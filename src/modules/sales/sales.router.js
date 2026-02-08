/**
 * Sales Module Router
 * Handles sales forecasts, goals, and leaderboard
 */

import { Router } from 'express';
import { z } from 'zod';
import { salesService } from './sales.service.js';

const router = Router();

// Validation schemas
const createForecastSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  period: z.enum(['MONTHLY', 'QUARTERLY', 'YEARLY']),
  startDate: z.string(),
  endDate: z.string(),
  targetAmount: z.number().min(0),
  probability: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

const createGoalSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['REVENUE', 'DEALS', 'CALLS', 'MEETINGS', 'EMAILS']),
  targetValue: z.number().min(0),
  startDate: z.string(),
  endDate: z.string(),
  period: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  assigneeId: z.string().optional(),
  notes: z.string().optional(),
});

const validate = (schema) => (req, res, next) => {
  try {
    req.validatedBody = schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.errors,
    });
  }
};

// ==================== FORECASTS ====================

// GET /sales/forecasts - List forecasts
router.get('/forecasts', async (req, res) => {
  try {
    const { page, limit, period, userId } = req.query;

    const result = await salesService.listForecasts({
      tenantId: req.tenantId,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100),
      period,
      userId,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('List forecasts error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /sales/forecasts/:id - Get forecast details
router.get('/forecasts/:id', async (req, res) => {
  try {
    const forecast = await salesService.getForecast({
      tenantId: req.tenantId,
      forecastId: req.params.id,
    });

    return res.json({ success: true, data: forecast });
  } catch (error) {
    console.error('Get forecast error:', error);
    return res.status(404).json({ success: false, error: error.message });
  }
});

// POST /sales/forecasts - Create forecast
router.post('/forecasts', validate(createForecastSchema), async (req, res) => {
  try {
    const forecast = await salesService.createForecast({
      tenantId: req.tenantId,
      userId: req.userId,
      data: req.validatedBody,
    });

    return res.status(201).json({ success: true, data: forecast });
  } catch (error) {
    console.error('Create forecast error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /sales/forecasts/:id - Update forecast
router.put('/forecasts/:id', async (req, res) => {
  try {
    const forecast = await salesService.updateForecast({
      tenantId: req.tenantId,
      forecastId: req.params.id,
      data: req.body,
    });

    return res.json({ success: true, data: forecast });
  } catch (error) {
    console.error('Update forecast error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /sales/forecasts/:id - Delete forecast
router.delete('/forecasts/:id', async (req, res) => {
  try {
    await salesService.deleteForecast({
      tenantId: req.tenantId,
      forecastId: req.params.id,
    });

    return res.json({ success: true, message: 'Forecast deleted' });
  } catch (error) {
    console.error('Delete forecast error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// GET /sales/forecasts/report - Get forecast report
router.get('/forecasts/report', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
      });
    }

    const report = await salesService.getForecastReport({
      tenantId: req.tenantId,
      startDate,
      endDate,
    });

    return res.json({ success: true, data: report });
  } catch (error) {
    console.error('Get forecast report error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== GOALS ====================

// GET /sales/goals - List goals
router.get('/goals', async (req, res) => {
  try {
    const { page, limit, type, status, userId } = req.query;

    const result = await salesService.listGoals({
      tenantId: req.tenantId,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100),
      type,
      status,
      userId,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('List goals error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /sales/goals/:id - Get goal details
router.get('/goals/:id', async (req, res) => {
  try {
    const goal = await salesService.getGoal({
      tenantId: req.tenantId,
      goalId: req.params.id,
    });

    return res.json({ success: true, data: goal });
  } catch (error) {
    console.error('Get goal error:', error);
    return res.status(404).json({ success: false, error: error.message });
  }
});

// POST /sales/goals - Create goal
router.post('/goals', validate(createGoalSchema), async (req, res) => {
  try {
    const goal = await salesService.createGoal({
      tenantId: req.tenantId,
      userId: req.userId,
      data: req.validatedBody,
    });

    return res.status(201).json({ success: true, data: goal });
  } catch (error) {
    console.error('Create goal error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /sales/goals/:id - Update goal
router.put('/goals/:id', async (req, res) => {
  try {
    const goal = await salesService.updateGoal({
      tenantId: req.tenantId,
      goalId: req.params.id,
      data: req.body,
    });

    return res.json({ success: true, data: goal });
  } catch (error) {
    console.error('Update goal error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /sales/goals/:id - Delete goal
router.delete('/goals/:id', async (req, res) => {
  try {
    await salesService.deleteGoal({
      tenantId: req.tenantId,
      goalId: req.params.id,
    });

    return res.json({ success: true, message: 'Goal deleted' });
  } catch (error) {
    console.error('Delete goal error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// GET /sales/goals/:id/progress - Get goal progress
router.get('/goals/:id/progress', async (req, res) => {
  try {
    const progress = await salesService.getGoalProgress({
      tenantId: req.tenantId,
      goalId: req.params.id,
    });

    return res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Get goal progress error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /sales/goals/:id/progress - Update goal progress
router.post('/goals/:id/progress', async (req, res) => {
  try {
    const { value } = req.body;

    if (typeof value !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'value is required and must be a number',
      });
    }

    const goal = await salesService.updateGoalProgress({
      tenantId: req.tenantId,
      goalId: req.params.id,
      value,
    });

    return res.json({ success: true, data: goal });
  } catch (error) {
    console.error('Update goal progress error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== LEADERBOARD ====================

// GET /sales/leaderboard - Get sales leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { period, limit } = req.query;

    const leaderboard = await salesService.getLeaderboard({
      tenantId: req.tenantId,
      period,
      limit: parseInt(limit) || 10,
    });

    return res.json({ success: true, ...leaderboard });
  } catch (error) {
    console.error('Get leaderboard error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export { router as salesRouter };
