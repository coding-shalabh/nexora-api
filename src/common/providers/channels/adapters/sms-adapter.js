/**
 * SMS Channel Adapter
 * Implements SMS via MSG91 with DLT compliance for India
 */

import {
  BaseChannelAdapter,
  ChannelCapabilities,
  ChannelEventTypes,
  NormalizedMessage,
} from '../base-adapter.js';
import { rateLimiter } from '../rate-limiter.js';
import { usageMeter } from '../usage-meter.js';
import { prisma } from '@crm360/database';

const SMS_API_BASE = process.env.SMS_API_URL || 'https://api.msg91.com/api/v5';

export class SMSAdapter extends BaseChannelAdapter {
  constructor(channelAccount) {
    super(channelAccount);
    this.apiKey = channelAccount.credentials?.apiKey;
    this.senderId = channelAccount.identifier;
    this.dltEntityId = channelAccount.dltEntityId;
  }

  getChannelType() {
    return 'SMS';
  }

  getCapabilities() {
    return [
      ChannelCapabilities.TEXT,
      ChannelCapabilities.TEMPLATES,
      ChannelCapabilities.DELIVERY_RECEIPTS,
    ];
  }

  async sendMessage(message) {
    // Check rate limit
    const rateCheck = await rateLimiter.checkLimit(
      this.channelAccount.id,
      'SMS',
      'message'
    );

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
      'SMS',
      this.getEventType(message)
    );

    if (!balanceCheck.sufficient) {
      return {
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        details: balanceCheck,
      };
    }

    // Check opt-out status
    const optedOut = await this.checkOptOut(message.metadata.recipient);
    if (optedOut) {
      return {
        success: false,
        error: 'RECIPIENT_OPTED_OUT',
      };
    }

