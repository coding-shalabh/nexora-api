import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../common/middleware/tenant.js';

const router = Router();

router.get('/', requirePermission('wallet:read'), async (req, res, next) => {
  try {
    // TODO: Implement actual wallet retrieval from database
    // For now, return default wallet data
    res.json({
      success: true,
      data: {
        tenantId: req.tenantId,
        balance: 0,
        currency: 'USD',
        lowBalanceThreshold: 100,
        autoRechargeEnabled: false,
        autoRechargeAmount: 0,
        autoRechargeThreshold: 0,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/balance', requirePermission('wallet:read'), async (req, res, next) => {
  try {
    // TODO: Implement actual wallet balance retrieval from database
    // For now, return default balance
    res.json({
      success: true,
      data: {
        balance: 0,
        currency: 'USD',
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/transactions', requirePermission('wallet:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        type: z.enum(['CREDIT', 'DEBIT']).optional(),
      })
      .parse(req.query);

    // TODO: Implement actual transaction retrieval from database
    // For now, return empty transactions list
    res.json({
      success: true,
      data: [],
      meta: {
        total: 0,
        page: params.page,
        limit: params.limit,
        totalPages: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/topup', requirePermission('wallet:topup'), async (req, res, next) => {
  try {
    const data = z
      .object({
        amount: z.number().min(1),
        paymentMethod: z.string(),
      })
      .parse(req.body);

    // TODO: Implement actual top-up processing
    // For now, return mock transaction
    res.status(201).json({
      success: true,
      data: {
        id: 'txn_' + Date.now(),
        type: 'CREDIT',
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        status: 'completed',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/usage', requirePermission('wallet:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .parse(req.query);

    // TODO: Implement actual usage summary from database
    // For now, return default usage data
    res.json({
      success: true,
      data: {
        totalSpent: 0,
        byChannel: {
          whatsapp: 0,
          sms: 0,
          email: 0,
          voice: 0,
        },
        period: {
          startDate:
            params.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: params.endDate || new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/spend-limits', requirePermission('wallet:read'), async (req, res, next) => {
  try {
    // TODO: Implement actual spend limits retrieval from database
    // For now, return default limits
    res.json({
      success: true,
      data: {
        whatsapp: {
          dailyLimit: 1000,
          monthlyLimit: 10000,
          currentDailySpend: 0,
          currentMonthlySpend: 0,
        },
        sms: {
          dailyLimit: 500,
          monthlyLimit: 5000,
          currentDailySpend: 0,
          currentMonthlySpend: 0,
        },
        email: {
          dailyLimit: 2000,
          monthlyLimit: 20000,
          currentDailySpend: 0,
          currentMonthlySpend: 0,
        },
        voice: {
          dailyLimit: 300,
          monthlyLimit: 3000,
          currentDailySpend: 0,
          currentMonthlySpend: 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/spend-limits', requirePermission('wallet:manage'), async (req, res, next) => {
  try {
    const data = z
      .object({
        channel: z.string(),
        dailyLimit: z.number().min(0),
        monthlyLimit: z.number().min(0),
      })
      .parse(req.body);

    // TODO: Implement actual spend limit update in database
    // For now, return the updated limit
    res.json({
      success: true,
      data: {
        channel: data.channel,
        dailyLimit: data.dailyLimit,
        monthlyLimit: data.monthlyLimit,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/settings', requirePermission('wallet:manage'), async (req, res, next) => {
  try {
    const data = z
      .object({
        lowBalanceThreshold: z.number().min(0).optional(),
        autoRechargeEnabled: z.boolean().optional(),
        autoRechargeAmount: z.number().min(0).optional(),
        autoRechargeThreshold: z.number().min(0).optional(),
      })
      .parse(req.body);

    // TODO: Implement actual wallet settings update in database
    // For now, return updated settings
    res.json({
      success: true,
      data: {
        tenantId: req.tenantId,
        lowBalanceThreshold: data.lowBalanceThreshold ?? 100,
        autoRechargeEnabled: data.autoRechargeEnabled ?? false,
        autoRechargeAmount: data.autoRechargeAmount ?? 0,
        autoRechargeThreshold: data.autoRechargeThreshold ?? 0,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as walletRouter };
