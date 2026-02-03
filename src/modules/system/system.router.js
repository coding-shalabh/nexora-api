import { Router } from 'express';
import { environmentConfig } from '../../config/environment.js';
import { channelMockService } from '../../services/channel-mock.service.js';
import { demoSeederService } from '../../services/demo-seeder.service.js';
import { authenticate } from '../../common/middleware/authenticate.js';

const router = Router();

/**
 * GET /system/mode
 * Get current system mode configuration
 * Public endpoint - no auth required
 */
router.get('/mode', (req, res) => {
  res.json({
    success: true,
    data: {
      environment: environmentConfig.mode,
      isDevelopment: environmentConfig.isDevelopment(),
      isStaging: environmentConfig.isStaging(),
      isProduction: environmentConfig.isProduction(),
      demo: {
        enabled: environmentConfig.demo.enabled,
        tenantId: environmentConfig.demo.tenantId,
        autoSeed: environmentConfig.demo.autoSeed,
      },
      channels: {
        mode: environmentConfig.channels.mode,
        areChannelsMocked: environmentConfig.areChannelsMocked(),
        mockedChannels: channelMockService.getMockedChannels(),
        whatsapp: {
          enabled: environmentConfig.channels.whatsapp.enabled,
          mocked: environmentConfig.channels.whatsapp.bypassMSG91,
          logOnly: environmentConfig.channels.whatsapp.logOnly,
        },
        email: {
          enabled: environmentConfig.channels.email.enabled,
          mocked:
            environmentConfig.channels.email.bypassResend ||
            environmentConfig.channels.email.bypassMSG91,
          logOnly: environmentConfig.channels.email.logOnly,
        },
        sms: {
          enabled: environmentConfig.channels.sms.enabled,
          mocked:
            environmentConfig.channels.sms.bypassFast2SMS ||
            environmentConfig.channels.sms.bypassInfobip ||
            environmentConfig.channels.sms.bypassMSG91,
          logOnly: environmentConfig.channels.sms.logOnly,
        },
        voice: {
          enabled: environmentConfig.channels.voice.enabled,
          mocked: environmentConfig.channels.voice.bypassTeleCMI,
          logOnly: environmentConfig.channels.voice.logOnly,
        },
      },
    },
  });
});

/**
 * GET /system/health
 * Health check endpoint
 * Public endpoint - no auth required
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: environmentConfig.mode,
    },
  });
});

/**
 * POST /system/seed-demo
 * Manually trigger demo data seeding
 * Protected endpoint - requires authentication
 */
router.post('/seed-demo', authenticate, async (req, res, next) => {
  try {
    if (!environmentConfig.demo.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Demo mode is not enabled',
      });
    }

    await demoSeederService.seedAll();

    res.json({
      success: true,
      message: 'Demo data seeded successfully',
      data: {
        tenantId: environmentConfig.demo.tenantId,
        counts: environmentConfig.demo.dataCounts,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /system/clear-demo
 * Clear all demo data
 * Protected endpoint - requires authentication
 */
router.post('/clear-demo', authenticate, async (req, res, next) => {
  try {
    if (!environmentConfig.demo.enabled) {
      return res.status(400).json({
        success: false,
        error: 'Demo mode is not enabled',
      });
    }

    await demoSeederService.clearDemoData();

    res.json({
      success: true,
      message: 'Demo data cleared successfully',
    });
  } catch (error) {
    next(error);
  }
});

export { router as systemRouter };