    try {
      // For DLT compliance, we need to use registered templates
      const template = await this.getTemplate(message);
      if (!template) {
        return {
          success: false,
          error: 'DLT_TEMPLATE_REQUIRED',
          details: 'SMS messages in India require DLT-registered templates',
        };
      }

      const payload = {
        flow_id: template.providerTemplateId,
        sender: this.senderId,
        mobiles: message.metadata.recipient,
        ...this.buildTemplateVariables(message.content, template),
      };

      const response = await fetch(`${SMS_API_BASE}/flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authkey': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.type === 'success') {
        await rateLimiter.recordAction(this.channelAccount.id, 'SMS', 'message');

        await usageMeter.recordUsage({
          tenantId: this.tenantId,
          workspaceId: this.workspaceId,
          channelAccountId: this.channelAccount.id,
          channelType: 'SMS',
          eventType: this.getEventType(message),
          messageEventId: message.id,
          direction: 'OUTBOUND',
        });

        this.emitEvent(ChannelEventTypes.MESSAGE_SENT, {
          messageId: message.id,
          externalId: data.request_id,
        });

        return {
          success: true,
          externalId: data.request_id,
        };
      } else {
        this.emitEvent(ChannelEventTypes.MESSAGE_FAILED, {
          messageId: message.id,
          error: data.message || 'Unknown error',
        });

        return {
          success: false,
          error: data.message || 'Failed to send SMS',
          errorCode: data.code,
        };
      }
    } catch (error) {
      this.log('error', 'Failed to send SMS', { error: error.message });

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
    const rateCheck = await rateLimiter.checkLimit(
      this.channelAccount.id,
      'SMS',
      'template'
    );

    if (!rateCheck.allowed) {
      return {
        success: false,
        error: 'RATE_LIMITED',
        retryAfter: rateCheck.retryAfter,
      };
    }

    // Check opt-out
    const optedOut = await this.checkOptOut(recipient);
    if (optedOut) {
      return {
        success: false,
        error: 'RECIPIENT_OPTED_OUT',
      };
    }

    try {
      const template = await prisma.sMSTemplate.findUnique({
        where: { id: templateId },
      });

      if (!template || template.dltStatus !== 'APPROVED') {
        return {
          success: false,
          error: 'TEMPLATE_NOT_APPROVED',
        };
      }

      const payload = {
        flow_id: template.providerTemplateId,
        sender: this.senderId,
        mobiles: recipient,
        ...variables,
      };

      const response = await fetch(`${SMS_API_BASE}/flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authkey': this.apiKey,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.type === 'success') {
        await rateLimiter.recordAction(this.channelAccount.id, 'SMS', 'template');

        return {
          success: true,
          externalId: data.request_id,
        };
      } else {
        return {
          success: false,
          error: data.message || 'Failed to send SMS',
          errorCode: data.code,
        };
      }
    } catch (error) {
      this.log('error', 'Failed to send SMS template', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async parseInboundWebhook(payload) {
    // MSG91 SMS webhook format
    const { message, mobile, datetime, request_id } = payload;

    return new NormalizedMessage({
      externalId: request_id,
      channelType: 'SMS',
      channelAccountId: this.channelAccount.id,
      direction: 'INBOUND',
      contentType: 'TEXT',
      content: { text: message },
      metadata: {
        from: mobile,
      },
      sentAt: new Date(datetime),
    });
  }

  async parseStatusWebhook(payload) {
    const { request_id, status, datetime, description } = payload;

    const statusMap = {
      1: 'DELIVERED',
      2: 'SENT',
      3: 'FAILED',
      5: 'SUBMITTED',
      6: 'REJECTED',
      7: 'NDNC_REJECTED', // Do Not Disturb
    };

    return {
      messageId: request_id,
      status: statusMap[status] || 'UNKNOWN',
      timestamp: new Date(datetime),
      error: status === 3 || status === 6 || status === 7 ? description : null,
    };
  }

  async validateCredentials() {
    try {
      const response = await fetch(`${SMS_API_BASE}/balance.json`, {
        headers: {
          'authkey': this.apiKey,
        },
      });

      const data = await response.json();

      if (response.ok && data.balance !== undefined) {
        return { valid: true, balance: data.balance };
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
      const rateLimitStatus = await rateLimiter.getStatus(this.channelAccount.id, 'SMS');

      return {
        healthy: validation.valid,
        details: {
          credentials: validation,
          rateLimits: rateLimitStatus,
          senderId: this.senderId,
          dltEntityId: this.dltEntityId,
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
    const segments = this.calculateSegments(message.content.text);
    return usageMeter.getCostEstimate('SMS', eventType, segments);
  }

  // SMS doesn't support media uploads
  async uploadMedia(buffer, mimeType) {
    throw new Error('SMS does not support media uploads');
  }

  async downloadMedia(mediaId) {
    throw new Error('SMS does not support media downloads');
  }

  // Private helper methods

  async getTemplate(message) {
    // Find matching DLT template
    if (message.metadata.templateId) {
      return prisma.sMSTemplate.findUnique({
        where: { id: message.metadata.templateId },
      });
    }

    // Try to find a template that matches the content
    return prisma.sMSTemplate.findFirst({
      where: {
        tenantId: this.tenantId,
        dltStatus: 'APPROVED',
      },
    });
  }

  buildTemplateVariables(content, template) {
    // Extract variable values from content based on template
    const variables = {};

    if (template.variables && Array.isArray(template.variables)) {
      template.variables.forEach((varName, idx) => {
        if (content.variables && content.variables[varName]) {
          variables[varName] = content.variables[varName];
        } else if (content.variables && content.variables[idx]) {
          variables[varName] = content.variables[idx];
        }
      });
    }

    return variables;
  }

  calculateSegments(text) {
    if (!text) return 1;

    // GSM-7 encoding: 160 chars per segment, or 153 for multi-part
    // Unicode: 70 chars per segment, or 67 for multi-part
    const isUnicode = /[^\x00-\x7F]/.test(text);
    const singleLimit = isUnicode ? 70 : 160;
    const multiLimit = isUnicode ? 67 : 153;

    if (text.length <= singleLimit) {
      return 1;
    }

    return Math.ceil(text.length / multiLimit);
  }

  async checkOptOut(phone) {
    const optOut = await prisma.optOut.findFirst({
      where: {
        channelType: 'SMS',
        identifier: phone,
        isActive: true,
      },
    });

    return !!optOut;
  }

  getEventType(message) {
    // Determine billing category based on message type
    if (message.metadata.category === 'OTP') {
      return 'SMS_OTP';
    }

    if (message.metadata.category === 'PROMOTIONAL') {
      return 'SMS_PROMOTIONAL';
    }

    return 'SMS_TRANSACTIONAL';
  }
}

/**
 * Factory function for SMS adapter
 */
export function createSMSAdapter(channelAccount) {
  return new SMSAdapter(channelAccount);
}
