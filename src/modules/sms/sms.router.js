/**
 * SMS Router
 * API endpoints for SMS messaging via Fast2SMS
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { fast2smsService } from '../../services/fast2sms.service.js';
import { prisma } from '@crm360/database';
import { logger } from '../../common/logger.js';

const router = Router();

// Validation schemas
const sendSMSSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
  route: z.enum(['q', 'dlt']).optional().default('q'),
  senderId: z.string().optional(),
  contactId: z.string().optional(),
});

const sendOTPSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  otp: z.string().length(6).optional(),
  expiry: z.number().min(1).max(30).optional().default(5),
});

const sendDLTSchema = z.object({
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  templateId: z.string().min(1, 'Template ID is required'),
  variables: z.array(z.string()).optional().default([]),
  senderId: z.string().min(1, 'Sender ID is required'),
});

const bulkSMSSchema = z.object({
  phones: z.array(z.string()).min(1, 'At least one phone number required'),
  message: z.string().min(1, 'Message is required'),
  route: z.enum(['q', 'dlt']).optional().default('q'),
  senderId: z.string().optional(),
});

// =====================
// Send SMS
// =====================

/**
 * Helper: Find or create contact by phone number
 */
async function findOrCreateContact(tenantId, phone, userId) {
  // Normalize phone number to E.164 format
  let normalizedPhone = phone.replace(/\D/g, '');
  if (normalizedPhone.length === 10) {
    normalizedPhone = `+91${normalizedPhone}`;
  } else if (!normalizedPhone.startsWith('+')) {
    normalizedPhone = `+${normalizedPhone}`;
  }

  // Try to find existing contact
  let contact = await prisma.contact.findFirst({
    where: {
      tenantId,
      OR: [
        { phone: normalizedPhone },
        { phone: phone },
        { phone: normalizedPhone.replace('+', '') },
      ],
    },
  });

  // Create contact if not exists
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        tenantId,
        phone: normalizedPhone,
        firstName: 'SMS',
        lastName: normalizedPhone.slice(-4),
        source: 'SMS',
        status: 'ACTIVE',
        ownerId: userId,
      },
    });
    logger.info('Auto-created contact for SMS', { contactId: contact.id, phone: normalizedPhone });
  }

  return contact;
}

/**
 * Helper: Find or create SMS conversation
 */
async function findOrCreateSMSConversation(tenantId, contactId, phone, userId) {
  // Get or create default SMS channel first
  let channel = await prisma.channel.findFirst({
    where: {
      tenantId,
      type: 'SMS',
      isActive: true,
    },
  });

  // Create default SMS channel if not exists
  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        tenantId,
        name: 'SMS Channel',
        type: 'SMS',
        isActive: true,
        config: { provider: 'fast2sms' },
      },
    });
    logger.info('Created default SMS channel', { channelId: channel.id });
  }

  // Find existing SMS conversation for this contact via channel
  let conversation = await prisma.conversation.findFirst({
    where: {
      tenantId,
      contactId,
      channel: {
        type: 'SMS',
      },
    },
  });

  if (!conversation) {
    // Create conversation
    conversation = await prisma.conversation.create({
      data: {
        tenantId,
        channelId: channel.id,
        contactId,
        status: 'OPEN',
        priority: 'MEDIUM',
        assignedToId: userId,
        metadata: { phone },
      },
    });
    logger.info('Created SMS conversation', { conversationId: conversation.id, contactId });
  }

  return conversation;
}

/**
 * Send a single SMS
 * POST /api/v1/sms/send
 */
