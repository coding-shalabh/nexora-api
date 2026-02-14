/**
 * AI Assistant Router
 * API endpoints for WhatsApp AI Assistant link management
 */

import { Hono } from 'hono';
import { prisma } from '@nexora/database';
import { logger } from '../../common/utils/logger.js';
import { RateLimiterService } from './rate-limiter.service.js';
import crypto from 'crypto';

const router = new Hono();
const rateLimiter = new RateLimiterService();

// In-memory state store (in production, use Redis)
const authStates = new Map();

/**
 * POST /link/initiate
 * Start the authorization process
 */
router.post('/link/initiate', async (c) => {
  try {
    const user = c.get('user');
    const { redirectUrl = '/settings/ai-assistant' } = await c.req.json();

    // Check if already linked
    const existingLink = await prisma.whatsAppAILink.findFirst({
      where: {
        userId: user.id,
        tenantId: user.tenantId,
        status: 'ACTIVE',
      },
    });

    if (existingLink) {
      return c.json(
        {
          success: false,
          error: 'WhatsApp already linked',
          message: 'You already have an active WhatsApp AI Assistant link',
        },
        400
      );
    }

    // Generate secure state token (CSRF protection)
    const state = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store state with user info
    authStates.set(state, {
      userId: user.id,
      tenantId: user.tenantId,
      redirectUrl,
      expiresAt,
    });

    // Clean up expired states
    setTimeout(() => authStates.delete(state), 5 * 60 * 1000);

    return c.json({
      success: true,
      authorizationUrl: `/ai-assistant/authorize?state=${state}`,
      state,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to initiate link');
    return c.json(
      {
        success: false,
        error: 'Failed to initiate authorization',
        message: error.message,
      },
      500
    );
  }
});

/**
 * POST /link/authorize
 * Complete the authorization (called from authorization page)
 */
router.post('/link/authorize', async (c) => {
  try {
    const { whatsappNumber, state } = await c.req.json();

    // Validate state token
    const stateData = authStates.get(state);
    if (!stateData) {
      return c.json(
        {
          success: false,
          error: 'Invalid or expired state token',
        },
        400
      );
    }

    // Check if state expired
    if (new Date() > stateData.expiresAt) {
      authStates.delete(state);
      return c.json(
        {
          success: false,
          error: 'Authorization expired. Please try again.',
        },
        400
      );
    }

    // Normalize phone number
    const normalizedNumber = whatsappNumber.startsWith('+') ? whatsappNumber : `+${whatsappNumber}`;

    // Validate phone number format (basic validation)
    if (!/^\+\d{10,15}$/.test(normalizedNumber)) {
      return c.json(
        {
          success: false,
          error: 'Invalid phone number format',
        },
        400
      );
    }

    // Check if number already linked to another user
    const existingLink = await prisma.whatsAppAILink.findUnique({
      where: { whatsappNumber: normalizedNumber },
    });

    if (existingLink && existingLink.userId !== stateData.userId) {
      return c.json(
        {
          success: false,
          error: 'This WhatsApp number is already linked to another account',
        },
        400
      );
    }

    // Create or update link
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const link = await prisma.whatsAppAILink.upsert({
      where: { whatsappNumber: normalizedNumber },
      create: {
        tenantId: stateData.tenantId,
        userId: stateData.userId,
        whatsappNumber: normalizedNumber,
        status: 'ACTIVE',
        linkedAt: new Date(),
        expiresAt,
        isActive: true,
      },
      update: {
        status: 'ACTIVE',
        linkedAt: new Date(),
        expiresAt,
        isActive: true,
      },
    });

    // Clean up state
    authStates.delete(state);

    // Send welcome message via WhatsApp
    try {
      // Import WhatsApp service dynamically
      const { sendWelcomeMessage } = await import('./utils/whatsapp-messages.js');
      await sendWelcomeMessage(normalizedNumber);
    } catch (err) {
      logger.warn({ error: err }, 'Failed to send welcome message');
      // Don't fail the whole request if welcome message fails
    }

    logger.info(
      { userId: stateData.userId, whatsappNumber: normalizedNumber },
      'WhatsApp AI link created'
    );

    return c.json({
      success: true,
      linkId: link.id,
      expiresAt: expiresAt.toISOString(),
      redirectUrl: `${stateData.redirectUrl}?linked=true`,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to authorize link');
    return c.json(
      {
        success: false,
        error: 'Failed to complete authorization',
        message: error.message,
      },
      500
    );
  }
});

/**
 * GET /link/status
 * Get current link status for authenticated user
 */
router.get('/link/status', async (c) => {
  try {
    const user = c.get('user');

    const link = await prisma.whatsAppAILink.findFirst({
      where: {
        userId: user.id,
        tenantId: user.tenantId,
        status: 'ACTIVE',
        isActive: true,
      },
      orderBy: { linkedAt: 'desc' },
    });

    if (!link) {
      return c.json({
        linked: false,
        message: 'No active WhatsApp AI Assistant link found',
      });
    }

    // Calculate days remaining
    const now = new Date();
    const daysRemaining = Math.ceil((link.expiresAt - now) / (1000 * 60 * 60 * 24));

    // Get usage stats
    const usage = await rateLimiter.getUserUsage(user.id, user.tenantId);

    return c.json({
      linked: true,
      whatsappNumber: link.whatsappNumber,
      linkedAt: link.linkedAt.toISOString(),
      expiresAt: link.expiresAt.toISOString(),
      daysRemaining: Math.max(0, daysRemaining),
      lastUsedAt: link.lastUsedAt?.toISOString() || null,
      usage: {
        today: usage.today,
        limit: usage.limit,
        remaining: usage.remaining,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get link status');
    return c.json(
      {
        success: false,
        error: 'Failed to get link status',
        message: error.message,
      },
      500
    );
  }
});

/**
 * POST /link/revoke
 * Unlink WhatsApp AI Assistant
 */
router.post('/link/revoke', async (c) => {
  try {
    const user = c.get('user');

    const link = await prisma.whatsAppAILink.findFirst({
      where: {
        userId: user.id,
        tenantId: user.tenantId,
        status: 'ACTIVE',
      },
    });

    if (!link) {
      return c.json(
        {
          success: false,
          error: 'No active link found to revoke',
        },
        404
      );
    }

    // Update link status
    await prisma.whatsAppAILink.update({
      where: { id: link.id },
      data: {
        status: 'REVOKED',
        isActive: false,
      },
    });

    // Send goodbye message
    try {
      const { sendGoodbyeMessage } = await import('./utils/whatsapp-messages.js');
      await sendGoodbyeMessage(link.whatsappNumber);
    } catch (err) {
      logger.warn({ error: err }, 'Failed to send goodbye message');
    }

    logger.info(
      { userId: user.id, whatsappNumber: link.whatsappNumber },
      'WhatsApp AI link revoked'
    );

    return c.json({
      success: true,
      message: 'WhatsApp AI Assistant has been unlinked successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to revoke link');
    return c.json(
      {
        success: false,
        error: 'Failed to revoke link',
        message: error.message,
      },
      500
    );
  }
});

/**
 * GET /schedules
 * Get user's push notification schedules
 */
router.get('/schedules', async (c) => {
  try {
    const user = c.get('user');

    const schedules = await prisma.aIAssistantSchedule.findMany({
      where: {
        userId: user.id,
        tenantId: user.tenantId,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return c.json({
      schedules: schedules.map((s) => ({
        id: s.id,
        type: s.scheduleType,
        frequency: s.frequency,
        time: s.time,
        timezone: s.timezone,
        isActive: s.isActive,
        lastRunAt: s.lastRunAt?.toISOString() || null,
        nextRunAt: s.nextRunAt?.toISOString() || null,
        config: s.config,
      })),
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get schedules');
    return c.json(
      {
        success: false,
        error: 'Failed to get schedules',
        message: error.message,
      },
      500
    );
  }
});

/**
 * POST /schedules
 * Create or update push notification schedule
 */
router.post('/schedules', async (c) => {
  try {
    const user = c.get('user');
    const { type, frequency, time, timezone = 'Asia/Kolkata', config } = await c.req.json();

    // Validate input
    if (!type || !frequency || !time) {
      return c.json(
        {
          success: false,
          error: 'Missing required fields: type, frequency, time',
        },
        400
      );
    }

    // Validate time format (HH:MM)
    if (!/^\d{2}:\d{2}$/.test(time)) {
      return c.json(
        {
          success: false,
          error: 'Invalid time format. Use HH:MM (e.g., "09:00")',
        },
        400
      );
    }

    // Calculate next run time
    const nextRunAt = calculateNextRun(time, timezone, frequency);

    // Check if schedule already exists
    const existing = await prisma.aIAssistantSchedule.findFirst({
      where: {
        userId: user.id,
        tenantId: user.tenantId,
        scheduleType: type,
        isActive: true,
      },
    });

    let schedule;
    if (existing) {
      // Update existing
      schedule = await prisma.aIAssistantSchedule.update({
        where: { id: existing.id },
        data: {
          frequency,
          time,
          timezone,
          config,
          nextRunAt,
        },
      });
    } else {
      // Create new
      schedule = await prisma.aIAssistantSchedule.create({
        data: {
          userId: user.id,
          tenantId: user.tenantId,
          scheduleType: type,
          frequency,
          time,
          timezone,
          config,
          nextRunAt,
          isActive: true,
        },
      });
    }

    logger.info({ userId: user.id, scheduleType: type }, 'AI Assistant schedule created/updated');

    return c.json({
      success: true,
      schedule: {
        id: schedule.id,
        type: schedule.scheduleType,
        frequency: schedule.frequency,
        time: schedule.time,
        timezone: schedule.timezone,
        nextRunAt: schedule.nextRunAt?.toISOString(),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create/update schedule');
    return c.json(
      {
        success: false,
        error: 'Failed to create/update schedule',
        message: error.message,
      },
      500
    );
  }
});

/**
 * DELETE /schedules/:id
 * Delete a schedule
 */
router.delete('/schedules/:id', async (c) => {
  try {
    const user = c.get('user');
    const scheduleId = c.req.param('id');

    const schedule = await prisma.aIAssistantSchedule.findFirst({
      where: {
        id: scheduleId,
        userId: user.id,
        tenantId: user.tenantId,
      },
    });

    if (!schedule) {
      return c.json(
        {
          success: false,
          error: 'Schedule not found',
        },
        404
      );
    }

    await prisma.aIAssistantSchedule.update({
      where: { id: scheduleId },
      data: { isActive: false },
    });

    return c.json({
      success: true,
      message: 'Schedule deleted successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to delete schedule');
    return c.json(
      {
        success: false,
        error: 'Failed to delete schedule',
        message: error.message,
      },
      500
    );
  }
});

/**
 * GET /usage
 * Get usage statistics
 */
router.get('/usage', async (c) => {
  try {
    const user = c.get('user');

    const [userUsage, tenantUsage] = await Promise.all([
      rateLimiter.getUserUsage(user.id, user.tenantId),
      rateLimiter.getTenantUsage(user.tenantId),
    ]);

    return c.json({
      user: userUsage,
      tenant: tenantUsage,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get usage');
    return c.json(
      {
        success: false,
        error: 'Failed to get usage statistics',
        message: error.message,
      },
      500
    );
  }
});

/**
 * Helper: Calculate next run time for schedule
 */
function calculateNextRun(time, timezone, frequency) {
  const now = new Date();
  const [hours, minutes] = time.split(':').map(Number);

  const next = new Date(now);
  next.setHours(hours, minutes, 0, 0);

  // If time has passed today, move to next occurrence
  if (next <= now) {
    if (frequency === 'DAILY') {
      next.setDate(next.getDate() + 1);
    } else if (frequency === 'WEEKLY') {
      next.setDate(next.getDate() + 7);
    } else if (frequency === 'MONTHLY') {
      next.setMonth(next.getMonth() + 1);
    }
  }

  return next;
}

export default router;
