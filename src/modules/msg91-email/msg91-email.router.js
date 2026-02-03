/**
 * MSG91 Email Router
 * API endpoints for email sending via MSG91
 * Cost-effective alternative to Resend for Indian market
 *
 * IMPORTANT: MSG91 Email requires:
 * 1. Verified domain with DKIM/SPF/DMARC records
 * 2. Approved email template (created in MSG91 dashboard)
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { msg91EmailService } from '../../services/msg91-email.service.js';
import { prisma } from '@crm360/database';
import { logger } from '../../common/logger.js';

const router = Router();

// Validation schemas
const sendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  domain: z.string().min(1, 'Domain is required'),
  templateId: z.string().min(1, 'Template ID is required'),
  variables: z.record(z.any()).optional(),
  from: z.string().optional(),
  fromName: z.string().optional(),
  replyTo: z.string().email().optional(),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  contactId: z.string().optional(),
});

const addDomainSchema = z.object({
  domain: z.string().min(1, 'Domain is required'),
});

// =====================
// Email Sending
// =====================

/**
 * Send a single email
 * POST /api/v1/msg91-email/send
 *
 * Required: domain, templateId, to
 * Note: Create templates in MSG91 dashboard first
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
    const { to, domain, templateId, variables, from, fromName, replyTo, cc, bcc, contactId } =
      validation.data;

    // Send email
    const result = await msg91EmailService.sendEmail({
      from,
      fromName,
      to,
      domain,
      templateId,
      variables,
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
            subject: `Email via MSG91 template: ${templateId}`,
            description: `Sent to ${Array.isArray(to) ? to.join(', ') : to}`,
            contactId: contactId || undefined,
            createdById: userId,
            metadata: {
              provider: 'msg91',
              emailId: result.emailId,
              to: Array.isArray(to) ? to : [to],
              templateId,
              domain,
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
          provider: 'msg91',
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
 * Send batch emails
 * POST /api/v1/msg91-email/send/batch
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

    const result = await msg91EmailService.sendBatchEmails(emails);

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
        errors: result.errors,
        message: result.message,
        provider: 'msg91',
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'BATCH_SEND_FAILED',
        message: result.error,
        errors: result.errors,
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Get email logs
 * GET /api/v1/msg91-email/logs
 */
router.get('/logs', authenticate, async (req, res, next) => {
  try {
    const { startDate, endDate, templateId, email } = req.query;

    const result = await msg91EmailService.getEmailLogs({
      startDate,
      endDate,
      templateId,
      email,
    });

    if (result.success) {
      return res.json({
        success: true,
        data: result.logs,
        total: result.total,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'LOGS_FETCH_FAILED',
        message: result.error,
      });
    }
  } catch (error) {
    next(error);
  }
});

// =====================
// Templates
// =====================

/**
 * Get email templates
 * GET /api/v1/msg91-email/templates
 */
router.get('/templates', authenticate, async (req, res, next) => {
  try {
    const result = await msg91EmailService.getEmailTemplates();

    if (result.success) {
      return res.json({
        success: true,
        data: result.templates,
      });
    } else {
      return res.status(400).json({
        success: false,
        error: 'TEMPLATES_FETCH_FAILED',
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
 * GET /api/v1/msg91-email/domains
 */
router.get('/domains', authenticate, async (req, res, next) => {
  try {
    const result = await msg91EmailService.getDomains();

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
 * POST /api/v1/msg91-email/domains
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

    const { domain } = validation.data;

    const result = await msg91EmailService.addDomain(domain);

    if (result.success) {
      return res.status(201).json({
        success: true,
        data: {
          domain: result.domain,
          dnsRecords: result.dnsRecords,
          message: result.message,
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
 * POST /api/v1/msg91-email/domains/:domain/verify
 */
router.post('/domains/:domain/verify', authenticate, async (req, res, next) => {
  try {
    const { domain } = req.params;

    const result = await msg91EmailService.verifyDomain(domain);

    if (result.success) {
      return res.json({
        success: true,
        data: {
          verified: result.verified,
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
 * Test MSG91 Email connection
 * GET /api/v1/msg91-email/test
 */
router.get('/test', authenticate, async (req, res, next) => {
  try {
    const result = await msg91EmailService.testConnection();

    return res.json({
      success: result.success,
      data: {
        connected: result.success,
        message: result.message || result.error,
        domainsCount: result.domainsCount,
        provider: 'msg91',
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
 * MSG91 webhook for email delivery events
 * POST /api/v1/msg91-email/webhook
 */
router.post('/webhook', async (req, res, next) => {
  try {
    const event = req.body;

    logger.info('MSG91 email webhook received', {
      type: event.type || event.event,
      emailId: event.request_id || event.message_id,
    });

    // Handle different event types
    const eventType = event.type || event.event;
    const emailId = event.request_id || event.message_id;

    if (emailId) {
      // Update activity record with delivery status
      const statusMap = {
        sent: 'SENT',
        delivered: 'DELIVERED',
        bounced: 'BOUNCED',
        opened: 'OPENED',
        clicked: 'CLICKED',
        spam: 'SPAM',
        unsubscribed: 'UNSUBSCRIBED',
        failed: 'FAILED',
      };

      const status = statusMap[eventType?.toLowerCase()];

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
    logger.error('MSG91 email webhook error', { error: error.message });
    // Still return 200 to prevent retries
    return res.json({ received: true });
  }
});

export default router;
