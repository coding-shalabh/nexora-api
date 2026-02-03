/**
 * Channel Service
 * Unified API for multi-channel messaging operations
 * Orchestrates adapters, rate limiting, usage metering, and consent
 */

import { prisma } from '@crm360/database';
import { logger } from '../../logger.js';
import { eventBus, createEvent } from '../../events/event-bus.js';
import { channelRegistry } from './channel-registry.js';
import { rateLimiter } from './rate-limiter.js';
import { usageMeter } from './usage-meter.js';
import { NormalizedMessage, ChannelEventTypes } from './base-adapter.js';
import {
  createWhatsAppAdapter,
  createSMSAdapter,
  createEmailAdapter,
  createVoiceAdapter,
} from './adapters/index.js';

class ChannelService {
  constructor() {
    this.logger = logger.child({ service: 'ChannelService' });
    this.initialized = false;
  }

  /**
   * Initialize the channel service
   * Registers all adapter factories
   */
  async initialize() {
    if (this.initialized) return;

    channelRegistry.registerAdapterFactory('WHATSAPP', createWhatsAppAdapter);
    channelRegistry.registerAdapterFactory('SMS', createSMSAdapter);
    channelRegistry.registerAdapterFactory('EMAIL', createEmailAdapter);
    channelRegistry.registerAdapterFactory('VOICE', createVoiceAdapter);

    this.initialized = true;
    this.logger.info('Channel service initialized');
  }

  /**
   * Send a message through the appropriate channel
   * Handles thread creation/lookup, consent checking, and event creation
   */
  async sendMessage({
    tenantId,
    workspaceId,
    channelAccountId,
    recipient, // phone number or email
    contentType,
    content,
    threadId = null,
    contactId = null,
    metadata = {},
  }) {
    // Get channel adapter
    const adapter = await channelRegistry.getAdapter(channelAccountId);
    const channelType = adapter.getChannelType();

    // Check consent
    const consent = await this.checkConsent(tenantId, channelType, recipient);
    if (!consent.allowed) {
      return {
        success: false,
        error: 'CONSENT_REQUIRED',
        details: consent,
      };
    }

    // Find or create thread
    let thread = threadId
      ? await prisma.conversation.findUnique({
          where: { id: threadId },
        })
      : null;

    if (!thread) {
      thread = await this.findOrCreateThread({
        tenantId,
        workspaceId,
        channelAccountId,
        channelType,
        recipient,
        contactId,
      });
    }

    // Create message event record
    const messageEvent = await prisma.messageEvent.create({
      data: {
        tenantId,
        threadId: thread.id,
        channelAccountId,
        channelType,
        direction: 'OUTBOUND',
        contentType,
        content,
        status: 'PENDING',
        metadata,
      },
    });

    // Build normalized message
    const normalizedMessage = new NormalizedMessage({
      id: messageEvent.id,
      threadId: thread.id,
      channelType,
      channelAccountId,
      direction: 'OUTBOUND',
      contentType,
      content,
      metadata: {
        ...metadata,
        recipient,
      },
    });

    // Send via adapter
    const result = await adapter.sendMessage(normalizedMessage);

    // Update message status
    const updateData = {
      status: result.success ? 'SENT' : 'FAILED',
      sentAt: result.success ? new Date() : null,
      externalId: result.externalId || null,
      errorCode: result.errorCode || null,
      errorMessage: result.error || null,
    };

    await prisma.messageEvent.update({
      where: { id: messageEvent.id },
      data: updateData,
    });

    // Update thread
    if (result.success) {
      await prisma.conversation.update({
        where: { id: thread.id },
        data: {
          lastCustomerMessageAt: new Date(),
          lastMessagePreview: this.getMessagePreview(content),
          status: 'OPEN',
        },
      });
    }

    return {
      success: result.success,
      messageEventId: messageEvent.id,
      threadId: thread.id,
      externalId: result.externalId,
      error: result.error,
    };
  }

