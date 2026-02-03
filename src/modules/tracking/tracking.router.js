import { Router } from 'express';
import { z } from 'zod';
import { trackingService } from './tracking.service.js';
import { authenticate, authorize } from '../../common/middleware/authenticate.js';

const router = Router();

// ============ PUBLIC TRACKING ENDPOINTS ============
// These endpoints are called by the tracking SDK from websites

/**
 * Receive tracking events from SDK
 * POST /tracking/collect
 */
router.post('/collect', async (req, res, next) => {
  try {
    const { apiKey, type, data } = req.body;

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API key required' });
    }

    // Validate API key
    const trackingScript = await trackingService.validateApiKey(apiKey);

    // Get IP address
    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;

    // Handle different event types
    let result;

    switch (type) {
      case 'session.start':
        result = await trackingService.startSession(trackingScript, {
          ...data,
          ipAddress,
        });
        break;

      case 'page.view':
        result = await trackingService.trackPageView(trackingScript, data);
        break;

      case 'page.leave':
        result = await trackingService.trackPageLeave(trackingScript, data);
        break;

      case 'events.batch':
        result = await trackingService.trackEvents(trackingScript, data);
        break;

      case 'form.submit':
        result = await trackingService.trackFormSubmit(trackingScript, data);
        break;

      case 'user.identify':
        result = await trackingService.identifyVisitor(trackingScript, data);
        break;

      case 'recording.events':
        result = await trackingService.storeRecordingEvents(trackingScript, data);
        break;

      default:
        return res.status(400).json({ success: false, error: 'Unknown event type' });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    if (error.code === 'UNAUTHORIZED') {
      return res.status(401).json({ success: false, error: error.message });
    }
    next(error);
  }
});

/**
 * Link redirect endpoint
 * GET /tracking/l/:shortCode
 */
router.get('/l/:shortCode', async (req, res, next) => {
  try {
    const { shortCode } = req.params;

    const link = await trackingService.getLinkByCode(shortCode);

    if (!link) {
      return res.status(404).send('Link not found');
    }

    if (!link.isActive) {
      return res.status(410).send('Link expired');
    }

    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return res.status(410).send('Link expired');
    }

    if (link.maxClicks && link.clickCount >= link.maxClicks) {
      return res.status(410).send('Link limit reached');
    }

    // Get visitor info
    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const referrer = req.headers['referer'];

    // Track the click
    await trackingService.trackLinkClick(link, {
      ipAddress,
      userAgent,
      referrer,
    });

    // Redirect to original URL
    res.redirect(302, link.originalUrl);
  } catch (error) {
    next(error);
  }
});

// ============ ADMIN ENDPOINTS ============
// These require authentication

/**
 * Get tracking scripts
 */
