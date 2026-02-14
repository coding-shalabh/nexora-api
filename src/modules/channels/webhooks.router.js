/**
 * Channel Webhooks Router
 * Handles incoming webhooks from channel providers (MSG91, Exotel, etc.)
 */

import { Router } from 'express';
import { channelsService } from './channels.service.js';
import { logger } from '../../common/logger.js';
import {
  broadcastNewMessage,
  broadcastConversationUpdate,
} from '../../common/websocket/socket.service.js';
import { assignmentService } from '../inbox/assignment.service.js';

const router = Router();

// Webhook signature verification middleware
const verifyWebhookSignature = (provider) => async (req, res, next) => {
  try {
    // In production, implement signature verification for each provider
    // For now, we'll accept all webhooks
    logger.debug({ provider, body: req.body }, 'Received webhook');
    next();
  } catch (error) {
    logger.error({ error, provider }, 'Webhook signature verification failed');
    res.status(401).json({ error: 'Invalid signature' });
  }
};

// =====================
// WhatsApp Webhooks (MSG91)
// =====================

/**
 * MSG91 WhatsApp webhook - single endpoint for all events
 * Configure this URL in MSG91: https://your-domain.com/api/v1/webhooks/msg91/whatsapp
 */
router.post('/msg91/whatsapp', async (req, res) => {
  try {
    logger.info(
      {
        webhook: 'msg91_whatsapp',
        body: req.body,
        query: req.query,
      },
      'MSG91 WhatsApp webhook received'
    );

    const payload = req.body;

    // MSG91 webhook payload structure:
    // - For incoming messages: { messages: [...], contacts: [...] }
    // - For status updates: { statuses: [...] }
    // - Phone number in the 'to' field for inbound, 'from' for status

    // Determine which channel account this belongs to
    // MSG91 sends the integrated_number in the webhook payload
    const integratedNumber =
      payload.integratedNumber ||
      payload.integrated_number ||
      payload.to ||
      payload.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;

    if (!integratedNumber) {
      logger.warn({ payload }, 'No integrated number found in webhook payload');
      return res.status(200).json({ status: 'ok', warning: 'No integrated number' });
    }

    // Find channel account by phone number
    const { prisma } = await import('@crm360/database');
    const channelAccount = await prisma.channelAccount.findFirst({
      where: {
        channelType: 'WHATSAPP',
        phoneNumber: integratedNumber.replace(/^\+/, ''), // Remove leading +
        status: 'ACTIVE',
      },
    });

    if (!channelAccount) {
      // Try without country code normalization
      const altAccount = await prisma.channelAccount.findFirst({
        where: {
          channelType: 'WHATSAPP',
          phoneNumber: { contains: integratedNumber.slice(-10) },
          status: 'ACTIVE',
        },
      });

      if (!altAccount) {
        logger.warn({ integratedNumber }, 'No channel account found for phone number');
        return res.status(200).json({ status: 'ok', warning: 'Channel account not found' });
      }

      // Process with found account
      await processMsg91Webhook(altAccount, payload, prisma, logger);
      return res.status(200).json({ status: 'ok', received: true });
    }

    // Process webhook
    await processMsg91Webhook(channelAccount, payload, prisma, logger);

    res.status(200).json({ status: 'ok', received: true });
  } catch (error) {
    logger.error(
      { error: error.message, stack: error.stack },
      'Error processing MSG91 WhatsApp webhook'
    );
    res.status(200).json({ status: 'error', message: error.message });
  }
});

/**
 * Process MSG91 webhook payload - creates conversations and messages
 * Handles MSG91's flat payload format:
 * { customerNumber, customerName, contentType, text, url, caption, uuid, ts, ... }
 */
