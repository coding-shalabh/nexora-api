/**
 * WhatsApp Router
 * API endpoints for WhatsApp messaging
 *
 * Routes:
 * POST /api/v1/whatsapp/connect/byok          - Connect using own MSG91 key
 * POST /api/v1/whatsapp/connect/managed       - Connect using Nexora's account
 * GET  /api/v1/whatsapp/accounts              - List WhatsApp accounts
 * GET  /api/v1/whatsapp/accounts/:id          - Get account details
 * DELETE /api/v1/whatsapp/accounts/:id        - Disconnect account
 * GET  /api/v1/whatsapp/accounts/:id/templates - Get templates
 * POST /api/v1/whatsapp/accounts/:id/templates - Create template
 * DELETE /api/v1/whatsapp/accounts/:id/templates/:name - Delete template
 * POST /api/v1/whatsapp/accounts/:id/send/template - Send template message
 * POST /api/v1/whatsapp/accounts/:id/send/text - Send text message
 * POST /api/v1/whatsapp/accounts/:id/send/media - Send media message
 * POST /api/v1/whatsapp/webhook/:id           - Receive webhooks
 * GET  /api/v1/whatsapp/accounts/:id/health   - Check health
 * GET  /api/v1/whatsapp/balance               - Get MSG91 wallet balance
 */

import { Router } from 'express';
import { z } from 'zod';
import { whatsAppService } from '../../common/providers/whatsapp/index.js';
import { prisma } from '@crm360/database';

const router = Router();

// =====================
// Validation Schemas
// =====================

const connectBYOKSchema = z.object({
  name: z.string().optional(),
  msg91AuthKey: z.string().min(10, 'Invalid MSG91 auth key'),
});

const connectManagedSchema = z.object({
  name: z.string().optional(),
  phoneNumber: z.string().min(10, 'Invalid phone number'),
});

const sendTemplateSchema = z.object({
  recipient: z.string().min(10),
  templateName: z.string().min(1),
  languageCode: z.string().optional().default('en'),
  components: z
    .object({
      header: z.union([z.string(), z.array(z.string())]).optional(),
      body: z.union([z.string(), z.array(z.string())]).optional(),
      buttons: z.array(z.any()).optional(),
    })
    .optional()
    .default({}),
});

const sendTextSchema = z.object({
  recipient: z.string().min(10),
  text: z.string().min(1),
});

const sendMediaSchema = z.object({
  recipient: z.string().min(10),
  mediaType: z.enum(['image', 'video', 'document', 'audio']),
  mediaUrl: z.string().url(),
  caption: z.string().optional(),
});

const createTemplateSchema = z.object({
  templateName: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_]+$/, 'Template name must be lowercase with underscores'),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).optional().default('MARKETING'),
  language: z.string().optional().default('en'),
  components: z
    .array(
      z.object({
        type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']),
        format: z.string().optional(),
        text: z.string().optional(),
        buttons: z.array(z.any()).optional(),
        example: z.any().optional(),
      })
    )
    .optional()
    .default([]),
});

// =====================
// Root Endpoint
// =====================

/**
 * Get WhatsApp overview
 * GET /whatsapp
 */
