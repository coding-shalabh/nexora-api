/**
 * White-Label Email Service Router
 * API endpoints for tenant email management (domains, templates, sending)
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { emailService } from '../../services/email.service.js';
import { logger } from '../../common/logger.js';

const router = Router();

// =====================
// ROOT ENDPOINT
// =====================

/**
 * Get email service status
 * GET /api/v1/email-service
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req.user;

    res.json({
      success: true,
      data: {
        configured: true,
        domainsCount: 0,
        templatesCount: 0,
        emailsSentToday: 0,
        message: 'Email service is active',
      },
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// Validation Schemas
// =====================

const addDomainSchema = z.object({
  domain: z
    .string()
    .min(3)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/, 'Invalid domain format'),
});

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  subject: z.string().min(1, 'Subject is required').max(200),
  htmlContent: z.string().min(1, 'HTML content is required'),
  textContent: z.string().optional(),
  jsonContent: z.any().optional(),
  variables: z
    .array(z.object({ name: z.string(), defaultValue: z.string().optional() }))
    .optional(),
  category: z.enum(['transactional', 'marketing', 'notification']).optional(),
  domainId: z.string().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subject: z.string().min(1).max(200).optional(),
  htmlContent: z.string().min(1).optional(),
  textContent: z.string().optional(),
  jsonContent: z.any().optional(),
  variables: z
    .array(z.object({ name: z.string(), defaultValue: z.string().optional() }))
    .optional(),
  category: z.enum(['transactional', 'marketing', 'notification']).optional(),
  domainId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

const sendEmailSchema = z.object({
  templateId: z.string().min(1, 'Template ID is required'),
  to: z.string().email('Invalid email address'),
  variables: z.record(z.string()).optional(),
  contactId: z.string().optional(),
  fromName: z.string().optional(),
  replyTo: z.string().email().optional(),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  useTestDomain: z.boolean().optional(), // Use Resend test domain for testing
});

const sendRawEmailSchema = z.object({
  to: z.string().email('Invalid email address'),
  subject: z.string().min(1, 'Subject is required'),
  html: z.string().min(1, 'HTML content is required'),
  text: z.string().optional(),
  domainId: z.string().optional(),
  contactId: z.string().optional(),
  fromName: z.string().optional(),
  replyTo: z.string().email().optional(),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  useTestDomain: z.boolean().optional(), // Use Resend test domain for testing
});

// =====================
// DOMAIN ENDPOINTS
// =====================

/**
 * List tenant domains
 * GET /api/v1/email-service/domains
 */
router.get('/domains', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const result = await emailService.listDomains(tenantId);

    if (result.success) {
      return res.json({ success: true, data: result.domains });
    }
    return res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    next(error);
  }
});

/**
 * Get domain by ID
 * GET /api/v1/email-service/domains/:id
 */