  /**
   * Send a template message
   */
  async sendTemplate({
    tenantId,
    workspaceId,
    channelAccountId,
    templateId,
    recipient,
    variables = {},
    contactId = null,
    metadata = {},
  }) {
    const adapter = await channelRegistry.getAdapter(channelAccountId);
    const channelType = adapter.getChannelType();

    // Get template
    const template = await this.getTemplate(templateId, channelType);
    if (!template) {
      return {
        success: false,
        error: 'TEMPLATE_NOT_FOUND',
      };
    }

    // Check consent
    const consent = await this.checkConsent(tenantId, channelType, recipient);
    if (!consent.allowed) {
      return {
        success: false,
        error: 'CONSENT_REQUIRED',
        details: consent,
      };
    }

    // Find or create thread
    const thread = await this.findOrCreateThread({
      tenantId,
      workspaceId,
      channelAccountId,
      channelType,
      recipient,
      contactId,
    });

    // Create message event
    const content = this.substituteVariables(template.content, variables);
    const messageEvent = await prisma.messageEvent.create({
      data: {
        tenantId,
        threadId: thread.id,
        channelAccountId,
        channelType,
        direction: 'OUTBOUND',
        contentType: 'TEMPLATE',
        content: { templateId, variables, renderedContent: content },
        status: 'PENDING',
        metadata: { ...metadata, templateId },
      },
    });

    // Send via adapter
    const result = await adapter.sendTemplate(templateId, variables, recipient);

    // Update status
    await prisma.messageEvent.update({
      where: { id: messageEvent.id },
      data: {
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        externalId: result.externalId || null,
        errorCode: result.errorCode || null,
        errorMessage: result.error || null,
      },
    });

    if (result.success) {
      await prisma.conversation.update({
        where: { id: thread.id },
        data: {
          lastCustomerMessageAt: new Date(),
          lastMessagePreview: content.substring(0, 100),
        },
      });
    }

    return {
      success: result.success,
      messageEventId: messageEvent.id,
      threadId: thread.id,
      externalId: result.externalId,
      error: result.error,
    };
  }

  /**
   * Process inbound webhook
   * Called by webhook endpoints for each channel
   */
  async processInboundWebhook(channelAccountId, payload) {
    const adapter = await channelRegistry.getAdapter(channelAccountId);
    const channelType = adapter.getChannelType();

    // Parse webhook into normalized message
    const normalizedMessage = await adapter.parseInboundWebhook(payload);

    // Find or create thread
    const thread = await this.findOrCreateThread({
      tenantId: adapter.tenantId,
      workspaceId: adapter.workspaceId,
      channelAccountId,
      channelType,
      recipient: normalizedMessage.metadata.from,
    });

    // Create message event
    const messageEvent = await prisma.messageEvent.create({
      data: {
        tenantId: adapter.tenantId,
        threadId: thread.id,
        channelAccountId,
        channelType,
        direction: 'INBOUND',
        contentType: normalizedMessage.contentType,
        content: normalizedMessage.content,
        status: 'DELIVERED',
        externalId: normalizedMessage.externalId,
        sentAt: normalizedMessage.sentAt,
        deliveredAt: new Date(),
        metadata: normalizedMessage.metadata,
      },
    });

    // Update thread
    await prisma.conversation.update({
      where: { id: thread.id },
      data: {
        lastCustomerMessageAt: new Date(),
        lastMessagePreview: this.getMessagePreview(normalizedMessage.content),
        unreadCount: { increment: 1 },
        status: 'OPEN',
      },
    });

    // Emit event
    eventBus.publish(
      createEvent(ChannelEventTypes.MESSAGE_RECEIVED, adapter.tenantId, {
        messageEventId: messageEvent.id,
        threadId: thread.id,
        channelType,
        from: normalizedMessage.metadata.from,
      })
    );

    return {
      success: true,
      messageEventId: messageEvent.id,
      threadId: thread.id,
    };
  }

  /**
   * Process status webhook
   * Updates message delivery/read status
   */
  async processStatusWebhook(channelAccountId, payload) {
    const adapter = await channelRegistry.getAdapter(channelAccountId);
    const status = await adapter.parseStatusWebhook(payload);

    // Find message by external ID
    const messageEvent = await prisma.messageEvent.findFirst({
      where: { externalId: status.messageId },
    });

    if (!messageEvent) {
      this.logger.warn({ externalId: status.messageId }, 'Message not found for status update');
      return { success: false, error: 'MESSAGE_NOT_FOUND' };
    }

    // Update status
    const updateData = { status: status.status };

    if (status.status === 'DELIVERED') {
      updateData.deliveredAt = status.timestamp;
    } else if (status.status === 'READ') {
      updateData.readAt = status.timestamp;
    } else if (status.status === 'FAILED') {
      updateData.failedAt = status.timestamp;
      updateData.errorCode = status.errorCode;
      updateData.errorMessage = status.error;
    }

    await prisma.messageEvent.update({
      where: { id: messageEvent.id },
      data: updateData,
    });

    // Emit appropriate event
    const eventType = {
      SENT: ChannelEventTypes.MESSAGE_SENT,
      DELIVERED: ChannelEventTypes.MESSAGE_DELIVERED,
      READ: ChannelEventTypes.MESSAGE_READ,
      FAILED: ChannelEventTypes.MESSAGE_FAILED,
    }[status.status];

    if (eventType) {
      eventBus.publish(
        createEvent(eventType, adapter.tenantId, {
          messageEventId: messageEvent.id,
          threadId: messageEvent.threadId,
          status: status.status,
        })
      );
    }

    return { success: true, messageEventId: messageEvent.id };
  }

