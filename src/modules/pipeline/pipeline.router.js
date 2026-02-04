import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../common/middleware/tenant.js';
import { pipelineService } from './pipeline.service.js';

const router = Router();

// ============ PIPELINES ============

router.get('/pipelines', requirePermission('pipeline:read'), async (req, res, next) => {
  try {
    const type = z.enum(['LEAD', 'DEAL']).optional().parse(req.query.type);
    const pipelines = await pipelineService.getPipelines(req.tenantId, type);

    res.json({
      success: true,
      data: pipelines,
    });
  } catch (error) {
    next(error);
  }
});

// ============ STAGES ============

router.get('/stages', requirePermission('pipeline:read'), async (req, res, next) => {
  try {
    const { pipelineId } = req.query;
    const tenantId = req.tenantId;

    const stages = await pipelineService.getStages(tenantId, pipelineId);

    res.json({
      success: true,
      data: stages,
      meta: {
        total: stages.length,
        pipelineId: pipelineId || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/stages', requirePermission('pipeline:write'), async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1),
        pipelineId: z.string(),
        order: z.number().optional(),
        color: z.string().optional(),
        description: z.string().optional(),
        probability: z.number().min(0).max(100).optional(),
        isWon: z.boolean().optional(),
        isLost: z.boolean().optional(),
        isClosed: z.boolean().optional(),
      })
      .parse(req.body);

    const stage = await pipelineService.createStage(req.tenantId, data);

    res.status(201).json({
      success: true,
      data: stage,
      message: 'Stage created successfully',
    });
  } catch (error) {
    next(error);
  }
});

// NOTE: Leads management moved to /api/v1/crm/leads for comprehensive qualification workflow
// This module focuses on deals pipeline management

// ============ DEALS ============

router.get('/deals', requirePermission('pipeline:deals:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        pipelineId: z.string().cuid().optional(),
        stageId: z.string().cuid().optional(),
        status: z.enum(['OPEN', 'WON', 'LOST']).optional(),
        assignedTo: z.string().cuid().optional(),
        contactId: z.string().optional(),
        companyId: z.string().optional(),
        search: z.string().optional(),
      })
      .parse(req.query);

    const result = await pipelineService.getDeals(req.tenantId, params);

    // Transform deals to use consistent field names for frontend
    const transformedDeals = result.deals.map((deal) => ({
      ...deal,
      title: deal.name, // Map name to title for frontend compatibility
      value: deal.amount, // Map amount to value for frontend compatibility
    }));

    res.json({
      success: true,
      data: transformedDeals,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/deals', requirePermission('pipeline:deals:create'), async (req, res, next) => {
  try {
    const data = z
      .object({
        title: z.string().min(1),
        pipelineId: z.string().cuid(),
        stageId: z.string().cuid(),
        contactId: z.string().cuid().optional(),
        companyId: z.string().cuid().optional(),
        value: z.number().min(0).optional().nullable(),
        currency: z.string().default('USD').optional(),
        probability: z.number().min(0).max(100).optional().nullable(),
        expectedCloseDate: z.string().datetime().optional().nullable(),
        description: z.string().optional().nullable(),
        products: z
          .array(
            z.object({
              productId: z.string().cuid(),
              quantity: z.number().min(1),
              unitPrice: z.number().min(0),
              discount: z.number().min(0).max(100).optional(),
            })
          )
          .optional(),
      })
      .parse(req.body);

    const deal = await pipelineService.createDeal(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: deal,
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/deals/:id/move',
  requirePermission('pipeline:deals:update'),
  async (req, res, next) => {
    try {
      const { stageId } = z.object({ stageId: z.string().cuid() }).parse(req.body);
      const deal = await pipelineService.moveDeal(req.tenantId, req.params.id, stageId);

      res.json({
        success: true,
        data: deal,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Alias endpoint for stage progression (same as /deals/:id/move)
router.patch(
  '/deals/:id/stage',
  requirePermission('pipeline:deals:update'),
  async (req, res, next) => {
    try {
      const { stageId } = z.object({ stageId: z.string().cuid() }).parse(req.body);
      const deal = await pipelineService.moveDeal(req.tenantId, req.params.id, stageId);

      res.json({
        success: true,
        data: deal,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/deals/:id/win',
  requirePermission('pipeline:deals:update'),
  async (req, res, next) => {
    try {
      const deal = await pipelineService.winDeal(req.tenantId, req.params.id);

      res.json({
        success: true,
        data: deal,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/deals/:id/lose',
  requirePermission('pipeline:deals:update'),
  async (req, res, next) => {
    try {
      const { reason } = z.object({ reason: z.string() }).parse(req.body);
      const deal = await pipelineService.loseDeal(req.tenantId, req.params.id, reason);

      res.json({
        success: true,
        data: deal,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/deals/:id', requirePermission('pipeline:deals:read'), async (req, res, next) => {
  try {
    const deal = await pipelineService.getDeal(req.tenantId, req.params.id);

    // Transform deal to use consistent field names for frontend
    const transformedDeal = {
      ...deal,
      title: deal.name,
      value: deal.amount,
    };

    res.json({
      success: true,
      data: transformedDeal,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/deals/:id', requirePermission('pipeline:deals:update'), async (req, res, next) => {
  try {
    const data = z
      .object({
        title: z.string().min(1).optional(),
        value: z.number().min(0).optional(),
        probability: z.number().min(0).max(100).optional(),
        expectedCloseDate: z.string().datetime().optional(),
        notes: z.string().optional(),
        assignedToId: z.string().cuid().optional(),
      })
      .parse(req.body);

    const deal = await pipelineService.updateDeal(req.tenantId, req.params.id, data);

    res.json({
      success: true,
      data: deal,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/deals/:id', requirePermission('pipeline:deals:delete'), async (req, res, next) => {
  try {
    await pipelineService.deleteDeal(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Deal deleted',
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/deals/:id/products',
  requirePermission('pipeline:deals:update'),
  async (req, res, next) => {
    try {
      const data = z
        .object({
          productId: z.string().cuid(),
          quantity: z.number().min(1).default(1),
          unitPrice: z.number().min(0),
          discount: z.number().min(0).max(100).default(0),
        })
        .parse(req.body);

      const dealProduct = await pipelineService.addDealProduct(
        req.tenantId,
        req.params.id,
        data.productId,
        data
      );

      res.status(201).json({
        success: true,
        data: dealProduct,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/deals/:id/products/:productId',
  requirePermission('pipeline:deals:update'),
  async (req, res, next) => {
    try {
      await pipelineService.removeDealProduct(req.tenantId, req.params.id, req.params.productId);

      res.json({
        success: true,
        message: 'Product removed from deal',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ PRODUCTS ============

router.get('/products', requirePermission('pipeline:products:read'), async (req, res, next) => {
  try {
    const products = await pipelineService.getProducts(req.tenantId);

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/products', requirePermission('pipeline:products:create'), async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1),
        sku: z.string().optional(),
        description: z.string().optional(),
        unitPrice: z.number().min(0),
        currency: z.string().default('USD'),
        category: z.string().optional(),
      })
      .parse(req.body);

    const product = await pipelineService.createProduct(req.tenantId, data);

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/products/:id', requirePermission('pipeline:products:read'), async (req, res, next) => {
  try {
    const product = await pipelineService.getProduct(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/products/:id',
  requirePermission('pipeline:products:update'),
  async (req, res, next) => {
    try {
      const data = z
        .object({
          name: z.string().min(1).optional(),
          sku: z.string().optional(),
          description: z.string().optional(),
          unitPrice: z.number().min(0).optional(),
          currency: z.string().optional(),
          category: z.string().optional(),
          isActive: z.boolean().optional(),
        })
        .parse(req.body);

      const product = await pipelineService.updateProduct(req.tenantId, req.params.id, data);

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/products/:id',
  requirePermission('pipeline:products:delete'),
  async (req, res, next) => {
    try {
      await pipelineService.deleteProduct(req.tenantId, req.params.id);

      res.json({
        success: true,
        message: 'Product deleted',
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as pipelineRouter };