async function processMsg91Webhook(channelAccount, payload, prisma, logger) {
  const tenantId = channelAccount.tenantId;

  // Check if this is a status update (delivery report)
  // MSG91 sends eventName with the actual status: "submitted", "sent", "delivered", "read", "failed"
  // direction: 1 = outbound, 0 = inbound
  const statusEvents = ['submitted', 'sent', 'delivered', 'read', 'failed'];
  const eventName = (payload.eventName || '').toLowerCase();
  const isOutbound = payload.direction === 1 || payload.direction === '1';
  // Treat as status update ONLY if it's outbound AND (has status event OR no text)
  // Inbound messages (direction=0) should always be processed as new messages
  const isStatusUpdate = isOutbound && (statusEvents.includes(eventName) || !payload.text);

  logger.info(
    {
      eventName,
      isOutbound,
      isStatusUpdate,
      hasText: !!payload.text,
      hasCustomerNumber: !!payload.customerNumber,
      direction: payload.direction,
    },
    'MSG91 webhook payload analysis'
  );

  if (isStatusUpdate) {
    const statuses = payload.statuses || [payload];
    for (const status of statuses) {
      // MSG91 sends various ID formats - try all possible fields
      // Priority: requestId/request_id (what we store), then uuid/id (Meta's ID)
      const possibleIds = [
        status.requestId,
        status.request_id,
        status.uuid,
        status.id,
        status.message_id,
        status.messageId,
      ].filter(Boolean);

      // MSG91 sends status in eventName field, fallback to status/reason fields
      const rawStatus = status.eventName || status.status || status.reason || '';
      const newStatus = rawStatus.toUpperCase();

      logger.info(
        {
          possibleIds,
          rawStatus,
          newStatus,
          statusPayload: status,
        },
        'Processing MSG91 status update'
      );

      // Try to find message by any of the possible IDs
      let message = null;
      for (const externalId of possibleIds) {
        if (!externalId) continue;

        // Try direct externalId match
        message = await prisma.conversationThread.findFirst({
          where: { externalId: externalId },
        });

        if (message) break;

        // Try with/without prefixes (some MSG91 responses add prefixes)
        const cleanId = externalId.replace(/^wamid\./, '');
        if (cleanId !== externalId) {
          message = await prisma.conversationThread.findFirst({
            where: { externalId: cleanId },
          });
          if (message) break;
        }

        // Try searching in metadata (MSG91 request_id)
        message = await prisma.conversationThread.findFirst({
          where: {
            metadata: {
              path: ['request_id'],
              equals: externalId,
            },
          },
        });
        if (message) break;
      }

      if (message) {
        // Map status - "submitted" means message was accepted by MSG91, treat as "sent"
        const mappedStatus =
          newStatus === 'READ'
            ? 'READ'
            : newStatus === 'DELIVERED'
              ? 'DELIVERED'
              : newStatus === 'FAILED'
                ? 'FAILED'
                : newStatus === 'SENT'
                  ? 'SENT'
                  : newStatus === 'SUBMITTED'
                    ? 'SENT'
                    : message.status;

        // Extract failure reason from MSG91 payload
        // MSG91 sends error details in various fields
        let failureReason = null;
        let failureCode = null;
        if (mappedStatus === 'FAILED') {
          failureReason =
            status.reason ||
            status.error ||
            status.error_message ||
            status.errorMessage ||
            status.failure_reason ||
            status.failureReason ||
            status.description ||
            status.message ||
            'Message delivery failed';
          failureCode = status.error_code || status.errorCode || status.code || null;

          // Check for specific WhatsApp Business API error codes
          // Error 131047 = Re-engagement message (24-hour window expired)
          // Error 131026 = Message undeliverable
          // Error 131051 = Unsupported message type
          if (
            failureCode === '131047' ||
            failureReason?.includes('Re-engagement') ||
            failureReason?.includes('24')
          ) {
            failureReason =
              '24-hour messaging window expired. Customer must message you first or use a template message.';
          } else if (failureCode === '131026') {
            failureReason =
              'Message could not be delivered. Customer may have blocked you or number is invalid.';
          } else if (failureCode === '131051') {
            failureReason = 'Unsupported message type for this conversation.';
          }

          logger.info(
            {
              messageId: message.id,
              failureReason,
              failureCode,
              rawReason: status.reason,
              rawError: status.error,
            },
            'Message failed with reason'
          );
        }

        // Only update if status is different (to avoid unnecessary updates)
        if (message.status !== mappedStatus) {
          await prisma.conversationThread.update({
            where: { id: message.id },
            data: {
              status: mappedStatus,
              deliveredAt:
                newStatus === 'DELIVERED' && !message.deliveredAt
                  ? new Date()
                  : message.deliveredAt,
              readAt: newStatus === 'READ' && !message.readAt ? new Date() : message.readAt,
              failedAt: mappedStatus === 'FAILED' ? new Date() : message.failedAt,
              failureReason: failureReason || message.failureReason,
              // failureCode stored in metadata if needed
            },
          });
          logger.info(
            {
              messageId: message.id,
              status: mappedStatus,
              previousStatus: message.status,
              failureReason,
            },
            'Message status updated'
          );

          // Broadcast status update via WebSocket for real-time UI updates
          try {
            const { broadcastMessageStatus } =
              await import('../../common/websocket/socket.service.js');
            const lowerStatus = mappedStatus.toLowerCase();
            logger.info(
              {
                messageId: message.id,
                threadId: message.threadId,
                status: lowerStatus,
                failureReason,
                tenantId,
              },
              'Broadcasting status update via WebSocket'
            );
            broadcastMessageStatus(
              tenantId,
              message.id,
              message.threadId,
              lowerStatus,
              failureReason
            );
          } catch (wsError) {
            logger.warn({ error: wsError.message }, 'Failed to broadcast status via WebSocket');
          }
        } else {
          logger.debug(
            { messageId: message.id, status: mappedStatus },
            'Status unchanged, skipping update'
          );
        }
      } else {
        logger.warn({ possibleIds, status: newStatus }, 'Message not found for status update');
      }
    }
    return;
  }

  // MSG91 flat payload format for inbound messages
  // Fields: customerNumber, customerName, contentType, text, url, caption, filename, uuid, ts, latitude, longitude
  const customerNumber = payload.customerNumber || payload.from;
  const customerName = payload.customerName || null;
  const msgContentType = (payload.contentType || 'text').toLowerCase();
  const msgUuid = payload.uuid || payload.requestId || `msg_${Date.now()}`;
  // MSG91 sends ts in ISO 8601 format (e.g., "2026-01-05T14:53:15+05:30")
  // For nested format, timestamp is UNIX seconds
  const msgTimestamp = payload.ts
    ? new Date(payload.ts) // ISO 8601 string
    : new Date();

  // ===== AI ASSISTANT ROUTING =====
  // Check if this WhatsApp number is linked to AI Assistant
  if (customerNumber) {
    const normalizedPhone = customerNumber.startsWith('+') ? customerNumber : `+${customerNumber}`;

    const aiLink = await prisma.whatsAppAILink.findFirst({
      where: {
        whatsappNumber: normalizedPhone,
        status: 'ACTIVE',
        isActive: true,
      },
      include: {
        user: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (aiLink) {
      // Route to AI Assistant service
      logger.info(
        { phone: normalizedPhone, userId: aiLink.userId, tenantId: aiLink.tenantId },
        'Routing message to AI Assistant'
      );

      try {
        const { AIAssistantService } = await import('../ai-assistant/ai-assistant.service.js');
        const aiService = new AIAssistantService();

        const messageText = payload.text || '';
        await aiService.processQuery({
          whatsappNumber: normalizedPhone,
          messageContent: messageText,
          externalId: msgUuid,
          user: aiLink.user,
          channelAccount,
        });

        logger.info({ phone: normalizedPhone }, 'AI Assistant processed successfully');
      } catch (aiError) {
        logger.error(
          { error: aiError.message, phone: normalizedPhone },
          'AI Assistant processing failed'
        );
        // Fallback: Continue with normal inbox processing if AI fails
      }

      return; // Exit early - do NOT create customer support conversation
    }

    // ===== UNLINKED USER - AI ASSISTANT CHATBOT =====
    // User is not linked but sent a message - handle with automated responses
    logger.info({ phone: normalizedPhone }, 'Unlinked user - routing to AI chatbot');

    try {
      const { LinkInitiationService } = await import('../ai-assistant/link-initiation.service.js');
      const linkService = new LinkInitiationService();

      const messageText = payload.text || '';
      await linkService.handleUnlinkedUser(normalizedPhone, messageText, channelAccount);

      logger.info({ phone: normalizedPhone }, 'AI chatbot response sent to unlinked user');
      return; // Exit early - automated response sent, no inbox conversation needed
    } catch (chatbotError) {
      logger.error(
        { error: chatbotError.message, phone: normalizedPhone },
        'AI chatbot failed - falling back to inbox'
      );
      // Fallback: Continue with normal inbox processing if chatbot fails
    }
  }
  // ===== END AI ASSISTANT ROUTING =====

  // If no customer number, try nested format (backward compatibility)
  if (!customerNumber && payload.messages) {
    const messages = payload.messages || [];
    const contacts = payload.contacts || [];

    for (const msg of messages) {
      const from = msg.from;
      const contactInfo = contacts.find((c) => c.wa_id === from);
      await processNestedMessage(channelAccount, msg, contactInfo?.profile?.name, prisma, logger);
    }
    return;
  }

  if (!customerNumber) {
    logger.warn({ payload }, 'No customer number found in payload');
    return;
  }

  // Normalize phone number
  const normalizedPhone = customerNumber.startsWith('+') ? customerNumber : `+${customerNumber}`;

  // Find or create contact
  let contact = await prisma.contact.findFirst({
    where: { tenantId, phone: normalizedPhone },
  });

  let isNewContact = false;
  if (!contact) {
    const nameParts = customerName ? customerName.split(' ') : [''];
    contact = await prisma.contact.create({
      data: {
        tenantId,
        phone: normalizedPhone,
        firstName: nameParts[0] || '',
        lastName: nameParts.slice(1).join(' ') || '',
        source: 'WHATSAPP',
        sourceDetails: {
          channelAccountId: channelAccount.id,
          channelAccountName: channelAccount.name,
          phoneNumber: channelAccount.phoneNumber,
          firstMessageAt: new Date().toISOString(),
          customerName: customerName || null,
        },
        status: 'ACTIVE',
        whatsappConsent: true, // Implicit consent from initiating conversation
        consentUpdatedAt: new Date(),
      },
    });
    isNewContact = true;
    logger.info({ contactId: contact.id, phone: normalizedPhone }, 'Contact created from WhatsApp');

    // Create activity for contact creation
    await prisma.activity.create({
      data: {
        tenantId,
        type: 'SYSTEM',
        subject: 'Contact created from WhatsApp',
        description: `Contact ${customerName || normalizedPhone} was automatically created from incoming WhatsApp message`,
        contactId: contact.id,
        metadata: {
          source: 'WHATSAPP',
          channelAccountId: channelAccount.id,
          channelAccountName: channelAccount.name,
          originalPhone: customerNumber,
          customerName: customerName || null,
        },
      },
    });
  }

  // Find or create Channel for this tenant's WhatsApp
  let channel = await prisma.channel.findFirst({
    where: { tenantId, type: 'WHATSAPP' },
  });

  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        tenantId,
        type: 'WHATSAPP',
        name: `WhatsApp - ${channelAccount.phoneNumber}`,
        phoneNumber: channelAccount.phoneNumber,
        provider: channelAccount.provider || 'msg91',
        status: 'ACTIVE',
        isActive: true,
      },
    });
    logger.info({ channelId: channel.id, tenantId }, 'Created WhatsApp channel for tenant');
  }

  // Find or create conversation thread
  let thread = await prisma.conversation.findFirst({
    where: {
      tenantId,
      contactPhone: normalizedPhone,
      channelType: 'WHATSAPP',
      status: { in: ['OPEN', 'PENDING'] },
    },
  });

  let isNewThread = false;
  if (!thread) {
    thread = await prisma.conversation.create({
      data: {
        tenantId,
        channelId: channel.id,
        channelType: 'WHATSAPP',
        contactId: contact.id,
        contactPhone: normalizedPhone,
        status: 'PENDING',
        lastCustomerMessageAt: new Date(),
        unreadCount: 1,
      },
    });
    isNewThread = true;
    logger.info({ threadId: thread.id, phone: normalizedPhone }, 'Conversation thread created');
  }

  // Helper to extract media URL from various payload structures
  const extractMediaUrlFromPayload = (type, data) => {
    // Try common URL field locations
    const urlFields = [
      data.url,
      data.link,
      data.media_url,
      data.mediaUrl,
      // Type-specific nested objects
      data[type]?.link,
      data[type]?.url,
      data[type]?.media_url,
      data[type]?.mediaUrl,
      // MSG91 specific flat fields
      data.image_url,
      data.document_url,
      data.video_url,
      data.audio_url,
      data.sticker_url,
      // WhatsApp API format
      data.document?.link,
      data.document?.url,
      data.image?.link,
      data.image?.url,
      data.video?.link,
      data.video?.url,
      data.audio?.link,
      data.audio?.url,
      // Additional fallbacks
      data.file?.url,
      data.file?.link,
      data.attachment?.url,
      data.attachment?.link,
    ];
    const foundUrl = urlFields.find((url) => url && typeof url === 'string') || null;
    logger.debug({ type, foundUrl, availableKeys: Object.keys(data) }, 'Extracting media URL');
    return foundUrl;
  };

  // Get filename for documents
  const extractFilename = (data) => {
    return data.filename || data.document?.filename || data.file_name || data.name || null;
  };

  // Get MIME type if available
  const extractMimeType = (data, type) => {
    return data.mime_type || data.mimeType || data[type]?.mime_type || data[type]?.mimeType || null;
  };

  // Extract message content from MSG91 flat payload
  let textContent = '';
  let mediaUrl = extractMediaUrlFromPayload(msgContentType, payload);
  let mediaType = null;
  let mimeType = extractMimeType(payload, msgContentType);
  let dbContentType = 'TEXT';
  let mediaFilename = null;

  switch (msgContentType) {
    case 'text':
      textContent = payload.text || '';
      dbContentType = 'TEXT';
      break;
    case 'image':
      textContent = payload.caption || '';
      mediaType = 'image';
      dbContentType = 'IMAGE';
      break;
    case 'video':
      textContent = payload.caption || '';
      mediaType = 'video';
      dbContentType = 'VIDEO';
      break;
    case 'audio':
    case 'voice':
    case 'ptt': // Push-to-talk voice messages
      textContent = '';
      mediaType = 'audio';
      dbContentType = 'AUDIO';
      break;
    case 'document':
      mediaFilename = extractFilename(payload);
      textContent = mediaFilename || '';
      mediaType = 'document';
      dbContentType = 'DOCUMENT';
      break;
    case 'sticker':
      textContent = '';
      mediaType = 'sticker';
      dbContentType = 'STICKER';
      break;
    case 'location':
      textContent = `📍 Location: ${payload.latitude}, ${payload.longitude}`;
      if (payload.name) textContent += `\n${payload.name}`;
      if (payload.address) textContent += `\n${payload.address}`;
      dbContentType = 'LOCATION';
      break;
    case 'contacts':
      textContent = '[Contact shared]';
      dbContentType = 'CONTACT';
      break;
    case 'interactive':
      textContent = payload.button || payload.interactive || '[Interactive]';
      dbContentType = 'INTERACTIVE';
      break;
    case 'reaction':
      textContent = `Reacted: ${payload.reaction}`;
      dbContentType = 'TEXT';
      break;
    case 'order':
      textContent = '[Order]';
      dbContentType = 'ORDER';
      break;
    default:
      textContent = payload.text || '';
      dbContentType = 'TEXT';
  }

  // Create message in conversation thread
  const messageRecord = await prisma.conversationThread.create({
    data: {
      tenantId,
      conversationId: thread.id,
      channelAccountId: channelAccount.id,
      channel: 'WHATSAPP',
      direction: 'INBOUND',
      externalId: msgUuid,
      contentType: dbContentType.toLowerCase(),
      textContent,
      content: textContent,
      // status uses default OPEN from schema - not message delivery status
      sentAt: msgTimestamp,
      deliveredAt: new Date(),
      metadata: {
        customerName,
        contentType: msgContentType,
        mimeType,
        filename: mediaFilename,
        mediaUrl,
        mediaType,
        raw: payload,
      },
    },
  });

  // Update conversation
  await prisma.conversation.update({
    where: { id: thread.id },
    data: {
      lastCustomerMessageAt: new Date(),
      unreadCount: { increment: 1 },
      status: 'PENDING',
    },
  });

  logger.info(
    {
      messageId: messageRecord.id,
      threadId: thread.id,
      from: normalizedPhone,
      content: textContent.substring(0, 50),
    },
    'WhatsApp message received and stored'
  );

  // Auto-assign conversation if it's a new thread
  if (isNewThread) {
    try {
      const assignmentResult = await assignmentService.autoAssignConversation(tenantId, thread.id, {
        channel: 'WHATSAPP',
        content: textContent,
        priority: 'MEDIUM',
      });

      if (assignmentResult) {
        logger.info(
          {
            threadId: thread.id,
            assignedTo: assignmentResult.assignedToId,
            rule: assignmentResult.ruleName,
          },
          'Conversation auto-assigned'
        );
      }
    } catch (assignError) {
      logger.warn({ error: assignError.message, threadId: thread.id }, 'Auto-assignment failed');
    }
  }

  // Broadcast message via WebSocket for real-time updates
  try {
    broadcastNewMessage({
      id: messageEvent.id,
      tenantId,
      threadId: thread.id,
      direction: 'inbound',
      type: msgContentType,
      content: textContent,
      status: 'delivered',
      sentAt: msgTimestamp,
      channel: 'whatsapp',
    });
  } catch (wsError) {
    logger.warn({ error: wsError.message }, 'Failed to broadcast message via WebSocket');
  }
}

