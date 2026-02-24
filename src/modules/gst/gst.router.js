import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import * as gstService from './gst.service.js';
import { logger } from '../../common/logger.js';
import { authenticate } from '../../common/middleware/authenticate.js';

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Validation error handler middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }
  next();
};

// ============================================================================
// GST Configuration
// ============================================================================

// Get GST Configuration
router.get('/config', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const config = await gstService.getGstConfig(tenantId);

    return res.json({
      success: true,
      data: config,
    });
  } catch (error) {
    logger.error({ error, path: req.path }, 'Failed to get GST config');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Update GST Configuration
router.post(
  '/config',
  [
    body('gstin')
      .isLength({ min: 15, max: 15 })
      .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
      .withMessage('Invalid GSTIN format'),
    body('legalName').notEmpty(),
    body('stateCode').isLength({ min: 2, max: 2 }),
    body('stateName').notEmpty(),
    body('address.street').notEmpty(),
    body('address.city').notEmpty(),
    body('address.state').notEmpty(),
    body('address.pincode').isLength({ min: 6, max: 6 }),
    validate,
  ],
  async (req, res) => {
    try {
      const { tenantId } = req.user;
      const data = req.body;

      const config = await gstService.updateGstConfig(tenantId, data);

      return res.json({
        success: true,
        data: config,
        message: 'GST configuration updated successfully',
      });
    } catch (error) {
      logger.error({ error, path: req.path }, 'Failed to update GST config');
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ============================================================================
// GSTIN Validation
// ============================================================================

router.get(
  '/validate-gstin/:gstin',
  [
    param('gstin')
      .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
      .withMessage('Invalid GSTIN format'),
    validate,
  ],
  async (req, res) => {
    try {
      const { gstin } = req.params;
      const result = await gstService.validateGstin(gstin);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error({ error, gstin: req.params.gstin }, 'GSTIN validation failed');
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ============================================================================
// HSN/SAC Code Management
// ============================================================================

// List HSN/SAC codes
router.get('/hsn', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { search, type } = req.query;

    const codes = await gstService.listHsnCodes(tenantId, { search, type });

    return res.json({
      success: true,
      data: codes,
    });
  } catch (error) {
    logger.error({ error, path: req.path }, 'Failed to list HSN codes');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Create HSN/SAC code
router.post(
  '/hsn',
  [
    body('code').isLength({ min: 4, max: 8 }),
    body('description').notEmpty(),
    body('gstRate').isFloat({ min: 0, max: 28 }),
    body('isService').optional().isBoolean(),
    validate,
  ],
  async (req, res) => {
    try {
      const { tenantId } = req.user;
      const data = req.body;

      const hsn = await gstService.createHsnCode(tenantId, data);

      return res.json({
        success: true,
        data: hsn,
        message: 'HSN/SAC code created successfully',
      });
    } catch (error) {
      logger.error({ error, path: req.path }, 'Failed to create HSN code');
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Update HSN/SAC code
router.put('/hsn/:id', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const data = req.body;

    const hsn = await gstService.updateHsnCode(tenantId, id, data);

    return res.json({
      success: true,
      data: hsn,
      message: 'HSN/SAC code updated successfully',
    });
  } catch (error) {
    logger.error({ error, path: req.path }, 'Failed to update HSN code');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Delete HSN/SAC code
router.delete('/hsn/:id', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    await gstService.deleteHsnCode(tenantId, id);

    return res.json({
      success: true,
      message: 'HSN/SAC code deleted successfully',
    });
  } catch (error) {
    logger.error({ error, path: req.path }, 'Failed to delete HSN code');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// GST Invoice Operations
// ============================================================================

// Calculate GST
router.post(
  '/calculate',
  [
    body('amount').isFloat({ min: 0 }),
    body('gstRate').isFloat({ min: 0, max: 28 }),
    body('placeOfSupply').isLength({ min: 2, max: 2 }),
    body('customerState').isLength({ min: 2, max: 2 }),
    validate,
  ],
  async (req, res) => {
    try {
      const { amount, gstRate, placeOfSupply, customerState, cess } = req.body;

      const result = gstService.calculateGst(amount, gstRate, placeOfSupply, customerState, cess);

      return res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error({ error, path: req.path }, 'GST calculation failed');
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Generate QR code for invoice
router.post('/invoice/:invoiceId/qr', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { invoiceId } = req.params;

    const qrCode = await gstService.generateInvoiceQr(tenantId, invoiceId);

    return res.json({
      success: true,
      data: { qrCode },
      message: 'QR code generated successfully',
    });
  } catch (error) {
    logger.error({ error, invoiceId: req.params.invoiceId }, 'QR generation failed');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Generate E-Invoice
router.post('/invoice/:invoiceId/e-invoice', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { invoiceId } = req.params;

    const result = await gstService.generateEInvoice(tenantId, invoiceId);

    return res.json({
      success: true,
      data: result,
      message: 'E-invoice generated successfully',
    });
  } catch (error) {
    logger.error({ error, invoiceId: req.params.invoiceId }, 'E-invoice generation failed');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel E-Invoice
router.post('/invoice/:invoiceId/e-invoice/cancel', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { invoiceId } = req.params;
    const { reason } = req.query;

    const result = await gstService.cancelEInvoice(tenantId, invoiceId, reason);

    return res.json({
      success: true,
      data: result,
      message: 'E-invoice cancelled successfully',
    });
  } catch (error) {
    logger.error({ error, invoiceId: req.params.invoiceId }, 'E-invoice cancellation failed');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// GST Returns
// ============================================================================

// Generate GSTR-1
router.get(
  '/returns/gstr-1',
  [query('month').notEmpty(), query('year').notEmpty(), validate],
  async (req, res) => {
    try {
      const { tenantId } = req.user;
      const { month, year } = req.query;

      const gstr1 = await gstService.generateGstr1(tenantId, month, year);

      return res.json({
        success: true,
        data: gstr1,
      });
    } catch (error) {
      logger.error({ error, path: req.path }, 'GSTR-1 generation failed');
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Generate GSTR-3B
router.get(
  '/returns/gstr-3b',
  [query('month').notEmpty(), query('year').notEmpty(), validate],
  async (req, res) => {
    try {
      const { tenantId } = req.user;
      const { month, year } = req.query;

      const gstr3b = await gstService.generateGstr3b(tenantId, month, year);

      return res.json({
        success: true,
        data: gstr3b,
      });
    } catch (error) {
      logger.error({ error, path: req.path }, 'GSTR-3B generation failed');
      return res.status(500).json({ success: false, error: error.message });
    }
  }
);

// List GST returns
router.get('/returns', async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { year } = req.query;

    const returns = await gstService.listGstReturns(tenantId, year);

    return res.json({
      success: true,
      data: returns,
    });
  } catch (error) {
    logger.error({ error, path: req.path }, 'Failed to list GST returns');
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// Helper: Indian States
// ============================================================================

router.get('/states', (req, res) => {
  const states = gstService.getIndianStates();
  return res.json({
    success: true,
    data: states,
  });
});

export default router;
