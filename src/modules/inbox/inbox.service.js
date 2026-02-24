import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import { logger } from '../../common/logger.js';
import { whatsAppService } from '../../common/providers/whatsapp/whatsapp.service.js';
import {
  broadcastNewMessage,
  broadcastMessageStatus,
} from '../../common/websocket/socket.service.js';

class InboxService {
  // Map channel account type to display type
  getChannelDisplayType(channelType) {
    const mapping = {
      WHATSAPP: 'whatsapp',
      SMS: 'sms',
      EMAIL: 'email',
      EMAIL_GMAIL: 'email',
      EMAIL_MICROSOFT: 'email',
      EMAIL_SMTP: 'email',
      VOICE: 'voice',
    };
    return mapping[channelType] || (channelType ? channelType.toLowerCase() : 'unknown');
  }

  async getConversations(tenantId, filters = {}) {
    const where = {
      tenantId,
      // Filter only messaging channels (not VOICE) through channel relation
      channel: { type: { in: ['WHATSAPP', 'SMS', 'EMAIL'] } },
    };

    // ========== STATUS FILTERS ==========
    if (filters.status) {
      // Support multiple statuses: "OPEN,PENDING" or single "OPEN"
      if (filters.status.includes(',')) {
        where.status = { in: filters.status.split(',') };
      } else {
        where.status = filters.status;
      }
    }

    // Filter by bucket (shorthand for common status combinations)
    if (filters.bucket) {
      switch (filters.bucket) {
        case 'all':
          where.status = { in: ['OPEN', 'PENDING'] };
          break;
        case 'unread':
          where.unreadCount = { gt: 0 };
          where.status = { in: ['OPEN', 'PENDING'] };
          break;
        case 'starred':
          where.isStarred = true;
          break;
        case 'snoozed':
          // SNOOZED is not a valid status — snoozed conversations use PENDING
          where.status = 'PENDING';
          break;
        case 'resolved':
          where.status = 'RESOLVED';
          break;
        case 'closed':
          where.status = 'CLOSED';
          break;
        case 'archived':
          where.status = { in: ['RESOLVED', 'CLOSED'] };
          break;
        case 'pending':
          where.status = 'PENDING';
          break;
        case 'open':
          where.status = 'OPEN';
          break;
      }
    }

    // Unassigned conversations
    if (filters.unassigned === 'true' || filters.unassigned === true) {
      where.assignedToId = null;
      if (!where.status) {
        where.status = { in: ['OPEN', 'PENDING'] };
      }
    }

    // ========== PRIORITY FILTER ==========
    // Note: priority field is on ConversationThread, not Conversation
    // Priority filter not supported for Conversation model

    // ========== STARRED FILTER ==========
    if (filters.starred === 'true' || filters.starred === true) {
      where.isStarred = true;
    }

    // ========== CHANNEL TYPE FILTER ==========
    // Fixed: Use channel relation instead of non-existent channelType field (2026-01-14)
    // Fixed: Handle VOICE channelType specially - voice calls are in CallSession model (2026-01-17)
    if (filters.channelType) {
      const channelTypeLower = filters.channelType.toLowerCase();

      // Voice is handled separately in CallSession model, not Conversation
      // Return empty results for voice channel type
      if (channelTypeLower === 'voice') {
        where.id = 'NONE'; // Will return no results - voice uses /inbox/voice page
      } else {
        // Map display types to ChannelType enum values
        const typeMap = {
          whatsapp: 'WHATSAPP',
          sms: 'SMS',
          email: 'EMAIL',
        };
        const mappedType = typeMap[channelTypeLower] || filters.channelType;
        where.channel = { type: mappedType };
      }
    }

    // Filter by specific channel account (e.g., specific WhatsApp number)
    // ChannelAccount and Channel are separate models; Conversation.channelId → Channel.id
    // Look up the ChannelAccount's type, then find the matching Channel to filter by channelId
    if (filters.channelAccountId) {
      const ca = await prisma.channelAccount.findUnique({
        where: { id: filters.channelAccountId },
        select: { type: true },
      });
      if (ca) {
        const caToChannelType = {
          WHATSAPP: 'WHATSAPP',
          SMS: 'SMS',
          EMAIL_SMTP: 'EMAIL',
          EMAIL_GMAIL: 'EMAIL',
          EMAIL_MICROSOFT: 'EMAIL',
          VOICE: 'VOICE',
        };
        const channelType = caToChannelType[ca.type] || ca.type;
        // Find the Channel record matching this type for the tenant
        const channel = await prisma.channel.findFirst({
          where: { tenantId, type: channelType },
          select: { id: true },
        });
        if (channel) {
          where.channelId = channel.id;
          // Override the channel relation filter to match specifically
          where.channel = { type: channelType };
        }
      }
    }

    // ========== ASSIGNMENT FILTERS ==========
    if (filters.assignedTo) {
      where.assignedToId = filters.assignedTo;
      // Default to active conversations if no status filter
      if (!where.status) {
        where.status = { in: ['OPEN', 'PENDING'] };
      }
    }

    // ========== DATE RANGE FILTERS ==========
    if (filters.dateFrom || filters.dateTo) {
      where.updatedAt = {};
      if (filters.dateFrom) {
        where.updatedAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.updatedAt.lte = new Date(filters.dateTo);
      }
    }

    // ========== SEARCH ==========
    if (filters.search) {
      where.OR = [
        { contactName: { contains: filters.search, mode: 'insensitive' } },
        { contactPhone: { contains: filters.search } },
        { lastMessagePreview: { contains: filters.search, mode: 'insensitive' } },
        { contact: { firstName: { contains: filters.search, mode: 'insensitive' } } },
        { contact: { lastName: { contains: filters.search, mode: 'insensitive' } } },
        { contact: { phone: { contains: filters.search } } },
        { contact: { email: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 25;

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              phone: true,
              email: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.conversation.count({ where }),
    ]);

    // Get channel types separately to avoid enum serialization issues
    const channelIds = [
      ...new Set(conversations.filter((c) => c.channelId).map((c) => c.channelId)),
    ];
    const channels =
      channelIds.length > 0
        ? await prisma.channel.findMany({
            where: { id: { in: channelIds } },
            select: { id: true, type: true },
          })
        : [];
    const channelMap = new Map(channels.map((ch) => [ch.id, ch.type]));

    // Batch-fetch purpose from ConversationThread (same IDs as Conversation)
    const convIds = conversations.map((c) => c.id);
    const threads =
      convIds.length > 0
        ? await prisma.conversationThread.findMany({
            where: { id: { in: convIds }, tenantId },
            select: { id: true, purpose: true },
          })
        : [];
    const purposeMap = new Map(threads.map((t) => [t.id, t.purpose]));

    // Transform to expected format
    const transformedConversations = conversations.map((conv) => {
      const channelType = conv.channelId ? channelMap.get(conv.channelId) : null;
      const isEmail = ['EMAIL_GMAIL', 'EMAIL_MICROSOFT', 'EMAIL_SMTP'].includes(channelType);

      return {
        id: conv.id,
        contactId: conv.contactId,
        contactName:
          conv.contact?.displayName ||
          `${conv.contact?.firstName || ''} ${conv.contact?.lastName || ''}`.trim() ||
          conv.contactPhone ||
          'Unknown',
        contactPhone: conv.contactPhone || conv.contact?.phone,
        contactEmail: conv.contactEmail || conv.contact?.email,
        contactAvatar: null, // Contact model doesn't have avatar
        lastMessage: conv.lastMessagePreview,
        lastMessageAt: conv.lastCustomerMessageAt || conv.updatedAt,
        unreadCount: conv.unreadCount || 0,
        status: conv.status?.toLowerCase() || 'open',
        channelType: this.getChannelDisplayType(channelType),
        assignedToId: conv.assignedToId,
        priority: conv.priority?.toLowerCase() || 'medium',
        messageCount: conv.messageCount || 0,
        isStarred: conv.isStarred || false,
        purpose: purposeMap.get(conv.id) || 'GENERAL',
        // Email specific fields
        subject: isEmail ? conv.subject || null : null,
      };
    });

    return {
      conversations: transformedConversations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getConversation(tenantId, conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        contact: true,
        channel: {
          select: { type: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const channelType = conversation.channel?.type;

    return {
      id: conversation.id,
      contactId: conversation.contactId,
      contactName:
        conversation.contact?.displayName ||
        `${conversation.contact?.firstName || ''} ${conversation.contact?.lastName || ''}`.trim(),
      contactPhone: conversation.contactPhone || conversation.contact?.phone,
      contactEmail: conversation.contactEmail || conversation.contact?.email,
      status: conversation.status?.toLowerCase() || 'open',
      channelType: this.getChannelDisplayType(channelType),
      assignedToId: conversation.assignedToId,
      priority: conversation.priority?.toLowerCase() || 'medium',
      unreadCount: conversation.unreadCount,
      messageCount: await prisma.message_events.count({ where: { threadId: conversationId } }),
      lastMessageAt: conversation.lastCustomerMessageAt || conversation.updatedAt,
      createdAt: conversation.createdAt,
      contact: conversation.contact,
    };
  }

  async getMessages(tenantId, conversationId, params = {}) {
    // Verify conversation exists and belongs to tenant
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const limit = params.limit || 50;

    // Query message_events by threadId (the conversationId is actually the thread ID)
    const messages = await prisma.message_events.findMany({
      where: {
        tenantId,
        threadId: conversationId,
      },
      orderBy: { sentAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = messages.length > limit;
    if (hasMore) messages.pop();

    // Transform messages to expected format
    const transformedMessages = messages.reverse().map((msg) => ({
      id: msg.id,
      conversationId: conversationId,
      direction: msg.direction?.toLowerCase() || 'inbound',
      type: msg.contentType?.toLowerCase() || 'text',
      content: msg.textContent || msg.htmlContent || '',
      subject: msg.subject,
      channel: this.getChannelDisplayType(msg.channel),
      status: msg.failedAt
        ? 'failed'
        : msg.readAt
          ? 'read'
          : msg.deliveredAt
            ? 'delivered'
            : msg.sentAt
              ? 'sent'
              : 'pending',
      sentAt: msg.sentAt,
      deliveredAt: msg.deliveredAt,
      readAt: msg.readAt,
      metadata: {},
    }));

    return {
      messages: transformedMessages,
      hasMore,
      cursor: hasMore ? messages[messages.length - 1]?.id : undefined,
    };
  }

  async sendMessage(tenantId, userId, conversationId, data) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        channel: {
          select: { type: true },
        },
        contact: {
          select: { phone: true, email: true },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const convChannelType = conversation.channel?.type;

    // Map Channel.type (ChannelType enum) to ChannelAccount.type (ChannelAccountType enum)
    // ChannelType has EMAIL but ChannelAccountType has EMAIL_GMAIL, EMAIL_MICROSOFT, EMAIL_SMTP
    const accountTypeFilter =
      convChannelType === 'EMAIL'
        ? { in: ['EMAIL_GMAIL', 'EMAIL_MICROSOFT', 'EMAIL_SMTP'] }
        : convChannelType;

    // Get a channel account for this channel type
    const channelAccount = await prisma.channelAccount.findFirst({
      where: {
        tenantId,
        type: accountTypeFilter,
        status: 'ACTIVE',
      },
    });

    if (!channelAccount) {
      throw new Error('No active channel available');
    }

    // Get user's default signature for this channel
    let messageContent = data.content;
    const channelType =
      convChannelType === 'WHATSAPP'
        ? 'WHATSAPP'
        : convChannelType?.startsWith('EMAIL')
          ? 'EMAIL'
          : 'ALL';

    const signature = await prisma.signature.findFirst({
      where: {
        tenantId,
        userId,
        isDefault: true,
        isActive: true,
        channel: { in: [channelType, 'ALL'] },
      },
      orderBy: [
        { channel: 'asc' }, // Prefer channel-specific over ALL
      ],
    });

    // Append signature if found and not already included
    if (signature && signature.content && !messageContent.includes(signature.content)) {
      messageContent = `${messageContent}\n\n${signature.content}`;
    }

    // Create message record in message_events (unified message store)
    // Use channelAccount.type (ChannelAccountType enum) not convChannelType (ChannelType enum)
    // because message_events.channel expects ChannelAccountType (e.g. EMAIL_SMTP not EMAIL)
    const message = await prisma.message_events.create({
      data: {
        tenantId,
        threadId: conversationId, // ConversationThread shares ID with Conversation
        channelAccountId: channelAccount.id,
        channel: channelAccount.type,
        direction: 'OUTBOUND',
        contentType: (data.type || 'TEXT').toUpperCase(),
        textContent: messageContent,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    // Update conversation - use updatedAt and lastCustomerMessageAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'OPEN',
        // Note: updatedAt is automatically set by Prisma
      },
    });

    // Channel-aware recipient validation and sending
    const isEmailChannel = ['EMAIL', 'EMAIL_GMAIL', 'EMAIL_MICROSOFT', 'EMAIL_SMTP'].includes(
      convChannelType
    );

    if (convChannelType === 'WHATSAPP') {
      // Validate phone for WhatsApp
      const recipientPhone = conversation.contactPhone || conversation.contact?.phone;

      if (!recipientPhone) {
        logger.error({ conversationId }, 'No recipient phone number found');
        await prisma.message_events.update({
          where: { id: message.id },
          data: {
            failedAt: new Date(),
            failureReason: 'No recipient phone number',
            status: 'FAILED',
            metadata: { error: 'No recipient phone number' },
          },
        });
        throw new Error('No recipient phone number found');
      }

      // Send via MSG91 WhatsApp
      try {
        logger.info(
          {
            channelAccountId: channelAccount.id,
            recipient: recipientPhone,
            content: messageContent.substring(0, 50),
            hasSignature: !!signature,
          },
          'Sending WhatsApp message via MSG91'
        );

        const sendResult = await whatsAppService.sendText({
          channelAccountId: channelAccount.id,
          recipient: recipientPhone,
          text: messageContent,
        });

        if (sendResult.success) {
          // Update message with provider message ID for status tracking
          await prisma.message_events.update({
            where: { id: message.id },
            data: {
              providerMessageId: sendResult.messageId,
              metadata: { request_id: sendResult.messageId }, // Store for fallback matching
            },
          });
          logger.info(
            { messageId: message.id, providerMessageId: sendResult.messageId },
            'WhatsApp message sent successfully'
          );

          // Broadcast status update immediately for faster UI response
          try {
            broadcastMessageStatus(tenantId, message.id, conversationId, 'sent');
          } catch (wsError) {
            logger.warn({ error: wsError.message }, 'Failed to broadcast sent status');
          }
        } else {
          await prisma.message_events.update({
            where: { id: message.id },
            data: {
              failedAt: new Date(),
              failureReason: sendResult.error || 'Failed to send message',
              status: 'FAILED',
              metadata: { error: sendResult.error || 'Failed to send message' },
            },
          });
          logger.error(
            { messageId: message.id, error: sendResult.error },
            'Failed to send WhatsApp message'
          );

          // Broadcast failed status
          try {
            broadcastMessageStatus(tenantId, message.id, conversationId, 'failed');
          } catch (wsError) {
            logger.warn({ error: wsError.message }, 'Failed to broadcast failed status');
          }
        }
      } catch (error) {
        logger.error(
          { error: error.message, messageId: message.id },
          'Error sending WhatsApp message'
        );
        await prisma.message_events.update({
          where: { id: message.id },
          data: {
            failedAt: new Date(),
            failureReason: error.message,
            status: 'FAILED',
            metadata: { error: error.message },
          },
        });

        // Broadcast failed status
        try {
          broadcastMessageStatus(tenantId, message.id, conversationId, 'failed');
        } catch (wsError) {
          logger.warn({ error: wsError.message }, 'Failed to broadcast failed status');
        }
      }
    } else if (isEmailChannel) {
      // Validate email for email channels
      const recipientEmail = conversation.contact?.email;

      if (!recipientEmail) {
        logger.error({ conversationId }, 'No recipient email address found');
        await prisma.message_events.update({
          where: { id: message.id },
          data: {
            failedAt: new Date(),
            failureReason: 'No recipient email address',
            status: 'FAILED',
            metadata: { error: 'No recipient email address' },
          },
        });
        throw new Error('No recipient email address found');
      }

      // Email message recorded — delivery handled by connected email accounts
      logger.info(
        { conversationId, recipientEmail, messageId: message.id },
        'Email message recorded in conversation'
      );

      try {
        broadcastMessageStatus(tenantId, message.id, conversationId, 'sent');
      } catch (wsError) {
        logger.warn({ error: wsError.message }, 'Failed to broadcast sent status');
      }
    } else if (convChannelType === 'SMS') {
      // Validate phone for SMS
      const recipientPhone = conversation.contactPhone || conversation.contact?.phone;

      if (!recipientPhone) {
        logger.error({ conversationId }, 'No recipient phone number found');
        await prisma.message_events.update({
          where: { id: message.id },
          data: {
            failedAt: new Date(),
            failureReason: 'No recipient phone number',
            status: 'FAILED',
            metadata: { error: 'No recipient phone number' },
          },
        });
        throw new Error('No recipient phone number found');
      }

      // SMS message recorded — delivery handled by connected SMS provider
      logger.info(
        { conversationId, recipientPhone, messageId: message.id },
        'SMS message recorded in conversation'
      );

      try {
        broadcastMessageStatus(tenantId, message.id, conversationId, 'sent');
      } catch (wsError) {
        logger.warn({ error: wsError.message }, 'Failed to broadcast sent status');
      }
    } else {
      // Other channels (VOICE, etc.) — message recorded
      logger.info(
        { conversationId, channelType: convChannelType, messageId: message.id },
        'Message recorded for channel'
      );

      try {
        broadcastMessageStatus(tenantId, message.id, conversationId, 'sent');
      } catch (wsError) {
        logger.warn({ error: wsError.message }, 'Failed to broadcast sent status');
      }
    }

    // Fetch updated message
    const updatedMessage = await prisma.message_events.findUnique({
      where: { id: message.id },
    });

    // Derive status from date fields
    const derivedStatus = updatedMessage?.failedAt
      ? 'failed'
      : updatedMessage?.readAt
        ? 'read'
        : updatedMessage?.deliveredAt
          ? 'delivered'
          : updatedMessage?.sentAt
            ? 'sent'
            : 'pending';

    logger.info(
      {
        messageId: message.id,
        conversationId,
        status: derivedStatus,
        textContent: updatedMessage?.textContent,
        originalContent: data.content,
      },
      'Message send completed'
    );

    // Use original content if updatedMessage.textContent is missing
    const finalMessageContent = updatedMessage?.textContent || data.content;

    const responseMessage = {
      id: message.id,
      conversationId: conversationId,
      direction: 'outbound',
      type: updatedMessage?.contentType?.toLowerCase() || 'text',
      content: finalMessageContent,
      status: derivedStatus,
      sentAt: message.sentAt,
      channel: this.getChannelDisplayType(convChannelType),
    };

    // Broadcast outbound message via WebSocket for real-time updates
    try {
      broadcastNewMessage({
        ...responseMessage,
        tenantId,
        threadId: conversationId,
      });
    } catch (wsError) {
      logger.warn({ error: wsError.message }, 'Failed to broadcast outbound message via WebSocket');
    }

    return responseMessage;
  }

  async createConversation(tenantId, data) {
    // Find or create a channel for this tenant + channelType
    let channel = await prisma.channel.findFirst({
      where: { tenantId, type: data.channelType, status: 'ACTIVE' },
    });

    if (!channel) {
      // Create a default channel for this type
      channel = await prisma.channel.create({
        data: {
          tenantId,
          type: data.channelType,
          name: `${data.channelType} Channel`,
          provider: data.channelType.toLowerCase(),
          status: 'ACTIVE',
        },
      });
    }

    const conversation = await prisma.conversation.create({
      data: {
        tenantId,
        channelId: channel.id,
        channelType: data.channelType,
        contactId: data.contactId || undefined,
        contactPhone: data.contactPhone || undefined,
        status: 'OPEN',
      },
      include: {
        contact: true,
        channel: true,
      },
    });

    // Create matching ConversationThread with same ID (message_events FK needs this)
    await prisma.conversationThread.create({
      data: {
        id: conversation.id,
        tenantId,
        contactId: data.contactId || undefined,
        contactPhone: data.contactPhone || undefined,
        status: 'OPEN',
        lastMessageChannel: data.channelType,
      },
    });

    // If an initial message was provided, create it as a message_events record
    if (data.initialMessage) {
      const channelAccount = await prisma.channelAccount.findFirst({
        where: { tenantId, type: data.channelType, status: 'ACTIVE' },
      });
      if (channelAccount) {
        await prisma.message_events.create({
          data: {
            tenantId,
            threadId: conversation.id,
            channelAccountId: channelAccount.id,
            channel: data.channelType,
            direction: 'OUTBOUND',
            contentType: 'TEXT',
            textContent: data.initialMessage,
            status: 'SENT',
            sentAt: new Date(),
          },
        });
      }
    }

    logger.info(
      { conversationId: conversation.id, channelType: data.channelType },
      'Conversation created'
    );

    return conversation;
  }

  async updateConversation(tenantId, conversationId, data) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const updateData = {};
    if (data.status) updateData.status = data.status;
    if (data.assignedTo) updateData.assignedToId = data.assignedTo;
    if (data.status === 'RESOLVED' || data.status === 'CLOSED') updateData.closedAt = new Date();
    if (data.status === 'OPEN') updateData.closedAt = null;

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
      include: {
        contact: true,
        channel: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    logger.info({ conversationId, updates: Object.keys(updateData) }, 'Conversation updated');

    return updated;
  }

  // Fixed: Use relation syntax for Prisma - 2026-01-12T17:50
  async assignConversation(tenantId, conversationId, assignedToId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedTo: assignedToId ? { connect: { id: assignedToId } } : { disconnect: true },
      },
    });

    logger.info({ conversationId, assignedToId }, 'Conversation assigned');

    return updated;
  }

  async resolveConversation(tenantId, conversationId, options = {}) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Check if agent has replied (at least one outbound message)
    const outboundCount = await prisma.message_events.count({
      where: {
        threadId: conversationId,
        direction: 'OUTBOUND',
      },
    });

    if (outboundCount === 0) {
      throw new Error('Cannot resolve: No reply has been sent to the customer');
    }

    // Check if feedback has been sent (unless force resolve is requested)
    if (!options.force) {
      // Get the last outbound message to check if it's a feedback template
      // Note: conversationThread doesn't have templateId - skip feedback check for now
      const lastOutboundMessage = null;

      // Check if the last template message was a feedback template
      let hasFeedbackSent = false;
      if (lastOutboundMessage?.templateId) {
        const template = await prisma.template.findUnique({
          where: { id: lastOutboundMessage.templateId },
          select: { category: true },
        });
        hasFeedbackSent = template?.category === 'FEEDBACK';
      }

      if (!hasFeedbackSent) {
        throw new Error(
          'Cannot resolve: Feedback has not been sent yet. Send a feedback request or use force resolve.'
        );
      }
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'RESOLVED',
        closedAt: new Date(),
      },
    });

    logger.info({ conversationId, forced: !!options.force }, 'Conversation resolved');

    return updated;
  }

  async reopenConversation(tenantId, conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'OPEN',
        closedAt: null,
      },
    });

    return updated;
  }

