/**
 * Channels Module Index
 * Multi-channel messaging framework for CRM360
 *
 * Provides unified API for:
 * - WhatsApp (MSG91)
 * - SMS (MSG91 with DLT compliance)
 * - Email (Gmail/Microsoft 365/SMTP)
 * - Voice (Exotel)
 *
 * Features:
 * - Adapter pattern for channel abstraction
 * - Rate limiting per channel
 * - Usage metering for PAYG billing
 * - Consent and opt-out management
 * - Normalized message events
 */

export { channelService } from './channel-service.js';
export { channelRegistry } from './channel-registry.js';
export { rateLimiter } from './rate-limiter.js';
export { usageMeter } from './usage-meter.js';

export {
  BaseChannelAdapter,
  NormalizedMessage,
  NormalizedContact,
  ChannelCapabilities,
  ChannelEventTypes,
} from './base-adapter.js';

export {
  WhatsAppAdapter,
  SMSAdapter,
  EmailAdapter,
  VoiceAdapter,
  getAdapterFactory,
} from './adapters/index.js';
