/**
 * Resend Email Router
 * API endpoints for email sending via Resend
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { resendService } from '../../services/resend.service.js';
import { prisma } from '@crm360/database';
import { logger } from '../../common/logger.js';

const router = Router();

// Validation schemas
const sendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string().min(1, 'Subject is required'),
  html: z.string().optional(),
  text: z.string().optional(),
  from: z.string().optional(),
  replyTo: z.string().email().optional(),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  contactId: z.string().optional(),
  templateId: z.string().optional(),
});

const addDomainSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
  region: z.enum(['us-east-1', 'eu-west-1', 'sa-east-1']).optional(),
});

// =====================
// Resend Configuration
// =====================

/**
 * Get Resend configuration status
 * GET /api/v1/resend
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    // TODO: Implement actual Resend config retrieval
    // For now, return default config status
    res.json({
      success: true,
      data: {
        configured: false,
        apiKeySet: false,
        domains: [],
        message: 'Resend integration not configured yet',
      },
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// Email Sending
// =====================

/**
 * Send a single email
 * POST /api/v1/resend/send
 */
router.post('/send', authenticate, async (req, res, next) => {
  try {
    const validation = sendEmailSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.error.errors[0].message,
      });
    }

    const { tenantId, userId } = req.user;
    const { to, subject, html, text, from, replyTo, cc, bcc, contactId } = validation.data;

    // At least html or text required
    if (!html && !text) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Either html or text content is required',
      });
    }

    // Send email
    const result = await resendService.sendEmail({
      from,
      to,
      subject,
      html,
      text,
      replyTo,
      cc,
      bcc,
    });

    if (result.success) {
      // Log email activity
      try {
        await prisma.activity.create({
          data: {
            tenantId,
            type: 'EMAIL',
            subject: `Email: ${subject}`,
            description: `Sent to ${Array.isArray(to) ? to.join(', ') : to}`,
            contactId: contactId || undefined,
            createdById: userId,
            metadata: {
              provider: 'resend',
              emailId: result.emailId,
              to: Array.isArray(to) ? to : [to],
              subject,
              status: 'SENT',
            },
          },
        });
      } catch (logErr) {
        logger.warn('Failed to log email activity', { error: logErr.message });
      }

      return res.json({
        success: true,
        data: {
          emailId: result.emailId,
          message: 'Email sent successfully',
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: result.code || 'SEND_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Send batch emails (up to 100)
 * POST /api/v1/resend/send/batch
 */
router.post('/send/batch', authenticate, async (req, res, next) => {
  try {
    const { emails } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'emails array is required',
      });
    }

    if (emails.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Maximum 100 emails per batch',
      });
    }

    const result = await resendService.sendBatchEmails(emails);

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
        message: result.message,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'BATCH_SEND_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Get email status
 * GET /api/v1/resend/status/:emailId
 */
router.get('/status/:emailId', authenticate, async (req, res, next) => {
  try {
    const { emailId } = req.params;

    const result = await resendService.getEmailStatus(emailId);

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
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
// Domain Management
// =====================

/**
 * List verified domains
 * GET /api/v1/resend/domains
 */
router.get('/domains', authenticate, async (req, res, next) => {
  try {
    const result = await resendService.listDomains();

    if (result.success) {
      return res.json({
        success: true,
        data: result.domains,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'DOMAINS_FETCH_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Add a domain
 * POST /api/v1/resend/domains
 */
router.post('/domains', authenticate, async (req, res, next) => {
  try {
    const validation = addDomainSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.error.errors[0].message,
      });
    }

    const { domain, region } = validation.data;

    const result = await resendService.addDomain(domain, region);

    if (result.success) {
      return res.status(201).json({
        success: true,
        data: {
          domain: result.domain,
          dnsRecords: result.dnsRecords,
          message: 'Domain added. Please add the DNS records to verify.',
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'DOMAIN_ADD_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Verify domain DNS
 * POST /api/v1/resend/domains/:domainId/verify
 */
router.post('/domains/:domainId/verify', authenticate, async (req, res, next) => {
  try {
    const { domainId } = req.params;

    const result = await resendService.verifyDomain(domainId);

    if (result.success) {
      return res.json({
        success: true,
        data: {
          status: result.status,
          message: result.message,
        },
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'VERIFY_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

// =====================
// Connection Test
// =====================

/**
 * Test Resend connection
 * GET /api/v1/resend/test
 */
router.get('/test', authenticate, async (req, res, next) => {
  try {
    const result = await resendService.testConnection();

    return res.json({
      success: result.success,
      data: {
        connected: result.success,
        message: result.message || result.error,
        domainsCount: result.domainsCount,
        provider: 'resend',
      },
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// Webhook for delivery events
// =====================

/**
 * Resend webhook for delivery events
 * POST /api/v1/resend/webhook
 */
router.post('/webhook', async (req, res, next) => {
  try {
    const event = req.body;

    logger.info('Resend webhook received', { type: event.type, emailId: event.data?.email_id });

    // Handle different event types
    const eventType = event.type;
    const emailId = event.data?.email_id;

    if (emailId) {
      // Update activity record with delivery status
      const statusMap = {
        'email.sent': 'SENT',
        'email.delivered': 'DELIVERED',
        'email.bounced': 'BOUNCED',
        'email.complained': 'COMPLAINED',
        'email.opened': 'OPENED',
        'email.clicked': 'CLICKED',
      };

      const status = statusMap[eventType];

      if (status) {
        try {
          await prisma.activity.updateMany({
            where: {
              metadata: {
                path: ['emailId'],
                equals: emailId,
              },
            },
            data: {
              metadata: {
                status,
                lastEvent: eventType,
                lastEventAt: new Date().toISOString(),
              },
            },
          });
        } catch (updateErr) {
          logger.warn('Failed to update email status', { error: updateErr.message });
        }
      }
    }

    // Always return 200 to acknowledge webhook
    return res.json({ received: true });
  } catch (error) {
    logger.error('Resend webhook error', { error: error.message });
    // Still return 200 to prevent retries
    return res.json({ received: true });
  }
});

export default router;
