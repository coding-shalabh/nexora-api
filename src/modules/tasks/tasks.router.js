import { Router } from 'express';
import { z } from 'zod';
import { tasksService } from './tasks.service.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';

const router = Router();

// ==================== VALIDATION SCHEMAS ====================

const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(500),
    description: z.string().optional(),
    status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'COMPLETED', 'CANCELLED']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    projectId: z.string().optional().nullable(),
    milestoneId: z.string().optional().nullable(),
    parentTaskId: z.string().optional().nullable(),
    assigneeId: z.string().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    startDate: z.string().datetime().optional().nullable(),
    estimatedHours: z.number().positive().optional().nullable(),
    labels: z.array(z.string()).optional(),
    customFields: z.record(z.any()).optional(),
  }),
});

const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().optional().nullable(),
    status: z.enum(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'COMPLETED', 'CANCELLED']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    projectId: z.string().optional().nullable(),
    milestoneId: z.string().optional().nullable(),
    parentTaskId: z.string().optional().nullable(),
    assigneeId: z.string().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    startDate: z.string().datetime().optional().nullable(),
    estimatedHours: z.number().positive().optional().nullable(),
    actualHours: z.number().positive().optional().nullable(),
    labels: z.array(z.string()).optional(),
    order: z.number().int().positive().optional(),
    customFields: z.record(z.any()).optional(),
  }),
});

const reorderTasksSchema = z.object({
  body: z.object({
    tasks: z.array(z.object({
      id: z.string(),
    })),
  }),
});

const addChecklistSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(500),
    completed: z.boolean().optional(),
  }),
});

const updateChecklistSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(500).optional(),
    completed: z.boolean().optional(),
    order: z.number().int().positive().optional(),
  }),
});

const addCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Content is required'),
  }),
});

const updateCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Content is required'),
  }),
});

const addAttachmentSchema = z.object({
  body: z.object({
    fileName: z.string().min(1, 'File name is required'),
    fileUrl: z.string().url('Invalid file URL'),
    fileSize: z.number().int().positive().optional(),
    mimeType: z.string().optional(),
  }),
});

const addDependencySchema = z.object({
  body: z.object({
    dependsOnTaskId: z.string().min(1, 'Dependency task ID is required'),
    type: z.enum(['FINISH_TO_START', 'START_TO_START', 'FINISH_TO_FINISH', 'START_TO_FINISH']).optional(),
  }),
});

// ==================== TASK ROUTES ====================

