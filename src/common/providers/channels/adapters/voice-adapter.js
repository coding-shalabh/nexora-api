/**
 * Voice Channel Adapter
 * Implements Voice calls via Exotel/MSG91 Voice
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

const VOICE_API_BASE = process.env.VOICE_API_URL || 'https://api.exotel.com/v1';

export class VoiceAdapter extends BaseChannelAdapter {
  constructor(channelAccount) {
    super(channelAccount);
    this.apiKey = channelAccount.credentials?.apiKey;
    this.apiToken = channelAccount.credentials?.apiToken;
    this.accountSid = channelAccount.credentials?.accountSid;
    this.phoneNumber = channelAccount.identifier;
    this.exophoneNumber = channelAccount.credentials?.exophoneNumber;
  }

  getChannelType() {
    return 'VOICE';
  }

  getCapabilities() {
    return [
      ChannelCapabilities.VOICE_CALL,
      ChannelCapabilities.VOICE_MESSAGE,
    ];
  }

  /**
   * Initiate an outbound call
   */
  async initiateCall({ to, from, callerId, appId, customField, metadata = {} }) {
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

    // Check concurrent calls limit
    const activeCalls = await this.getActiveCallCount();
    if (activeCalls >= 5) { // Default concurrent limit
      return {
        success: false,
        error: 'CONCURRENT_CALL_LIMIT',
        details: 'Maximum concurrent calls reached',
      };
    }

    try {
      const payload = {
        From: from || this.phoneNumber,
        To: to,
        CallerId: callerId || this.exophoneNumber,
        CallType: 'trans',
        Url: `${process.env.API_BASE_URL}/webhooks/voice/connect`,
        StatusCallback: `${process.env.API_BASE_URL}/webhooks/voice/status`,
        StatusCallbackEvents: ['initiated', 'ringing', 'answered', 'completed'],
        CustomField: customField,
      };

      const response = await fetch(`${VOICE_API_BASE}/Accounts/${this.accountSid}/Calls/connect.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(payload),
      });

      const data = await response.json();

      if (response.ok && data.Call?.Sid) {
        await rateLimiter.recordAction(this.channelAccount.id, 'VOICE', 'call');

        // Create call session record
        const callSession = await prisma.callSession.create({
          data: {
            tenantId: this.tenantId,
            workspaceId: this.workspaceId,
            channelAccountId: this.channelAccount.id,
            externalId: data.Call.Sid,
            direction: 'OUTBOUND',
            fromNumber: from || this.phoneNumber,
            toNumber: to,
            status: 'INITIATED',
            initiatedAt: new Date(),
            metadata,
          },
        });

        this.emitEvent(ChannelEventTypes.CALL_INITIATED, {
          callSessionId: callSession.id,
          externalId: data.Call.Sid,
          to,
          from: from || this.phoneNumber,
        });

        return {
          success: true,
          externalId: data.Call.Sid,
          callSessionId: callSession.id,
        };
      } else {
        return {
          success: false,
          error: data.RestException?.Message || 'Failed to initiate call',
          errorCode: data.RestException?.Code,
        };
      }
    } catch (error) {
      this.log('error', 'Failed to initiate call', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send a text-to-speech or recorded message
   */
  async sendMessage(message) {
    // Voice messages are typically part of IVR flows
    // This could be a voice broadcast or recorded message

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
      // Create an outbound call with TTS/recorded message
      const result = await this.initiateCall({
        to: message.metadata.recipient,
        appId: message.content.ivrAppId,
        customField: JSON.stringify({
          type: 'voice_message',
          messageId: message.id,
          ttsText: message.content.ttsText,
          audioUrl: message.content.audioUrl,
        }),
        metadata: message.metadata,
      });

      if (result.success) {
        this.emitEvent(ChannelEventTypes.MESSAGE_SENT, {
          messageId: message.id,
          externalId: result.externalId,
        });
      }

      return result;
    } catch (error) {
      this.log('error', 'Failed to send voice message', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendTemplate(templateId, variables, recipient) {
    // Voice templates are IVR flows
    try {
      const template = await prisma.template.findUnique({
        where: { id: templateId },
      });

      if (!template || template.channelType !== 'VOICE') {
        return {
          success: false,
          error: 'TEMPLATE_NOT_FOUND',
        };
      }

      const message = new NormalizedMessage({
        channelType: 'VOICE',
        channelAccountId: this.channelAccount.id,
        direction: 'OUTBOUND',
        contentType: 'VOICE_MESSAGE',
        content: {
          ivrAppId: template.metadata?.ivrAppId,
          ttsText: this.substituteVariables(template.content, variables),
        },
        metadata: {
          recipient,
          templateId,
        },
      });

      return this.sendMessage(message);
    } catch (error) {
      this.log('error', 'Failed to send voice template', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Handle incoming call webhook
   */
  async handleIncomingCall(payload) {
    const { CallSid, From, To, Direction, CallStatus } = payload;

    const callSession = await prisma.callSession.create({
      data: {
        tenantId: this.tenantId,
        workspaceId: this.workspaceId,
        channelAccountId: this.channelAccount.id,
        externalId: CallSid,
        direction: 'INBOUND',
        fromNumber: From,
        toNumber: To,
        status: 'RINGING',
        initiatedAt: new Date(),
      },
    });

    this.emitEvent(ChannelEventTypes.CALL_RINGING, {
      callSessionId: callSession.id,
      externalId: CallSid,
      from: From,
      to: To,
    });

    return callSession;
  }

  /**
   * Parse call status webhook
   */
  async parseStatusWebhook(payload) {
    const { CallSid, Status, Duration, RecordingUrl, StartTime, EndTime } = payload;

    const statusMap = {
      initiated: 'INITIATED',
      ringing: 'RINGING',
      'in-progress': 'IN_PROGRESS',
      completed: 'COMPLETED',
      busy: 'BUSY',
      'no-answer': 'NO_ANSWER',
      failed: 'FAILED',
      canceled: 'CANCELLED',
    };

    const mappedStatus = statusMap[Status] || Status.toUpperCase();

    // Update call session
    const callSession = await prisma.callSession.findFirst({
      where: { externalId: CallSid },
    });

    if (callSession) {
      const updateData = {
        status: mappedStatus,
      };

      if (mappedStatus === 'IN_PROGRESS') {
        updateData.answeredAt = new Date();
        this.emitEvent(ChannelEventTypes.CALL_ANSWERED, {
          callSessionId: callSession.id,
          externalId: CallSid,
        });
      }

      if (mappedStatus === 'COMPLETED' || mappedStatus === 'FAILED' ||
          mappedStatus === 'BUSY' || mappedStatus === 'NO_ANSWER') {
        updateData.endedAt = new Date();
        updateData.durationSeconds = Duration ? parseInt(Duration) : null;

        if (RecordingUrl) {
          updateData.recordingUrl = RecordingUrl;
          this.emitEvent(ChannelEventTypes.CALL_RECORDING_READY, {
            callSessionId: callSession.id,
            recordingUrl: RecordingUrl,
          });
        }

        // Record usage for billing
        if (Duration) {
          await usageMeter.recordUsage({
            tenantId: callSession.tenantId,
            workspaceId: callSession.workspaceId,
            channelAccountId: this.channelAccount.id,
            channelType: 'VOICE',
            eventType: `VOICE_${callSession.direction}_PER_MIN`,
            callSessionId: callSession.id,
            direction: callSession.direction,
            durationSeconds: parseInt(Duration),
          });
        }

        if (mappedStatus === 'COMPLETED') {
          this.emitEvent(ChannelEventTypes.CALL_ENDED, {
            callSessionId: callSession.id,
            duration: Duration,
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
      externalId: CallSid,
      status: mappedStatus,
      duration: Duration,
      recordingUrl: RecordingUrl,
    };
  }

  async parseInboundWebhook(payload) {
    // Parse incoming call data
    return this.handleIncomingCall(payload);
  }

  async validateCredentials() {
    try {
      const response = await fetch(`${VOICE_API_BASE}/Accounts/${this.accountSid}.json`, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64')}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.Account) {
        return {
          valid: true,
          accountStatus: data.Account.Status,
          balance: data.Account.Balance,
        };
      } else {
        return { valid: false, error: data.RestException?.Message };
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async getHealthStatus() {
    try {
      const validation = await this.validateCredentials();
      const rateLimitStatus = await rateLimiter.getStatus(this.channelAccount.id, 'VOICE');
      const activeCalls = await this.getActiveCallCount();

      return {
        healthy: validation.valid,
        details: {
          credentials: validation,
          rateLimits: rateLimitStatus,
          phoneNumber: this.phoneNumber,
          exophoneNumber: this.exophoneNumber,
          activeCalls,
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

  // Voice doesn't support media uploads in traditional sense
  async uploadMedia(buffer, mimeType) {
    throw new Error('Voice channel uses IVR recordings, not media uploads');
  }

  async downloadMedia(mediaId) {
    throw new Error('Use recording URLs directly');
  }

  // Helper methods

  async getActiveCallCount() {
    const count = await prisma.callSession.count({
      where: {
        channelAccountId: this.channelAccount.id,
        status: { in: ['INITIATED', 'RINGING', 'IN_PROGRESS'] },
      },
    });
    return count;
  }

  substituteVariables(content, variables) {
    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  /**
   * Transfer an active call
   */
  async transferCall(callSid, transferTo) {
    try {
      const response = await fetch(
        `${VOICE_API_BASE}/Accounts/${this.accountSid}/Calls/${callSid}.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            Legs: [{ To: transferTo }],
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.RestException?.Message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * End an active call
   */
  async endCall(callSid) {
    try {
      const response = await fetch(
        `${VOICE_API_BASE}/Accounts/${this.accountSid}/Calls/${callSid}.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            Status: 'completed',
          }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.RestException?.Message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Start call recording
   */
  async startRecording(callSid) {
    try {
      const response = await fetch(
        `${VOICE_API_BASE}/Accounts/${this.accountSid}/Calls/${callSid}/Recordings.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${this.apiKey}:${this.apiToken}`).toString('base64')}`,
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        return { success: true, recordingSid: data.Recording?.Sid };
      } else {
        return { success: false, error: data.RestException?.Message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

/**
 * Factory function for Voice adapter
 */
export function createVoiceAdapter(channelAccount) {
  return new VoiceAdapter(channelAccount);
}
