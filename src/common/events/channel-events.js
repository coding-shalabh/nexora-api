/**
 * Channel-specific event types
 * Extends the base event types for multi-channel messaging
 */

export const ChannelEvents = {
  // Channel message lifecycle events
  CHANNEL_MESSAGE_QUEUED: 'channel.message.queued',
  CHANNEL_MESSAGE_SENT: 'channel.message.sent',
  CHANNEL_MESSAGE_DELIVERED: 'channel.message.delivered',
  CHANNEL_MESSAGE_READ: 'channel.message.read',
  CHANNEL_MESSAGE_FAILED: 'channel.message.failed',
  CHANNEL_MESSAGE_RECEIVED: 'channel.message.received',

  // Voice call events
  CALL_INITIATED: 'channel.call.initiated',
  CALL_RINGING: 'channel.call.ringing',
  CALL_ANSWERED: 'channel.call.answered',
  CALL_ENDED: 'channel.call.ended',
  CALL_FAILED: 'channel.call.failed',
  CALL_RECORDING_READY: 'channel.call.recording_ready',

  // Channel health events
  CHANNEL_CONNECTED: 'channel.connected',
  CHANNEL_DISCONNECTED: 'channel.disconnected',
  CHANNEL_ERROR: 'channel.error',
  CHANNEL_RATE_LIMITED: 'channel.rate_limited',

  // Consent events
  CONSENT_GRANTED: 'channel.consent.granted',
  CONSENT_REVOKED: 'channel.consent.revoked',
  OPT_OUT_RECEIVED: 'channel.opt_out.received',

  // Sequence events
  SEQUENCE_ENROLLED: 'sequence.enrolled',
  SEQUENCE_STEP_EXECUTED: 'sequence.step.executed',
  SEQUENCE_STEP_FAILED: 'sequence.step.failed',
  SEQUENCE_COMPLETED: 'sequence.completed',
  SEQUENCE_PAUSED: 'sequence.paused',
  SEQUENCE_UNENROLLED: 'sequence.unenrolled',
};
