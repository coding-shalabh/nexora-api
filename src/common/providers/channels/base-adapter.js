/**
 * Base Channel Adapter
 * Abstract base class for all channel adapters (WhatsApp, SMS, Email, Voice)
 * Implements the adapter pattern for unified multi-channel messaging
 */

import { logger } from '../../logger.js';
import { eventBus, createEvent } from '../../events/event-bus.js';

/**
 * Normalized message structure that all adapters work with
 */
export class NormalizedMessage {
  constructor(data) {
    this.id = data.id;
    this.externalId = data.externalId || null;
    this.threadId = data.threadId;
    this.channelType = data.channelType;
    this.channelAccountId = data.channelAccountId;
    this.direction = data.direction; // INBOUND | OUTBOUND
    this.contentType = data.contentType; // TEXT | IMAGE | VIDEO | AUDIO | DOCUMENT | TEMPLATE | VOICE_CALL | VOICE_MESSAGE
    this.content = data.content;
    this.metadata = data.metadata || {};
    this.status = data.status || 'PENDING';
    this.sentAt = data.sentAt || null;
    this.deliveredAt = data.deliveredAt || null;
    this.readAt = data.readAt || null;
    this.failedAt = data.failedAt || null;
    this.errorCode = data.errorCode || null;
    this.errorMessage = data.errorMessage || null;
    this.cost = data.cost || null;
  }
}

/**
 * Normalized contact structure
 */
export class NormalizedContact {
  constructor(data) {
    this.id = data.id;
    this.externalId = data.externalId || null;
    this.identifier = data.identifier; // phone number, email address, etc.
    this.name = data.name || null;
    this.metadata = data.metadata || {};
  }
}

/**
 * Channel adapter capabilities
 */
export const ChannelCapabilities = {
  TEXT: 'text',
  RICH_TEXT: 'rich_text',
  IMAGES: 'images',
  VIDEOS: 'videos',
  AUDIO: 'audio',
  DOCUMENTS: 'documents',
  TEMPLATES: 'templates',
  INTERACTIVE: 'interactive',
  VOICE_CALL: 'voice_call',
  VOICE_MESSAGE: 'voice_message',
  READ_RECEIPTS: 'read_receipts',
  DELIVERY_RECEIPTS: 'delivery_receipts',
  TYPING_INDICATORS: 'typing_indicators',
  REACTIONS: 'reactions',
  REPLIES: 'replies',
};

/**
 * Base adapter class - all channel adapters extend this
 */
export class BaseChannelAdapter {
  constructor(channelAccount) {
    if (new.target === BaseChannelAdapter) {
      throw new Error('BaseChannelAdapter is abstract and cannot be instantiated directly');
    }

    this.channelAccount = channelAccount;
    this.tenantId = channelAccount.tenantId;
    this.workspaceId = channelAccount.workspaceId;
    this.logger = logger.child({
      adapter: this.getChannelType(),
      channelAccountId: channelAccount.id,
    });
  }

  /**
   * Get the channel type (must be implemented by subclass)
   * @returns {string} WHATSAPP | SMS | EMAIL | VOICE
   */
  getChannelType() {
    throw new Error('getChannelType must be implemented by subclass');
  }

  /**
   * Get supported capabilities for this channel
   * @returns {string[]} Array of capability strings
   */
  getCapabilities() {
    throw new Error('getCapabilities must be implemented by subclass');
  }

  /**
   * Check if a capability is supported
   * @param {string} capability
   * @returns {boolean}
   */
  hasCapability(capability) {
    return this.getCapabilities().includes(capability);
  }

  /**
   * Send a message through the channel
   * @param {NormalizedMessage} message
   * @returns {Promise<{success: boolean, externalId?: string, error?: string}>}
   */
  async sendMessage(message) {
    throw new Error('sendMessage must be implemented by subclass');
  }

