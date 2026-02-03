import { Router } from 'express';
import { z } from 'zod';
import { authenticateSuperAdmin, authorizeSuperAdmin } from './super-admin.middleware.js';
import { superAdminService } from './super-admin.service.js';
import { authRateLimiter } from '../../common/middleware/rate-limiter.js';
import { emailCreditsRouter } from './email-credits.router.js';

const router = Router();

// ==================== ROOT ENDPOINT ====================

/**
 * Get super admin status
 * GET /api/v1/super-admin
 */
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        available: true,
        message: 'Super Admin API is available',
        endpoints: {
          auth: '/login, /refresh',
          tenants: '/tenants',
          users: '/users',
          credits: '/email',
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
});

// Mount email credits routes
router.use('/email', emailCreditsRouter);

// ==================== VALIDATION SCHEMAS ====================

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

const createSuperAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'BILLING', 'ANALYST']).optional(),
  permissions: z.record(z.any()).optional(),
});

const updateSuperAdminSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'BILLING', 'ANALYST']).optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
  permissions: z.record(z.any()).optional(),
});

const updateTenantSchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']).optional(),
  settings: z.record(z.any()).optional(),
});

const suspendTenantSchema = z.object({
  reason: z.string().min(1),
});

// ==================== AUTH ROUTES (Public) ====================

/**
 * POST /super-admin/auth/login
 * Login as super admin
 */
router.post('/auth/login', authRateLimiter, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const result = await superAdminService.login(data, ipAddress, userAgent);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /super-admin/auth/refresh
 * Refresh access token
 */
router.post('/auth/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await superAdminService.refreshTokens(refreshToken);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /super-admin/auth/logout
 * Logout super admin
 */
router.post('/auth/logout', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const sessionToken = req.headers['x-session-token'];
    const ipAddress = req.ip || req.connection?.remoteAddress;
    const userAgent = req.headers['user-agent'];

    await superAdminService.logout(sessionToken, req.superAdmin.id, ipAddress, userAgent);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /super-admin/auth/me
 * Get current super admin profile
 */
router.get('/auth/me', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const result = await superAdminService.getMe(req.superAdmin.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== TENANT MANAGEMENT ====================

/**
 * GET /super-admin/tenants
 * List all tenants
 */
router.get('/tenants', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { page, limit, search, status } = req.query;

    const result = await superAdminService.listTenants({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /super-admin/tenants/:id
 * Get tenant by ID
 */
router.get('/tenants/:id', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const result = await superAdminService.getTenant(req.params.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /super-admin/tenants/:id
 * Update tenant
 */
router.patch(
  '/tenants/:id',
  authenticateSuperAdmin,
  authorizeSuperAdmin('SUPER_ADMIN', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = updateTenantSchema.parse(req.body);
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await superAdminService.updateTenant(
        req.params.id,
        data,
        req.superAdmin.id,
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /super-admin/tenants/:id/suspend
 * Suspend tenant
 */
router.post(
  '/tenants/:id/suspend',
  authenticateSuperAdmin,
  authorizeSuperAdmin('SUPER_ADMIN', 'ADMIN'),
  async (req, res, next) => {
    try {
      const { reason } = suspendTenantSchema.parse(req.body);
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await superAdminService.suspendTenant(
        req.params.id,
        reason,
        req.superAdmin.id,
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        data: result,
        message: 'Tenant suspended successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /super-admin/tenants/:id/activate
 * Activate tenant
 */
router.post(
  '/tenants/:id/activate',
  authenticateSuperAdmin,
  authorizeSuperAdmin('SUPER_ADMIN', 'ADMIN'),
  async (req, res, next) => {
    try {
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await superAdminService.activateTenant(
        req.params.id,
        req.superAdmin.id,
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        data: result,
        message: 'Tenant activated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== PLATFORM ANALYTICS ====================

/**
 * GET /super-admin/analytics/overview
 * Get platform overview stats
 */
router.get('/analytics/overview', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const result = await superAdminService.getPlatformStats();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// ==================== SUPER ADMIN MANAGEMENT ====================

/**
 * GET /super-admin/admins
 * List all super admins (SUPER_ADMIN only)
 */
router.get(
  '/admins',
  authenticateSuperAdmin,
  authorizeSuperAdmin('SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const { page, limit } = req.query;

      const result = await superAdminService.listSuperAdmins({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /super-admin/admins
 * Create super admin (SUPER_ADMIN only)
 */
router.post(
  '/admins',
  authenticateSuperAdmin,
  authorizeSuperAdmin('SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const data = createSuperAdminSchema.parse(req.body);
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await superAdminService.createSuperAdmin(
        data,
        req.superAdmin.id,
        ipAddress,
        userAgent
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Super admin created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /super-admin/admins/:id
 * Update super admin (SUPER_ADMIN only)
 */
router.patch(
  '/admins/:id',
  authenticateSuperAdmin,
  authorizeSuperAdmin('SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const data = updateSuperAdminSchema.parse(req.body);
      const ipAddress = req.ip || req.connection?.remoteAddress;
      const userAgent = req.headers['user-agent'];

      const result = await superAdminService.updateSuperAdmin(
        req.params.id,
        data,
        req.superAdmin.id,
        ipAddress,
        userAgent
      );

      res.json({
        success: true,
        data: result,
        message: 'Super admin updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== AUDIT LOGS ====================

/**
 * GET /super-admin/audit-logs
 * Get platform audit logs
 */
router.get(
  '/audit-logs',
  authenticateSuperAdmin,
  authorizeSuperAdmin('SUPER_ADMIN', 'ADMIN'),
  async (req, res, next) => {
    try {
      const { page, limit, action, superAdminId, entityType } = req.query;

      const result = await superAdminService.getAuditLogs({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 50,
        action,
        superAdminId,
        entityType,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as superAdminRouter };