/**
 * Process nested message format (backward compatibility)
 */
async function processNestedMessage(channelAccount, msg, contactName, prisma, logger) {
  const tenantId = channelAccount.tenantId;
  const from = msg.from;
  const normalizedPhone = from.startsWith('+') ? from : `+${from}`;

  // Find or create Channel for this tenant's WhatsApp
  let channel = await prisma.channel.findFirst({
    where: { tenantId, type: 'WHATSAPP' },
  });

  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        tenantId,
        type: 'WHATSAPP',
        name: `WhatsApp - ${channelAccount.phoneNumber}`,
        phoneNumber: channelAccount.phoneNumber,
        provider: channelAccount.provider || 'msg91',
        status: 'ACTIVE',
        isActive: true,
      },
    });
    logger.info({ channelId: channel.id, tenantId }, 'Created WhatsApp channel for tenant');
  }

  let contact = await prisma.contact.findFirst({
    where: { tenantId, phone: normalizedPhone },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        tenantId,
        phone: normalizedPhone,
        firstName: contactName?.split(' ')[0] || '',
        lastName: contactName?.split(' ').slice(1).join(' ') || '',
        source: 'WHATSAPP',
        sourceDetails: {
          channelAccountId: channelAccount.id,
          channelAccountName: channelAccount.name,
          phoneNumber: channelAccount.phoneNumber,
          firstMessageAt: new Date().toISOString(),
          customerName: contactName || null,
        },
        status: 'ACTIVE',
        whatsappConsent: true,
        consentUpdatedAt: new Date(),
      },
    });

    // Create activity for contact creation
    await prisma.activity.create({
      data: {
        tenantId,
        type: 'SYSTEM',
        subject: 'Contact created from WhatsApp',
        description: `Contact ${contactName || normalizedPhone} was automatically created from incoming WhatsApp message`,
        contactId: contact.id,
        metadata: {
          source: 'WHATSAPP',
          channelAccountId: channelAccount.id,
        },
      },
    });
  }

  let thread = await prisma.conversation.findFirst({
    where: {
      tenantId,
      contactPhone: normalizedPhone,
      channelType: 'WHATSAPP',
      status: { in: ['OPEN', 'PENDING'] },
    },
  });

  if (!thread) {
    thread = await prisma.conversation.create({
      data: {
        tenantId,
        channelId: channel.id,
        channelType: 'WHATSAPP',
        contactId: contact.id,
        contactPhone: normalizedPhone,
        status: 'PENDING',
        lastCustomerMessageAt: new Date(),
        unreadCount: 1,
      },
    });
  }

  const msgType = (msg.type || 'text').toLowerCase();
  let textContent = '';
  let mediaUrl = null;
  let dbContentType = 'TEXT';

  if (msgType === 'text') textContent = msg.text?.body || '';
  else if (msgType === 'image') {
    textContent = msg.image?.caption || '[Image]';
    mediaUrl = msg.image?.url;
    dbContentType = 'IMAGE';
  } else if (msgType === 'video') {
    textContent = msg.video?.caption || '[Video]';
    mediaUrl = msg.video?.url;
    dbContentType = 'VIDEO';
  } else if (msgType === 'audio') {
    textContent = '[Audio]';
    mediaUrl = msg.audio?.url;
    dbContentType = 'AUDIO';
  } else if (msgType === 'document') {
    textContent = msg.document?.filename || '[Doc]';
    mediaUrl = msg.document?.url;
    dbContentType = 'DOCUMENT';
  } else if (msgType === 'location') {
    textContent = `📍 ${msg.location?.latitude}, ${msg.location?.longitude}`;
    dbContentType = 'LOCATION';
  } else textContent = `[${msgType}]`;

  await prisma.conversationThread.create({
    data: {
      tenantId,
      conversationId: thread.id,
      channelAccountId: channelAccount.id,
      channel: 'WHATSAPP',
      direction: 'INBOUND',
      externalId: msg.id,
      contentType: dbContentType.toLowerCase(),
      textContent,
      content: textContent,
      // status uses default OPEN from schema
      sentAt: msg.timestamp ? new Date(parseInt(msg.timestamp) * 1000) : new Date(),
      deliveredAt: new Date(),
      metadata: { contactName, mediaUrl, raw: msg },
    },
  });

  await prisma.conversation.update({
    where: { id: thread.id },
    data: { lastCustomerMessageAt: new Date(), unreadCount: { increment: 1 }, status: 'PENDING' },
  });

  logger.info(
    { threadId: thread.id, from: normalizedPhone },
    'WhatsApp message stored (nested format)'
  );
}

