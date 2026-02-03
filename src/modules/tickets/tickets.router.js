import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../common/middleware/tenant.js';
import { ticketsService } from './tickets.service.js';

const router = Router();

router.get('/', requirePermission('tickets:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        assignedTo: z.string().optional(),
        search: z.string().optional(),
      })
      .parse(req.query);

    const result = await ticketsService.getTickets(req.tenantId, params);

    res.json({
      success: true,
      data: result.tickets,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

// Stats endpoint - MUST be before /:id to avoid route conflict
router.get('/stats', requirePermission('tickets:read'), async (req, res, next) => {
  try {
    const stats = await ticketsService.getTicketStats(req.tenantId);
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

// SLA Policies - MUST be before /:id to avoid route conflict
router.get('/sla-policies', requirePermission('tickets:sla:read'), async (req, res, next) => {
  try {
    const policies = await ticketsService.getSLAPolicies(req.tenantId);

    res.json({
      success: true,
      data: policies,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requirePermission('tickets:read'), async (req, res, next) => {
  try {
    const ticket = await ticketsService.getTicket(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', requirePermission('tickets:create'), async (req, res, next) => {
  try {
    const data = z
      .object({
        subject: z.string().min(1),
        description: z.string().optional(),
        contactId: z.string().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
        category: z.string().optional(),
      })
      .parse(req.body);

    const ticket = await ticketsService.createTicket(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requirePermission('tickets:update'), async (req, res, next) => {
  try {
    const data = z
      .object({
        subject: z.string().min(1).optional(),
        description: z.string().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED']).optional(),
        category: z.string().optional(),
      })
      .parse(req.body);

    const ticket = await ticketsService.updateTicket(req.tenantId, req.params.id, data);

    res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/assign', requirePermission('tickets:assign'), async (req, res, next) => {
  try {
    const { assignedTo } = z.object({ assignedTo: z.string().uuid() }).parse(req.body);
    const ticket = await ticketsService.assignTicket(req.tenantId, req.params.id, assignedTo);

    res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/resolve', requirePermission('tickets:update'), async (req, res, next) => {
  try {
    const ticket = await ticketsService.resolveTicket(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/comments', requirePermission('tickets:update'), async (req, res, next) => {
  try {
    const { content, isInternal } = z
      .object({
        content: z.string().min(1),
        isInternal: z.boolean().default(false),
      })
      .parse(req.body);

    const comment = await ticketsService.addComment(
      req.tenantId,
      req.params.id,
      req.userId,
      content,
      isInternal
    );

    res.status(201).json({
      success: true,
      data: comment,
    });
  } catch (error) {
    next(error);
  }
});

export { router as ticketsRouter };