  /**
   * Find or create conversation thread
   */
  async findOrCreateThread({
    tenantId,
    workspaceId,
    channelAccountId,
    channelType,
    recipient,
    contactId = null,
  }) {
    // Try to find existing thread
    let thread = await prisma.conversation.findFirst({
      where: {
        tenantId,
        channelAccountId,
        externalIdentifier: recipient,
        status: { not: 'CLOSED' },
      },
    });

    if (thread) return thread;

    // Find or create contact
    if (!contactId) {
      const contact = await this.findOrCreateContact(tenantId, workspaceId, channelType, recipient);
      contactId = contact.id;
    }

    // Create new thread
    thread = await prisma.conversation.create({
      data: {
        tenantId,
        workspaceId,
        channelAccountId,
        channelType,
        contactId,
        externalIdentifier: recipient,
        status: 'ACTIVE',
      },
    });

    return thread;
  }

  /**
   * Find or create contact
   */
  async findOrCreateContact(tenantId, workspaceId, channelType, identifier) {
    const field = ['WHATSAPP', 'SMS', 'VOICE'].includes(channelType) ? 'phone' : 'email';

    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        [field]: identifier,
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          workspaceId,
          [field]: identifier,
          source: 'INBOUND_MESSAGE',
        },
      });
    }

    return contact;
  }

  /**
   * Check consent status
   */
  async checkConsent(tenantId, channelType, identifier) {
    // Check for opt-out
    const optOut = await prisma.optOut.findFirst({
      where: {
        tenantId,
        channelType,
        identifier,
        isActive: true,
      },
    });

    if (optOut) {
      return {
        allowed: false,
        reason: 'OPTED_OUT',
        optOutDate: optOut.createdAt,
      };
    }

    // Check for explicit consent (required for some channels)
    const consent = await prisma.consent.findFirst({
      where: {
        tenantId,
        channelType,
        identifier,
        status: 'GRANTED',
      },
    });

    // For WhatsApp/SMS, consent might be implicit within 24h window
    // For email marketing, explicit consent is required
    if (channelType === 'EMAIL') {
      if (!consent) {
        return {
          allowed: false,
          reason: 'NO_CONSENT',
        };
      }
    }

    return { allowed: true, consent };
  }

  /**
   * Record opt-out
   */
  async recordOptOut(tenantId, channelType, identifier, source = 'USER') {
    await prisma.optOut.create({
      data: {
        tenantId,
        channelType,
        identifier,
        source,
        isActive: true,
      },
    });

    eventBus.publish(
      createEvent(ChannelEventTypes.OPT_OUT_RECEIVED, tenantId, {
        channelType,
        identifier,
        source,
      })
    );
  }

  /**
   * Record consent
   */
  async recordConsent(tenantId, contactId, channelType, identifier, source = 'EXPLICIT') {
    const consent = await prisma.consent.create({
      data: {
        tenantId,
        contactId,
        channelType,
        identifier,
        source,
        status: 'GRANTED',
        grantedAt: new Date(),
      },
    });

    eventBus.publish(
      createEvent(ChannelEventTypes.CONSENT_GRANTED, tenantId, {
        consentId: consent.id,
        channelType,
        identifier,
      })
    );

    return consent;
  }

  /**
   * Get channel accounts for tenant
   */
  async getChannelAccounts(tenantId, workspaceId, channelType = null) {
    const where = { tenantId, workspaceId };
    if (channelType) where.channelType = channelType;

    return prisma.channelAccount.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get channel health status
   */
  async getChannelHealth(tenantId) {
    return channelRegistry.healthCheckTenant(tenantId);
  }

  /**
   * Get usage summary
   */
  async getUsageSummary(tenantId, workspaceId, startDate, endDate) {
    return usageMeter.getUsageSummary(tenantId, workspaceId, startDate, endDate);
  }

  // Helper methods

  getTemplate(templateId, channelType) {
    if (channelType === 'SMS') {
      return prisma.sMSTemplate.findUnique({ where: { id: templateId } });
    }
    return prisma.template.findUnique({ where: { id: templateId } });
  }

  substituteVariables(content, variables) {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  getMessagePreview(content) {
    if (typeof content === 'string') {
      return content.substring(0, 100);
    }
    if (content.text) {
      return content.text.substring(0, 100);
    }
    if (content.body) {
      return content.body.substring(0, 100);
    }
    if (content.caption) {
      return content.caption.substring(0, 100);
    }
    return '[Media]';
  }
}

// Singleton instance
export const channelService = new ChannelService();
