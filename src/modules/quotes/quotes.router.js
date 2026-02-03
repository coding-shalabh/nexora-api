import { Router } from 'express';
import { z } from 'zod';
import { quotesService } from './quotes.service.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { validate } from '../../common/middleware/validate.js';

const router = Router();

// ==================== VALIDATION SCHEMAS ====================

const quoteLineSchema = z.object({
  productId: z.string().optional().nullable(),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().positive('Quantity must be positive'),
  unitPrice: z.number().min(0, 'Unit price must be non-negative'),
  taxRate: z.number().min(0).max(100).optional(),
  discountPercent: z.number().min(0).max(100).optional(),
  discountAmount: z.number().min(0).optional(),
  hsnCode: z.string().optional().nullable(),
  sacCode: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  productType: z.enum(['GOODS', 'SERVICES']).optional(),
});

const createQuoteSchema = z.object({
  body: z.object({
    contactId: z.string().optional().nullable(),
    dealId: z.string().optional().nullable(),
    expiryDate: z.string().datetime().optional().nullable(),
    currency: z.string().length(3, 'Currency must be 3-letter code').optional(),
    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),
    isGstQuote: z.boolean().optional(),
    supplyType: z
      .enum([
        'B2B',
        'B2C_LARGE',
        'B2C_SMALL',
        'SEZ_WITH_PAY',
        'SEZ_WITHOUT_PAY',
        'EXPORT_WITH_PAY',
        'EXPORT_WITHOUT_PAY',
        'DEEMED_EXPORT',
        'NIL_RATED',
        'EXEMPT',
      ])
      .optional(),
    sellerGstin: z.string().optional().nullable(),
    sellerLegalName: z.string().optional().nullable(),
    sellerAddress: z.string().optional().nullable(),
    sellerStateCode: z.string().optional().nullable(),
    buyerGstin: z.string().optional().nullable(),
    buyerLegalName: z.string().optional().nullable(),
    buyerAddress: z.string().optional().nullable(),
    buyerStateCode: z.string().optional().nullable(),
    placeOfSupply: z.string().optional().nullable(),
    isInterState: z.boolean().optional(),
    isReverseCharge: z.boolean().optional(),
    lines: z.array(quoteLineSchema).optional(),
  }),
});

const updateQuoteSchema = z.object({
  body: z.object({
    contactId: z.string().optional().nullable(),
    dealId: z.string().optional().nullable(),
    expiryDate: z.string().datetime().optional().nullable(),
    currency: z.string().length(3).optional(),
    notes: z.string().optional().nullable(),
    terms: z.string().optional().nullable(),
    isGstQuote: z.boolean().optional(),
    supplyType: z
      .enum([
        'B2B',
        'B2C_LARGE',
        'B2C_SMALL',
        'SEZ_WITH_PAY',
        'SEZ_WITHOUT_PAY',
        'EXPORT_WITH_PAY',
        'EXPORT_WITHOUT_PAY',
        'DEEMED_EXPORT',
        'NIL_RATED',
        'EXEMPT',
      ])
      .optional(),
    sellerGstin: z.string().optional().nullable(),
    sellerLegalName: z.string().optional().nullable(),
    sellerAddress: z.string().optional().nullable(),
    sellerStateCode: z.string().optional().nullable(),
    buyerGstin: z.string().optional().nullable(),
    buyerLegalName: z.string().optional().nullable(),
    buyerAddress: z.string().optional().nullable(),
    buyerStateCode: z.string().optional().nullable(),
    placeOfSupply: z.string().optional().nullable(),
    isInterState: z.boolean().optional(),
    isReverseCharge: z.boolean().optional(),
  }),
});

const addLineItemsSchema = z.object({
  body: z.object({
    lines: z.array(quoteLineSchema).min(1, 'At least one line item is required'),
  }),
});

// ==================== QUOTE ROUTES ====================

// Get all quotes
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await quotesService.getQuotes(req.tenantId, {
      search: req.query.search,
      status: req.query.status,
      contactId: req.query.contactId,
      dealId: req.query.dealId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
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

// Get quote stats
router.get('/stats', authenticate, async (req, res, next) => {
  try {
    const stats = await quotesService.getQuoteStats(req.tenantId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get single quote
router.get('/:quoteId', authenticate, async (req, res, next) => {
  try {
    const quote = await quotesService.getQuote(req.tenantId, req.params.quoteId);
    res.json(quote);
  } catch (error) {
    next(error);
  }
});

// Create quote
router.post('/', authenticate, validate(createQuoteSchema), async (req, res, next) => {
  try {
    const quote = await quotesService.createQuote(req.tenantId, req.userId, req.body);
    res.status(201).json(quote);
  } catch (error) {
    next(error);
  }
});

// Update quote
router.patch('/:quoteId', authenticate, validate(updateQuoteSchema), async (req, res, next) => {
  try {
    const quote = await quotesService.updateQuote(req.tenantId, req.params.quoteId, req.body);
    res.json(quote);
  } catch (error) {
    next(error);
  }
});

// Delete quote
router.delete('/:quoteId', authenticate, async (req, res, next) => {
  try {
    const result = await quotesService.deleteQuote(req.tenantId, req.params.quoteId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Send quote to contact
router.post('/:quoteId/send', authenticate, async (req, res, next) => {
  try {
    const quote = await quotesService.sendQuote(req.tenantId, req.params.quoteId);
    res.json(quote);
  } catch (error) {
    next(error);
  }
});

// Accept quote
router.post('/:quoteId/accept', authenticate, async (req, res, next) => {
  try {
    const quote = await quotesService.acceptQuote(req.tenantId, req.params.quoteId);
    res.json(quote);
  } catch (error) {
    next(error);
  }
});

// Reject quote
router.post('/:quoteId/reject', authenticate, async (req, res, next) => {
  try {
    const quote = await quotesService.rejectQuote(req.tenantId, req.params.quoteId);
    res.json(quote);
  } catch (error) {
    next(error);
  }
});

// Duplicate quote
router.post('/:quoteId/duplicate', authenticate, async (req, res, next) => {
  try {
    const quote = await quotesService.duplicateQuote(req.tenantId, req.params.quoteId, req.userId);
    res.status(201).json(quote);
  } catch (error) {
    next(error);
  }
});

// Add line items to quote
router.post(
  '/:quoteId/lines',
  authenticate,
  validate(addLineItemsSchema),
  async (req, res, next) => {
    try {
      const quote = await quotesService.addLineItems(
        req.tenantId,
        req.params.quoteId,
        req.body.lines
      );
      res.json(quote);
    } catch (error) {
      next(error);
    }
  }
);

// Remove line item from quote
router.delete('/:quoteId/lines/:lineId', authenticate, async (req, res, next) => {
  try {
    const quote = await quotesService.removeLineItem(
      req.tenantId,
      req.params.quoteId,
      req.params.lineId
    );
    res.json(quote);
  } catch (error) {
    next(error);
  }
});

export { router as quotesRouter };
