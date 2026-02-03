import { Router } from 'express';
import { z } from 'zod';
import { tenantMiddleware } from '../../common/middleware/tenant.js';
import { tenantService } from './tenant.service.js';
import { featureAccessService } from './feature-access.service.js';

const router = Router();

// All tenant routes require authentication
router.use(tenantMiddleware);

// Root endpoint - returns current tenant (for backwards compatibility)
router.get('/', async (req, res, next) => {
  try {
    const tenant = await tenantService.getTenant(req.tenantId);

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
});

// Get current tenant
router.get('/current', async (req, res, next) => {
  try {
    const tenant = await tenantService.getTenant(req.tenantId);

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
});

// Get current tenant with subscription and plan details
router.get('/current/plan', async (req, res, next) => {
  try {
    const tenant = await tenantService.getTenantWithPlan(req.tenantId);

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
});

// Get feature access control info
router.get('/access-control', async (req, res, next) => {
  try {
    const accessControl = await featureAccessService.getAccessControl(req.tenantId);

    res.json({
      success: true,
      data: accessControl,
    });
  } catch (error) {
    next(error);
  }
});

// Check access to specific module
router.get('/access/module/:moduleName', async (req, res, next) => {
  try {
    const hasAccess = await featureAccessService.hasModuleAccess(
      req.tenantId,
      req.params.moduleName
    );

    res.json({
      success: true,
      data: {
        module: req.params.moduleName,
        hasAccess,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Check access to specific feature
router.get('/access/feature/:featureName', async (req, res, next) => {
  try {
    const hasAccess = await featureAccessService.hasFeatureAccess(
      req.tenantId,
      req.params.featureName
    );

    res.json({
      success: true,
      data: {
        feature: req.params.featureName,
        hasAccess,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Check usage limit
router.get('/access/limit/:limitType', async (req, res, next) => {
  try {
    const limitCheck = await featureAccessService.checkLimit(req.tenantId, req.params.limitType);

    res.json({
      success: true,
      data: {
        limit: req.params.limitType,
        ...limitCheck,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update tenant settings
router.patch('/current', async (req, res, next) => {
  try {
    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      settings: z.record(z.unknown()).optional(),
    });

    const data = updateSchema.parse(req.body);
    const tenant = await tenantService.updateTenant(req.tenantId, data);

    res.json({
      success: true,
      data: tenant,
    });
  } catch (error) {
    next(error);
  }
});

// Get workspaces
router.get('/workspaces', async (req, res, next) => {
  try {
    const workspaces = await tenantService.getWorkspaces(req.tenantId);

    res.json({
      success: true,
      data: workspaces,
    });
  } catch (error) {
    next(error);
  }
});

// Create workspace
router.post('/workspaces', async (req, res, next) => {
  try {
    const createSchema = z.object({
      name: z.string().min(1),
      settings: z.record(z.unknown()).optional(),
    });

    const data = createSchema.parse(req.body);
    const workspace = await tenantService.createWorkspace(req.tenantId, data);

    res.status(201).json({
      success: true,
      data: workspace,
    });
  } catch (error) {
    next(error);
  }
});

// Get users
router.get('/users', async (req, res, next) => {
  try {
    const users = await tenantService.getUsers(req.tenantId);

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
});

// Invite user
router.post('/users/invite', async (req, res, next) => {
  try {
    const inviteSchema = z.object({
      email: z.string().email(),
      roleId: z.string().uuid(),
      workspaceId: z.string().uuid().optional(),
    });

    const data = inviteSchema.parse(req.body);
    await tenantService.inviteUser(req.tenantId, req.workspaceId, data);

    res.status(201).json({
      success: true,
      message: 'Invitation sent',
    });
  } catch (error) {
    next(error);
  }
});

// Get roles
router.get('/roles', async (req, res, next) => {
  try {
    const roles = await tenantService.getRoles(req.tenantId);

    res.json({
      success: true,
      data: roles,
    });
  } catch (error) {
    next(error);
  }
});

export { router as tenantRouter };