  /**
   * Send a template message (if supported)
   * @param {string} templateId
   * @param {object} variables
   * @param {string} recipient
   * @returns {Promise<{success: boolean, externalId?: string, error?: string}>}
   */
  async sendTemplate(templateId, variables, recipient) {
    throw new Error('sendTemplate must be implemented by subclass');
  }

  /**
   * Parse incoming webhook payload into normalized message
   * @param {object} payload
   * @returns {Promise<NormalizedMessage>}
   */
  async parseInboundWebhook(payload) {
    throw new Error('parseInboundWebhook must be implemented by subclass');
  }

  /**
   * Parse status update webhook into message status
   * @param {object} payload
   * @returns {Promise<{messageId: string, status: string, timestamp: Date, error?: string}>}
   */
  async parseStatusWebhook(payload) {
    throw new Error('parseStatusWebhook must be implemented by subclass');
  }

  /**
   * Validate channel credentials/configuration
   * @returns {Promise<{valid: boolean, error?: string}>}
   */
  async validateCredentials() {
    throw new Error('validateCredentials must be implemented by subclass');
  }

  /**
   * Get current account health/status
   * @returns {Promise<{healthy: boolean, details: object}>}
   */
  async getHealthStatus() {
    throw new Error('getHealthStatus must be implemented by subclass');
  }

  /**
   * Refresh OAuth tokens (for email channels)
   * @returns {Promise<{success: boolean, newTokens?: object}>}
   */
  async refreshTokens() {
    return { success: true }; // Default no-op for non-OAuth channels
  }

  /**
   * Get message cost estimate
   * @param {NormalizedMessage} message
   * @returns {Promise<{cost: number, currency: string, breakdown: object}>}
   */
  async estimateCost(message) {
    throw new Error('estimateCost must be implemented by subclass');
  }

  /**
   * Upload media file to provider
   * @param {Buffer} buffer
   * @param {string} mimeType
   * @returns {Promise<{mediaId: string, url?: string}>}
   */
  async uploadMedia(buffer, mimeType) {
    throw new Error('uploadMedia must be implemented by subclass');
  }

  /**
   * Download media from provider
   * @param {string} mediaId
   * @returns {Promise<Buffer>}
   */
  async downloadMedia(mediaId) {
    throw new Error('downloadMedia must be implemented by subclass');
  }

  // Helper methods for all adapters

  /**
   * Emit a channel event
   */
  emitEvent(type, payload) {
    eventBus.publish(createEvent(type, this.tenantId, {
      channelAccountId: this.channelAccount.id,
      channelType: this.getChannelType(),
      ...payload,
    }));
  }

  /**
   * Log with adapter context
   */
  log(level, message, data = {}) {
    this.logger[level]({ ...data }, message);
  }
}

/**
 * Extended event types for channels
 */
export const ChannelEventTypes = {
  // Message lifecycle
  MESSAGE_QUEUED: 'channel.message.queued',
  MESSAGE_SENT: 'channel.message.sent',
  MESSAGE_DELIVERED: 'channel.message.delivered',
  MESSAGE_READ: 'channel.message.read',
  MESSAGE_FAILED: 'channel.message.failed',
  MESSAGE_RECEIVED: 'channel.message.received',

  // Call events
  CALL_INITIATED: 'channel.call.initiated',
  CALL_RINGING: 'channel.call.ringing',
  CALL_ANSWERED: 'channel.call.answered',
  CALL_ENDED: 'channel.call.ended',
  CALL_FAILED: 'channel.call.failed',
  CALL_RECORDING_READY: 'channel.call.recording_ready',

  // Channel health
  CHANNEL_CONNECTED: 'channel.connected',
  CHANNEL_DISCONNECTED: 'channel.disconnected',
  CHANNEL_ERROR: 'channel.error',
  CHANNEL_RATE_LIMITED: 'channel.rate_limited',

  // Consent
  CONSENT_GRANTED: 'channel.consent.granted',
  CONSENT_REVOKED: 'channel.consent.revoked',
  OPT_OUT_RECEIVED: 'channel.opt_out.received',
};