// Get all tasks
router.get(
  '/',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await tasksService.getTasks(req.tenantId, {
        search: req.query.search,
        status: req.query.status,
        priority: req.query.priority,
        projectId: req.query.projectId,
        milestoneId: req.query.milestoneId,
        assigneeId: req.query.assigneeId,
        createdById: req.query.createdById,
        parentTaskId: req.query.parentTaskId,
        labels: req.query.labels ? req.query.labels.split(',') : undefined,
        dueDateFrom: req.query.dueDateFrom,
        dueDateTo: req.query.dueDateTo,
        overdue: req.query.overdue === 'true',
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

// Get my tasks
router.get(
  '/my-tasks',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await tasksService.getMyTasks(req.tenantId, req.userId, {
        status: req.query.status,
        priority: req.query.priority,
        projectId: req.query.projectId,
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 25,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Get upcoming tasks
router.get(
  '/upcoming',
  authenticate,
  async (req, res, next) => {
    try {
      const tasks = await tasksService.getUpcomingTasks(
        req.tenantId,
        req.userId,
        parseInt(req.query.days) || 7
      );
      res.json(tasks);
    } catch (error) {
      next(error);
    }
  }
);

// Get task stats
router.get(
  '/stats',
  authenticate,
  async (req, res, next) => {
    try {
      const stats = await tasksService.getTaskStats(req.tenantId, {
        projectId: req.query.projectId,
        assigneeId: req.query.assigneeId,
      });
      res.json(stats);
    } catch (error) {
      next(error);
    }
  }
);

// Get single task
router.get(
  '/:taskId',
  authenticate,
  async (req, res, next) => {
    try {
      const task = await tasksService.getTask(req.tenantId, req.params.taskId);
      res.json(task);
    } catch (error) {
      next(error);
    }
  }
);

// Create task
router.post(
  '/',
  authenticate,
  validate(createTaskSchema),
  async (req, res, next) => {
    try {
      const task = await tasksService.createTask(
        req.tenantId,
        req.userId,
        req.body
      );
      res.status(201).json(task);
    } catch (error) {
      next(error);
    }
  }
);

// Update task
router.patch(
  '/:taskId',
  authenticate,
  validate(updateTaskSchema),
  async (req, res, next) => {
    try {
      const task = await tasksService.updateTask(
        req.tenantId,
        req.params.taskId,
        req.body
      );
      res.json(task);
    } catch (error) {
      next(error);
    }
  }
);

// Delete task
router.delete(
  '/:taskId',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await tasksService.deleteTask(
        req.tenantId,
        req.params.taskId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Reorder tasks
router.post(
  '/reorder',
  authenticate,
  validate(reorderTasksSchema),
  async (req, res, next) => {
    try {
      const result = await tasksService.reorderTasks(
        req.tenantId,
        req.body.tasks
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== CHECKLIST ROUTES ====================

// Get checklists
router.get(
  '/:taskId/checklists',
  authenticate,
  async (req, res, next) => {
    try {
      const checklists = await tasksService.getChecklists(
        req.tenantId,
        req.params.taskId
      );
      res.json(checklists);
    } catch (error) {
      next(error);
    }
  }
);

// Add checklist item
router.post(
  '/:taskId/checklists',
  authenticate,
  validate(addChecklistSchema),
  async (req, res, next) => {
    try {
      const item = await tasksService.addChecklistItem(
        req.tenantId,
        req.params.taskId,
        req.body
      );
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  }
);

// Update checklist item
router.patch(
  '/checklists/:itemId',
  authenticate,
  validate(updateChecklistSchema),
  async (req, res, next) => {
    try {
      const item = await tasksService.updateChecklistItem(
        req.tenantId,
        req.params.itemId,
        req.body
      );
      res.json(item);
    } catch (error) {
      next(error);
    }
  }
);

// Delete checklist item
router.delete(
  '/checklists/:itemId',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await tasksService.deleteChecklistItem(
        req.tenantId,
        req.params.itemId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== COMMENT ROUTES ====================

// Get comments
router.get(
  '/:taskId/comments',
  authenticate,
  async (req, res, next) => {
    try {
      const comments = await tasksService.getComments(
        req.tenantId,
        req.params.taskId
      );
      res.json(comments);
    } catch (error) {
      next(error);
    }
  }
);

// Add comment
router.post(
  '/:taskId/comments',
  authenticate,
  validate(addCommentSchema),
  async (req, res, next) => {
    try {
      const comment = await tasksService.addComment(
        req.tenantId,
        req.params.taskId,
        req.userId,
        req.body
      );
      res.status(201).json(comment);
    } catch (error) {
      next(error);
    }
  }
);

// Update comment
router.patch(
  '/comments/:commentId',
  authenticate,
  validate(updateCommentSchema),
  async (req, res, next) => {
    try {
      const comment = await tasksService.updateComment(
        req.tenantId,
        req.params.commentId,
        req.userId,
        req.body
      );
      res.json(comment);
    } catch (error) {
      next(error);
    }
  }
);

// Delete comment
router.delete(
  '/comments/:commentId',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await tasksService.deleteComment(
        req.tenantId,
        req.params.commentId,
        req.userId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== ATTACHMENT ROUTES ====================

// Get attachments
router.get(
  '/:taskId/attachments',
  authenticate,
  async (req, res, next) => {
    try {
      const attachments = await tasksService.getAttachments(
        req.tenantId,
        req.params.taskId
      );
      res.json(attachments);
    } catch (error) {
      next(error);
    }
  }
);

// Add attachment
router.post(
  '/:taskId/attachments',
  authenticate,
  validate(addAttachmentSchema),
  async (req, res, next) => {
    try {
      const attachment = await tasksService.addAttachment(
        req.tenantId,
        req.params.taskId,
        req.userId,
        req.body
      );
      res.status(201).json(attachment);
    } catch (error) {
      next(error);
    }
  }
);

// Delete attachment
router.delete(
  '/attachments/:attachmentId',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await tasksService.deleteAttachment(
        req.tenantId,
        req.params.attachmentId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// ==================== DEPENDENCY ROUTES ====================

// Add dependency
router.post(
  '/:taskId/dependencies',
  authenticate,
  validate(addDependencySchema),
  async (req, res, next) => {
    try {
      const dependency = await tasksService.addDependency(
        req.tenantId,
        req.params.taskId,
        req.body.dependsOnTaskId,
        req.body.type
      );
      res.status(201).json(dependency);
    } catch (error) {
      next(error);
    }
  }
);

// Remove dependency
router.delete(
  '/:taskId/dependencies/:dependsOnTaskId',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await tasksService.removeDependency(
        req.tenantId,
        req.params.taskId,
        req.params.dependsOnTaskId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

export { router as tasksRouter };
