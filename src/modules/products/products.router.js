import { Router } from 'express';
import { z } from 'zod';
import { productsService } from './products.service.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';

const router = Router();

// ==================== VALIDATION SCHEMAS ====================

const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    unitPrice: z.number().positive('Unit price must be positive'),
    currency: z.string().length(3, 'Currency must be 3-letter code').optional(),
    taxRate: z.number().min(0).max(100).optional().nullable(),
    isActive: z.boolean().optional(),
    hsnCode: z.string().optional().nullable(),
    sacCode: z.string().optional().nullable(),
    productType: z.enum(['GOODS', 'SERVICES']).optional(),
    gstRate: z.number().min(0).max(100).optional().nullable(),
    cessRate: z.number().min(0).max(100).optional().nullable(),
    unit: z.string().optional().nullable(),
    isTaxExempt: z.boolean().optional(),
    taxExemptReason: z.string().optional().nullable(),
  }),
});

const updateProductSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().optional().nullable(),
    sku: z.string().optional().nullable(),
    unitPrice: z.number().positive().optional(),
    currency: z.string().length(3).optional(),
    taxRate: z.number().min(0).max(100).optional().nullable(),
    isActive: z.boolean().optional(),
    hsnCode: z.string().optional().nullable(),
    sacCode: z.string().optional().nullable(),
    productType: z.enum(['GOODS', 'SERVICES']).optional(),
    gstRate: z.number().min(0).max(100).optional().nullable(),
    cessRate: z.number().min(0).max(100).optional().nullable(),
    unit: z.string().optional().nullable(),
    isTaxExempt: z.boolean().optional(),
    taxExemptReason: z.string().optional().nullable(),
  }),
});

// ==================== PRODUCT ROUTES ====================

// Get all products
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await productsService.getProducts(req.tenantId, {
      search: req.query.search,
      productType: req.query.productType,
      isActive: req.query.isActive ? req.query.isActive === 'true' : undefined,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 25,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get product stats
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const stats = await productsService.getProductStats(req.tenantId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get single product
router.get('/:productId', authenticate, async (req, res, next) => {
  try {
    const product = await productsService.getProduct(req.tenantId, req.params.productId);
    res.json(product);
  } catch (error) {
    next(error);
  }
});

// Create product
router.post('/', authenticate, validate(createProductSchema), async (req, res, next) => {
  try {
    const product = await productsService.createProduct(req.tenantId, req.body);
    res.status(201).json(product);
  } catch (error) {
    next(error);
  }
});

// Update product
router.patch('/:productId', authenticate, validate(updateProductSchema), async (req, res, next) => {
  try {
    const product = await productsService.updateProduct(
      req.tenantId,
      req.params.productId,
      req.body
    );
    res.json(product);
  } catch (error) {
    next(error);
  }
});

// Delete product (soft delete - set isActive to false)
router.delete('/:productId', authenticate, async (req, res, next) => {
  try {
    const result = await productsService.deleteProduct(req.tenantId, req.params.productId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Archive product (alias for delete)
router.post('/:productId/archive', authenticate, async (req, res, next) => {
  try {
    const result = await productsService.archiveProduct(req.tenantId, req.params.productId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Restore archived product
router.post('/:productId/restore', authenticate, async (req, res, next) => {
  try {
    const result = await productsService.restoreProduct(req.tenantId, req.params.productId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export { router as productsRouter };
