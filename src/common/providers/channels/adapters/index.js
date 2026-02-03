/**
 * Channel Adapters Index
 * Exports all channel adapter factories
 */

export { WhatsAppAdapter, createWhatsAppAdapter } from './whatsapp-adapter.js';
export { SMSAdapter, createSMSAdapter } from './sms-adapter.js';
export { EmailAdapter, createEmailAdapter } from './email-adapter.js';
export { VoiceAdapter, createVoiceAdapter as createExotelAdapter } from './voice-adapter.js';
export { TeleCMIAdapter, createTeleCMIAdapter } from './telecmi-adapter.js';

// Import factories for smart routing
import { createVoiceAdapter as createExotel } from './voice-adapter.js';
import { createTeleCMIAdapter as createTeleCMI } from './telecmi-adapter.js';

/**
 * Smart voice adapter factory
 * Selects the appropriate voice provider based on channel account configuration
 */
export function createVoiceAdapter(channelAccount) {
  // Check provider from credentials or metadata
  const provider = channelAccount.credentials?.provider ||
                   channelAccount.metadata?.provider ||
                   'exotel'; // Default to exotel for backward compatibility

  if (provider === 'telecmi') {
    return createTeleCMI(channelAccount);
  }

  // Default to Exotel
  return createExotel(channelAccount);
}

/**
 * Get adapter factory by channel type
 */
export function getAdapterFactory(channelType) {
  const factories = {
    WHATSAPP: createWhatsAppAdapter,
    SMS: createSMSAdapter,
    EMAIL: createEmailAdapter,
    VOICE: createVoiceAdapter,
  };

  return factories[channelType];
}
