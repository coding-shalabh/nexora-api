/**
 * Email Drafts Router
 * API endpoints for email drafts, templates, and signatures
 */

import { Router } from 'express';
import { z } from 'zod';
import { emailDraftsService } from './email-drafts.service.js';

const router = Router();

// Validation helper
const validate = (schema) => (req, res, next) => {
  try {
    req.validatedBody = schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: error.errors?.[0]?.message || 'Invalid request data',
    });
  }
};

// ==================== SCHEMAS ====================

const createDraftSchema = z.object({
  mailboxId: z.string().min(1, 'Mailbox ID is required'),
  to: z.array(z.string().email()).optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  isHtml: z.boolean().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        size: z.number(),
        url: z.string(),
      })
    )
    .optional(),
});

const updateDraftSchema = z.object({
  to: z.array(z.string().email()).optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  isHtml: z.boolean().optional(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        size: z.number(),
        url: z.string(),
      })
    )
    .optional(),
});

const scheduleDraftSchema = z.object({
  scheduledAt: z.string().datetime(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  subject: z.string().max(200),
  body: z.string(),
  category: z.string().max(50).optional(),
  variables: z.array(z.string()).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subject: z.string().max(200).optional(),
  body: z.string().optional(),
  category: z.string().max(50).optional(),
  variables: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const createSignatureSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string(),
  isHtml: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  isGlobal: z.boolean().optional(),
});

const updateSignatureSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content: z.string().optional(),
  isHtml: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});

// ==================== DRAFT ROUTES ====================

/**
 * GET /drafts
 * List all drafts for a mailbox
 */
router.get('/drafts', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { mailboxId, status, page, limit } = req.query;

    if (!mailboxId) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Mailbox ID is required',
      });
    }

    const result = await emailDraftsService.getDrafts(tenantId, mailboxId, {
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get drafts error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch drafts',
    });
  }
});

/**
 * GET /drafts/:id
 * Get a single draft
 */
router.get('/drafts/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const draftId = req.params.id;

    const draft = await emailDraftsService.getDraft(tenantId, draftId);

    return res.json({ success: true, data: draft });
  } catch (error) {
    console.error('Get draft error:', error);
    if (error.message === 'Draft not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Draft not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch draft',
    });
  }
});

/**
 * POST /drafts
 * Create a new draft
 */
router.post('/drafts', validate(createDraftSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;

    const draft = await emailDraftsService.createDraft(tenantId, userId, req.validatedBody);

    return res.status(201).json({
      success: true,
      data: draft,
      message: 'Draft created successfully',
    });
  } catch (error) {
    console.error('Create draft error:', error);
    return res.status(400).json({
      success: false,
      error: 'CREATE_FAILED',
      message: error.message || 'Failed to create draft',
    });
  }
});

/**
 * PATCH /drafts/:id
 * Update a draft
 */
router.patch('/drafts/:id', validate(updateDraftSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const draftId = req.params.id;

    const draft = await emailDraftsService.updateDraft(tenantId, draftId, req.validatedBody);

    return res.json({
      success: true,
      data: draft,
      message: 'Draft updated successfully',
    });
  } catch (error) {
    console.error('Update draft error:', error);
    if (error.message === 'Draft not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Draft not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: error.message || 'Failed to update draft',
    });
  }
});

/**
 * POST /drafts/:id/schedule
 * Schedule a draft for sending
 */
router.post('/drafts/:id/schedule', validate(scheduleDraftSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const draftId = req.params.id;

    const result = await emailDraftsService.scheduleDraft(
      tenantId,
      draftId,
      req.validatedBody.scheduledAt
    );

    return res.json({
      success: true,
      data: result,
      message: `Email scheduled for ${result.scheduledAt}`,
    });
  } catch (error) {
    console.error('Schedule draft error:', error);
    if (error.message === 'Draft not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Draft not found',
      });
    }
    return res.status(400).json({
      success: false,
      error: 'SCHEDULE_FAILED',
      message: error.message || 'Failed to schedule draft',
    });
  }
});

/**
 * POST /drafts/:id/send
 * Send a draft immediately
 */
router.post('/drafts/:id/send', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const draftId = req.params.id;

    const result = await emailDraftsService.sendDraft(tenantId, draftId);

    return res.json({
      success: true,
      data: result,
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error('Send draft error:', error);
    if (error.message === 'Draft not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Draft not found',
      });
    }
    return res.status(400).json({
      success: false,
      error: 'SEND_FAILED',
      message: error.message || 'Failed to send email',
    });
  }
});

