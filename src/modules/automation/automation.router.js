import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../common/middleware/tenant.js';
import { automationService } from './automation.service.js';

const router = Router();

router.get('/workflows', requirePermission('automation:read'), async (req, res, next) => {
  try {
    const params = z.object({
      status: z.enum(['ACTIVE', 'PAUSED', 'DRAFT']).optional(),
    }).parse(req.query);

    const workflows = await automationService.getWorkflows(req.tenantId, params);

    res.json({
      success: true,
      data: workflows,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/workflows/:id', requirePermission('automation:read'), async (req, res, next) => {
  try {
    const workflow = await automationService.getWorkflow(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/workflows', requirePermission('automation:create'), async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      trigger: z.object({
        type: z.string(),
        config: z.record(z.unknown()).optional(),
      }),
      conditions: z.array(z.object({
        field: z.string(),
        operator: z.string(),
        value: z.unknown(),
      })).optional(),
      actions: z.array(z.object({
        type: z.string(),
        config: z.record(z.unknown()),
      })),
    }).parse(req.body);

    const workflow = await automationService.createWorkflow(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/workflows/:id', requirePermission('automation:update'), async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      trigger: z.object({
        type: z.string(),
        config: z.record(z.unknown()).optional(),
      }).optional(),
      conditions: z.array(z.object({
        field: z.string(),
        operator: z.string(),
        value: z.unknown(),
      })).optional(),
      actions: z.array(z.object({
        type: z.string(),
        config: z.record(z.unknown()),
      })).optional(),
    }).parse(req.body);

    const workflow = await automationService.updateWorkflow(req.tenantId, req.params.id, data);

    res.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/workflows/:id/activate', requirePermission('automation:update'), async (req, res, next) => {
  try {
    const workflow = await automationService.activateWorkflow(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/workflows/:id/pause', requirePermission('automation:update'), async (req, res, next) => {
  try {
    const workflow = await automationService.pauseWorkflow(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: workflow,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/workflows/:id/executions', requirePermission('automation:read'), async (req, res, next) => {
  try {
    const params = z.object({
      page: z.coerce.number().min(1).default(1),
      limit: z.coerce.number().min(1).max(100).default(25),
    }).parse(req.query);

    const result = await automationService.getExecutions(req.tenantId, req.params.id, params);

    res.json({
      success: true,
      data: result.executions,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/workflows/:id', requirePermission('automation:delete'), async (req, res, next) => {
  try {
    await automationService.deleteWorkflow(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Workflow deleted',
    });
  } catch (error) {
    next(error);
  }
});

export { router as automationRouter };
