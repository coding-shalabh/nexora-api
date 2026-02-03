import { Router } from 'express';
import { z } from 'zod';
import { sesEmailService } from '../../services/ses-email.service.js';

const router = Router();

// Validation helper
const validate = (schema) => (req, res, next) => {
  try {
    req.validatedBody = schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: error.errors?.[0]?.message || 'Invalid request data',
    });
  }
};

// ============================================
// EMAIL CREDITS ENDPOINTS
// ============================================

// Get email credits balance for tenant
router.get('/credits', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const credits = await sesEmailService.getEmailCredits(tenantId);

    return res.json({
      success: true,
      data: credits,
    });
  } catch (error) {
    console.error('Get credits error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch credits',
    });
  }
});

// Get pricing plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await sesEmailService.getEmailPlans();

    // If no plans in DB, return default plans
    if (plans.length === 0) {
      return res.json({
        success: true,
        data: {
          plans: [
            {
              id: 'starter',
              name: 'Starter',
              slug: 'starter',
              emails: 5000,
              priceInr: 29900,
              priceUsd: 399,
              pricePerEmail: 0.06,
              features: ['5,000 emails', 'Basic templates', 'Email support'],
            },
            {
              id: 'growth',
              name: 'Growth',
              slug: 'growth',
              emails: 25000,
              priceInr: 79900,
              priceUsd: 999,
              pricePerEmail: 0.032,
              isPopular: true,
              features: ['25,000 emails', 'All templates', 'Priority support', 'Analytics'],
            },
            {
              id: 'pro',
              name: 'Pro',
              slug: 'pro',
              emails: 100000,
              priceInr: 199900,
              priceUsd: 2499,
              pricePerEmail: 0.02,
              features: ['100,000 emails', 'Custom templates', 'API access', 'Dedicated support'],
            },
            {
              id: 'enterprise',
              name: 'Enterprise',
              slug: 'enterprise',
              emails: 500000,
              priceInr: 499900,
              priceUsd: 5999,
              pricePerEmail: 0.01,
              features: ['500,000 emails', 'White-label', 'Custom domain', 'SLA guarantee'],
            },
          ],
          freeQuota: 500,
          overageRate: 0.15,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        plans,
        freeQuota: 500,
        overageRate: 0.15,
      },
    });
  } catch (error) {
    console.error('Get plans error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch plans',
    });
  }
});

// Get purchase history
router.get('/purchases', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20 } = req.query;

    const history = await sesEmailService.getPurchaseHistory(tenantId, {
      page: parseInt(page),
      limit: parseInt(limit),
    });

    return res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Get purchases error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch purchase history',
    });
  }
});

// Get usage history
router.get('/usage', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page = 1, limit = 20, startDate, endDate } = req.query;

    const history = await sesEmailService.getUsageHistory(tenantId, {
      page: parseInt(page),
      limit: parseInt(limit),
      startDate,
      endDate,
    });

    return res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    console.error('Get usage error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch usage history',
    });
  }
});

// Get usage summary
router.get('/usage/summary', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { period = 'month' } = req.query;

    const summary = await sesEmailService.getUsageSummary(tenantId, period);

    return res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error('Get usage summary error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch usage summary',
    });
  }
});

// Add credits (admin only - for manual top-ups or testing)
const addCreditsSchema = z.object({
  amount: z.number().int().positive().max(1000000),
  reason: z.string().optional().default('manual'),
});

router.post('/credits/add', validate(addCreditsSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const { amount, reason } = req.validatedBody;

    // Check if user has admin permissions
    if (req.roleLevel < 9) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only admins can add credits',
      });
    }

    const result = await sesEmailService.addEmailCredits(tenantId, amount, {
      userId,
      type: 'TOPUP',
      notes: reason,
    });

    return res.json({
      success: true,
      data: result,
      message: `Added ${amount} email credits`,
    });
  } catch (error) {
    console.error('Add credits error:', error);
    return res.status(500).json({
      success: false,
      error: 'ADD_FAILED',
      message: error.message || 'Failed to add credits',
    });
  }
});

// ============================================
// BULK EMAIL SENDING ENDPOINTS
// ============================================

// Send bulk email schema
const sendBulkSchema = z.object({
  recipients: z
    .array(
      z.object({
        email: z.string().email(),
        variables: z.record(z.string()).optional(),
      })
    )
    .min(1)
    .max(10000),
  from: z.string().optional(),
  subject: z.string().min(1),
  html: z.string().min(1),
  text: z.string().optional(),
  trackOpens: z.boolean().optional().default(true),
  trackClicks: z.boolean().optional().default(true),
  campaignId: z.string().optional(),
});

// Send bulk emails
router.post('/send', validate(sendBulkSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const { recipients, from, subject, html, text, trackOpens, trackClicks, campaignId } =
      req.validatedBody;

    // Check credits first
    const credits = await sesEmailService.getEmailCredits(tenantId);

    if (recipients.length > credits.totalAvailable) {
      return res.status(400).json({
        success: false,
        error: 'INSUFFICIENT_CREDITS',
        message: `Insufficient email credits. Need ${recipients.length}, have ${credits.totalAvailable}`,
        data: {
          needed: recipients.length,
          available: credits.totalAvailable,
          credits: credits.credits,
          freeRemaining: credits.freeRemaining,
        },
      });
    }

    // Send emails
    const result = await sesEmailService.sendCampaignEmail({
      tenantId,
      userId,
      campaignId,
      recipients,
      from,
      subject,
      html,
      trackOpens,
      trackClicks,
    });

    return res.json({
      success: true,
      data: result,
      message: `Sent ${result.successful} of ${result.total} emails`,
    });
  } catch (error) {
    console.error('Send bulk email error:', error);
    return res.status(500).json({
      success: false,
      error: 'SEND_FAILED',
      message: error.message || 'Failed to send emails',
    });
  }
});

// Send test email
const testEmailSchema = z.object({
  to: z.string().email(),
  subject: z.string().optional().default('Test Email from Nexora'),
  html: z
    .string()
    .optional()
    .default('<h1>Test Email</h1><p>This is a test email from Nexora CRM.</p>'),
});

router.post('/test', validate(testEmailSchema), async (req, res) => {
  try {
    const { to, subject, html } = req.validatedBody;

    const result = await sesEmailService.sendEmail({
      to,
      subject,
      html,
    });

    return res.json({
      success: true,
      data: result,
      message: `Test email sent to ${to}`,
    });
  } catch (error) {
    console.error('Test email error:', error);
    return res.status(500).json({
      success: false,
      error: 'SEND_FAILED',
      message: error.message || 'Failed to send test email',
    });
  }
});

export default router;
