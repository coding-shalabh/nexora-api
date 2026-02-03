/**
 * Sequences Router
 * API endpoints for sequence management
 */

import { Router } from 'express';
import { sequencesService } from './sequences.service.js';
import { validateRequest } from '../../common/middleware/validation.js';
import { z } from 'zod';

const router = Router();

// Validation schemas
const createSequenceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  targetType: z.enum(['CONTACT', 'LEAD', 'DEAL']).optional(),
  timezone: z.string().optional(),
  businessHoursOnly: z.boolean().optional(),
  workingHours: z
    .record(
      z.object({
        start: z.string(),
        end: z.string(),
      })
    )
    .optional(),
  pauseOnReply: z.boolean().optional(),
  dailyCap: z.number().int().positive().optional(),
  throttlePerHour: z.number().int().positive().optional(),
  steps: z
    .array(
      z.object({
        stepType: z.enum(['WHATSAPP', 'SMS', 'EMAIL', 'TASK', 'CALL', 'WAIT', 'CONDITION']),
        channel: z.enum(['WHATSAPP', 'SMS', 'EMAIL', 'VOICE']).optional(),
        delayDays: z.number().int().min(0).optional(),
        delayHours: z.number().int().min(0).max(23).optional(),
        delayMinutes: z.number().int().min(0).max(59).optional(),
        templateId: z.string().optional(),
        subject: z.string().optional(),
        content: z.string().optional(),
        taskTitle: z.string().optional(),
        taskNotes: z.string().optional(),
        isABTest: z.boolean().optional(),
        variants: z
          .array(
            z.object({
              weight: z.number().int().positive(),
              subject: z.string().optional(),
              content: z.string().optional(),
            })
          )
          .optional(),
      })
    )
    .optional(),
});

const updateSequenceSchema = createSequenceSchema.partial();

const stepSchema = z.object({
  stepType: z.enum(['WHATSAPP', 'SMS', 'EMAIL', 'TASK', 'CALL', 'WAIT', 'CONDITION']),
  channel: z.enum(['WHATSAPP', 'SMS', 'EMAIL', 'VOICE']).optional(),
  delayDays: z.number().int().min(0).optional(),
  delayHours: z.number().int().min(0).max(23).optional(),
  delayMinutes: z.number().int().min(0).max(59).optional(),
  templateId: z.string().optional(),
  subject: z.string().optional(),
  content: z.string().optional(),
  taskTitle: z.string().optional(),
  taskNotes: z.string().optional(),
  isABTest: z.boolean().optional(),
  variants: z
    .array(
      z.object({
        weight: z.number().int().positive(),
        subject: z.string().optional(),
        content: z.string().optional(),
      })
    )
    .optional(),
});

const enrollSchema = z
  .object({
    contactId: z.string().optional(),
    leadId: z.string().optional(),
    dealId: z.string().optional(),
    source: z.string().optional(),
  })
  .refine((data) => data.contactId || data.leadId || data.dealId, {
    message: 'At least one of contactId, leadId, or dealId is required',
  });

const bulkEnrollSchema = z.object({
  contactIds: z.array(z.string()).optional(),
  leadIds: z.array(z.string()).optional(),
  dealIds: z.array(z.string()).optional(),
  source: z.string().optional(),
});

// =====================
// Sequence CRUD
// =====================

/**
 * Get overall sequences stats
 */
