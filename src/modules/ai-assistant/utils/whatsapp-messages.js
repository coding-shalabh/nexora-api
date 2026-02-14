/**
 * WhatsApp Message Templates
 * Pre-defined messages for AI Assistant lifecycle events
 */

import { logger } from '../../../common/utils/logger.js';

const WHATSAPP_NUMBER = process.env.AI_ASSISTANT_WHATSAPP_NUMBER;

/**
 * Send welcome message after successful linking
 */
export async function sendWelcomeMessage(toNumber) {
  const message = `🎉 *Welcome to Nexora AI Assistant!*

Your WhatsApp is now linked. I can help you with:

📊 *Business Analytics*
• Sales reports & pipeline metrics
• CRM statistics (contacts, companies)
• Ticket & project insights

💰 *Subscription Management*
• Check your plan & billing
• View usage statistics

⏰ *Automated Reports*
• Daily/weekly summaries
• Real-time event alerts

Just send me a message like:
• "Show this month's sales"
• "What's my plan?"
• "Schedule daily report at 9 AM"

Your link expires in 30 days. You'll get a reminder to renew.

Let's get started! 🚀`;

  return await sendWhatsAppMessage(toNumber, message);
}

/**
 * Send goodbye message after unlinking
 */
export async function sendGoodbyeMessage(toNumber) {
  const message = `👋 *Goodbye from Nexora AI Assistant*

Your WhatsApp AI Assistant has been unlinked.

You can re-link anytime from:
Settings > AI Assistant

Thank you for using Nexora! 💙`;

  return await sendWhatsAppMessage(toNumber, message);
}

/**
 * Send expiry reminder (3 days before expiry)
 */
export async function sendExpiryReminder(toNumber, daysRemaining) {
  const message = `⏰ *Link Expiry Reminder*

Your Nexora AI Assistant link expires in *${daysRemaining} days*.

To continue receiving updates:
1. Visit Settings > AI Assistant
2. Click "Renew Link"

Don't lose access to your AI assistant! 🔗`;

  return await sendWhatsAppMessage(toNumber, message);
}

/**
 * Send link expired notification
 */
export async function sendExpiredNotification(toNumber) {
  const message = `🔒 *Link Expired*

Your Nexora AI Assistant link has expired.

To re-activate:
1. Visit Settings > AI Assistant
2. Link your WhatsApp again

We'll be here when you're ready! 😊`;

  return await sendWhatsAppMessage(toNumber, message);
}

/**
 * Helper: Send WhatsApp message via MSG91
 */
async function sendWhatsAppMessage(toNumber, message) {
  try {
    // Import WhatsApp service dynamically
    const { prisma } = await import('@crm360/database');

    // Get the Nexora WhatsApp channel account
    const channelAccount = await prisma.channelAccount.findFirst({
      where: {
        channel: {
          type: 'WHATSAPP',
        },
        isActive: true,
      },
      include: {
        channel: true,
      },
    });

    if (!channelAccount) {
      logger.warn('No active WhatsApp channel found for AI Assistant');
      return;
    }

    // Import and use WhatsApp service
    const { WhatsAppService } = await import('../../channels/providers/whatsapp.service.js');
    const whatsappService = new WhatsAppService(channelAccount);

    await whatsappService.sendText(toNumber, message);
    logger.info({ toNumber }, 'AI Assistant message sent');
  } catch (error) {
    logger.error({ error, toNumber }, 'Failed to send AI Assistant message');
    throw error;
  }
}
