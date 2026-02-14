/**
 * Link Initiation Service
 * Handles WhatsApp-initiated linking flow
 */

import { prisma } from '@crm360/database';
import { logger } from '../../common/utils/logger.js';
import crypto from 'crypto';

export class LinkInitiationService {
  /**
   * Detect user intent from message
   * Returns: 'link', 'login', 'about', 'help', 'pricing', 'contact', null
   */
  detectIntent(messageContent) {
    const lowerMessage = messageContent.toLowerCase().trim();

    // Link account intent
    if (
      lowerMessage.includes('link') ||
      lowerMessage.includes('connect') ||
      lowerMessage.includes('register') ||
      lowerMessage.includes('signup') ||
      lowerMessage.includes('sign up') ||
      lowerMessage.includes('activate')
    ) {
      return 'link';
    }

    // Login intent
    if (
      lowerMessage.includes('login') ||
      lowerMessage.includes('log in') ||
      lowerMessage.includes('signin') ||
      lowerMessage.includes('sign in')
    ) {
      return 'login';
    }

    // About Nexora intent
    if (
      lowerMessage.includes('about') ||
      lowerMessage.includes('what is nexora') ||
      lowerMessage.includes('tell me more')
    ) {
      return 'about';
    }

    // Pricing intent
    if (
      lowerMessage.includes('price') ||
      lowerMessage.includes('cost') ||
      lowerMessage.includes('plan')
    ) {
      return 'pricing';
    }

    // Help/Support intent
    if (
      lowerMessage.includes('help') ||
      lowerMessage.includes('support') ||
      lowerMessage.includes('assist')
    ) {
      return 'help';
    }

    // Contact intent
    if (
      lowerMessage.includes('contact') ||
      lowerMessage.includes('reach') ||
      lowerMessage.includes('talk')
    ) {
      return 'contact';
    }

    return null; // No specific intent detected
  }

  /**
   * Initiate linking process by sending authorization link template
   * @param {string} whatsappNumber - User's WhatsApp number
   * @param {Object} channelAccount - WhatsApp channel account
   */
  async initiateLinking(whatsappNumber, channelAccount) {
    try {
      logger.info({ whatsappNumber }, 'Initiating WhatsApp AI Assistant linking');

      // 1. Generate secure state token (CSRF protection)
      const state = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      // 2. Store state in database (temporary linking session)
      await prisma.whatsAppLinkSession.create({
        data: {
          state,
          whatsappNumber,
          expiresAt,
          status: 'PENDING',
        },
      });

      // 3. Send WhatsApp template with authorization link
      await this.sendAuthorizationTemplate(whatsappNumber, state, channelAccount);

      logger.info({ whatsappNumber, state }, 'Authorization link sent via WhatsApp');
      return { success: true, state };
    } catch (error) {
      logger.error({ error, whatsappNumber }, 'Failed to initiate linking');

      // Send error message to user
      await this.sendPlainMessage(
        whatsappNumber,
        channelAccount,
        '❌ Sorry, something went wrong. Please try again or visit Settings > AI Assistant in your Nexora dashboard.'
      );

      throw error;
    }
  }

  /**
   * Send authorization template via MSG91
   */
  async sendAuthorizationTemplate(whatsappNumber, state, channelAccount) {
    try {
      const templateName = 'nexora_ai_link_request';
      const templateParams = [state]; // {{1}} = state token

      // Import WhatsApp service
      const { WhatsAppService } = await import('../channels/providers/whatsapp.service.js');
      const whatsappService = new WhatsAppService(channelAccount);

      // Send template message
      await whatsappService.sendTemplate({
        to: whatsappNumber,
        templateName,
        templateParams,
      });

      logger.info({ whatsappNumber, templateName, state }, 'Authorization template sent');
    } catch (error) {
      logger.error({ error, whatsappNumber }, 'Failed to send authorization template');
      throw error;
    }
  }

  /**
   * Send plain text message (fallback)
   */
  async sendPlainMessage(whatsappNumber, channelAccount, message) {
    try {
      const { WhatsAppService } = await import('../channels/providers/whatsapp.service.js');
      const whatsappService = new WhatsAppService(channelAccount);

      await whatsappService.sendText(whatsappNumber, message);
    } catch (error) {
      logger.error({ error, whatsappNumber }, 'Failed to send plain message');
    }
  }

  /**
   * Handle message from unlinked user
   * Detects intent and sends appropriate automated response
   */
  async handleUnlinkedUser(whatsappNumber, messageContent, channelAccount) {
    try {
      const intent = this.detectIntent(messageContent);
      logger.info({ whatsappNumber, intent, message: messageContent }, 'Handling unlinked user');

      let responseMessage;

      switch (intent) {
        case 'link':
          // User wants to link - send authorization link template
          return await this.initiateLinking(whatsappNumber, channelAccount);

        case 'login':
          responseMessage = `🔐 *Login to Nexora*

Visit: https://nexoraos.pro

Your email: Check your registered email
Password: Use your Nexora password

Forgot password? Click "Forgot Password" on login page

Need help? Reply "help"`;
          break;

        case 'about':
          responseMessage = `🚀 *About Nexora*

Nexora is an all-in-one Business OS for small-medium businesses.

Features:
• CRM & Sales Pipeline
• Customer Support (Inbox, Tickets)
• WhatsApp, Email, SMS channels
• Marketing Automation
• Project Management
• HR & Payroll
• Finance & Invoicing
• AI-powered Analytics

Learn more: https://72orionx.com

Want to link your account? Reply "link my account"`;
          break;

        case 'pricing':
          responseMessage = `💰 *Nexora Pricing*

Starter Plan: ₹1,999/month
• Up to 5 users
• All core features
• WhatsApp, Email, SMS
• 1000 contacts

Growth Plan: ₹4,999/month
• Up to 20 users
• Advanced automation
• Priority support
• Unlimited contacts

Enterprise: Custom pricing
• Unlimited users
• Dedicated support
• Custom integrations

View details: https://nexoraos.pro/pricing

Already a customer? Reply "link my account"`;
          break;

        case 'help':
          responseMessage = `🤝 *How Can I Help?*

Reply with:
• "login" - Get login link
• "about" - Learn about Nexora
• "pricing" - View pricing plans
• "link my account" - Connect WhatsApp AI
• "contact" - Contact support

Already using Nexora? Link your account to get:
• Real-time business analytics
• AI-powered insights
• Automated reports

Reply "link my account" to get started!`;
          break;

        case 'contact':
          responseMessage = `📞 *Contact Nexora Support*

Email: admin@helixcode.in
Website: https://72orionx.com
Hours: Mon-Fri, 9 AM - 6 PM IST

For existing customers:
Link your account to get instant AI-powered support!

Reply "link my account" to connect`;
          break;

        default:
          // Welcome message for any other message
          responseMessage = `👋 *Welcome to Nexora AI Assistant!*

I can help you with:
• Login to your account
• Learn about Nexora
• View pricing plans
• Link your WhatsApp for AI assistance

Reply with what you need:
• "login"
• "about"
• "pricing"
• "link my account"
• "help"

How can I assist you today?`;
          break;
      }

      await this.sendPlainMessage(whatsappNumber, channelAccount, responseMessage);
      return { success: true, action: intent || 'welcome', responseSent: true };
    } catch (error) {
      logger.error({ error, whatsappNumber }, 'Error handling unlinked user');
      throw error;
    }
  }
}