/**
 * MSG91 WhatsApp webhook - GET for verification
 */
router.get('/msg91/whatsapp', (req, res) => {
  console.log('MSG91 Webhook Verification:', req.query);
  // Return challenge if provided
  if (req.query['hub.challenge']) {
    return res.send(req.query['hub.challenge']);
  }
  res.json({ status: 'Webhook endpoint active' });
});

/**
 * WhatsApp message webhook (legacy per-channel)
 */
router.post(
  '/whatsapp/:channelAccountId/message',
  verifyWebhookSignature('msg91'),
  async (req, res, next) => {
    try {
      const { channelAccountId } = req.params;

      await channelsService.processInboundWebhook(channelAccountId, req.body);

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error({ error }, 'Error processing WhatsApp message webhook');
      // Always return 200 to prevent provider retries on our errors
      res.status(200).json({ status: 'error', message: error.message });
    }
  }
);

/**
 * WhatsApp status webhook
 */
router.post(
  '/whatsapp/:channelAccountId/status',
  verifyWebhookSignature('msg91'),
  async (req, res, next) => {
    try {
      const { channelAccountId } = req.params;

      await channelsService.processStatusWebhook(channelAccountId, req.body);

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error({ error }, 'Error processing WhatsApp status webhook');
      res.status(200).json({ status: 'error', message: error.message });
    }
  }
);

