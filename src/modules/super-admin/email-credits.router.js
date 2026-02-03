import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@crm360/database';
import { authenticateSuperAdmin, authorizeSuperAdmin } from './super-admin.middleware.js';
import { sesEmailService } from '../../services/ses-email.service.js';

const router = Router();

// ==================== VALIDATION SCHEMAS ====================

const createPlanSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  emails: z.number().int().positive(),
  priceInr: z.number().int().positive(),
  priceUsd: z.number().int().positive(),
  pricePerEmail: z.number().positive(),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  isPopular: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).optional(),
  emails: z.number().int().positive().optional(),
  priceInr: z.number().int().positive().optional(),
  priceUsd: z.number().int().positive().optional(),
  pricePerEmail: z.number().positive().optional(),
  description: z.string().optional(),
  features: z.array(z.string()).optional(),
  isPopular: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const addCreditsSchema = z.object({
  credits: z.number().int().positive(),
  type: z.enum(['TOPUP', 'BONUS', 'ADJUSTMENT', 'REFUND']).optional().default('TOPUP'),
  notes: z.string().optional(),
});

const updateFreeQuotaSchema = z.object({
  freeQuota: z.number().int().min(0),
});

// ==================== EMAIL CREDIT PLANS ====================

/**
 * GET /super-admin/email/plans
 * List all email credit plans
 */
