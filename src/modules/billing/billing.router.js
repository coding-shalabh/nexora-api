import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../common/middleware/tenant.js';
import { billingService } from './billing.service.js';
import { razorpayService } from '../../services/razorpay.service.js';
import { logger } from '../../common/logger.js';

const router = Router();

// ============ PLANS (from DB) ============

router.get('/plans', async (req, res, next) => {
  try {
    const plans = await billingService.getPlans();
    res.json({ success: true, data: plans });
  } catch (error) {
    next(error);
  }
});

// ============ CHECKOUT (Razorpay) ============

router.post('/checkout/create-order', requirePermission('billing:read'), async (req, res, next) => {
  try {
    const data = z
      .object({
        planId: z.string().min(1),
        billingCycle: z.enum(['MONTHLY', 'YEARLY']),
      })
      .parse(req.body);

    const order = await billingService.createCheckoutOrder(
      req.tenantId,
      data.planId,
      data.billingCycle
    );

    res.json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/checkout/verify-payment',
  requirePermission('billing:read'),
  async (req, res, next) => {
    try {
      const data = z
        .object({
          razorpay_order_id: z.string().min(1),
          razorpay_payment_id: z.string().min(1),
          razorpay_signature: z.string().min(1),
          planId: z.string().min(1),
          billingCycle: z.enum(['MONTHLY', 'YEARLY']),
        })
        .parse(req.body);

      const result = await billingService.verifyAndActivatePayment(req.tenantId, req.userId, data);

      res.json({
        success: true,
        data: {
          subscription: result.subscription,
          invoice: result.invoice,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ SUBSCRIPTION ============

router.get('/subscription', requirePermission('billing:read'), async (req, res, next) => {
  try {
    const subscription = await billingService.getSubscription(req.tenantId);

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/subscription/cancel', requirePermission('billing:read'), async (req, res, next) => {
  try {
    const subscription = await billingService.cancelSubscription(req.tenantId);

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/subscription/upgrade', requirePermission('billing:read'), async (req, res, next) => {
  try {
    const data = z
      .object({
        planId: z.string().min(1),
        billingCycle: z.enum(['MONTHLY', 'YEARLY']),
      })
      .parse(req.body);

    const subscription = await billingService.upgradePlan(
      req.tenantId,
      data.planId,
      data.billingCycle
    );

    res.json({
      success: true,
      data: subscription,
    });
  } catch (error) {
    next(error);
  }
});

// ============ DUNNING ============

router.get('/dunning', requirePermission('billing:read'), async (req, res, next) => {
  try {
    const status = await billingService.getDunningStatus(req.tenantId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/dunning/retry/:paymentId',
  requirePermission('billing:read'),
  async (req, res, next) => {
    try {
      const result = await billingService.retryFailedPayment(req.tenantId, req.params.paymentId);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ TRIAL MANAGEMENT ============

router.post('/trials/expire', requirePermission('billing:read'), async (req, res, next) => {
  try {
    const result = await billingService.expireTrials();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// ============ QUOTES ============

router.get('/quotes', requirePermission('billing:quotes:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        status: z.enum(['DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED']).optional(),
      })
      .parse(req.query);

    const result = await billingService.getQuotes(req.tenantId, params);

    res.json({
      success: true,
      data: result.quotes,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/quotes', requirePermission('billing:quotes:create'), async (req, res, next) => {
  try {
    const data = z
      .object({
        title: z.string().min(1),
        contactId: z.string().uuid().optional(),
        companyId: z.string().uuid().optional(),
        dealId: z.string().uuid().optional(),
        validUntil: z.string().datetime(),
        items: z.array(
          z.object({
            description: z.string(),
            quantity: z.number().min(1),
            unitPrice: z.number().min(0),
            discount: z.number().min(0).max(100).optional(),
          })
        ),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const quote = await billingService.createQuote(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: quote,
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/quotes/:id/send',
  requirePermission('billing:quotes:send'),
  async (req, res, next) => {
    try {
      const quote = await billingService.sendQuote(req.tenantId, req.params.id);

      res.json({
        success: true,
        data: quote,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch('/quotes/:id/accept', async (req, res, next) => {
  try {
    const quote = await billingService.acceptQuote(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: quote,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/quotes/:id', requirePermission('billing:quotes:read'), async (req, res, next) => {
  try {
    const quote = await billingService.getQuote(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: quote,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/quotes/:id', requirePermission('billing:quotes:update'), async (req, res, next) => {
  try {
    const data = z
      .object({
        title: z.string().min(1).optional(),
        items: z
          .array(
            z.object({
              description: z.string(),
              quantity: z.number().min(1),
              unitPrice: z.number().min(0),
              discount: z.number().min(0).max(100).optional(),
            })
          )
          .optional(),
        discount: z.number().min(0).optional(),
        tax: z.number().min(0).optional(),
        notes: z.string().optional(),
        validUntil: z.string().datetime().optional(),
      })
      .parse(req.body);

    const quote = await billingService.updateQuote(req.tenantId, req.params.id, data);

    res.json({
      success: true,
      data: quote,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/quotes/:id', requirePermission('billing:quotes:delete'), async (req, res, next) => {
  try {
    await billingService.deleteQuote(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Quote deleted',
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/quotes/:id/decline',
  requirePermission('billing:quotes:update'),
  async (req, res, next) => {
    try {
      const { reason } = z.object({ reason: z.string().optional() }).parse(req.body);
      const quote = await billingService.declineQuote(req.tenantId, req.params.id, reason);

      res.json({
        success: true,
        data: quote,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ INVOICES ============

router.get('/invoices', requirePermission('billing:invoices:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        status: z
          .enum(['DRAFT', 'SENT', 'VIEWED', 'PAID', 'PARTIAL', 'OVERDUE', 'CANCELLED'])
          .optional(),
      })
      .parse(req.query);

    const result = await billingService.getInvoices(req.tenantId, params);

    res.json({
      success: true,
      data: result.invoices,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/invoices', requirePermission('billing:invoices:create'), async (req, res, next) => {
  try {
    const data = z
      .object({
        contactId: z.string().optional(),
        companyId: z.string().optional(),
        quoteId: z.string().optional(),
        dueDate: z.string(),
        items: z
          .array(
            z.object({
              description: z.string(),
              quantity: z.number().min(0.001),
              unitPrice: z.number().min(0),
              discount: z.number().min(0).max(100).optional(),
              hsnCode: z.string().optional(),
              sacCode: z.string().optional(),
              unit: z.string().optional(),
              gstRate: z.number().min(0).max(28).optional(),
              cessRate: z.number().min(0).optional(),
            })
          )
          .optional(), // Make items optional when quoteId is provided
        notes: z.string().optional(),
        terms: z.string().optional(),
        // GST Fields
        isGstInvoice: z.boolean().optional(),
        invoiceType: z
          .enum(['TAX_INVOICE', 'BILL_OF_SUPPLY', 'CREDIT_NOTE', 'DEBIT_NOTE', 'EXPORT_INVOICE'])
          .optional(),
        supplyType: z
          .enum([
            'B2B',
            'B2C_LARGE',
            'B2C_SMALL',
            'SEZ_WITH_PAY',
            'SEZ_WITHOUT_PAY',
            'EXPORT_WITH_PAY',
            'EXPORT_WITHOUT_PAY',
          ])
          .optional(),
        buyerGstin: z.string().optional(),
        buyerLegalName: z.string().optional(),
        buyerAddress: z.string().optional(),
        buyerStateCode: z.string().optional(),
        placeOfSupply: z.string().optional(),
        isReverseCharge: z.boolean().optional(),
        // Shipping
        shipToName: z.string().optional(),
        shipToAddress: z.string().optional(),
        shipToStateCode: z.string().optional(),
        // Transport
        transporterName: z.string().optional(),
        vehicleNumber: z.string().optional(),
        eWayBillNumber: z.string().optional(),
      })
      .parse(req.body);

    const invoice = await billingService.createInvoice(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/invoices/:id/send',
  requirePermission('billing:invoices:send'),
  async (req, res, next) => {
    try {
      const invoice = await billingService.sendInvoice(req.tenantId, req.params.id);

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/invoices/:id', requirePermission('billing:invoices:read'), async (req, res, next) => {
  try {
    const invoice = await billingService.getInvoice(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: invoice,
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/invoices/:id',
  requirePermission('billing:invoices:update'),
  async (req, res, next) => {
    try {
      const data = z
        .object({
          items: z
            .array(
              z.object({
                description: z.string(),
                quantity: z.number().min(1),
                unitPrice: z.number().min(0),
                discount: z.number().min(0).max(100).optional(),
              })
            )
            .optional(),
          discount: z.number().min(0).optional(),
          tax: z.number().min(0).optional(),
          notes: z.string().optional(),
          dueDate: z.string().datetime().optional(),
        })
        .parse(req.body);

      const invoice = await billingService.updateInvoice(req.tenantId, req.params.id, data);

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/invoices/:id',
  requirePermission('billing:invoices:delete'),
  async (req, res, next) => {
    try {
      await billingService.deleteInvoice(req.tenantId, req.params.id);

      res.json({
        success: true,
        message: 'Invoice deleted',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/invoices/:id/void',
  requirePermission('billing:invoices:update'),
  async (req, res, next) => {
    try {
      const invoice = await billingService.voidInvoice(req.tenantId, req.params.id);

      res.json({
        success: true,
        data: invoice,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ PAYMENTS ============

router.get('/payments', requirePermission('billing:payments:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        status: z.enum(['COMPLETED', 'PENDING', 'FAILED', 'REFUNDED']).optional(),
      })
      .parse(req.query);

    const result = await billingService.getPayments(req.tenantId, params);

    res.json({
      success: true,
      data: result.payments,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/payments', requirePermission('billing:payments:create'), async (req, res, next) => {
  try {
    const data = z
      .object({
        invoiceId: z.string().uuid(),
        amount: z.number().min(0),
        method: z.enum(['CARD', 'BANK_TRANSFER', 'WALLET']),
        transactionId: z.string().optional(),
      })
      .parse(req.body);

    const payment = await billingService.recordPayment(req.tenantId, data);

    res.status(201).json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/payments/:id', requirePermission('billing:payments:read'), async (req, res, next) => {
  try {
    const payment = await billingService.getPayment(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: payment,
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/payments/:id/refund',
  requirePermission('billing:payments:refund'),
  async (req, res, next) => {
    try {
      const data = z
        .object({
          amount: z.number().min(0).optional(),
          reason: z.string().optional(),
        })
        .parse(req.body);

      const result = await billingService.refundPayment(req.tenantId, req.params.id, data);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ RAZORPAY WEBHOOK (separate router, no auth) ============

const webhookRouter = Router();

/**
 * Razorpay webhook endpoint.
 * This route does NOT use tenant middleware or authentication.
 * Instead, it verifies the Razorpay webhook signature.
 *
 * Events handled:
 *   - payment.captured
 *   - payment.failed
 *   - subscription.charged
 *   - subscription.cancelled
 */
webhookRouter.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];

    if (!signature) {
      logger.warn('Razorpay webhook received without signature header');
      return res.status(400).json({ success: false, error: 'Missing signature' });
    }

    // Verify webhook signature
    const isValid = razorpayService.verifyWebhookSignature(req.body, signature);

    if (!isValid) {
      logger.warn('Razorpay webhook signature verification failed');
      return res.status(400).json({ success: false, error: 'Invalid signature' });
    }

    const { event, payload } = req.body;

    logger.info({ event }, 'Razorpay webhook received');

    // Process the event asynchronously (respond 200 immediately)
    res.status(200).json({ success: true });

    // Handle the event after responding
    try {
      await billingService.handleWebhookEvent(event, payload);
    } catch (error) {
      logger.error({ error: error.message, event }, 'Error processing Razorpay webhook event');
    }
  } catch (error) {
    logger.error({ error: error.message }, 'Razorpay webhook error');
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export { router as billingRouter, webhookRouter as billingWebhookRouter };