// =====================
// SMS Webhooks (MSG91)
// =====================

/**
 * SMS inbound webhook
 */
router.post(
  '/sms/:channelAccountId/inbound',
  verifyWebhookSignature('msg91'),
  async (req, res, next) => {
    try {
      const { channelAccountId } = req.params;

      await channelsService.processInboundWebhook(channelAccountId, req.body);

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error({ error }, 'Error processing SMS inbound webhook');
      res.status(200).json({ status: 'error', message: error.message });
    }
  }
);

/**
 * SMS delivery report webhook
 */
router.post(
  '/sms/:channelAccountId/dlr',
  verifyWebhookSignature('msg91'),
  async (req, res, next) => {
    try {
      const { channelAccountId } = req.params;

      await channelsService.processStatusWebhook(channelAccountId, req.body);

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error({ error }, 'Error processing SMS DLR webhook');
      res.status(200).json({ status: 'error', message: error.message });
    }
  }
);

// =====================
// Voice Webhooks (Exotel)
// =====================

/**
 * Voice call connect webhook (outbound calls)
 */
router.post(
  '/voice/:channelAccountId/connect',
  verifyWebhookSignature('exotel'),
  async (req, res, next) => {
    try {
      const { channelAccountId } = req.params;

      // Return TwiML-like response for call flow
      const customField = req.body.CustomField ? JSON.parse(req.body.CustomField) : {};

      if (customField.type === 'voice_message') {
        // Play TTS or audio message
        if (customField.audioUrl) {
          res.type('text/xml').send(`
            <Response>
              <Play>${customField.audioUrl}</Play>
            </Response>
          `);
        } else if (customField.ttsText) {
          res.type('text/xml').send(`
            <Response>
              <Say>${customField.ttsText}</Say>
            </Response>
          `);
        } else {
          res.type('text/xml').send('<Response><Hangup/></Response>');
        }
      } else {
        // Default: connect to agent
        res.type('text/xml').send(`
          <Response>
            <Dial callerId="${req.body.CallerId}">
              <Number>${req.body.To}</Number>
            </Dial>
          </Response>
        `);
      }
    } catch (error) {
      logger.error({ error }, 'Error processing voice connect webhook');
      res.type('text/xml').send('<Response><Hangup/></Response>');
    }
  }
);

