/**
 * Email Mailbox Router
 * API endpoints for managing email mailboxes
 */

import { Router } from 'express';
import { z } from 'zod';
import { emailMailboxService } from './email-mailbox.service.js';

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

const createMailboxSchema = z.object({
  domainId: z.string().min(1, 'Domain ID is required'),
  localPart: z
    .string()
    .min(1, 'Local part is required')
    .max(64, 'Local part too long')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid email local part'),
  displayName: z.string().max(100).optional(),
  password: z.string().min(8).optional(),
  quotaGB: z.number().min(1).max(100).optional(),
});

const updateMailboxSchema = z.object({
  displayName: z.string().max(100).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DISABLED']).optional(),
  password: z.string().min(8).optional(),
  quotaGB: z.number().min(1).max(100).optional(),
  userId: z.string().nullable().optional(),
});

const autoResponderSchema = z.object({
  enabled: z.boolean(),
  subject: z.string().max(200).optional(),
  message: z.string().max(5000).optional(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
});

const forwardingSchema = z.object({
  enabled: z.boolean(),
  address: z.string().email().optional().nullable(),
  keepCopy: z.boolean().optional(),
});

// ==================== ROUTES ====================

/**
 * GET /mailboxes
 * List all mailboxes for the tenant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { domainId, status, page, limit } = req.query;

    const result = await emailMailboxService.getMailboxes(tenantId, {
      domainId,
      status,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get mailboxes error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch mailboxes',
    });
  }
});

/**
 * GET /mailboxes/:id
 * Get single mailbox details
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const mailboxId = req.params.id;

    const mailbox = await emailMailboxService.getMailbox(tenantId, mailboxId);

    return res.json({ success: true, data: mailbox });
  } catch (error) {
    console.error('Get mailbox error:', error);
    if (error.message === 'Mailbox not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Mailbox not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch mailbox',
    });
  }
});

/**
 * POST /mailboxes
 * Create a new mailbox
 */
router.post('/', validate(createMailboxSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;

    // Check admin permissions
    if (req.roleLevel < 7) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Insufficient permissions to create mailboxes',
      });
    }

    const mailbox = await emailMailboxService.createMailbox(tenantId, userId, req.validatedBody);

    return res.status(201).json({
      success: true,
      data: mailbox,
      message: `Mailbox ${mailbox.email} created successfully`,
    });
  } catch (error) {
    console.error('Create mailbox error:', error);
    return res.status(400).json({
      success: false,
      error: 'CREATE_FAILED',
      message: error.message || 'Failed to create mailbox',
    });
  }
});

/**
 * PATCH /mailboxes/:id
 * Update mailbox settings
 */
router.patch('/:id', validate(updateMailboxSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const mailboxId = req.params.id;

    // Check admin permissions
    if (req.roleLevel < 7) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Insufficient permissions to update mailboxes',
      });
    }

    const mailbox = await emailMailboxService.updateMailbox(tenantId, mailboxId, req.validatedBody);

    return res.json({
      success: true,
      data: mailbox,
      message: 'Mailbox updated successfully',
    });
  } catch (error) {
    console.error('Update mailbox error:', error);
    if (error.message === 'Mailbox not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Mailbox not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: error.message || 'Failed to update mailbox',
    });
  }
});

/**
 * PUT /mailboxes/:id/auto-responder
 * Update auto-responder settings
 */
router.put('/:id/auto-responder', validate(autoResponderSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const mailboxId = req.params.id;

    const result = await emailMailboxService.updateAutoResponder(
      tenantId,
      mailboxId,
      req.validatedBody
    );

    return res.json({
      success: true,
      data: result,
      message: result.enabled ? 'Auto-responder enabled' : 'Auto-responder disabled',
    });
  } catch (error) {
    console.error('Update auto-responder error:', error);
    if (error.message === 'Mailbox not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Mailbox not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: error.message || 'Failed to update auto-responder',
    });
  }
});

/**
 * PUT /mailboxes/:id/forwarding
 * Update forwarding settings
 */
router.put('/:id/forwarding', validate(forwardingSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const mailboxId = req.params.id;

    const result = await emailMailboxService.updateForwarding(
      tenantId,
      mailboxId,
      req.validatedBody
    );

    return res.json({
      success: true,
      data: result,
      message: result.enabled ? 'Forwarding enabled' : 'Forwarding disabled',
    });
  } catch (error) {
    console.error('Update forwarding error:', error);
    if (error.message === 'Mailbox not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Mailbox not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: error.message || 'Failed to update forwarding',
    });
  }
});

/**
 * POST /mailboxes/:id/catch-all
 * Set mailbox as catch-all for the domain
 */
router.post('/:id/catch-all', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const mailboxId = req.params.id;
    const { enabled = true } = req.body;

    // Check admin permissions
    if (req.roleLevel < 9) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only admins can set catch-all mailboxes',
      });
    }

    const result = await emailMailboxService.setCatchAll(tenantId, mailboxId, enabled);

    return res.json({
      success: true,
      data: result,
      message: result.isCatchAll ? 'Mailbox set as catch-all' : 'Catch-all disabled',
    });
  } catch (error) {
    console.error('Set catch-all error:', error);
    if (error.message === 'Mailbox not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Mailbox not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: error.message || 'Failed to set catch-all',
    });
  }
});

/**
 * POST /mailboxes/:id/credentials
 * Generate new IMAP/SMTP credentials
 */
router.post('/:id/credentials', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const mailboxId = req.params.id;

    const credentials = await emailMailboxService.generateCredentials(tenantId, mailboxId);

    return res.json({
      success: true,
      data: credentials,
      message:
        'New credentials generated. Store the password securely - it cannot be retrieved again.',
    });
  } catch (error) {
    console.error('Generate credentials error:', error);
    if (error.message === 'Mailbox not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Mailbox not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'GENERATE_FAILED',
      message: error.message || 'Failed to generate credentials',
    });
  }
});

/**
 * DELETE /mailboxes/:id
 * Delete a mailbox
 */
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const mailboxId = req.params.id;

    // Check admin permissions
    if (req.roleLevel < 9) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only admins can delete mailboxes',
      });
    }

    const result = await emailMailboxService.deleteMailbox(tenantId, mailboxId);

    return res.json({
      success: true,
      message: `Mailbox ${result.email} deleted successfully`,
    });
  } catch (error) {
    console.error('Delete mailbox error:', error);
    if (error.message === 'Mailbox not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Mailbox not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: error.message || 'Failed to delete mailbox',
    });
  }
});

export default router;