router.get('/scripts', authenticate, authorize('crm:activities:read'), async (req, res, next) => {
  try {
    const scripts = await trackingService.getTrackingScripts(req.tenantId);

    res.json({
      success: true,
      data: scripts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create tracking script
 */
router.post(
  '/scripts',
  authenticate,
  authorize('crm:activities:create'),
  async (req, res, next) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        domain: z.string().min(1),
        settings: z.record(z.unknown()).optional(),
      });

      const data = schema.parse(req.body);
      const script = await trackingService.createTrackingScript(req.tenantId, data);

      res.status(201).json({
        success: true,
        data: script,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get visitor sessions
 */
router.get('/sessions', authenticate, authorize('crm:activities:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        contactId: z.string().optional(),
        companyId: z.string().optional(),
        isIdentified: z.coerce.boolean().optional(),
      })
      .parse(req.query);

    const result = await trackingService.getSessions(req.tenantId, params);

    res.json({
      success: true,
      data: result.sessions,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get single session with details
 */
router.get(
  '/sessions/:id',
  authenticate,
  authorize('crm:activities:read'),
  async (req, res, next) => {
    try {
      const session = await trackingService.getSession(req.tenantId, req.params.id);

      if (!session) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }

      res.json({
        success: true,
        data: session,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get session recording for playback
 */
router.get(
  '/sessions/:id/recording',
  authenticate,
  authorize('crm:activities:read'),
  async (req, res, next) => {
    try {
      const recording = await trackingService.getSessionRecording(req.tenantId, req.params.id);

      if (!recording) {
        return res.status(404).json({ success: false, error: 'Recording not found' });
      }

      res.json({
        success: true,
        data: recording,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get tracked links
 */
router.get('/links', authenticate, authorize('crm:activities:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        campaign: z.string().optional(),
        isActive: z.coerce.boolean().optional(),
      })
      .parse(req.query);

    // TODO: Implement actual link listing from database
    // For now, return empty array with proper structure
    res.json({
      success: true,
      data: [],
      meta: {
        total: 0,
        page: params.page,
        limit: params.limit,
        totalPages: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create tracked link
 */
router.post('/links', authenticate, authorize('crm:activities:create'), async (req, res, next) => {
  try {
    const schema = z.object({
      originalUrl: z.string().url(),
      name: z.string().optional(),
      description: z.string().optional(),
      shortCode: z.string().min(4).max(20).optional(),
      campaign: z.string().optional(),
      source: z.string().optional(),
      medium: z.string().optional(),
      expiresAt: z.string().datetime().optional(),
      maxClicks: z.number().positive().optional(),
      trackingScriptId: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const link = await trackingService.createLink(req.tenantId, data);

    res.status(201).json({
      success: true,
      data: link,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update tracked link
 */
router.put(
  '/links/:id',
  authenticate,
  authorize('crm:activities:update'),
  async (req, res, next) => {
    try {
      const schema = z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        expiresAt: z.string().datetime().optional(),
        maxClicks: z.number().positive().optional(),
        isActive: z.boolean().optional(),
      });

      const data = schema.parse(req.body);

      // TODO: Implement link update in service
      // For now, return mock updated link
      const link = {
        id: req.params.id,
        ...data,
        updatedAt: new Date().toISOString(),
      };

      res.json({
        success: true,
        data: link,
        message: 'Link updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ ANALYTICS ENDPOINTS ============

/**
 * Get analytics overview
 */
router.get(
  '/analytics/overview',
  authenticate,
  authorize('crm:activities:read'),
  async (req, res, next) => {
    try {
      const { period = '7d' } = req.query;
      const data = await trackingService.getAnalyticsOverview(req.tenantId, period);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get visitors over time
 */
router.get(
  '/analytics/visitors',
  authenticate,
  authorize('crm:activities:read'),
  async (req, res, next) => {
    try {
      const { period = '7d' } = req.query;
      const data = await trackingService.getVisitorsOverTime(req.tenantId, period);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get top pages
 */
router.get(
  '/analytics/pages',
  authenticate,
  authorize('crm:activities:read'),
  async (req, res, next) => {
    try {
      const { period = '7d', limit = 20 } = req.query;
      const data = await trackingService.getTopPages(req.tenantId, period, parseInt(limit));

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get traffic sources
 */
router.get(
  '/analytics/sources',
  authenticate,
  authorize('crm:activities:read'),
  async (req, res, next) => {
    try {
      const { period = '7d' } = req.query;
      const data = await trackingService.getTrafficSources(req.tenantId, period);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get live visitors
 */
router.get(
  '/analytics/live',
  authenticate,
  authorize('crm:activities:read'),
  async (req, res, next) => {
    try {
      const data = await trackingService.getLiveVisitors(req.tenantId);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get form analytics
 */
router.get(
  '/analytics/forms',
  authenticate,
  authorize('crm:activities:read'),
  async (req, res, next) => {
    try {
      const { period = '7d' } = req.query;
      const data = await trackingService.getFormAnalytics(req.tenantId, period);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get device breakdown
 */
router.get(
  '/analytics/devices',
  authenticate,
  authorize('crm:activities:read'),
  async (req, res, next) => {
    try {
      const { period = '7d' } = req.query;
      const data = await trackingService.getDeviceBreakdown(req.tenantId, period);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get geographic breakdown
 */
router.get(
  '/analytics/geography',
  authenticate,
  authorize('crm:activities:read'),
  async (req, res, next) => {
    try {
      const { period = '7d' } = req.query;
      const data = await trackingService.getGeographicBreakdown(req.tenantId, period);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ SCRIPT MANAGEMENT ENDPOINTS ============

/**
 * Update tracking script
 */
router.put(
  '/scripts/:id',
  authenticate,
  authorize('crm:activities:update'),
  async (req, res, next) => {
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        domain: z.string().min(1).optional(),
        settings: z.record(z.unknown()).optional(),
        isActive: z.boolean().optional(),
      });

      const data = schema.parse(req.body);
      const script = await trackingService.updateTrackingScript(req.tenantId, req.params.id, data);

      res.json({
        success: true,
        data: script,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete (deactivate) tracking script
 */
router.delete(
  '/scripts/:id',
  authenticate,
  authorize('crm:activities:delete'),
  async (req, res, next) => {
    try {
      await trackingService.deleteTrackingScript(req.tenantId, req.params.id);

      res.json({
        success: true,
        message: 'Tracking script deactivated',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Regenerate API key for tracking script
 */
router.post(
  '/scripts/:id/regenerate-key',
  authenticate,
  authorize('crm:activities:update'),
  async (req, res, next) => {
    try {
      const script = await trackingService.regenerateApiKey(req.tenantId, req.params.id);

      res.json({
        success: true,
        data: script,
      });
    } catch (error) {
      next(error);
    }
  }
);

export { router as trackingRouter };
