/**
 * Email Alias & Forwarder Router
 * API endpoints for managing email aliases and forwarders
 */

import { Router } from 'express';
import { z } from 'zod';
import { emailAliasService } from './email-alias.service.js';

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

const createAliasSchema = z.object({
  mailboxId: z.string().min(1, 'Target mailbox ID is required'),
  domainId: z.string().min(1, 'Domain ID is required'),
  localPart: z
    .string()
    .min(1, 'Local part is required')
    .max(64, 'Local part too long')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid email local part'),
});

const updateAliasSchema = z.object({
  isActive: z.boolean().optional(),
  mailboxId: z.string().optional(),
});

const createForwarderSchema = z.object({
  domainId: z.string().min(1, 'Domain ID is required'),
  localPart: z
    .string()
    .min(1, 'Local part is required')
    .max(64, 'Local part too long')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid email local part'),
  forwardTo: z.array(z.string().email()).min(1, 'At least one forward-to address required'),
  keepCopy: z.boolean().optional(),
});

const updateForwarderSchema = z.object({
  isActive: z.boolean().optional(),
  forwardTo: z.array(z.string().email()).optional(),
  keepCopy: z.boolean().optional(),
});

// ==================== ALIAS ROUTES ====================

/**
 * GET /aliases
 * List all aliases
 */
router.get('/aliases', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { mailboxId, domainId, page, limit } = req.query;

    const result = await emailAliasService.getAliases(tenantId, {
      mailboxId,
      domainId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get aliases error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch aliases',
    });
  }
});

/**
 * POST /aliases
 * Create a new alias
 */
router.post('/aliases', validate(createAliasSchema), async (req, res) => {
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

    const alias = await emailAliasService.createAlias(tenantId, userId, req.validatedBody);

    return res.status(201).json({
      success: true,
      data: alias,
      message: `Alias ${alias.email} created successfully`,
    });
  } catch (error) {
    console.error('Create alias error:', error);
    return res.status(400).json({
      success: false,
      error: 'CREATE_FAILED',
      message: error.message || 'Failed to create alias',
    });
  }
});

/**
 * PATCH /aliases/:id
 * Update an alias
 */
router.patch('/aliases/:id', validate(updateAliasSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const aliasId = req.params.id;

    if (req.roleLevel < 7) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    const alias = await emailAliasService.updateAlias(tenantId, aliasId, req.validatedBody);

    return res.json({
      success: true,
      data: alias,
      message: 'Alias updated successfully',
    });
  } catch (error) {
    console.error('Update alias error:', error);
    if (error.message === 'Alias not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Alias not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: error.message || 'Failed to update alias',
    });
  }
});

/**
 * DELETE /aliases/:id
 * Delete an alias
 */
router.delete('/aliases/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const aliasId = req.params.id;

    if (req.roleLevel < 7) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    const result = await emailAliasService.deleteAlias(tenantId, aliasId);

    return res.json({
      success: true,
      message: `Alias ${result.email} deleted successfully`,
    });
  } catch (error) {
    console.error('Delete alias error:', error);
    if (error.message === 'Alias not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Alias not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: error.message || 'Failed to delete alias',
    });
  }
});

// ==================== FORWARDER ROUTES ====================

/**
 * GET /forwarders
 * List all forwarders
 */
router.get('/forwarders', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { domainId, page, limit } = req.query;

    const result = await emailAliasService.getForwarders(tenantId, {
      domainId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get forwarders error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch forwarders',
    });
  }
});

/**
 * POST /forwarders
 * Create a new forwarder
 */
router.post('/forwarders', validate(createForwarderSchema), async (req, res) => {
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

    const forwarder = await emailAliasService.createForwarder(tenantId, userId, req.validatedBody);

    return res.status(201).json({
      success: true,
      data: forwarder,
      message: `Forwarder ${forwarder.email} created successfully`,
    });
  } catch (error) {
    console.error('Create forwarder error:', error);
    return res.status(400).json({
      success: false,
      error: 'CREATE_FAILED',
      message: error.message || 'Failed to create forwarder',
    });
  }
});

/**
 * PATCH /forwarders/:id
 * Update a forwarder
 */
router.patch('/forwarders/:id', validate(updateForwarderSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const forwarderId = req.params.id;

    if (req.roleLevel < 7) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    const forwarder = await emailAliasService.updateForwarder(
      tenantId,
      forwarderId,
      req.validatedBody
    );

    return res.json({
      success: true,
      data: forwarder,
      message: 'Forwarder updated successfully',
    });
  } catch (error) {
    console.error('Update forwarder error:', error);
    if (error.message === 'Forwarder not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Forwarder not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: error.message || 'Failed to update forwarder',
    });
  }
});

/**
 * DELETE /forwarders/:id
 * Delete a forwarder
 */
router.delete('/forwarders/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const forwarderId = req.params.id;

    if (req.roleLevel < 7) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    const result = await emailAliasService.deleteForwarder(tenantId, forwarderId);

    return res.json({
      success: true,
      message: `Forwarder ${result.email} deleted successfully`,
    });
  } catch (error) {
    console.error('Delete forwarder error:', error);
    if (error.message === 'Forwarder not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Forwarder not found',
      });
    }
    return res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: error.message || 'Failed to delete forwarder',
    });
  }
});

export default router;
