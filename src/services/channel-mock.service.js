import { environmentConfig } from '../config/environment.js';
import { logger } from '../common/logger.js';
import { nanoid } from 'nanoid';

/**
 * Channel Mock Service
 * Mocks external channel integrations (WhatsApp, Email, SMS, Voice) in development mode
 * Logs messages instead of sending them externally
 */
class ChannelMockService {
  /**
   * Mock WhatsApp send (logs instead of sending via MSG91)
   */
  async sendWhatsApp(to, message, options = {}, realService = null) {
    const config = environmentConfig.channels.whatsapp;

    if (config.bypassMSG91) {
      const mockId = `mock-wa-${nanoid(10)}`;

      if (config.logOnly || environmentConfig.logging.logChannelMocks) {
        logger.info('[MOCK WhatsApp] Message NOT sent externally', {
          to,
          message: typeof message === 'string' ? message.substring(0, 100) : message,
          messageId: mockId,
          options,
        });
      }

      // Return mock success response matching real MSG91 response format
      return {
        success: true,
        messageId: mockId,
        status: 'sent',
        to,
        timestamp: new Date().toISOString(),
        mock: true,
        channel: 'whatsapp',
      };
    }

    // Actually send via MSG91
    if (realService && typeof realService.send === 'function') {
      return realService.send(to, message, options);
    }

    throw new Error('Real WhatsApp service not provided');
  }

  /**
   * Mock Email send (logs instead of sending via Resend/MSG91)
   */
  async sendEmail(to, subject, body, options = {}, realService = null) {
    const config = environmentConfig.channels.email;

    if (config.bypassResend || config.bypassMSG91) {
      const mockId = `mock-email-${nanoid(10)}`;

      if (config.logOnly || environmentConfig.logging.logChannelMocks) {
        logger.info('[MOCK Email] Email NOT sent externally', {
          to,
          subject,
          bodyPreview: typeof body === 'string' ? body.substring(0, 100) : '[HTML]',
          messageId: mockId,
          options,
        });
      }

      // Return mock success response
      return {
        success: true,
        messageId: mockId,
        status: 'sent',
        to,
        subject,
        timestamp: new Date().toISOString(),
        mock: true,
        channel: 'email',
      };
    }

    // Actually send via Resend
    if (realService && typeof realService.send === 'function') {
      return realService.send(to, subject, body, options);
    }

    throw new Error('Real Email service not provided');
  }

  /**
   * Mock SMS send (logs instead of sending via Fast2SMS/Infobip/MSG91)
   */
  async sendSMS(to, message, options = {}, realService = null) {
    const config = environmentConfig.channels.sms;

    if (config.bypassFast2SMS || config.bypassInfobip || config.bypassMSG91) {
      const mockId = `mock-sms-${nanoid(10)}`;

      if (config.logOnly || environmentConfig.logging.logChannelMocks) {
        logger.info('[MOCK SMS] SMS NOT sent externally', {
          to,
          message: message.substring(0, 100),
          messageId: mockId,
          options,
        });
      }

      // Return mock success response
      return {
        success: true,
        messageId: mockId,
        status: 'sent',
        to,
        timestamp: new Date().toISOString(),
        mock: true,
        channel: 'sms',
      };
    }

    // Actually send via SMS provider
    if (realService && typeof realService.send === 'function') {
      return realService.send(to, message, options);
    }

    throw new Error('Real SMS service not provided');
  }

  /**
   * Mock Voice call (logs instead of calling via TeleCMI)
   */
  async makeCall(to, options = {}, realService = null) {
    const config = environmentConfig.channels.voice;

    if (config.bypassTeleCMI) {
      const mockId = `mock-call-${nanoid(10)}`;

      if (config.logOnly || environmentConfig.logging.logChannelMocks) {
        logger.info('[MOCK Voice] Call NOT made externally', {
          to,
          callId: mockId,
          options,
        });
      }

      // Return mock success response
      return {
        success: true,
        callId: mockId,
        status: 'initiated',
        to,
        timestamp: new Date().toISOString(),
        mock: true,
        channel: 'voice',
      };
    }

    // Actually make call via TeleCMI
    if (realService && typeof realService.makeCall === 'function') {
      return realService.makeCall(to, options);
    }

    throw new Error('Real Voice service not provided');
  }

  /**
   * Check if a specific channel is mocked
   */
  isChannelMocked(channel) {
    switch (channel) {
      case 'whatsapp':
        return environmentConfig.channels.whatsapp.bypassMSG91;
      case 'email':
        return (
          environmentConfig.channels.email.bypassResend ||
          environmentConfig.channels.email.bypassMSG91
        );
      case 'sms':
        return (
          environmentConfig.channels.sms.bypassFast2SMS ||
          environmentConfig.channels.sms.bypassInfobip ||
          environmentConfig.channels.sms.bypassMSG91
        );
      case 'voice':
        return environmentConfig.channels.voice.bypassTeleCMI;
      default:
        return false;
    }
  }

  /**
   * Get channel configuration
   */
  getChannelConfig(channel) {
    return environmentConfig.channels[channel] || null;
  }

  /**
   * Get all mocked channels
   */
  getMockedChannels() {
    const mocked = [];
    ['whatsapp', 'email', 'sms', 'voice'].forEach((channel) => {
      if (this.isChannelMocked(channel)) {
        mocked.push(channel);
      }
    });
    return mocked;
  }
}

export const channelMockService = new ChannelMockService();
