/**
 * AI Assistant Service
 * Core orchestration for WhatsApp AI Assistant
 */

import { prisma } from '@crm360/database';
import { IntentClassifierService } from './intent-classifier.service.js';
import { ToolExecutorService } from './tool-executor.service.js';
import { AIProviderService } from './ai-provider.service.js';
import { ResponseFormatterService } from './response-formatter.service.js';
import { RateLimiterService } from './rate-limiter.service.js';
import { logger } from '../../common/utils/logger.js';

export class AIAssistantService {
  constructor() {
    this.intentClassifier = new IntentClassifierService();
    this.toolExecutor = new ToolExecutorService();
    this.aiProvider = new AIProviderService();
    this.responseFormatter = new ResponseFormatterService();
    this.rateLimiter = new RateLimiterService();
  }

  /**
   * Process incoming WhatsApp query from AI-linked user
   * @param {Object} params - Query parameters
   * @param {string} params.whatsappNumber - User's WhatsApp number
   * @param {string} params.messageContent - User's message text
   * @param {string} params.externalId - MSG91 message ID
   * @param {Object} params.user - User object with tenant and permissions
   * @param {Object} params.channelAccount - WhatsApp channel account
   */
  async processQuery({ whatsappNumber, messageContent, externalId, user, channelAccount }) {
    try {
      logger.info({ whatsappNumber, userId: user.id }, 'Processing AI Assistant query');

      // 1. Check rate limit
      const rateLimitOk = await this.rateLimiter.checkLimit(user.id, user.tenantId);
      if (!rateLimitOk) {
        await this.sendResponse(whatsappNumber, channelAccount, {
          content:
            '⚠️ You have reached your daily query limit (100 queries/day). Please try again tomorrow.',
          error: true,
        });
        return;
      }

      // 2. Get or create conversation
      const conversation = await this.getOrCreateConversation(
        user.id,
        user.tenantId,
        whatsappNumber
      );

      // 3. Store inbound message
      await this.storeMessage({
        conversationId: conversation.id,
        tenantId: user.tenantId,
        userId: user.id,
        direction: 'INBOUND',
        content: messageContent,
      });

      // 4. Build user context
      const userContext = {
        userId: user.id,
        tenantId: user.tenantId,
        permissions: this.extractPermissions(user),
        roleLevel: user.roles?.[0]?.role?.level || 0,
        conversationHistory: conversation.context || [],
      };

      // 5. Call AI with tool definitions
      const startTime = Date.now();
      const aiResponse = await this.aiProvider.processWithTools(
        messageContent,
        userContext,
        async (toolName, toolArgs) => {
          return await this.toolExecutor.executeTool(toolName, toolArgs, userContext);
        }
      );
      const processingTime = Date.now() - startTime;

      // 6. Format response for WhatsApp
      const formattedResponse = this.responseFormatter.formatForWhatsApp(aiResponse);

      // 7. Send response via WhatsApp
      await this.sendResponse(whatsappNumber, channelAccount, {
        content: formattedResponse,
        aiModel: aiResponse.model,
        promptTokens: aiResponse.usage?.promptTokens,
        completionTokens: aiResponse.usage?.completionTokens,
        processingTime,
      });

      // 8. Store outbound message
      await this.storeMessage({
        conversationId: conversation.id,
        tenantId: user.tenantId,
        userId: user.id,
        direction: 'OUTBOUND',
        content: formattedResponse,
        intent: aiResponse.intent,
        aiModel: aiResponse.model,
        aiPromptTokens: aiResponse.usage?.promptTokens,
        aiCompletionTokens: aiResponse.usage?.completionTokens,
        processingTimeMs: processingTime,
      });

      // 9. Update usage tracking
      await this.rateLimiter.recordQuery(
        user.id,
        user.tenantId,
        aiResponse.usage?.totalTokens || 0,
        aiResponse.usage?.cost || 0
      );

      // 10. Update conversation context
      await this.updateConversationContext(conversation.id, messageContent, formattedResponse);

      logger.info({ userId: user.id, processingTime }, 'AI Assistant query processed successfully');
    } catch (error) {
      logger.error({ error, whatsappNumber }, 'Failed to process AI Assistant query');

      // Send error message to user
      await this.sendResponse(whatsappNumber, channelAccount, {
        content: '❌ Sorry, I encountered an error processing your request. Please try again.',
        error: true,
      });

      // Store error message
      if (error.conversationId) {
        await this.storeMessage({
          conversationId: error.conversationId,
          tenantId: user.tenantId,
          userId: user.id,
          direction: 'OUTBOUND',
          content: 'Error occurred',
          errorMessage: error.message,
        });
      }
    }
  }

  /**
   * Get or create conversation for user
   */
  async getOrCreateConversation(userId, tenantId, whatsappNumber) {
    let conversation = await prisma.aIAssistantConversation.findFirst({
      where: {
        userId,
        tenantId,
        whatsappNumber,
        status: 'ACTIVE',
      },
    });

    if (!conversation) {
      conversation = await prisma.aIAssistantConversation.create({
        data: {
          userId,
          tenantId,
          whatsappNumber,
          status: 'ACTIVE',
        },
      });
    }

    return conversation;
  }

  /**
   * Store message in database
   */
  async storeMessage(data) {
    return await prisma.aIAssistantMessage.create({
      data: {
        ...data,
        sentAt: new Date(),
      },
    });
  }

  /**
   * Update conversation context (last 10 messages)
   */
  async updateConversationContext(conversationId, userMessage, aiResponse) {
    const conversation = await prisma.aIAssistantConversation.findUnique({
      where: { id: conversationId },
      select: { context: true, messageCount: true },
    });

    const context = conversation.context || [];
    context.push(
      { role: 'user', content: userMessage },
      { role: 'assistant', content: aiResponse }
    );

    // Keep only last 10 messages (20 entries)
    const recentContext = context.slice(-20);

    await prisma.aIAssistantConversation.update({
      where: { id: conversationId },
      data: {
        context: recentContext,
        messageCount: { increment: 1 },
        lastMessageAt: new Date(),
      },
    });
  }

  /**
   * Send response via WhatsApp
   */
  async sendResponse(whatsappNumber, channelAccount, { content, error = false }) {
    try {
      // Import WhatsApp service dynamically to avoid circular dependency
      const { WhatsAppService } = await import('../channels/providers/whatsapp.service.js');
      const whatsappService = new WhatsAppService(channelAccount);

      await whatsappService.sendText(whatsappNumber, content);
    } catch (err) {
      logger.error({ error: err, whatsappNumber }, 'Failed to send WhatsApp response');
      throw err;
    }
  }

  /**
   * Extract user permissions from roles
   */
  extractPermissions(user) {
    if (!user.roles || user.roles.length === 0) return [];

    const permissions = new Set();

    user.roles.forEach((userRole) => {
      if (userRole.role && userRole.role.permissions) {
        userRole.role.permissions.forEach((rp) => {
          if (rp.permission) {
            permissions.add(rp.permission.code);
          }
        });
      }
    });

    return Array.from(permissions);
  }
}