/**
 * DELETE /drafts/:id
 * Delete a draft
 */
router.delete('/drafts/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const draftId = req.params.id;

    await emailDraftsService.deleteDraft(tenantId, draftId);

    return res.json({
      success: true,
      message: 'Draft deleted successfully',
    });
  } catch (error) {
    console.error('Delete draft error:', error);
    if (error.message === 'Draft not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Draft not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: error.message || 'Failed to delete draft',
    });
  }
});

// ==================== TEMPLATE ROUTES ====================

/**
 * GET /templates
 * List all email templates
 */
router.get('/templates', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { category, page, limit } = req.query;

    const result = await emailDraftsService.getTemplates(tenantId, {
      category,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get templates error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch templates',
    });
  }
});

/**
 * POST /templates
 * Create a new template
 */
router.post('/templates', validate(createTemplateSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;

    if (req.roleLevel < 7) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    const template = await emailDraftsService.createTemplate(tenantId, userId, req.validatedBody);

    return res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully',
    });
  } catch (error) {
    console.error('Create template error:', error);
    return res.status(400).json({
      success: false,
      error: 'CREATE_FAILED',
      message: error.message || 'Failed to create template',
    });
  }
});

/**
 * PATCH /templates/:id
 * Update a template
 */
router.patch('/templates/:id', validate(updateTemplateSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const templateId = req.params.id;

    if (req.roleLevel < 7) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    const template = await emailDraftsService.updateTemplate(
      tenantId,
      templateId,
      req.validatedBody
    );

    return res.json({
      success: true,
      data: template,
      message: 'Template updated successfully',
    });
  } catch (error) {
    console.error('Update template error:', error);
    if (error.message === 'Template not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Template not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: error.message || 'Failed to update template',
    });
  }
});

/**
 * DELETE /templates/:id
 * Delete a template
 */
router.delete('/templates/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const templateId = req.params.id;

    if (req.roleLevel < 7) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    await emailDraftsService.deleteTemplate(tenantId, templateId);

    return res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Delete template error:', error);
    if (error.message === 'Template not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Template not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: error.message || 'Failed to delete template',
    });
  }
});

// ==================== SIGNATURE ROUTES ====================

/**
 * GET /signatures
 * List all signatures (user's + global)
 */
router.get('/signatures', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;

    const signatures = await emailDraftsService.getSignatures(tenantId, userId);

    return res.json({ success: true, data: signatures });
  } catch (error) {
    console.error('Get signatures error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch signatures',
    });
  }
});

/**
 * POST /signatures
 * Create a new signature
 */
router.post('/signatures', validate(createSignatureSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;

    // Only admins can create global signatures
    if (req.validatedBody.isGlobal && req.roleLevel < 7) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only admins can create global signatures',
      });
    }

    const signature = await emailDraftsService.createSignature(tenantId, userId, req.validatedBody);

    return res.status(201).json({
      success: true,
      data: signature,
      message: 'Signature created successfully',
    });
  } catch (error) {
    console.error('Create signature error:', error);
    return res.status(400).json({
      success: false,
      error: 'CREATE_FAILED',
      message: error.message || 'Failed to create signature',
    });
  }
});

/**
 * PATCH /signatures/:id
 * Update a signature
 */
router.patch('/signatures/:id', validate(updateSignatureSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const signatureId = req.params.id;

    const signature = await emailDraftsService.updateSignature(
      tenantId,
      signatureId,
      userId,
      req.validatedBody
    );

    return res.json({
      success: true,
      data: signature,
      message: 'Signature updated successfully',
    });
  } catch (error) {
    console.error('Update signature error:', error);
    if (error.message === 'Signature not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Signature not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: error.message || 'Failed to update signature',
    });
  }
});

/**
 * DELETE /signatures/:id
 * Delete a signature
 */
router.delete('/signatures/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const signatureId = req.params.id;

    await emailDraftsService.deleteSignature(tenantId, signatureId);

    return res.json({
      success: true,
      message: 'Signature deleted successfully',
    });
  } catch (error) {
    console.error('Delete signature error:', error);
    if (error.message === 'Signature not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Signature not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: error.message || 'Failed to delete signature',
    });
  }
});

export default router;