/**
 * Voice call status webhook
 */
router.post(
  '/voice/:channelAccountId/status',
  verifyWebhookSignature('exotel'),
  async (req, res, next) => {
    try {
      const { channelAccountId } = req.params;

      await channelsService.processVoiceStatusWebhook(channelAccountId, req.body);

      res.status(200).json({ status: 'ok' });
    } catch (error) {
      logger.error({ error }, 'Error processing voice status webhook');
      res.status(200).json({ status: 'error', message: error.message });
    }
  }
);

/**
 * Voice incoming call webhook
 */
router.post(
  '/voice/:channelAccountId/incoming',
  verifyWebhookSignature('exotel'),
  async (req, res, next) => {
    try {
      const { channelAccountId } = req.params;

      // Process incoming call
      await channelsService.processIncomingCall(channelAccountId, req.body);

      // Return IVR response or connect to agent
      res.type('text/xml').send(`
        <Response>
          <Say>Thank you for calling. Please hold while we connect you to an agent.</Say>
          <Dial callerId="${req.body.From}">
            <User>agent</User>
          </Dial>
        </Response>
      `);
    } catch (error) {
      logger.error({ error }, 'Error processing incoming call webhook');
      res.type('text/xml').send(`
        <Response>
          <Say>We're sorry, we are unable to connect your call at this time. Please try again later.</Say>
          <Hangup/>
        </Response>
      `);
    }
  }
);