router.get('/plans', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const plans = await prisma.emailCreditPlan.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    res.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /super-admin/email/plans
 * Create email credit plan
 */
router.post(
  '/plans',
  authenticateSuperAdmin,
  authorizeSuperAdmin('SUPER_ADMIN', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = createPlanSchema.parse(req.body);

      const plan = await prisma.emailCreditPlan.create({
        data: {
          ...data,
          features: data.features || [],
        },
      });

      res.status(201).json({
        success: true,
        data: plan,
        message: 'Email credit plan created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /super-admin/email/plans/:id
 * Update email credit plan
 */
router.patch(
  '/plans/:id',
  authenticateSuperAdmin,
  authorizeSuperAdmin('SUPER_ADMIN', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = updatePlanSchema.parse(req.body);

      const plan = await prisma.emailCreditPlan.update({
        where: { id: req.params.id },
        data,
      });

      res.json({
        success: true,
        data: plan,
        message: 'Email credit plan updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /super-admin/email/plans/:id
 * Delete email credit plan (soft delete by deactivating)
 */
router.delete(
  '/plans/:id',
  authenticateSuperAdmin,
  authorizeSuperAdmin('SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      await prisma.emailCreditPlan.update({
        where: { id: req.params.id },
        data: { isActive: false },
      });

      res.json({
        success: true,
        message: 'Email credit plan deactivated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== TENANT EMAIL CREDITS MANAGEMENT ====================

/**
 * GET /super-admin/email/tenants
 * List all tenants with their email credits
 */
router.get('/tenants', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search } = req.query;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          email: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.tenant.count({ where }),
    ]);

    // Get email credits for each tenant
    const tenantsWithCredits = await Promise.all(
      tenants.map(async (tenant) => {
        const balance = await prisma.emailCreditBalance.findUnique({
          where: { tenantId: tenant.id },
        });

        return {
          ...tenant,
          emailCredits: balance
            ? {
                totalCredits: balance.totalCredits,
                usedCredits: balance.usedCredits,
                freeQuota: balance.freeQuota,
                freeUsedThisMonth: balance.freeUsedThisMonth,
                available:
                  balance.totalCredits -
                  balance.usedCredits +
                  Math.max(0, balance.freeQuota - balance.freeUsedThisMonth),
              }
            : {
                totalCredits: 0,
                usedCredits: 0,
                freeQuota: 500,
                freeUsedThisMonth: 0,
                available: 500,
              },
        };
      })
    );

    res.json({
      success: true,
      data: tenantsWithCredits,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /super-admin/email/tenants/:tenantId
 * Get tenant email credits details
 */
router.get('/tenants/:tenantId', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { tenantId } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        email: true,
        status: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Tenant not found',
      });
    }

    const credits = await sesEmailService.getEmailCredits(tenantId);
    const usageSummary = await sesEmailService.getUsageSummary(tenantId, 'month');
    const recentPurchases = await sesEmailService.getPurchaseHistory(tenantId, { limit: 5 });
    const recentUsage = await sesEmailService.getUsageHistory(tenantId, { limit: 10 });

    res.json({
      success: true,
      data: {
        tenant,
        credits,
        usageSummary,
        recentPurchases: recentPurchases.purchases,
        recentUsage: recentUsage.logs,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /super-admin/email/tenants/:tenantId/credits
 * Add credits to tenant
 */
router.post(
  '/tenants/:tenantId/credits',
  authenticateSuperAdmin,
  authorizeSuperAdmin('SUPER_ADMIN', 'ADMIN'),
  async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const data = addCreditsSchema.parse(req.body);

      const result = await sesEmailService.addEmailCredits(tenantId, data.credits, {
        userId: req.superAdmin.id,
        type: data.type,
        notes: data.notes || `Added by super admin: ${req.superAdmin.email}`,
      });

      res.json({
        success: true,
        data: result,
        message: `Added ${data.credits} email credits to tenant`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /super-admin/email/tenants/:tenantId/free-quota
 * Update tenant's free quota
 */
router.patch(
  '/tenants/:tenantId/free-quota',
  authenticateSuperAdmin,
  authorizeSuperAdmin('SUPER_ADMIN', 'ADMIN'),
  async (req, res, next) => {
    try {
      const { tenantId } = req.params;
      const { freeQuota } = updateFreeQuotaSchema.parse(req.body);

      let balance = await prisma.emailCreditBalance.findUnique({
        where: { tenantId },
      });

      if (!balance) {
        balance = await prisma.emailCreditBalance.create({
          data: {
            tenantId,
            freeQuota,
          },
        });
      } else {
        balance = await prisma.emailCreditBalance.update({
          where: { tenantId },
          data: { freeQuota },
        });
      }

      res.json({
        success: true,
        data: balance,
        message: `Updated free quota to ${freeQuota}`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==================== PLATFORM EMAIL ANALYTICS ====================

/**
 * GET /super-admin/email/analytics
 * Get platform-wide email analytics
 */
router.get('/analytics', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;

    const now = new Date();
    let startDate;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    // Get total usage across all tenants
    const usageLogs = await prisma.emailUsageLog.findMany({
      where: {
        createdAt: { gte: startDate },
      },
    });

    // Get total purchases
    const purchases = await prisma.emailCreditPurchase.findMany({
      where: {
        createdAt: { gte: startDate },
        status: 'COMPLETED',
      },
    });

    // Get all balances
    const balances = await prisma.emailCreditBalance.findMany();

    // Calculate totals
    const totalEmailsSent = usageLogs.reduce((sum, l) => sum + l.emailsSent, 0);
    const totalEmailsFailed = usageLogs.reduce((sum, l) => sum + l.emailsFailed, 0);
    const totalCreditsUsed = usageLogs.reduce((sum, l) => sum + l.creditsUsed, 0);
    const totalFreeCreditsUsed = usageLogs.reduce((sum, l) => sum + l.freeCreditsUsed, 0);

    const totalCreditsPurchased = purchases.reduce((sum, p) => sum + p.credits, 0);
    const totalRevenue = purchases.reduce((sum, p) => sum + p.amountPaid, 0);

    const totalActiveCredits = balances.reduce(
      (sum, b) => sum + (b.totalCredits - b.usedCredits),
      0
    );
    const totalTenants = balances.length;

    res.json({
      success: true,
      data: {
        period,
        startDate,
        endDate: now,
        usage: {
          totalSent: totalEmailsSent,
          totalFailed: totalEmailsFailed,
          paidCreditsUsed: totalCreditsUsed,
          freeCreditsUsed: totalFreeCreditsUsed,
          deliveryRate:
            totalEmailsSent > 0
              ? ((totalEmailsSent - totalEmailsFailed) / totalEmailsSent) * 100
              : 0,
        },
        purchases: {
          totalCredits: totalCreditsPurchased,
          totalRevenue,
          transactionCount: purchases.length,
          avgPurchaseSize:
            purchases.length > 0 ? Math.round(totalCreditsPurchased / purchases.length) : 0,
        },
        platform: {
          totalTenants,
          totalActiveCredits,
          avgCreditsPerTenant: totalTenants > 0 ? Math.round(totalActiveCredits / totalTenants) : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /super-admin/email/purchases
 * Get all credit purchases across platform
 */
router.get('/purchases', authenticateSuperAdmin, async (req, res, next) => {
  try {
    const { page = 1, limit = 50, tenantId, type } = req.query;

    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (type) where.type = type;

    const [purchases, total] = await Promise.all([
      prisma.emailCreditPurchase.findMany({
        where,
        include: {
          plan: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.emailCreditPurchase.count({ where }),
    ]);

    // Get tenant names
    const tenantIds = [...new Set(purchases.map((p) => p.tenantId))];
    const tenants = await prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true, slug: true },
    });
    const tenantMap = Object.fromEntries(tenants.map((t) => [t.id, t]));

    const purchasesWithTenants = purchases.map((p) => ({
      ...p,
      tenant: tenantMap[p.tenantId] || null,
    }));

    res.json({
      success: true,
      data: purchasesWithTenants,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /super-admin/email/plans/seed
 * Seed default email plans
 */
router.post(
  '/plans/seed',
  authenticateSuperAdmin,
  authorizeSuperAdmin('SUPER_ADMIN'),
  async (req, res, next) => {
    try {
      const defaultPlans = [
        {
          name: 'Starter',
          slug: 'starter',
          emails: 5000,
          priceInr: 29900, // ₹299
          priceUsd: 399, // $3.99
          pricePerEmail: 0.06,
          description: 'Perfect for small businesses getting started with email marketing',
          features: ['5,000 emails', 'Basic templates', 'Email support', '30-day validity'],
          isPopular: false,
          sortOrder: 1,
        },
        {
          name: 'Growth',
          slug: 'growth',
          emails: 25000,
          priceInr: 79900, // ₹799
          priceUsd: 999, // $9.99
          pricePerEmail: 0.032,
          description: 'Ideal for growing businesses with regular campaigns',
          features: [
            '25,000 emails',
            'All templates',
            'Priority support',
            'Analytics dashboard',
            '60-day validity',
          ],
          isPopular: true,
          sortOrder: 2,
        },
        {
          name: 'Pro',
          slug: 'pro',
          emails: 100000,
          priceInr: 199900, // ₹1,999
          priceUsd: 2499, // $24.99
          pricePerEmail: 0.02,
          description: 'For businesses with high-volume email needs',
          features: [
            '100,000 emails',
            'Custom templates',
            'API access',
            'Dedicated support',
            'Advanced analytics',
            '90-day validity',
          ],
          isPopular: false,
          sortOrder: 3,
        },
        {
          name: 'Enterprise',
          slug: 'enterprise',
          emails: 500000,
          priceInr: 499900, // ₹4,999
          priceUsd: 5999, // $59.99
          pricePerEmail: 0.01,
          description: 'Enterprise-grade solution for large organizations',
          features: [
            '500,000 emails',
            'White-label sending',
            'Custom domain',
            'SLA guarantee',
            'Account manager',
            '1-year validity',
          ],
          isPopular: false,
          sortOrder: 4,
        },
      ];

      const results = [];
      for (const plan of defaultPlans) {
        const existing = await prisma.emailCreditPlan.findUnique({
          where: { slug: plan.slug },
        });

        if (existing) {
          const updated = await prisma.emailCreditPlan.update({
            where: { slug: plan.slug },
            data: plan,
          });
          results.push({ ...updated, action: 'updated' });
        } else {
          const created = await prisma.emailCreditPlan.create({
            data: plan,
          });
          results.push({ ...created, action: 'created' });
        }
      }

      res.json({
        success: true,
        data: results,
        message: `Seeded ${results.length} email credit plans`,
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as emailCreditsRouter };