  async deleteConversation(tenantId, conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Delete all messages first (due to foreign key constraint)
    await prisma.message_events.deleteMany({
      where: { threadId: conversationId },
    });

    // Delete conversation notes if any
    try {
      await prisma.conversationNote.deleteMany({
        where: { conversationId: conversationId },
      });
    } catch (e) {
      // ConversationNote may not exist for all conversations
    }

    // Delete the conversation
    await prisma.conversation.delete({
      where: { id: conversationId },
    });

    return { success: true };
  }

  async toggleStar(tenantId, conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        isStarred: !conversation.isStarred,
      },
    });

    return updated;
  }

  async archiveConversation(tenantId, conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'CLOSED',
      },
    });

    return updated;
  }

  async unarchiveConversation(tenantId, conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'OPEN',
      },
    });

    return updated;
  }

  async snoozeConversation(tenantId, conversationId, { duration, customUntil, reason, userId }) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const now = new Date();
    let snoozedUntil;

    switch (duration) {
      case 'LATER_TODAY':
        snoozedUntil = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        break;
      case 'TOMORROW':
        snoozedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        snoozedUntil.setHours(9, 0, 0, 0);
        break;
      case 'NEXT_WEEK': {
        const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
        snoozedUntil = new Date(now.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
        snoozedUntil.setHours(9, 0, 0, 0);
        break;
      }
      default:
        if (customUntil) {
          snoozedUntil = new Date(customUntil);
        } else {
          throw new Error('Invalid snooze duration');
        }
    }

    // Update Conversation status to PENDING (proxy for snoozed)
    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'PENDING' },
    });

    // Also update ConversationThread if it exists (has proper snooze fields)
    try {
      await prisma.conversationThread.updateMany({
        where: { id: conversationId, tenantId },
        data: {
          status: 'SNOOZED',
          snoozedUntil,
          snoozedAt: now,
          snoozedById: userId || null,
          snoozeReason: reason || null,
        },
      });
    } catch (e) {
      // ConversationThread may not exist for this conversation — that's fine
      logger.debug({ conversationId }, 'No ConversationThread to update for snooze');
    }

    return { ...updated, snoozedUntil, snoozeStatus: 'snoozed' };
  }

  async unsnoozeConversation(tenantId, conversationId) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    const updated = await prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'OPEN' },
    });

    // Also clear snooze fields on ConversationThread
    try {
      await prisma.conversationThread.updateMany({
        where: { id: conversationId, tenantId },
        data: {
          status: 'OPEN',
          snoozedUntil: null,
          snoozedAt: null,
          snoozedById: null,
          snoozeReason: null,
        },
      });
    } catch (e) {
      logger.debug({ conversationId }, 'No ConversationThread to update for unsnooze');
    }

    return updated;
  }

  async getChannels(tenantId) {
    // Use raw SQL to avoid Prisma enum validation issues with invalid healthStatus values
    const channels = await prisma.$queryRaw`
      SELECT id, type, name, "phoneNumber", "emailAddress", status, "healthStatus", provider
      FROM channel_accounts
      WHERE "tenantId" = ${tenantId}
        AND type IN ('WHATSAPP', 'SMS', 'VOICE', 'EMAIL_GMAIL', 'EMAIL_MICROSOFT', 'EMAIL_SMTP')
      ORDER BY "createdAt" ASC
    `;

    // Valid health status values
    const validHealthStatuses = ['healthy', 'degraded', 'unhealthy', 'unknown'];

    return channels.map((ch) => {
      const healthStatus = ch.healthStatus?.toLowerCase();
      return {
        id: ch.id,
        type: this.getChannelDisplayType(ch.type),
        name: ch.name,
        phoneNumber: ch.phoneNumber,
        emailAddress: ch.emailAddress,
        status: ch.status?.toLowerCase() || 'unknown',
        healthStatus: validHealthStatuses.includes(healthStatus) ? healthStatus : 'unknown',
        provider: ch.provider,
      };
    });
  }

  async getConversationStats(tenantId) {
    const [open, pending, resolved, closed] = await Promise.all([
      prisma.conversation.count({ where: { tenantId, status: 'OPEN' } }),
      prisma.conversation.count({ where: { tenantId, status: 'PENDING' } }),
      prisma.conversation.count({ where: { tenantId, status: 'RESOLVED' } }),
      prisma.conversation.count({ where: { tenantId, status: 'CLOSED' } }),
    ]);

    return { open, pending, resolved, closed, total: open + pending + resolved + closed };
  }

  /**
   * Get inbox counts for sidebar badges
   * Returns counts for: all, unassigned, mine, starred, snoozed, archived, and by channel type
   * Fixed: Use channel relation instead of non-existent channelType field (2026-01-14)
   */
  async getInboxCounts(tenantId, userId) {
    // Run all counts in parallel for performance
    const [all, unassigned, mine, starred, snoozed, archived, whatsapp, sms, email, voice] =
      await Promise.all([
        // All active conversations (not archived/closed)
        prisma.conversation.count({
          where: { tenantId, status: { in: ['OPEN', 'PENDING'] } },
        }),
        // Unassigned conversations
        prisma.conversation.count({
          where: { tenantId, assignedToId: null, status: { in: ['OPEN', 'PENDING'] } },
        }),
        // My conversations (assigned to current user)
        userId
          ? prisma.conversation.count({
              where: { tenantId, assignedToId: userId, status: { in: ['OPEN', 'PENDING'] } },
            })
          : Promise.resolve(0),
        // Starred conversations
        prisma.conversation.count({
          where: { tenantId, isStarred: true },
        }),
        // Snoozed conversations (uses PENDING status)
        prisma.conversation.count({
          where: { tenantId, status: 'PENDING' },
        }),
        // Archived/closed conversations
        prisma.conversation.count({
          where: { tenantId, status: { in: ['RESOLVED', 'CLOSED'] } },
        }),
        // WhatsApp channel - use channel relation
        prisma.conversation.count({
          where: { tenantId, channel: { type: 'WHATSAPP' }, status: { in: ['OPEN', 'PENDING'] } },
        }),
        // SMS channel - use channel relation
        prisma.conversation.count({
          where: { tenantId, channel: { type: 'SMS' }, status: { in: ['OPEN', 'PENDING'] } },
        }),
        // Email channel - use channel relation (single EMAIL enum value)
        prisma.conversation.count({
          where: {
            tenantId,
            channel: { type: 'EMAIL' },
            status: { in: ['OPEN', 'PENDING'] },
          },
        }),
        // Voice channel - VOICE is not in ChannelType enum, return 0
        Promise.resolve(0),
      ]);

    return {
      all,
      unassigned,
      mine,
      starred,
      snoozed,
      archived,
      whatsapp,
      sms,
      email,
      voice,
    };
  }

  async markAsRead(tenantId, conversationId) {
    // First try ConversationThread (new model with message_events)
    const thread = await prisma.conversationThread.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (thread) {
      // Get all unread inbound messages from message_events
      const unreadMessages = await prisma.message_events.findMany({
        where: {
          threadId: conversationId,
          tenantId,
          direction: 'INBOUND',
          readAt: null,
        },
        select: { id: true },
      });

      // Mark all unread messages as read
      if (unreadMessages.length > 0) {
        await prisma.message_events.updateMany({
          where: {
            threadId: conversationId,
            tenantId,
            direction: 'INBOUND',
            readAt: null,
          },
          data: {
            readAt: new Date(),
          },
        });

        // Broadcast status update for each message via WebSocket
        for (const msg of unreadMessages) {
          try {
            broadcastMessageStatus(tenantId, msg.id, conversationId, 'read');
          } catch (wsError) {
            logger.warn(
              { error: wsError.message, messageId: msg.id },
              'Failed to broadcast read status'
            );
          }
        }

        logger.info(
          { conversationId, messageCount: unreadMessages.length },
          'Marked messages as read (ConversationThread)'
        );
      }

      // Update conversation thread: reset unread count and change status if needed
      const updateData = { unreadCount: 0 };
      if (thread.status === 'PENDING') {
        updateData.status = 'OPEN';
      }

      await prisma.conversationThread.update({
        where: { id: conversationId },
        data: updateData,
      });

      return { success: true, messagesMarked: unreadMessages.length };
    }

    // Fall back to old Conversation model
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // For old Conversation model, just reset unread count
    const updateData = { unreadCount: 0 };
    if (conversation.status === 'PENDING') {
      updateData.status = 'OPEN';
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    logger.info({ conversationId }, 'Marked conversation as read (Conversation)');

    return { success: true, messagesMarked: 0 };
  }

  // ============ TEMPLATES ============

  async getTemplates(tenantId, filters = {}) {
    const where = { tenantId };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive === 'true' || filters.isActive === true;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { content: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 25;

    const [templates, total] = await Promise.all([
      prisma.template.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.template.count({ where }),
    ]);

    return {
      templates,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTemplate(tenantId, templateId) {
    const template = await prisma.template.findFirst({
      where: { id: templateId, tenantId },
    });

    if (!template) {
      throw new NotFoundError('Template not found');
    }

    return template;
  }

  async createTemplate(tenantId, userId, data) {
    const template = await prisma.template.create({
      data: {
        tenantId,
        name: data.name,
        type: data.type || 'WHATSAPP',
        category: data.category,
        subject: data.subject,
        content: data.content,
        variables: data.variables,
        isActive: data.isActive ?? true,
      },
    });

    logger.info({ templateId: template.id, tenantId }, 'Template created');

    return template;
  }

  async updateTemplate(tenantId, templateId, data) {
    const existing = await prisma.template.findFirst({
      where: { id: templateId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Template not found');
    }

    const template = await prisma.template.update({
      where: { id: templateId },
      data: {
        name: data.name,
        type: data.type,
        category: data.category,
        subject: data.subject,
        content: data.content,
        variables: data.variables,
        isActive: data.isActive,
        updatedAt: new Date(),
      },
    });

    return template;
  }

  async deleteTemplate(tenantId, templateId) {
    const existing = await prisma.template.findFirst({
      where: { id: templateId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Template not found');
    }

    await prisma.template.delete({
      where: { id: templateId },
    });

    logger.info({ templateId, tenantId }, 'Template deleted');
  }

  // ============ BROADCASTS ============
  // NOTE: Broadcast model does not exist in database yet - returning "coming soon" placeholder

  async getBroadcasts(tenantId, filters = {}) {
    // Broadcast feature coming soon
    return {
      broadcasts: [],
      comingSoon: true,
      message: 'Broadcast feature is coming soon!',
      meta: {
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 0,
      },
    };
  }

  async getBroadcast(tenantId, broadcastId) {
    throw new Error('Broadcast feature is coming soon');
  }

  async createBroadcast(tenantId, userId, data) {
    throw new Error('Broadcast feature is coming soon');
  }

  async updateBroadcast(tenantId, broadcastId, data) {
    throw new Error('Broadcast feature is coming soon');
  }

  async deleteBroadcast(tenantId, broadcastId) {
    throw new Error('Broadcast feature is coming soon');
  }

  async sendBroadcast(tenantId, broadcastId) {
    throw new Error('Broadcast feature is coming soon');
  }

  async cancelBroadcast(tenantId, broadcastId) {
    throw new Error('Broadcast feature is coming soon');
  }

  // ============ TAGS ============

  async getTags(tenantId) {
    const tags = await prisma.tag.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        _count: {
          select: { contacts: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      createdAt: t.createdAt,
      contactCount: t._count.contacts,
    }));
  }

  async createTag(tenantId, data) {
    const tag = await prisma.tag.create({
      data: {
        tenantId,
        name: data.name,
        color: data.color || '#6366f1',
      },
    });

    logger.info({ tagId: tag.id, tenantId }, 'Tag created');

    return tag;
  }

  async updateTag(tenantId, tagId, data) {
    const existing = await prisma.tag.findFirst({
      where: { id: tagId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Tag not found');
    }

    const tag = await prisma.tag.update({
      where: { id: tagId },
      data: {
        name: data.name,
        color: data.color,
      },
    });

    return tag;
  }

  async deleteTag(tenantId, tagId) {
    const existing = await prisma.tag.findFirst({
      where: { id: tagId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Tag not found');
    }

    await prisma.tag.delete({
      where: { id: tagId },
    });

    logger.info({ tagId, tenantId }, 'Tag deleted');
  }

  // ============ CHATBOTS ============
  // NOTE: Chatbot model does not exist in database yet - returning "coming soon" placeholder

  async getChatbots(tenantId, filters = {}) {
    // Chatbot feature coming soon
    return {
      chatbots: [],
      comingSoon: true,
      message: 'Chatbot feature is coming soon!',
      meta: {
        total: 0,
        page: 1,
        limit: 25,
        totalPages: 0,
      },
    };
  }

  async getChatbot(tenantId, chatbotId) {
    throw new Error('Chatbot feature is coming soon');
  }

  async createChatbot(tenantId, userId, data) {
    throw new Error('Chatbot feature is coming soon');
  }

  async updateChatbot(tenantId, chatbotId, data) {
    throw new Error('Chatbot feature is coming soon');
  }

  async deleteChatbot(tenantId, chatbotId) {
    throw new Error('Chatbot feature is coming soon');
  }

  async activateChatbot(tenantId, chatbotId) {
    throw new Error('Chatbot feature is coming soon');
  }

  async deactivateChatbot(tenantId, chatbotId) {
    throw new Error('Chatbot feature is coming soon');
  }

  // ============ PURPOSE CLASSIFICATION ============

  /**
   * Get conversation counts by purpose for sidebar badges
   * Uses ConversationThread model which has the purpose field
   */
  async getPurposeCounts(tenantId) {
    const [general, sales, support, service, marketing] = await Promise.all([
      prisma.conversationThread.count({
        where: { tenantId, purpose: 'GENERAL', status: { in: ['OPEN', 'PENDING'] } },
      }),
      prisma.conversationThread.count({
        where: { tenantId, purpose: 'SALES', status: { in: ['OPEN', 'PENDING'] } },
      }),
      prisma.conversationThread.count({
        where: { tenantId, purpose: 'SUPPORT', status: { in: ['OPEN', 'PENDING'] } },
      }),
      prisma.conversationThread.count({
        where: { tenantId, purpose: 'SERVICE', status: { in: ['OPEN', 'PENDING'] } },
      }),
      prisma.conversationThread.count({
        where: { tenantId, purpose: 'MARKETING', status: { in: ['OPEN', 'PENDING'] } },
      }),
    ]);

    return {
      GENERAL: general,
      SALES: sales,
      SUPPORT: support,
      SERVICE: service,
      MARKETING: marketing,
      total: general + sales + support + service + marketing,
    };
  }

  /**
   * Update conversation purpose
   * @param {string} tenantId - Tenant ID
   * @param {string} conversationId - Conversation ID (can be Conversation or ConversationThread ID)
   * @param {string} purpose - New purpose (GENERAL, SALES, SUPPORT, SERVICE, MARKETING)
   * @param {string} subCategory - Optional sub-category
   * @param {string} userId - User who made the change
   */
  async updatePurpose(tenantId, conversationId, purpose, subCategory, userId) {
    // First, try to find in ConversationThread (new model)
    let thread = await prisma.conversationThread.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (thread) {
      // Update ConversationThread
      const updated = await prisma.conversationThread.update({
        where: { id: conversationId },
        data: {
          purpose,
          subCategory: subCategory || null,
          purposeSetAt: new Date(),
          purposeSetById: userId,
        },
        include: {
          contacts: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      logger.info(
        { conversationId, purpose, subCategory, userId },
        'Conversation purpose updated (ConversationThread)'
      );

      return updated;
    }

    // If not found in ConversationThread, this conversation doesn't support purpose yet
    throw new NotFoundError('Conversation not found or does not support purpose classification');
  }

  // ============ ANALYTICS ============

  /**
   * Get inbox analytics for a date range
   */
  async getAnalytics(tenantId, dateFrom, dateTo) {
    // Get conversation counts
    const [totalConversations, resolvedConversations, messageStats] = await Promise.all([
      prisma.conversation.count({
        where: {
          tenantId,
          createdAt: { gte: dateFrom, lte: dateTo },
        },
      }),
      prisma.conversation.count({
        where: {
          tenantId,
          status: 'RESOLVED',
          updatedAt: { gte: dateFrom, lte: dateTo },
        },
      }),
      prisma.conversationThread.groupBy({
        by: ['direction'],
        where: {
          tenantId,
          createdAt: { gte: dateFrom, lte: dateTo },
        },
        _count: { id: true },
      }),
    ]);

    // Get unique contacts count
    const contacts = await prisma.conversation.findMany({
      where: {
        tenantId,
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      select: { contactId: true },
      distinct: ['contactId'],
    });

    // Calculate average response time from first response to customer messages
    let avgResponseTime = 'N/A';
    try {
      const result = await prisma.$queryRaw`
        SELECT AVG(EXTRACT(EPOCH FROM (agent_msg."createdAt" - cust_msg."createdAt"))) / 60 as avg_minutes
        FROM message_events cust_msg
        INNER JOIN LATERAL (
          SELECT "createdAt" FROM message_events
          WHERE "threadId" = cust_msg."threadId"
            AND direction = 'OUTBOUND'
            AND "createdAt" > cust_msg."createdAt"
          ORDER BY "createdAt" ASC LIMIT 1
        ) agent_msg ON true
        WHERE cust_msg."tenantId" = ${tenantId}
          AND cust_msg.direction = 'INBOUND'
          AND cust_msg."createdAt" >= ${dateFrom}
          AND cust_msg."createdAt" <= ${dateTo}
      `;
      const mins = result[0]?.avg_minutes;
      if (mins != null) {
        avgResponseTime = mins < 1 ? `${Math.round(mins * 60)} sec` : `${mins.toFixed(1)} min`;
      }
    } catch {
      avgResponseTime = 'N/A';
    }

    // Get channel breakdown
    const channelStats = await prisma.conversation.groupBy({
      by: ['channelId'],
      where: {
        tenantId,
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      _count: { id: true },
    });

    return {
      conversations: totalConversations,
      contacts: contacts.length,
      resolved: resolvedConversations,
      avgResponseTime,
      messagesSent: messageStats.find((m) => m.direction === 'OUTBOUND')?._count?.id || 0,
      messagesReceived: messageStats.find((m) => m.direction === 'INBOUND')?._count?.id || 0,
      byChannel: channelStats,
    };
  }

  // ============ NOTES ============

  /**
   * Get notes for a conversation
   * Works with both Conversation (old) and ConversationThread (new) models
   */
  async getConversationNotes(tenantId, conversationId) {
    // First try ConversationThread (new model with conversation_notes)
    const thread = await prisma.conversationThread.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (thread) {
      try {
        // Get notes from conversation_notes table (use raw query as fallback if model not available)
        if (prisma.conversationNote) {
          const notes = await prisma.conversationNote.findMany({
            where: {
              threadId: conversationId,
              tenantId,
            },
            orderBy: { createdAt: 'desc' },
          });

          // Fetch user details for each note
          const userIds = [...new Set(notes.map((n) => n.userId))];
          if (userIds.length > 0) {
            const users = await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, name: true, email: true, avatarUrl: true },
            });
            const userMap = new Map(users.map((u) => [u.id, u]));

            return notes.map((note) => ({
              ...note,
              createdBy: userMap.get(note.userId) || {
                id: note.userId,
                name: 'Unknown',
                email: '',
                avatarUrl: null,
              },
            }));
          }
          return notes;
        }

        // Fallback: query using raw SQL if model not available
        const notes = await prisma.$queryRaw`
          SELECT * FROM conversation_notes
          WHERE "threadId" = ${conversationId} AND "tenantId" = ${tenantId}
          ORDER BY "createdAt" DESC
        `;
        return notes || [];
      } catch (error) {
        logger.warn(
          { error: error.message, conversationId },
          'Failed to fetch notes, returning empty array'
        );
        return [];
      }
    }

    // Fall back to old Conversation model
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // For old Conversation model, return empty array (no notes support)
    return [];
  }

  /**
   * Add a note to a conversation
   * Works with both Conversation (old) and ConversationThread (new) models
   */
  async addConversationNote(tenantId, conversationId, userId, content, isPrivate = false) {
    // First try ConversationThread (new model with conversation_notes)
    const thread = await prisma.conversationThread.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (thread) {
      try {
        let note;
        const noteId = `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        if (prisma.conversationNote) {
          // Create note using Prisma model
          note = await prisma.conversationNote.create({
            data: {
              threadId: conversationId,
              tenantId,
              userId,
              content,
              isPinned: false,
              mentions: [],
            },
          });
        } else {
          // Fallback: use raw SQL
          const now = new Date();
          await prisma.$executeRaw`
            INSERT INTO conversation_notes ("id", "threadId", "tenantId", "userId", "content", "isPinned", "mentions", "createdAt", "updatedAt")
            VALUES (${noteId}, ${conversationId}, ${tenantId}, ${userId}, ${content}, false, '{}', ${now}, ${now})
          `;
          note = {
            id: noteId,
            threadId: conversationId,
            tenantId,
            userId,
            content,
            isPinned: false,
            mentions: [],
            createdAt: now,
            updatedAt: now,
          };
        }

        // Fetch user details
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true, avatarUrl: true },
        });

        logger.info(
          { conversationId, noteId: note.id, userId },
          'Note added to conversation thread'
        );

        return {
          ...note,
          createdBy: user || { id: userId, name: 'Unknown', email: '', avatarUrl: null },
        };
      } catch (error) {
        logger.error({ error: error.message, conversationId, userId }, 'Failed to add note');
        throw new Error('Failed to add note');
      }
    }

    // Fall back to old Conversation model
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });

    if (!conversation) {
      throw new NotFoundError('Conversation not found');
    }

    // Old Conversation model doesn't support notes
    throw new Error('Notes not supported for this conversation type');
  }
}

export const inboxService = new InboxService();