router.get('/stats', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    // TODO: Implement actual stats calculation
    // For now, return default values
    res.json({
      success: true,
      data: {
        totalSequences: 0,
        activeSequences: 0,
        totalEnrollments: 0,
        activeEnrollments: 0,
        completedEnrollments: 0,
        exitedEnrollments: 0,
        totalStepsSent: 0,
        avgCompletionRate: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all sequences
 */
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.auth?.tenantId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    // TODO: Implement actual sequence listing from database
    // For now, return empty array with proper structure
    res.json({
      success: true,
      data: [],
      meta: {
        total: 0,
        page,
        limit,
        totalPages: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get single sequence
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { tenantId } = req.auth;
    const sequence = await sequencesService.getSequence(tenantId, req.params.id);
    res.json(sequence);
  } catch (error) {
    next(error);
  }
});

/**
 * Create sequence
 */
router.post('/', validateRequest({ body: createSequenceSchema }), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.auth?.tenantId;
    const userId = req.userId || req.auth?.userId;

    // TODO: Implement actual sequence creation in database
    // For now, return mock sequence
    const sequence = {
      id: 'seq_' + Date.now(),
      name: req.body.name,
      description: req.body.description || null,
      targetType: req.body.targetType || 'CONTACT',
      isActive: false,
      createdAt: new Date().toISOString(),
      createdBy: userId,
      tenantId,
    };

    res.status(201).json({
      success: true,
      data: sequence,
      message: 'Sequence created successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update sequence
 */
router.patch('/:id', validateRequest({ body: updateSequenceSchema }), async (req, res, next) => {
  try {
    const { tenantId } = req.auth;
    const sequence = await sequencesService.updateSequence(tenantId, req.params.id, req.body);
    res.json(sequence);
  } catch (error) {
    next(error);
  }
});

/**
 * Delete sequence
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId } = req.auth;
    await sequencesService.deleteSequence(tenantId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Activate sequence
 */
router.post('/:id/activate', async (req, res, next) => {
  try {
    const { tenantId } = req.auth;
    const sequence = await sequencesService.activateSequence(tenantId, req.params.id);
    res.json(sequence);
  } catch (error) {
    next(error);
  }
});

/**
 * Deactivate sequence
 */
router.post('/:id/deactivate', async (req, res, next) => {
  try {
    const { tenantId } = req.auth;
    const sequence = await sequencesService.deactivateSequence(tenantId, req.params.id);
    res.json(sequence);
  } catch (error) {
    next(error);
  }
});

/**
 * Get sequence stats
 */
router.get('/:id/stats', async (req, res, next) => {
  try {
    const { tenantId } = req.auth;
    const stats = await sequencesService.getSequenceStats(tenantId, req.params.id);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// =====================
// Step Management
// =====================

/**
 * Add step to sequence
 */
router.post('/:id/steps', validateRequest({ body: stepSchema }), async (req, res, next) => {
  try {
    const { tenantId } = req.auth;
    const step = await sequencesService.addStep(tenantId, req.params.id, req.body);
    res.status(201).json(step);
  } catch (error) {
    next(error);
  }
});

/**
 * Update step
 */
router.patch(
  '/:id/steps/:stepId',
  validateRequest({ body: stepSchema.partial() }),
  async (req, res, next) => {
    try {
      const { tenantId } = req.auth;
      const step = await sequencesService.updateStep(
        tenantId,
        req.params.id,
        req.params.stepId,
        req.body
      );
      res.json(step);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete step
 */
router.delete('/:id/steps/:stepId', async (req, res, next) => {
  try {
    const { tenantId } = req.auth;
    await sequencesService.deleteStep(tenantId, req.params.id, req.params.stepId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Reorder steps
 */
router.post(
  '/:id/steps/reorder',
  validateRequest({ body: z.object({ stepOrder: z.array(z.string()) }) }),
  async (req, res, next) => {
    try {
      const { tenantId } = req.auth;
      const steps = await sequencesService.reorderSteps(
        tenantId,
        req.params.id,
        req.body.stepOrder
      );
      res.json(steps);
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// Enrollment Management
// =====================

/**
 * Enroll contact/lead/deal in sequence
 */
router.post('/:id/enroll', validateRequest({ body: enrollSchema }), async (req, res, next) => {
  try {
    const { tenantId, userId } = req.auth;
    const enrollment = await sequencesService.enrollContact(tenantId, req.params.id, {
      ...req.body,
      enrolledById: userId,
    });
    res.status(201).json(enrollment);
  } catch (error) {
    next(error);
  }
});

/**
 * Bulk enroll contacts/leads/deals
 */
router.post(
  '/:id/bulk-enroll',
  validateRequest({ body: bulkEnrollSchema }),
  async (req, res, next) => {
    try {
      const { tenantId, userId } = req.auth;
      const result = await sequencesService.bulkEnroll(tenantId, req.params.id, {
        ...req.body,
        enrolledById: userId,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get enrollments for sequence
 */
router.get('/:id/enrollments', async (req, res, next) => {
  try {
    const { tenantId } = req.auth;
    const filters = {
      status: req.query.status,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await sequencesService.getEnrollments(tenantId, req.params.id, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Pause enrollment
 */
router.post('/enrollments/:enrollmentId/pause', async (req, res, next) => {
  try {
    const { tenantId } = req.auth;
    const enrollment = await sequencesService.pauseEnrollment(tenantId, req.params.enrollmentId);
    res.json(enrollment);
  } catch (error) {
    next(error);
  }
});

/**
 * Resume enrollment
 */
router.post('/enrollments/:enrollmentId/resume', async (req, res, next) => {
  try {
    const { tenantId } = req.auth;
    const enrollment = await sequencesService.resumeEnrollment(tenantId, req.params.enrollmentId);
    res.json(enrollment);
  } catch (error) {
    next(error);
  }
});

/**
 * Exit enrollment
 */
router.post(
  '/enrollments/:enrollmentId/exit',
  validateRequest({ body: z.object({ reason: z.string().optional() }) }),
  async (req, res, next) => {
    try {
      const { tenantId } = req.auth;
      const enrollment = await sequencesService.exitEnrollment(
        tenantId,
        req.params.enrollmentId,
        req.body.reason
      );
      res.json(enrollment);
    } catch (error) {
      next(error);
    }
  }
);

export default router;