router.post('/send', authenticate, async (req, res, next) => {
  try {
    const validation = sendSMSSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.error.errors[0].message,
      });
    }

    const { phone, message, route, senderId, contactId: providedContactId } = validation.data;
    const { tenantId, userId } = req.user;

    // Validate phone number
    if (!fast2smsService.validatePhoneNumber(phone)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PHONE',
        message: 'Please provide a valid Indian mobile number',
      });
    }

    // Find or create contact
    const contact = providedContactId
      ? await prisma.contact.findUnique({ where: { id: providedContactId } })
      : await findOrCreateContact(tenantId, phone, userId);

    if (!contact) {
      return res.status(400).json({
        success: false,
        error: 'CONTACT_ERROR',
        message: 'Could not find or create contact',
      });
    }

    // Find or create SMS conversation
    const conversation = await findOrCreateSMSConversation(tenantId, contact.id, phone, userId);

    // Send SMS
    const result = await fast2smsService.sendQuickSMS({
      phone,
      message,
      route,
      senderId,
    });

    if (result.success) {
      // Add message to conversation thread
      await prisma.conversationThread.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          textContent: message,
          channel: 'SMS',
          contentType: 'text',
          externalId: result.requestId,
          status: 'SENT',
          sentAt: new Date(),
          metadata: {
            requestId: result.requestId,
            route,
            provider: 'fast2sms',
          },
        },
      });

      // Update conversation lastMessageAt
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
        },
      });

      // Create activity on contact
      await prisma.activity.create({
        data: {
          tenantId,
          contactId: contact.id,
          type: 'SMS',
          subject: `SMS sent to ${phone}`,
          description: message.substring(0, 200),
          metadata: {
            requestId: result.requestId,
            phone,
            route,
            status: 'SENT',
            provider: 'fast2sms',
            conversationId: conversation.id,
          },
        },
      });

      return res.json({
        success: true,
        data: {
          requestId: result.requestId,
          message: 'SMS sent successfully',
          credits: result.credits,
          contactId: contact.id,
          conversationId: conversation.id,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'SMS_SEND_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Send OTP
 * POST /api/v1/sms/otp
 */
router.post('/otp', authenticate, async (req, res, next) => {
  try {
    const validation = sendOTPSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.error.errors[0].message,
      });
    }

    const { phone, otp, expiry } = validation.data;
    const { tenantId } = req.user;

    // Validate phone number
    if (!fast2smsService.validatePhoneNumber(phone)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PHONE',
        message: 'Please provide a valid Indian mobile number',
      });
    }

    // Send OTP
    const result = await fast2smsService.sendOTP({
      phone,
      otp,
      expiry,
    });

    if (result.success) {
      // Record OTP send in activity log
      await fast2smsService.recordSMS(tenantId, {
        phone,
        message: `OTP: ${result.otp}`,
        route: 'otp',
        requestId: result.requestId,
        status: 'SENT',
      });

      return res.json({
        success: true,
        data: {
          requestId: result.requestId,
          message: 'OTP sent successfully',
          // Don't return OTP in production unless needed
          otp: process.env.NODE_ENV === 'development' ? result.otp : undefined,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'OTP_SEND_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Send DLT template SMS
 * POST /api/v1/sms/dlt
 */
router.post('/dlt', authenticate, async (req, res, next) => {
  try {
    const validation = sendDLTSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.error.errors[0].message,
      });
    }

    const { phone, templateId, variables, senderId } = validation.data;
    const { tenantId } = req.user;

    // Validate phone number
    if (!fast2smsService.validatePhoneNumber(phone)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PHONE',
        message: 'Please provide a valid Indian mobile number',
      });
    }

    // Send DLT SMS
    const result = await fast2smsService.sendDLTTemplateSMS({
      phone,
      templateId,
      variables,
      senderId,
    });

    if (result.success) {
      // Record SMS in activity log
      await fast2smsService.recordSMS(tenantId, {
        phone,
        message: `DLT Template: ${templateId}`,
        route: 'dlt',
        requestId: result.requestId,
        status: 'SENT',
      });

      return res.json({
        success: true,
        data: {
          requestId: result.requestId,
          message: 'DLT SMS sent successfully',
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'DLT_SEND_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Send bulk SMS
 * POST /api/v1/sms/bulk
 */
router.post('/bulk', authenticate, async (req, res, next) => {
  try {
    const validation = bulkSMSSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.error.errors[0].message,
      });
    }

    const { phones, message, route, senderId } = validation.data;
    const { tenantId } = req.user;

    // Validate all phone numbers
    const invalidPhones = phones.filter((p) => !fast2smsService.validatePhoneNumber(p));
    if (invalidPhones.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PHONES',
        message: `Invalid phone numbers: ${invalidPhones.join(', ')}`,
      });
    }

    // Send bulk SMS
    const result = await fast2smsService.sendBulkSMS({
      phones,
      message,
      route,
      senderId,
    });

    if (result.success) {
      // Record bulk SMS in activity log
      await fast2smsService.recordSMS(tenantId, {
        phone: phones.join(','),
        message,
        route,
        requestId: result.requestId,
        status: 'SENT',
      });

      return res.json({
        success: true,
        data: {
          requestId: result.requestId,
          message: 'Bulk SMS sent successfully',
          recipientCount: result.recipientCount,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'BULK_SEND_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

// =====================
// Status & Balance
// =====================

/**
 * Get SMS balance
 * GET /api/v1/sms/balance
 */
router.get('/balance', authenticate, async (req, res, next) => {
  try {
    const result = await fast2smsService.getBalance();

    if (result.success) {
      return res.json({
        success: true,
        data: {
          balance: result.balance,
          currency: result.currency,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'BALANCE_FETCH_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Test SMS connection
 * GET /api/v1/sms/test
 */
router.get('/test', authenticate, async (req, res, next) => {
  try {
    const result = await fast2smsService.testConnection();

    return res.json({
      success: result.success,
      data: {
        connected: result.success,
        message: result.message || result.error,
        balance: result.balance,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get delivery status
 * GET /api/v1/sms/status/:requestId
 */
router.get('/status/:requestId', authenticate, async (req, res, next) => {
  try {
    const { requestId } = req.params;

    const result = await fast2smsService.getDeliveryStatus(requestId);

    if (result.success) {
      return res.json({
        success: true,
        data: result.status,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'STATUS_FETCH_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

// =====================
// SMS History
// =====================

/**
 * Get SMS history
 * GET /api/v1/sms/history
 */
router.get('/history', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { page = 1, limit = 20, contactId } = req.query;

    const where = {
      tenantId,
      type: { in: ['SMS_SENT', 'SMS_RECEIVED'] },
    };

    if (contactId) {
      where.contactId = contactId;
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
        select: {
          id: true,
          subject: true,
          description: true,
          metadata: true,
          createdAt: true,
        },
      }),
      prisma.activity.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        messages: activities.map((a) => ({
          id: a.id,
          phone: a.metadata?.phone,
          message: a.description,
          requestId: a.metadata?.requestId,
          status: a.metadata?.status,
          route: a.metadata?.route,
          createdAt: a.createdAt,
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// Webhook for delivery reports (if configured)
// =====================

/**
 * Fast2SMS delivery report webhook
 * POST /api/v1/sms/webhook/delivery
 */
router.post('/webhook/delivery', async (req, res, next) => {
  try {
    const { request_id, mobile, status, datetime } = req.body;

    logger.info('Fast2SMS delivery report received', {
      requestId: request_id,
      mobile,
      status,
      datetime,
    });

    // Update activity record if exists
    await prisma.activity.updateMany({
      where: {
        metadata: {
          path: ['requestId'],
          equals: request_id,
        },
      },
      data: {
        metadata: {
          status,
          deliveredAt: datetime,
        },
      },
    });

    return res.json({ success: true });
  } catch (error) {
    logger.error('Webhook processing error', { error: error.message });
    // Always return 200 to webhook
    return res.json({ success: true });
  }
});

// =====================
// Messages
// =====================

/**
 * Send an SMS message (simplified endpoint)
 */
router.post('/messages', async (req, res, next) => {
  try {
    const data = z
      .object({
        to: z.string(),
        message: z.string(),
        from: z.string().optional(),
      })
      .parse(req.body);

    // TODO: Implement actual SMS sending via SMS service
    // For now, return mock response
    const result = {
      id: 'sms_' + Date.now(),
      to: data.to,
      from: data.from || 'NEXORA',
      status: 'sent',
      sentAt: new Date().toISOString(),
      tenantId: req.tenantId,
    };

    res.status(201).json({
      success: true,
      data: result,
      message: 'SMS sent successfully',
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// Stats
// =====================

/**
 * Get SMS messaging statistics
 */
router.get('/stats', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    // TODO: Implement actual stats aggregation from SMS messages
    // For now, return empty stats with proper structure
    res.json({
      success: true,
      data: {
        totalSent: 0,
        totalFailed: 0,
        totalDelivered: 0,
        sentToday: 0,
        deliveryRate: 0,
        avgCost: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
