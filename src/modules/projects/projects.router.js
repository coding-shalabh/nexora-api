import { Router } from 'express';
import { z } from 'zod';
import { projectsService } from './projects.service.js';
import { authenticate, authorize } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';

const router = Router();

// ==================== VALIDATION SCHEMAS ====================

const createProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().optional(),
    status: z.enum(['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
    budget: z.number().positive().optional().nullable(),
    currency: z.string().length(3).optional(),
    clientId: z.string().optional().nullable(),
    ownerId: z.string().optional().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    customFields: z.record(z.any()).optional(),
  }),
});

const updateProjectSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional().nullable(),
    status: z.enum(['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    startDate: z.string().datetime().optional().nullable(),
    endDate: z.string().datetime().optional().nullable(),
    budget: z.number().positive().optional().nullable(),
    currency: z.string().length(3).optional(),
    clientId: z.string().optional().nullable(),
    ownerId: z.string().optional().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    progress: z.number().min(0).max(100).optional(),
    customFields: z.record(z.any()).optional(),
  }),
});

const addMemberSchema = z.object({
  body: z.object({
    userId: z.string().min(1, 'User ID is required'),
    role: z.enum(['OWNER', 'MANAGER', 'MEMBER', 'VIEWER']).optional(),
  }),
});

const createMilestoneSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().optional(),
    dueDate: z.string().datetime().optional().nullable(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
  }),
});

const updateMilestoneSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
    order: z.number().int().positive().optional(),
  }),
});

const createTimeEntrySchema = z.object({
  body: z.object({
    projectId: z.string().min(1, 'Project ID is required'),
    taskId: z.string().optional().nullable(),
    description: z.string().optional(),
    hours: z.number().positive('Hours must be positive'),
    date: z.string().datetime(),
    billable: z.boolean().optional(),
    hourlyRate: z.number().positive().optional().nullable(),
  }),
});

const updateTimeEntrySchema = z.object({
  body: z.object({
    description: z.string().optional().nullable(),
    hours: z.number().positive().optional(),
    date: z.string().datetime().optional(),
    billable: z.boolean().optional(),
    hourlyRate: z.number().positive().optional().nullable(),
  }),
});

// ==================== PROJECT ROUTES ====================

// Get all projects
router.get(
  '/',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await projectsService.getProjects(req.tenantId, {
        search: req.query.search,
        status: req.query.status,
        priority: req.query.priority,
        ownerId: req.query.ownerId,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 25,
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get single project
router.get(
  '/:projectId',
  authenticate,
  async (req, res, next) => {
    try {
      const project = await projectsService.getProject(
        req.tenantId,
        req.params.projectId
      );
      res.json(project);
    } catch (error) {
      next(error);
    }
  }
);

// Get project stats
router.get(
  '/:projectId/stats',
  authenticate,
  async (req, res, next) => {
    try {
      const stats = await projectsService.getProjectStats(
        req.tenantId,
        req.params.projectId
      );
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

// Create project
router.post(
  '/',
  authenticate,
  validate(createProjectSchema),
  async (req, res, next) => {
    try {
      const project = await projectsService.createProject(
        req.tenantId,
        req.userId,
        req.body
      );
      res.status(201).json(project);
    } catch (error) {
      next(error);
    }
  }
);

// Update project
router.patch(
  '/:projectId',
  authenticate,
  validate(updateProjectSchema),
  async (req, res, next) => {
    try {
      const project = await projectsService.updateProject(
        req.tenantId,
        req.params.projectId,
        req.body
      );
      res.json(project);
    } catch (error) {
      next(error);
    }
  }
);

// Delete project
router.delete(
  '/:projectId',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await projectsService.deleteProject(
        req.tenantId,
        req.params.projectId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== PROJECT MEMBER ROUTES ====================

// Add project member
router.post(
  '/:projectId/members',
  authenticate,
  validate(addMemberSchema),
  async (req, res, next) => {
    try {
      const member = await projectsService.addProjectMember(
        req.tenantId,
        req.params.projectId,
        req.body.userId,
        req.body.role
      );
      res.status(201).json(member);
    } catch (error) {
      next(error);
    }
  }
);

// Remove project member
router.delete(
  '/:projectId/members/:userId',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await projectsService.removeProjectMember(
        req.tenantId,
        req.params.projectId,
        req.params.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== MILESTONE ROUTES ====================

// Get project milestones
router.get(
  '/:projectId/milestones',
  authenticate,
  async (req, res, next) => {
    try {
      const milestones = await projectsService.getMilestones(
        req.tenantId,
        req.params.projectId
      );
      res.json(milestones);
    } catch (error) {
      next(error);
    }
  }
);

// Create milestone
router.post(
  '/:projectId/milestones',
  authenticate,
  validate(createMilestoneSchema),
  async (req, res, next) => {
    try {
      const milestone = await projectsService.createMilestone(
        req.tenantId,
        req.params.projectId,
        req.body
      );
      res.status(201).json(milestone);
    } catch (error) {
      next(error);
    }
  }
);

// Update milestone
router.patch(
  '/milestones/:milestoneId',
  authenticate,
  validate(updateMilestoneSchema),
  async (req, res, next) => {
    try {
      const milestone = await projectsService.updateMilestone(
        req.tenantId,
        req.params.milestoneId,
        req.body
      );
      res.json(milestone);
    } catch (error) {
      next(error);
    }
  }
);

// Delete milestone
router.delete(
  '/milestones/:milestoneId',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await projectsService.deleteMilestone(
        req.tenantId,
        req.params.milestoneId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== TIME ENTRY ROUTES ====================

// Get time entries (supports filtering by project, task, user, date range)
router.get(
  '/time-entries',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await projectsService.getTimeEntries(req.tenantId, {
        projectId: req.query.projectId,
        taskId: req.query.taskId,
        userId: req.query.userId,
        billable: req.query.billable === 'true' ? true : req.query.billable === 'false' ? false : undefined,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 50,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Create time entry
router.post(
  '/time-entries',
  authenticate,
  validate(createTimeEntrySchema),
  async (req, res, next) => {
    try {
      const entry = await projectsService.createTimeEntry(
        req.tenantId,
        req.userId,
        req.body
      );
      res.status(201).json(entry);
    } catch (error) {
      next(error);
    }
  }
);

// Update time entry
router.patch(
  '/time-entries/:entryId',
  authenticate,
  validate(updateTimeEntrySchema),
  async (req, res, next) => {
    try {
      const entry = await projectsService.updateTimeEntry(
        req.tenantId,
        req.params.entryId,
        req.body
      );
      res.json(entry);
    } catch (error) {
      next(error);
    }
  }
);

// Delete time entry
router.delete(
  '/time-entries/:entryId',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await projectsService.deleteTimeEntry(
        req.tenantId,
        req.params.entryId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export { router as projectsRouter };