router.get('/domains/:id', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const result = await emailService.getDomain(tenantId, id);

    if (result.success) {
      return res.json({ success: true, data: result.domain });
    }
    return res.status(result.code === 'NOT_FOUND' ? 404 : 400).json({
      success: false,
      error: result.code,
      message: result.error,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Add a domain
 * POST /api/v1/email-service/domains
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

    const { tenantId } = req.user;
    const { domain } = validation.data;
    const result = await emailService.addDomain(tenantId, domain);

    if (result.success) {
      return res.status(201).json({
        success: true,
        data: {
          domain: result.domain,
          dnsRecords: result.dnsRecords,
        },
        message: result.message,
      });
    }
    return res.status(400).json({
      success: false,
      error: result.code,
      message: result.error,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Verify domain
 * POST /api/v1/email-service/domains/:id/verify
 * Body: { manual: true } to mark as manually verified
 */
router.post('/domains/:id/verify', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { manual } = req.body || {};
    const result = await emailService.verifyDomain(tenantId, id, manual === true);

    if (result.success) {
      return res.json({
        success: true,
        data: result.domain,
        message: result.message,
      });
    }
    return res.status(400).json({
      success: false,
      error: result.code,
      message: result.error || result.message,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Set default domain
 * POST /api/v1/email-service/domains/:id/set-default
 */
router.post('/domains/:id/set-default', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const result = await emailService.setDefaultDomain(tenantId, id);

    if (result.success) {
      return res.json({ success: true, data: result.domain });
    }
    return res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete domain
 * DELETE /api/v1/email-service/domains/:id
 */
router.delete('/domains/:id', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const result = await emailService.deleteDomain(tenantId, id);

    if (result.success) {
      return res.json({ success: true, message: result.message });
    }
    return res.status(result.code === 'NOT_FOUND' ? 404 : 400).json({
      success: false,
      error: result.code,
      message: result.error,
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// TEMPLATE ENDPOINTS
// =====================

/**
 * List templates
 * GET /api/v1/email-service/templates
 */
router.get('/templates', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { category, isActive, domainId } = req.query;

    const result = await emailService.listTemplates(tenantId, {
      category,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      domainId,
    });

    if (result.success) {
      return res.json({ success: true, data: result.templates });
    }
    return res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    next(error);
  }
});

/**
 * Get template by ID
 * GET /api/v1/email-service/templates/:id
 */
router.get('/templates/:id', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const result = await emailService.getTemplate(tenantId, id);

    if (result.success) {
      return res.json({ success: true, data: result.template });
    }
    return res.status(result.code === 'NOT_FOUND' ? 404 : 400).json({
      success: false,
      error: result.code,
      message: result.error,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create template
 * POST /api/v1/email-service/templates
 */
router.post('/templates', authenticate, async (req, res, next) => {
  try {
    const validation = createTemplateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.error.errors[0].message,
      });
    }

    const { tenantId, userId } = req.user;
    const result = await emailService.createTemplate(tenantId, {
      ...validation.data,
      createdById: userId,
    });

    if (result.success) {
      return res.status(201).json({ success: true, data: result.template });
    }
    return res.status(400).json({
      success: false,
      error: result.code,
      message: result.error,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update template
 * PUT /api/v1/email-service/templates/:id
 */
router.put('/templates/:id', authenticate, async (req, res, next) => {
  try {
    const validation = updateTemplateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.error.errors[0].message,
      });
    }

    const { tenantId } = req.user;
    const { id } = req.params;
    const result = await emailService.updateTemplate(tenantId, id, validation.data);

    if (result.success) {
      return res.json({ success: true, data: result.template });
    }
    return res.status(result.code === 'NOT_FOUND' ? 404 : 400).json({
      success: false,
      error: result.code,
      message: result.error,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete template
 * DELETE /api/v1/email-service/templates/:id
 */
router.delete('/templates/:id', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const result = await emailService.deleteTemplate(tenantId, id);

    if (result.success) {
      return res.json({ success: true, message: result.message });
    }
    return res.status(result.code === 'NOT_FOUND' ? 404 : 400).json({
      success: false,
      error: result.code,
      message: result.error,
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// SEND ENDPOINTS
// =====================

/**
 * Send email using template
 * POST /api/v1/email-service/send
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

    const { tenantId } = req.user;
    const result = await emailService.sendEmail(tenantId, validation.data);

    if (result.success) {
      return res.json({
        success: true,
        data: {
          emailId: result.emailId,
          providerEmailId: result.providerEmailId,
        },
        message: result.message,
      });
    }
    return res.status(400).json({
      success: false,
      error: result.code,
      message: result.error,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Send raw email (without template)
 * POST /api/v1/email-service/send/raw
 */
router.post('/send/raw', authenticate, async (req, res, next) => {
  try {
    const validation = sendRawEmailSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: validation.error.errors[0].message,
      });
    }

    const { tenantId } = req.user;
    const result = await emailService.sendRawEmail(tenantId, validation.data);

    if (result.success) {
      return res.json({
        success: true,
        data: {
          emailId: result.emailId,
          providerEmailId: result.providerEmailId,
        },
        message: result.message,
      });
    }
    return res.status(400).json({
      success: false,
      error: result.code,
      message: result.error,
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// LOGS ENDPOINT
// =====================

/**
 * Get email logs
 * GET /api/v1/email-service/logs
 */
router.get('/logs', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { status, templateId, domainId, contactId, page = 1, limit = 50 } = req.query;

    const result = await emailService.getEmailLogs(tenantId, {
      status,
      templateId,
      domainId,
      contactId,
      skip: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit),
    });

    if (result.success) {
      return res.json({
        success: true,
        data: result.logs,
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
      });
    }
    return res.status(400).json({ success: false, error: result.error });
  } catch (error) {
    next(error);
  }
});

// =====================
// WEBHOOK ENDPOINT
// =====================

/**
 * Webhook for Resend delivery events
 * POST /api/v1/email-service/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    logger.info('Email webhook received', { type: event.type, emailId: event.data?.email_id });

    const eventType = event.type?.replace('email.', '') || event.event;
    const providerEmailId = event.data?.email_id;

    if (providerEmailId && eventType) {
      await emailService.updateEmailStatus(providerEmailId, eventType, event.data);
    }

    return res.json({ received: true });
  } catch (error) {
    logger.error('Email webhook error', { error: error.message });
    return res.json({ received: true });
  }
});

export default router;