// =====================
// Email Webhooks
// =====================

/**
 * Email webhook (for email tracking pixels, bounces, etc.)
 */
router.post('/email/:channelAccountId/events', async (req, res, next) => {
  try {
    const { channelAccountId } = req.params;

    // Process email events (opens, clicks, bounces, etc.)
    await channelsService.processEmailEvents(channelAccountId, req.body);

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error({ error }, 'Error processing email events webhook');
    res.status(200).json({ status: 'error', message: error.message });
  }
});

/**
 * Google Gmail push notification webhook
 */
router.post('/email/:channelAccountId/gmail/push', async (req, res, next) => {
  try {
    const { channelAccountId } = req.params;

    // Gmail push notifications for new messages
    await channelsService.processGmailPush(channelAccountId, req.body);

    res.status(200).send();
  } catch (error) {
    logger.error({ error }, 'Error processing Gmail push notification');
    res.status(200).send();
  }
});

/**
 * Microsoft Graph notification webhook
 */
router.post('/email/:channelAccountId/microsoft/notifications', async (req, res, next) => {
  try {
    const { channelAccountId } = req.params;

    // Handle validation request
    if (req.query.validationToken) {
      return res.status(200).send(req.query.validationToken);
    }

    // Process notifications
    await channelsService.processMicrosoftNotifications(channelAccountId, req.body);

    res.status(202).send();
  } catch (error) {
    logger.error({ error }, 'Error processing Microsoft notification');
    res.status(202).send();
  }
});

// =====================
// Opt-out Webhooks
// =====================

/**
 * Handle opt-out requests (STOP messages, unsubscribe links)
 */
router.post('/opt-out/:channelAccountId', async (req, res, next) => {
  try {
    const { channelAccountId } = req.params;
    const { identifier, channelType, source } = req.body;

    await channelsService.recordOptOut(channelAccountId, {
      identifier,
      channelType,
      source,
    });

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error({ error }, 'Error processing opt-out webhook');
    res.status(200).json({ status: 'error' });
  }
});

export default router;
