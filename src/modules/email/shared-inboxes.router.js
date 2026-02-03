/**
 * Shared Inbox Routes
 * API endpoints for managing shared inboxes and members
 */

import { Router } from 'express';
import { z } from 'zod';
import {
  getSharedInboxes,
  getSharedInbox,
  createSharedInbox,
  updateSharedInbox,
  deleteSharedInbox,
  getInboxMembers,
  addInboxMember,
  updateInboxMember,
  removeInboxMember,
  getUserSharedInboxes,
} from './shared-inboxes.service.js';

const router = Router();

// Validation schemas
const createSharedInboxSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
  inboundType: z.enum(['forwarding', 'oauth', 'imap']).optional().default('forwarding'),
  smtpProvider: z.string().optional().nullable(),
  autoAssign: z.boolean().optional().default(false),
  assignmentType: z
    .enum(['round_robin', 'load_balanced', 'manual'])
    .optional()
    .default('round_robin'),
  signature: z.string().optional().nullable(),
});

const updateSharedInboxSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  inboundType: z.enum(['forwarding', 'oauth', 'imap']).optional(),
  smtpProvider: z.string().optional().nullable(),
  autoAssign: z.boolean().optional(),
  assignmentType: z.enum(['round_robin', 'load_balanced', 'manual']).optional(),
  signature: z.string().optional().nullable(),
  status: z.enum(['active', 'paused', 'disconnected']).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['admin', 'member']).optional().default('member'),
  canSend: z.boolean().optional().default(true),
  canAssign: z.boolean().optional().default(false),
  receiveNotifications: z.boolean().optional().default(true),
});

const updateMemberSchema = z.object({
  role: z.enum(['admin', 'member']).optional(),
  canSend: z.boolean().optional(),
  canAssign: z.boolean().optional(),
  receiveNotifications: z.boolean().optional(),
});

/**
 * GET /shared-inboxes
 * Get all shared inboxes for the tenant
 */
router.get('/', async (req, res, next) => {
  try {
    const { tenantId } = req;

    const inboxes = await getSharedInboxes(tenantId);

    res.json({
      success: true,
      data: inboxes,
    });
  } catch (error) {
    console.error('Error getting shared inboxes:', error);
    next(error);
  }
});

/**
 * GET /shared-inboxes/my-inboxes
 * Get shared inboxes the current user is a member of
 */
router.get('/my-inboxes', async (req, res, next) => {
  try {
    const { tenantId, userId } = req;

    const inboxes = await getUserSharedInboxes(tenantId, userId);

    res.json({
      success: true,
      data: inboxes,
    });
  } catch (error) {
    console.error('Error getting user shared inboxes:', error);
    next(error);
  }
});

/**
 * GET /shared-inboxes/:id
 * Get a single shared inbox by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;

    const inbox = await getSharedInbox(tenantId, id);

    if (!inbox) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Shared inbox not found',
      });
    }

    res.json({
      success: true,
      data: inbox,
    });
  } catch (error) {
    console.error('Error getting shared inbox:', error);
    next(error);
  }
});

/**
 * POST /shared-inboxes
 * Create a new shared inbox
 */
router.post('/', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const data = createSharedInboxSchema.parse(req.body);

    const inbox = await createSharedInbox(tenantId, data);

    res.status(201).json({
      success: true,
      data: inbox,
      message: 'Shared inbox created successfully',
    });
  } catch (error) {
    console.error('Error creating shared inbox:', error);
    if (error.message?.includes('already exists')) {
      return res.status(400).json({
        success: false,
        error: 'DUPLICATE',
        message: error.message,
      });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.errors[0]?.message || 'Validation failed',
      });
    }
    next(error);
  }
});

/**
 * PATCH /shared-inboxes/:id
 * Update a shared inbox
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const data = updateSharedInboxSchema.parse(req.body);

    const inbox = await updateSharedInbox(tenantId, id, data);

    res.json({
      success: true,
      data: inbox,
      message: 'Shared inbox updated successfully',
    });
  } catch (error) {
    console.error('Error updating shared inbox:', error);
    if (error.message === 'Shared inbox not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message,
      });
    }
    if (error.message?.includes('already exists')) {
      return res.status(400).json({
        success: false,
        error: 'DUPLICATE',
        message: error.message,
      });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.errors[0]?.message || 'Validation failed',
      });
    }
    next(error);
  }
});

/**
 * DELETE /shared-inboxes/:id
 * Delete a shared inbox
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;

    await deleteSharedInbox(tenantId, id);

    res.json({
      success: true,
      message: 'Shared inbox deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting shared inbox:', error);
    if (error.message === 'Shared inbox not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message,
      });
    }
    next(error);
  }
});

// ==================== MEMBER ROUTES ====================

/**
 * GET /shared-inboxes/:id/members
 * Get all members of a shared inbox
 */
router.get('/:id/members', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;

    const members = await getInboxMembers(tenantId, id);

    res.json({
      success: true,
      data: members,
    });
  } catch (error) {
    console.error('Error getting inbox members:', error);
    if (error.message === 'Shared inbox not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message,
      });
    }
    next(error);
  }
});

/**
 * POST /shared-inboxes/:id/members
 * Add a member to a shared inbox
 */
router.post('/:id/members', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id } = req.params;
    const data = addMemberSchema.parse(req.body);

    const member = await addInboxMember(tenantId, id, data);

    res.status(201).json({
      success: true,
      data: member,
      message: 'Member added successfully',
    });
  } catch (error) {
    console.error('Error adding inbox member:', error);
    if (error.message === 'Shared inbox not found' || error.message === 'User not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message,
      });
    }
    if (error.message?.includes('already a member')) {
      return res.status(400).json({
        success: false,
        error: 'DUPLICATE',
        message: error.message,
      });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.errors[0]?.message || 'Validation failed',
      });
    }
    next(error);
  }
});

/**
 * PATCH /shared-inboxes/:id/members/:userId
 * Update a member's permissions
 */
router.patch('/:id/members/:userId', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id, userId } = req.params;
    const data = updateMemberSchema.parse(req.body);

    const member = await updateInboxMember(tenantId, id, userId, data);

    res.json({
      success: true,
      data: member,
      message: 'Member updated successfully',
    });
  } catch (error) {
    console.error('Error updating inbox member:', error);
    if (error.message === 'Shared inbox not found' || error.message === 'Member not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message,
      });
    }
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.errors[0]?.message || 'Validation failed',
      });
    }
    next(error);
  }
});

/**
 * DELETE /shared-inboxes/:id/members/:userId
 * Remove a member from a shared inbox
 */
router.delete('/:id/members/:userId', async (req, res, next) => {
  try {
    const { tenantId } = req;
    const { id, userId } = req.params;

    await removeInboxMember(tenantId, id, userId);

    res.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    console.error('Error removing inbox member:', error);
    if (error.message === 'Shared inbox not found' || error.message === 'Member not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message,
      });
    }
    next(error);
  }
});

export { router as sharedInboxesRouter };
export default router;
