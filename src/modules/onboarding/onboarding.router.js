/**
 * Onboarding API Router (Express)
 * Handles all onboarding endpoints for new tenant setup
 */

import { Router } from 'express';
import { onboardingService } from './onboarding.service.js';
import {
  initializeOnboardingSchema,
  companySchema,
  adminAccountSchema,
  teamSetupSchema,
  emailConfigSchema,
  crmConfigSchema,
  ticketingConfigSchema,
  marketingConfigSchema,
  completeOnboardingSchema,
} from './onboarding.schema.js';
import { verifyToken } from '../../common/utils/jwt.js';

const router = Router();

/**
 * Middleware to verify onboarding token
 */
const verifyOnboardingToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Missing onboarding token' },
    });
  }

  const token = authHeader.substring(7);

  try {
    const payload = await verifyToken(token);

    if (payload.type !== 'onboarding') {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid token type' },
      });
    }

    req.onboardingId = payload.onboardingId;
    req.tenantId = payload.tenantId;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
    });
  }
};

// ================================
// Public Endpoints
// ================================

/**
 * Get onboarding overview
 * GET /api/v1/onboarding
 */
router.get('/', async (req, res) => {
  try {
    // Return onboarding information
    res.json({
      success: true,
      data: {
        available: true,
        steps: ['company', 'admin', 'team', 'email', 'crm', 'ticketing', 'marketing'],
        message: 'Onboarding is available. Use POST /initialize to start.',
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ONBOARDING_INFO_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * Get onboarding steps
 * GET /api/v1/onboarding/steps
 */
router.get('/steps', async (req, res) => {
  try {
    // Return available onboarding steps
    res.json({
      success: true,
      data: [
        { id: 1, name: 'company', title: 'Company Information', required: true },
        { id: 2, name: 'admin', title: 'Admin Account', required: true },
        { id: 3, name: 'team', title: 'Team Setup', required: false },
        { id: 4, name: 'email', title: 'Email Configuration', required: false },
        { id: 5, name: 'crm', title: 'CRM Settings', required: false },
        { id: 6, name: 'ticketing', title: 'Ticketing Setup', required: false },
        { id: 7, name: 'marketing', title: 'Marketing Tools', required: false },
      ],
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'STEPS_FETCH_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * Get all available pricing plans
 * GET /api/v1/onboarding/plans
 */
router.get('/plans', async (req, res) => {
  try {
    const plans = await onboardingService.getAvailablePlans();

    res.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PLANS_FETCH_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * Get single plan details
 * GET /api/v1/onboarding/plans/:planId
 */
router.get('/plans/:planId', async (req, res) => {
  try {
    const plan = await onboardingService.getPlanById(req.params.planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Plan not found' },
      });
    }

    res.json({
      success: true,
      data: plan,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PLAN_FETCH_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * Initialize onboarding (called after purchase)
 * POST /api/v1/onboarding/initialize
 */
router.post('/initialize', async (req, res) => {
  try {
    const body = initializeOnboardingSchema.parse(req.body);
    const result = await onboardingService.initialize(body);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INITIALIZATION_FAILED',
        message: error.message,
      },
    });
  }
});

// ================================
// Protected Endpoints (Require Onboarding Token)
// ================================

/**
 * Get onboarding status
 * GET /api/v1/onboarding/status
 */
router.get('/status', verifyOnboardingToken, async (req, res) => {
  try {
    const status = await onboardingService.getStatus(req.onboardingId);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'STATUS_FETCH_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * Save company information
 * POST /api/v1/onboarding/company
 */
router.post('/company', verifyOnboardingToken, async (req, res) => {
  try {
    const body = companySchema.parse(req.body);
    const result = await onboardingService.saveCompany(req.onboardingId, body);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SAVE_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * Save admin account
 * POST /api/v1/onboarding/admin
 */
router.post('/admin', verifyOnboardingToken, async (req, res) => {
  try {
    const body = adminAccountSchema.parse(req.body);
    const result = await onboardingService.saveAdmin(req.onboardingId, body);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SAVE_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * Save team setup
 * POST /api/v1/onboarding/team
 */
router.post('/team', verifyOnboardingToken, async (req, res) => {
  try {
    const body = teamSetupSchema.parse(req.body);
    const result = await onboardingService.saveTeam(req.onboardingId, body);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SAVE_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * Save email configuration
 * POST /api/v1/onboarding/email
 */
router.post('/email', verifyOnboardingToken, async (req, res) => {
  try {
    const body = emailConfigSchema.parse(req.body);
    const result = await onboardingService.saveEmail(req.onboardingId, body);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SAVE_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * Save CRM configuration
 * POST /api/v1/onboarding/crm
 */
router.post('/crm', verifyOnboardingToken, async (req, res) => {
  try {
    const body = crmConfigSchema.parse(req.body);
    const result = await onboardingService.saveCRM(req.onboardingId, body);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SAVE_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * Save ticketing configuration
 * POST /api/v1/onboarding/ticketing
 */
router.post('/ticketing', verifyOnboardingToken, async (req, res) => {
  try {
    const body = ticketingConfigSchema.parse(req.body);
    const result = await onboardingService.saveTicketing(req.onboardingId, body);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SAVE_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * Save marketing configuration
 * POST /api/v1/onboarding/marketing
 */
router.post('/marketing', verifyOnboardingToken, async (req, res) => {
  try {
    const body = marketingConfigSchema.parse(req.body);
    const result = await onboardingService.saveMarketing(req.onboardingId, body);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'SAVE_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * Complete onboarding
 * POST /api/v1/onboarding/complete
 */
router.post('/complete', verifyOnboardingToken, async (req, res) => {
  try {
    const body = completeOnboardingSchema.parse(req.body);
    const result = await onboardingService.complete(req.onboardingId, body);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: {
        code: 'COMPLETION_FAILED',
        message: error.message,
      },
    });
  }
});

/**
 * Add user to tenant (for seeding/testing)
 * POST /api/v1/onboarding/add-user
 */
router.post('/add-user', async (req, res) => {
  try {
    const { secret, tenantId, workspaceId, email, firstName, lastName, password, roleName } =
      req.body;

    if (secret !== 'NEXORA_SEED_2026') {
      return res.status(403).json({ success: false, error: { message: 'Invalid secret' } });
    }

    const { prisma } = await import('@crm360/database');
    const bcryptModule = await import('bcryptjs');
    const bcrypt = bcryptModule.default || bcryptModule;

    const role = await prisma.role.findFirst({
      where: { tenantId, name: roleName || 'Sales Representative' },
    });

    if (!role) {
      return res
        .status(400)
        .json({ success: false, error: { message: `Role "${roleName}" not found` } });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        tenantId,
        email: email.toLowerCase(),
        firstName,
        lastName,
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true,
        isOnline: true,
        settings: { timezone: 'Asia/Kolkata' },
      },
    });

    await prisma.userWorkspace.create({
      data: { userId: user.id, workspaceId },
    });

    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    res.json({
      success: true,
      data: { userId: user.id, email: user.email },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
});

/**
 * Update user role (for seeding/testing)
 * POST /api/v1/onboarding/update-role
 */
router.post('/update-role', async (req, res) => {
  try {
    const { secret, tenantId, email, roleName } = req.body;

    if (secret !== 'NEXORA_SEED_2026') {
      return res.status(403).json({ success: false, error: { message: 'Invalid secret' } });
    }

    const { prisma } = await import('@crm360/database');

    // Find the user
    const user = await prisma.user.findFirst({
      where: { tenantId, email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: { message: 'User not found' } });
    }

    // Find the new role
    const role = await prisma.role.findFirst({
      where: { tenantId, name: roleName },
    });

    if (!role) {
      return res
        .status(400)
        .json({ success: false, error: { message: `Role "${roleName}" not found` } });
    }

    // Delete existing roles and add new one
    await prisma.userRole.deleteMany({
      where: { userId: user.id },
    });

    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    res.json({
      success: true,
      data: { userId: user.id, email: user.email, newRole: roleName },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
});

export default router;
