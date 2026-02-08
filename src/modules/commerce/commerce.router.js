/**
 * Commerce Module Router
 * Handles inventory, discounts, revenue, receipts, and settings
 */

import { Router } from 'express';
import { z } from 'zod';
import { commerceService } from './commerce.service.js';

const router = Router();

// Validation schemas
const createDiscountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  value: z.number().min(0),
  minimumPurchase: z.number().optional(),
  maximumDiscount: z.number().optional(),
  usageLimit: z.number().optional(),
  perCustomerLimit: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  applicableTo: z.enum(['ALL', 'PRODUCTS', 'CATEGORIES']).optional(),
  productIds: z.array(z.string()).optional(),
});

const adjustInventorySchema = z.object({
  quantity: z.number(),
  reason: z.string().optional(),
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

// ==================== INVENTORY ====================

// GET /commerce/inventory - List inventory
router.get('/inventory', async (req, res) => {
  try {
    const { page, limit, status, search } = req.query;

    const result = await commerceService.listInventory({
      tenantId: req.tenantId,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100),
      status,
      search,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('List inventory error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /commerce/inventory/adjust - Adjust stock
router.post('/inventory/adjust', validate(adjustInventorySchema), async (req, res) => {
  try {
    const { productId, quantity, reason } = req.validatedBody;

    const result = await commerceService.adjustInventory({
      tenantId: req.tenantId,
      productId,
      quantity,
      reason,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Adjust inventory error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== DISCOUNTS ====================

// GET /commerce/discounts - List discounts
router.get('/discounts', async (req, res) => {
  try {
    const { page, limit, status, type } = req.query;

    const result = await commerceService.listDiscounts({
      tenantId: req.tenantId,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100),
      status,
      type,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('List discounts error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /commerce/discounts/:id - Get discount details
router.get('/discounts/:id', async (req, res) => {
  try {
    const discount = await commerceService.getDiscount({
      tenantId: req.tenantId,
      discountId: req.params.id,
    });

    return res.json({ success: true, data: discount });
  } catch (error) {
    console.error('Get discount error:', error);
    return res.status(404).json({ success: false, error: error.message });
  }
});

// POST /commerce/discounts - Create discount
router.post('/discounts', validate(createDiscountSchema), async (req, res) => {
  try {
    const discount = await commerceService.createDiscount({
      tenantId: req.tenantId,
      data: req.validatedBody,
    });

    return res.status(201).json({ success: true, data: discount });
  } catch (error) {
    console.error('Create discount error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PUT /commerce/discounts/:id - Update discount
router.put('/discounts/:id', async (req, res) => {
  try {
    const discount = await commerceService.updateDiscount({
      tenantId: req.tenantId,
      discountId: req.params.id,
      data: req.body,
    });

    return res.json({ success: true, data: discount });
  } catch (error) {
    console.error('Update discount error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /commerce/discounts/:id - Delete discount
router.delete('/discounts/:id', async (req, res) => {
  try {
    await commerceService.deleteDiscount({
      tenantId: req.tenantId,
      discountId: req.params.id,
    });

    return res.json({ success: true, message: 'Discount deleted' });
  } catch (error) {
    console.error('Delete discount error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /commerce/discounts/validate - Validate discount code
router.post('/discounts/validate', async (req, res) => {
  try {
    const { code, cartTotal } = req.body;

    const result = await commerceService.validateDiscount({
      tenantId: req.tenantId,
      code,
      cartTotal,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Validate discount error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== REVENUE ====================

// GET /commerce/revenue/summary - Get revenue summary
router.get('/revenue/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const summary = await commerceService.getRevenueSummary({
      tenantId: req.tenantId,
      startDate,
      endDate,
    });

    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Get revenue summary error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /commerce/revenue/breakdown - Get revenue breakdown
router.get('/revenue/breakdown', async (req, res) => {
  try {
    const { groupBy, startDate, endDate } = req.query;

    const breakdown = await commerceService.getRevenueBreakdown({
      tenantId: req.tenantId,
      groupBy,
      startDate,
      endDate,
    });

    return res.json({ success: true, data: breakdown });
  } catch (error) {
    console.error('Get revenue breakdown error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== RECEIPTS ====================

// GET /commerce/receipts - List receipts
router.get('/receipts', async (req, res) => {
  try {
    const { page, limit } = req.query;

    const result = await commerceService.listReceipts({
      tenantId: req.tenantId,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100),
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('List receipts error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SETTINGS ====================

// GET /commerce/settings - Get commerce settings
router.get('/settings', async (req, res) => {
  try {
    const settings = await commerceService.getSettings({
      tenantId: req.tenantId,
    });

    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Get commerce settings error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /commerce/settings - Update commerce settings
router.put('/settings', async (req, res) => {
  try {
    const settings = await commerceService.updateSettings({
      tenantId: req.tenantId,
      data: req.body,
    });

    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Update commerce settings error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// ==================== CUSTOM REPORTS (placeholder) ====================

// GET /commerce/reports/custom - List custom reports
router.get('/reports/custom', async (req, res) => {
  // Placeholder - returns empty list until custom reports are implemented
  return res.json({
    success: true,
    data: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
});

export { router as commerceRouter };
