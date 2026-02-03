/**
 * WhatsApp Channel Adapter
 * Implements WhatsApp Business API via MSG91/Gupshup
 */

import {
  BaseChannelAdapter,
  ChannelCapabilities,
  ChannelEventTypes,
  NormalizedMessage,
} from '../base-adapter.js';
import { rateLimiter } from '../rate-limiter.js';
import { usageMeter } from '../usage-meter.js';
import { integrationStatsTracker } from '../../../../services/integration-stats-tracker.service.js';

const WHATSAPP_API_BASE = process.env.WHATSAPP_API_URL || 'https://api.msg91.com/api/v5/whatsapp';

export class WhatsAppAdapter extends BaseChannelAdapter {
  constructor(channelAccount) {
    super(channelAccount);
    this.apiKey = channelAccount.credentials?.apiKey;
    this.phoneNumber = channelAccount.identifier;
    this.wabaId = channelAccount.credentials?.wabaId;
  }

  getChannelType() {
    return 'WHATSAPP';
  }

  getCapabilities() {
    return [
      ChannelCapabilities.TEXT,
      ChannelCapabilities.RICH_TEXT,
      ChannelCapabilities.IMAGES,
      ChannelCapabilities.VIDEOS,
      ChannelCapabilities.AUDIO,
      ChannelCapabilities.DOCUMENTS,
      ChannelCapabilities.TEMPLATES,
      ChannelCapabilities.INTERACTIVE,
      ChannelCapabilities.READ_RECEIPTS,
      ChannelCapabilities.DELIVERY_RECEIPTS,
      ChannelCapabilities.REACTIONS,
      ChannelCapabilities.REPLIES,
    ];
  }