router.get('/', async (req, res, next) => {
  try {
    const { tenantId } = req;

    // Get connected accounts count (with fallback if prisma fails)
    let accountsCount = 0;
    try {
      accountsCount = await prisma.channelAccount.count({
        where: {
          tenantId,
          provider: 'MSG91',
          isActive: true,
        },
      });
    } catch (dbError) {
      // Fallback to 0 if database query fails
      accountsCount = 0;
    }

    res.json({
      success: true,
      data: {
        available: true,
        connectedAccounts: accountsCount,
        message: 'WhatsApp messaging service is available',
        endpoints: {
          connect: '/connect/byok, /connect/managed',
          accounts: '/accounts',
          send: '/accounts/:id/send/template, /accounts/:id/send/text',
          balance: '/balance',
          stats: '/stats',
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// Connection Endpoints
// =====================

/**
 * Connect WhatsApp using BYOK (Bring Your Own Key)
 */
router.post('/connect/byok', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const data = connectBYOKSchema.parse(req.body);

    const result = await whatsAppService.connectBYOK({
      tenantId,
      name: data.name,
      msg91AuthKey: data.msg91AuthKey,
    });

    res.status(201).json({
      success: true,
      data: {
        channelAccount: result.channelAccount,
        integratedNumbers: result.integratedNumbers,
      },
      message: 'WhatsApp connected successfully (BYOK mode)',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }
    next(error);
  }
});

/**
 * Connect WhatsApp using Nexora's managed account
 */
router.post('/connect/managed', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const data = connectManagedSchema.parse(req.body);

    const result = await whatsAppService.connectManaged({
      tenantId,
      name: data.name,
      phoneNumber: data.phoneNumber,
    });

    res.status(201).json({
      success: true,
      data: result.channelAccount,
      message: 'WhatsApp connected successfully (Managed mode)',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }
    next(error);
  }
});

// =====================
// Balance (must be before /accounts/:id)
// =====================

/**
 * Get MSG91 wallet balance
 */
router.get('/balance', async (req, res, next) => {
  try {
    const { tenantId } = req;

    // Get first active WhatsApp account for tenant
    const account = await prisma.channelAccount.findFirst({
      where: {
        tenantId,
        type: 'WHATSAPP',
        status: 'ACTIVE',
      },
    });

    if (!account) {
      return res.json({
        success: true,
        data: { balance: null, message: 'No active WhatsApp account' },
      });
    }

    // Get balance from MSG91
    const authKey = await whatsAppService.getAuthKey(account.id);
    const result = await whatsAppService.getBalance(authKey);

    res.json({
      success: result.success,
      data: {
        balance: result.balance,
        currency: result.currency || 'INR',
      },
      error: result.error,
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// Account Management
// =====================

/**
 * List WhatsApp accounts for tenant
 */
router.get('/accounts', async (req, res, next) => {
  try {
    const { tenantId } = req;

    const accounts = await prisma.channelAccount.findMany({
      where: {
        tenantId,
        type: 'WHATSAPP',
      },
      select: {
        id: true,
        name: true,
        provider: true,
        phoneNumber: true,
        status: true,
        healthStatus: true,
        lastHealthCheck: true,
        createdAt: true,
        providerConfig: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Don't expose auth keys in list
    const safeAccounts = accounts.map((acc) => ({
      ...acc,
      isActive: acc.status === 'ACTIVE',
      mode: acc.providerConfig?.mode || 'BYOK',
      providerConfig: undefined,
      hasApiKey: !!acc.providerConfig?.msg91AuthKey,
    }));

    res.json({
      success: true,
      data: safeAccounts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get WhatsApp account details
 */
router.get('/accounts/:id', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;

    const account = await prisma.channelAccount.findFirst({
      where: {
        id,
        tenantId,
        type: 'WHATSAPP',
      },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'WhatsApp account not found',
      });
    }

    // Get templates
    const authKey = await whatsAppService.getAuthKey(id);
    const templates = await whatsAppService.getTemplates(authKey, account.phoneNumber);

    res.json({
      success: true,
      data: {
        id: account.id,
        name: account.name,
        phoneNumber: account.phoneNumber,
        provider: account.provider,
        mode: account.providerConfig?.mode || 'BYOK',
        businessName: account.providerConfig?.businessName,
        isActive: account.status === 'ACTIVE',
        healthStatus: account.healthStatus,
        lastHealthCheck: account.lastHealthCheck,
        templates: templates.success ? templates.approvedTemplates : [],
        allTemplates: templates.success ? templates.templates : [],
        createdAt: account.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Disconnect WhatsApp account
 */
router.delete('/accounts/:id', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;

    const account = await prisma.channelAccount.findFirst({
      where: { id, tenantId, type: 'WHATSAPP' },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'WhatsApp account not found',
      });
    }

    await prisma.channelAccount.update({
      where: { id },
      data: {
        status: 'DISCONNECTED',
        providerConfig: {
          ...account.providerConfig,
          msg91AuthKey: null, // Remove auth key on disconnect
          disconnectedAt: new Date().toISOString(),
        },
      },
    });

    res.json({
      success: true,
      message: 'WhatsApp account disconnected',
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// Templates
// =====================

/**
 * Get templates for account
 */
router.get('/accounts/:id/templates', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;

    const account = await prisma.channelAccount.findFirst({
      where: { id, tenantId, type: 'WHATSAPP' },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
      });
    }

    const authKey = await whatsAppService.getAuthKey(id);
    const result = await whatsAppService.getTemplates(authKey, account.phoneNumber);

    res.json({
      success: result.success,
      data: result.templates || [],
      approvedTemplates: result.approvedTemplates || [],
      error: result.error,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create template
 */
router.post('/accounts/:id/templates', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const data = createTemplateSchema.parse(req.body);

    const account = await prisma.channelAccount.findFirst({
      where: { id, tenantId, type: 'WHATSAPP' },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
      });
    }

    const result = await whatsAppService.createTemplate({
      channelAccountId: id,
      templateName: data.templateName,
      category: data.category,
      language: data.language,
      components: data.components,
    });

    res.status(result.success ? 201 : 400).json({
      success: result.success,
      data: result.success
        ? {
            templateId: result.templateId,
            templateName: data.templateName,
            status: 'PENDING',
          }
        : null,
      message: result.message || result.error,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }
    next(error);
  }
});

/**
 * Delete template
 */
router.delete('/accounts/:id/templates/:templateName', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id, templateName } = req.params;

    const account = await prisma.channelAccount.findFirst({
      where: { id, tenantId, type: 'WHATSAPP' },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
      });
    }

    const result = await whatsAppService.deleteTemplate({
      channelAccountId: id,
      templateName,
    });

    res.json({
      success: result.success,
      message: result.success ? 'Template deleted' : result.error,
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// Messaging
// =====================

/**
 * Send template message
 */
router.post('/accounts/:id/send/template', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const data = sendTemplateSchema.parse(req.body);

    const account = await prisma.channelAccount.findFirst({
      where: { id, tenantId, type: 'WHATSAPP' },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
      });
    }

    if (account.status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'CHANNEL_INACTIVE',
        message: 'WhatsApp channel is not active',
      });
    }

    const result = await whatsAppService.sendTemplate({
      channelAccountId: id,
      recipient: data.recipient,
      templateName: data.templateName,
      languageCode: data.languageCode,
      components: data.components,
    });

    // TODO: Add proper message event logging
    // For now, just log to console
    if (result.success) {
      console.log('WhatsApp template sent:', {
        recipient: data.recipient,
        templateName: data.templateName,
        messageId: result.messageId,
      });
    }

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result.success ? { messageId: result.messageId } : null,
      error: result.error,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }
    next(error);
  }
});

/**
 * Send text message (within 24hr window)
 */
router.post('/accounts/:id/send/text', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const data = sendTextSchema.parse(req.body);

    const account = await prisma.channelAccount.findFirst({
      where: { id, tenantId, type: 'WHATSAPP' },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
      });
    }

    const result = await whatsAppService.sendText({
      channelAccountId: id,
      recipient: data.recipient,
      text: data.text,
    });

    // TODO: Add proper message event logging
    if (result.success) {
      console.log('WhatsApp text sent:', {
        recipient: data.recipient,
        messageId: result.messageId,
      });
    }

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result.success ? { messageId: result.messageId } : null,
      error: result.error,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }
    next(error);
  }
});

/**
 * Send media message
 */
router.post('/accounts/:id/send/media', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const data = sendMediaSchema.parse(req.body);

    const account = await prisma.channelAccount.findFirst({
      where: { id, tenantId, type: 'WHATSAPP' },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
      });
    }

    const result = await whatsAppService.sendMedia({
      channelAccountId: id,
      recipient: data.recipient,
      mediaType: data.mediaType,
      mediaUrl: data.mediaUrl,
      caption: data.caption,
    });

    // TODO: Add proper message event logging
    if (result.success) {
      console.log('WhatsApp media sent:', {
        recipient: data.recipient,
        mediaType: data.mediaType,
        messageId: result.messageId,
      });
    }

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result.success ? { messageId: result.messageId } : null,
      error: result.error,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        details: error.errors,
      });
    }
    next(error);
  }
});

// =====================
// Webhooks
// =====================

/**
 * Receive MSG91 webhook
 */
router.post('/webhook/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Immediately respond to webhook
    res.status(200).json({ success: true });

    // Process asynchronously
    whatsAppService.processWebhook(id, req.body).catch((error) => {
      console.error('Webhook processing error:', error);
    });
  } catch (error) {
    // Always return 200 to prevent retries
    res.status(200).json({ success: false });
  }
});

// =====================
// Health Check
// =====================

/**
 * Check account health
 */
router.get('/accounts/:id/health', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;

    const account = await prisma.channelAccount.findFirst({
      where: { id, tenantId, type: 'WHATSAPP' },
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
      });
    }

    const result = await whatsAppService.checkHealth(id);

    res.json({
      success: true,
      data: {
        healthy: result.healthy,
        status: result.healthy ? 'HEALTHY' : 'UNHEALTHY',
        numbers: result.numbers,
        error: result.error,
        lastCheck: new Date(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// Messages
// =====================

/**
 * Send a WhatsApp message (simplified endpoint)
 */
router.post('/messages', async (req, res, next) => {
  try {
    const data = z
      .object({
        to: z.string(),
        message: z.string().optional(),
        template: z.string().optional(),
        mediaUrl: z.string().optional(),
      })
      .parse(req.body);

    // TODO: Implement actual message sending via WhatsApp service
    // For now, return mock response
    const result = {
      id: 'msg_' + Date.now(),
      to: data.to,
      status: 'sent',
      sentAt: new Date().toISOString(),
      tenantId: req.tenantId,
    };

    res.status(201).json({
      success: true,
      data: result,
      message: 'Message sent successfully',
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// Stats
// =====================

/**
 * Get WhatsApp messaging statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    // TODO: Implement actual stats aggregation from conversations/messages
    // For now, return empty stats with proper structure
    res.json({
      success: true,
      data: {
        totalSent: 0,
        totalReceived: 0,
        totalConversations: 0,
        activeConversations: 0,
        sentToday: 0,
        receivedToday: 0,
        responseRate: 0,
        avgResponseTime: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as whatsAppRouter };
