/**
 * TeleCMI Voice Channel Adapter
 * Implements Click-to-Call via TeleCMI API
 *
 * TeleCMI Documentation:
 * - Click-to-Call: https://doc.telecmi.com/chub/docs/click-to-call/
 * - Admin API: https://doc.telecmi.com/chub/docs/click-to-call-admin/
 */

import {
  BaseChannelAdapter,
  ChannelCapabilities,
  ChannelEventTypes,
} from '../base-adapter.js';
import { rateLimiter } from '../rate-limiter.js';
import { usageMeter } from '../usage-meter.js';
import { prisma } from '@crm360/database';
import { logger } from '../../../logger.js';

const TELECMI_API_BASE = 'https://rest.telecmi.com/v2';

export class TeleCMIAdapter extends BaseChannelAdapter {
  constructor(channelAccount) {
    super(channelAccount);

    // TeleCMI uses different auth methods:
    // 1. User token for click2call
    // 2. User ID + Secret for admin click2call
    this.apiToken = channelAccount.credentials?.apiToken;
    this.userId = channelAccount.credentials?.userId;
    this.secret = channelAccount.credentials?.secret;
    this.callerId = channelAccount.credentials?.callerId || channelAccount.identifier;
    this.logger = logger.child({ adapter: 'TeleCMI' });
  }

  getChannelType() {
    return 'VOICE';
  }

  getCapabilities() {
    return [
      ChannelCapabilities.VOICE_CALL,
      ChannelCapabilities.CLICK_TO_CALL,
    ];
  }