  async sendMessage(message) {
    // Check rate limit
    const rateCheck = await rateLimiter.checkLimit(this.channelAccount.id, 'WHATSAPP', 'message');

    if (!rateCheck.allowed) {
      return {
        success: false,
        error: 'RATE_LIMITED',
        retryAfter: rateCheck.retryAfter,
      };
    }

    // Check balance
    const balanceCheck = await usageMeter.checkBalance(
      this.tenantId,
      this.workspaceId,
      'WHATSAPP',
      this.getEventType(message)
    );

    if (!balanceCheck.sufficient) {
      return {
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        details: balanceCheck,
      };
    }

    try {
      const payload = this.buildMessagePayload(message);

      const response = await fetch(`${WHATSAPP_API_BASE}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.type === 'success') {
        // Record rate limit
        await rateLimiter.recordAction(this.channelAccount.id, 'WHATSAPP', 'message');

        // Record usage
        await usageMeter.recordUsage({
          tenantId: this.tenantId,
          workspaceId: this.workspaceId,
          channelAccountId: this.channelAccount.id,
          channelType: 'WHATSAPP',
          eventType: this.getEventType(message),
          messageEventId: message.id,
          direction: 'OUTBOUND',
        });

        // Track stats
        const provider = this.channelAccount.credentials?.provider || 'msg91';
        await integrationStatsTracker.recordMessageSent(this.tenantId, provider, 'whatsapp');

        this.emitEvent(ChannelEventTypes.MESSAGE_SENT, {
          messageId: message.id,
          externalId: data.messageId,
        });

        return {
          success: true,
          externalId: data.messageId,
        };
      } else {
        // Track failed message
        const provider = this.channelAccount.credentials?.provider || 'msg91';
        await integrationStatsTracker.recordMessageFailed(this.tenantId, provider);

        this.emitEvent(ChannelEventTypes.MESSAGE_FAILED, {
          messageId: message.id,
          error: data.message || 'Unknown error',
        });

        return {
          success: false,
          error: data.message || 'Failed to send message',
          errorCode: data.code,
        };
      }
    } catch (error) {
      this.log('error', 'Failed to send WhatsApp message', { error: error.message });

      // Track failed message
      const provider = this.channelAccount.credentials?.provider || 'msg91';
      await integrationStatsTracker.recordMessageFailed(this.tenantId, provider);

      this.emitEvent(ChannelEventTypes.MESSAGE_FAILED, {
        messageId: message.id,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendTemplate(templateId, variables, recipient) {
    // Check rate limit
    const rateCheck = await rateLimiter.checkLimit(this.channelAccount.id, 'WHATSAPP', 'template');

    if (!rateCheck.allowed) {
      return {
        success: false,
        error: 'RATE_LIMITED',
        retryAfter: rateCheck.retryAfter,
      };
    }

    try {
      const payload = {
        integrated_number: this.phoneNumber,
        content_type: 'template',
        recipient,
        template: {
          id: templateId,
          components: this.buildTemplateComponents(variables),
        },
      };

      const response = await fetch(`${WHATSAPP_API_BASE}/sendTemplate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.type === 'success') {
        await rateLimiter.recordAction(this.channelAccount.id, 'WHATSAPP', 'template');

        return {
          success: true,
          externalId: data.messageId,
        };
      } else {
        return {
          success: false,
          error: data.message || 'Failed to send template',
          errorCode: data.code,
        };
      }
    } catch (error) {
      this.log('error', 'Failed to send WhatsApp template', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async parseInboundWebhook(payload) {
    // Parse MSG91 WhatsApp webhook format
    const { message_id, from, type, text, image, video, audio, document, timestamp, context } =
      payload;

    let content = {};
    let contentType = 'TEXT';

    if (text) {
      content = { text: text.body };
      contentType = 'TEXT';
    } else if (image) {
      content = {
        mediaId: image.id,
        url: image.url,
        caption: image.caption,
        mimeType: image.mime_type,
      };
      contentType = 'IMAGE';
    } else if (video) {
      content = {
        mediaId: video.id,
        url: video.url,
        caption: video.caption,
        mimeType: video.mime_type,
      };
      contentType = 'VIDEO';
    } else if (audio) {
      content = {
        mediaId: audio.id,
        url: audio.url,
        mimeType: audio.mime_type,
      };
      contentType = 'AUDIO';
    } else if (document) {
      content = {
        mediaId: document.id,
        url: document.url,
        filename: document.filename,
        mimeType: document.mime_type,
      };
      contentType = 'DOCUMENT';
    }

    return new NormalizedMessage({
      externalId: message_id,
      channelType: 'WHATSAPP',
      channelAccountId: this.channelAccount.id,
      direction: 'INBOUND',
      contentType,
      content,
      metadata: {
        from,
        timestamp,
        replyTo: context?.message_id,
      },
      sentAt: new Date(timestamp * 1000),
    });
  }

  async parseStatusWebhook(payload) {
    const { message_id, status, timestamp, errors } = payload;

    const statusMap = {
      sent: 'SENT',
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
    };

    return {
      messageId: message_id,
      status: statusMap[status] || status.toUpperCase(),
      timestamp: new Date(timestamp * 1000),
      error: errors?.[0]?.message,
      errorCode: errors?.[0]?.code,
    };
  }

  async validateCredentials() {
    try {
      const response = await fetch(`${WHATSAPP_API_BASE}/getPhoneNumbers`, {
        headers: {
          authkey: this.apiKey,
        },
      });

      const data = await response.json();

      if (response.ok && data.type === 'success') {
        return { valid: true };
      } else {
        return { valid: false, error: data.message };
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async getHealthStatus() {
    try {
      const validation = await this.validateCredentials();
      const rateLimitStatus = await rateLimiter.getStatus(this.channelAccount.id, 'WHATSAPP');

      return {
        healthy: validation.valid,
        details: {
          credentials: validation,
          rateLimits: rateLimitStatus,
          phoneNumber: this.phoneNumber,
          wabaId: this.wabaId,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  async estimateCost(message) {
    const eventType = this.getEventType(message);
    return usageMeter.getCostEstimate('WHATSAPP', eventType);
  }

  async uploadMedia(buffer, mimeType) {
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mimeType }));
    formData.append('type', mimeType);

    const response = await fetch(`${WHATSAPP_API_BASE}/media/upload`, {
      method: 'POST',
      headers: {
        authkey: this.apiKey,
      },
      body: formData,
    });

    const data = await response.json();

    if (response.ok && data.id) {
      return { mediaId: data.id };
    }

    throw new Error(data.message || 'Failed to upload media');
  }

  async downloadMedia(mediaId) {
    const response = await fetch(`${WHATSAPP_API_BASE}/media/${mediaId}`, {
      headers: {
        authkey: this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download media');
    }

    return Buffer.from(await response.arrayBuffer());
  }

  // Private helper methods

  buildMessagePayload(message) {
    const base = {
      integrated_number: this.phoneNumber,
      recipient: message.metadata.recipient,
    };

    switch (message.contentType) {
      case 'TEXT':
        return {
          ...base,
          content_type: 'text',
          text: {
            body: message.content.text,
          },
        };

      case 'IMAGE':
        return {
          ...base,
          content_type: 'image',
          image: {
            id: message.content.mediaId,
            caption: message.content.caption,
          },
        };

      case 'VIDEO':
        return {
          ...base,
          content_type: 'video',
          video: {
            id: message.content.mediaId,
            caption: message.content.caption,
          },
        };

      case 'AUDIO':
        return {
          ...base,
          content_type: 'audio',
          audio: {
            id: message.content.mediaId,
          },
        };

      case 'DOCUMENT':
        return {
          ...base,
          content_type: 'document',
          document: {
            id: message.content.mediaId,
            filename: message.content.filename,
          },
        };

      default:
        throw new Error(`Unsupported content type: ${message.contentType}`);
    }
  }

  buildTemplateComponents(variables) {
    if (!variables) return [];

    const components = [];

    // Header variables
    if (variables.header) {
      components.push({
        type: 'header',
        parameters: Array.isArray(variables.header)
          ? variables.header.map((v) => ({ type: 'text', text: v }))
          : [{ type: 'text', text: variables.header }],
      });
    }

    // Body variables
    if (variables.body) {
      components.push({
        type: 'body',
        parameters: Array.isArray(variables.body)
          ? variables.body.map((v) => ({ type: 'text', text: v }))
          : [{ type: 'text', text: variables.body }],
      });
    }

    // Button variables
    if (variables.buttons) {
      variables.buttons.forEach((btn, idx) => {
        components.push({
          type: 'button',
          sub_type: btn.type,
          index: idx,
          parameters: [{ type: 'text', text: btn.value }],
        });
      });
    }

    return components;
  }

  getEventType(message) {
    // Determine the billing event type based on message characteristics
    if (message.contentType === 'TEMPLATE') {
      // Template messages are categorized
      return `WHATSAPP_${message.metadata.category || 'MARKETING'}`;
    }

    // Session messages within 24h window
    if (message.metadata.isSessionMessage) {
      return 'WHATSAPP_SERVICE';
    }

    // User-initiated (response to customer)
    if (message.metadata.isReply) {
      return 'WHATSAPP_USER_INITIATED';
    }

    // Default to marketing
    return 'WHATSAPP_MARKETING';
  }
}

/**
 * Factory function for WhatsApp adapter
 */
export function createWhatsAppAdapter(channelAccount) {
  return new WhatsAppAdapter(channelAccount);
}