  /**
   * Initiate a Click-to-Call
   * This connects the agent first, then the customer
   */
  async initiateCall({ to, agentNumber, callerId, customField, metadata = {} }) {
    // Check rate limit
    const rateCheck = await rateLimiter.checkLimit(
      this.channelAccount.id,
      'VOICE',
      'call'
    );

    if (!rateCheck.allowed) {
      return {
        success: false,
        error: 'RATE_LIMITED',
        retryAfter: rateCheck.retryAfter,
      };
    }

    try {
      let result;

      // Use Admin API if we have user_id and secret
      if (this.userId && this.secret) {
        result = await this.initiateAdminClick2Call({ to, agentNumber, callerId, customField, metadata });
      }
      // Use User Token API
      else if (this.apiToken) {
        result = await this.initiateUserClick2Call({ to, agentNumber, callerId, customField, metadata });
      } else {
        throw new Error('No valid TeleCMI credentials configured');
      }

      if (result.success) {
        await rateLimiter.recordAction(this.channelAccount.id, 'VOICE', 'call');

        this.emitEvent(ChannelEventTypes.CALL_INITIATED, {
          externalId: result.requestId,
          to,
          agentNumber,
        });
      }

      return result;
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to initiate TeleCMI call');
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * User Click-to-Call API
   * Uses user authentication token
   */
  async initiateUserClick2Call({ to, callerId, customField, metadata }) {
    const payload = {
      token: this.apiToken,
      to: this.formatPhoneNumber(to),
      extra_params: {
        crm: 'nexora',
        ...metadata,
        customField,
      },
    };

    if (callerId) {
      payload.callerid = this.formatPhoneNumber(callerId);
    }

    const response = await fetch(`${TELECMI_API_BASE}/click2call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data.code === 200) {
      return {
        success: true,
        requestId: data.request_id,
        message: data.msg,
        callSid: data.request_id,
      };
    } else {
      return {
        success: false,
        error: data.msg || 'Failed to initiate call',
        code: data.code,
      };
    }
  }

  /**
   * Admin Click-to-Call API
   * Uses app secret authentication
   */
  async initiateAdminClick2Call({ to, agentNumber, callerId, customField, metadata }) {
    const payload = {
      user_id: this.userId,
      secret: this.secret,
      to: this.formatPhoneNumber(to),
      webrtc: true, // Use softphone by default
      followme: false, // Don't route to mobile
      extra_params: {
        crm: 'nexora',
        ...metadata,
        customField,
      },
    };

    if (callerId || this.callerId) {
      payload.callerid = this.formatPhoneNumber(callerId || this.callerId);
    }

    const response = await fetch(`${TELECMI_API_BASE}/webrtc/click2call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data.code === 200) {
      return {
        success: true,
        requestId: data.request_id,
        message: data.msg,
        callSid: data.request_id,
      };
    } else {
      let errorMessage = data.msg || 'Failed to initiate call';

      // Map error codes
      switch (data.code) {
        case 407:
          errorMessage = 'Invalid app secret';
          break;
        case 404:
          errorMessage = 'Invalid user_id';
          break;
        case 400:
          errorMessage = 'Missing required parameters';
          break;
      }

      return {
        success: false,
        error: errorMessage,
        code: data.code,
      };
    }
  }

  /**
   * Send a message (voice broadcast)
   */
  async sendMessage(message) {
    // TeleCMI voice messages are through click-to-call
    return this.initiateCall({
      to: message.metadata.recipient,
      customField: JSON.stringify({
        type: 'voice_message',
        messageId: message.id,
      }),
      metadata: message.metadata,
    });
  }

  async sendTemplate(templateId, variables, recipient) {
    // Voice templates can be IVR flows
    return {
      success: false,
      error: 'Voice templates not implemented for TeleCMI',
    };
  }

  /**
   * Handle incoming call webhook from TeleCMI
   */
  async handleIncomingCall(payload) {
    const { call_id, caller_id, did_number, status } = payload;

    const callSession = await prisma.callSession.create({
      data: {
        tenantId: this.tenantId,
        workspaceId: this.workspaceId,
        channelAccountId: this.channelAccount.id,
        externalId: call_id,
        direction: 'INBOUND',
        fromNumber: caller_id,
        toNumber: did_number,
        status: 'RINGING',
        initiatedAt: new Date(),
      },
    });

    this.emitEvent(ChannelEventTypes.CALL_RINGING, {
      callSessionId: callSession.id,
      externalId: call_id,
      from: caller_id,
      to: did_number,
    });

    return callSession;
  }

  /**
   * Parse call status webhook from TeleCMI
   */
  async parseStatusWebhook(payload) {
    const {
      call_id,
      status,
      duration,
      recording_url,
      answered_at,
      ended_at,
    } = payload;

    const statusMap = {
      initiated: 'INITIATED',
      ringing: 'RINGING',
      answered: 'IN_PROGRESS',
      completed: 'COMPLETED',
      busy: 'BUSY',
      noanswer: 'NO_ANSWER',
      failed: 'FAILED',
      canceled: 'CANCELLED',
    };

    const mappedStatus = statusMap[status?.toLowerCase()] || status?.toUpperCase();

    // Update call session
    const callSession = await prisma.callSession.findFirst({
      where: { externalId: call_id },
    });

    if (callSession) {
      const updateData = { status: mappedStatus };

      if (mappedStatus === 'IN_PROGRESS') {
        updateData.answeredAt = answered_at ? new Date(answered_at) : new Date();
        this.emitEvent(ChannelEventTypes.CALL_ANSWERED, {
          callSessionId: callSession.id,
          externalId: call_id,
        });
      }

      if (['COMPLETED', 'FAILED', 'BUSY', 'NO_ANSWER'].includes(mappedStatus)) {
        updateData.endedAt = ended_at ? new Date(ended_at) : new Date();
        updateData.durationSeconds = duration ? parseInt(duration) : null;

        if (recording_url) {
          updateData.recordingUrl = recording_url;
          this.emitEvent(ChannelEventTypes.CALL_RECORDING_READY, {
            callSessionId: callSession.id,
            recordingUrl: recording_url,
          });
        }

        // Record usage for billing
        if (duration) {
          await usageMeter.recordUsage({
            tenantId: callSession.tenantId,
            workspaceId: callSession.workspaceId,
            channelAccountId: this.channelAccount.id,
            channelType: 'VOICE',
            eventType: `VOICE_${callSession.direction}_PER_MIN`,
            callSessionId: callSession.id,
            direction: callSession.direction,
            durationSeconds: parseInt(duration),
          });
        }

        if (mappedStatus === 'COMPLETED') {
          this.emitEvent(ChannelEventTypes.CALL_ENDED, {
            callSessionId: callSession.id,
            duration,
          });
        } else {
          this.emitEvent(ChannelEventTypes.CALL_FAILED, {
            callSessionId: callSession.id,
            reason: mappedStatus,
          });
        }
      }

      await prisma.callSession.update({
        where: { id: callSession.id },
        data: updateData,
      });
    }

    return {
      callSessionId: callSession?.id,
      externalId: call_id,
      status: mappedStatus,
      duration,
      recordingUrl: recording_url,
    };
  }

  async parseInboundWebhook(payload) {
    return this.handleIncomingCall(payload);
  }

  async validateCredentials() {
    try {
      // Try a simple API call to validate
      // TeleCMI doesn't have a dedicated validation endpoint
      // We'll check if the token/credentials format is valid

      if (this.userId && this.secret) {
        // For admin API, credentials are validated during actual call
        return {
          valid: true,
          method: 'admin',
          userId: this.userId,
        };
      }

      if (this.apiToken) {
        // Token should be a valid JWT
        try {
          const parts = this.apiToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            return {
              valid: true,
              method: 'user_token',
              orgId: payload.org_id,
              email: payload.email_id,
            };
          }
        } catch {
          return { valid: false, error: 'Invalid token format' };
        }
      }

      return { valid: false, error: 'No credentials configured' };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async getHealthStatus() {
    try {
      const validation = await this.validateCredentials();
      const rateLimitStatus = await rateLimiter.getStatus(this.channelAccount.id, 'VOICE');

      return {
        healthy: validation.valid,
        provider: 'TeleCMI',
        details: {
          credentials: validation,
          rateLimits: rateLimitStatus,
          callerId: this.callerId,
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
    return usageMeter.getCostEstimate('VOICE', 'VOICE_OUTBOUND_PER_MIN', 1, 60);
  }

  async uploadMedia(buffer, mimeType) {
    throw new Error('Voice channel uses recordings, not media uploads');
  }

  async downloadMedia(mediaId) {
    throw new Error('Use recording URLs directly');
  }

  // Helper methods

  /**
   * Format phone number to E.164 format
   */
  formatPhoneNumber(number) {
    if (!number) return number;

    // Remove all non-digits except leading +
    let formatted = number.replace(/[^\d+]/g, '');

    // If no + prefix, assume Indian number and add +91
    if (!formatted.startsWith('+')) {
      if (formatted.startsWith('91') && formatted.length > 10) {
        formatted = '+' + formatted;
      } else if (formatted.length === 10) {
        formatted = '+91' + formatted;
      } else {
        formatted = '+' + formatted;
      }
    }

    return formatted;
  }

  /**
   * End an active call (if supported by TeleCMI)
   */
  async endCall(callSid) {
    // TeleCMI may not support ending calls via API
    // The softphone user typically ends the call
    this.logger.info({ callSid }, 'End call requested - TeleCMI calls are ended via softphone');
    return { success: true, message: 'End call request noted' };
  }

  /**
   * Transfer call (if supported)
   */
  async transferCall(callSid, transferTo) {
    this.logger.info({ callSid, transferTo }, 'Transfer requested - TeleCMI transfers via softphone');
    return { success: true, message: 'Transfer should be done via softphone' };
  }

  /**
   * Hold call (if supported)
   */
  async holdCall(callSid) {
    return { success: true, message: 'Hold should be done via softphone' };
  }

  /**
   * Resume call from hold
   */
  async resumeCall(callSid) {
    return { success: true, message: 'Resume should be done via softphone' };
  }
}

/**
 * Factory function for TeleCMI adapter
 */
export function createTeleCMIAdapter(channelAccount) {
  return new TeleCMIAdapter(channelAccount);
}
