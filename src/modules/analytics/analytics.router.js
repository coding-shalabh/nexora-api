import { Router } from 'express';
import { z } from 'zod';
import https from 'https';
import axios from 'axios';
import { requirePermission } from '../../common/middleware/tenant.js';
import { analyticsService } from './analytics.service.js';

const router = Router();

// IP API Configuration
const IPAPI_KEY = process.env.IPAPI_KEY || 'a40190664a200f86c6a6';
const IPAPI_BASE_URL = 'https://api.ipapi.is';

// Create axios instance with custom HTTPS agent for better Windows TLS compatibility
const httpsAgent = new https.Agent({
  rejectUnauthorized: true,
  minVersion: 'TLSv1.2',
});

const ipApiClient = axios.create({
  baseURL: IPAPI_BASE_URL,
  timeout: 10000,
  httpsAgent,
});

// Simple cache for IP lookups
const ipCache = new Map();
const IP_CACHE_TIMEOUT = 60 * 60 * 1000; // 1 hour

router.get('/dashboard', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .parse(req.query);

    const dashboard = await analyticsService.getDashboard(req.tenantId, params);

    res.json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/pipeline', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        pipelineId: z.string().uuid().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .parse(req.query);

    const metrics = await analyticsService.getPipelineMetrics(req.tenantId, params);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/inbox', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .parse(req.query);

    const metrics = await analyticsService.getInboxMetrics(req.tenantId, params);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/tickets', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .parse(req.query);

    const metrics = await analyticsService.getTicketMetrics(req.tenantId, params);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/team', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .parse(req.query);

    const metrics = await analyticsService.getTeamPerformance(req.tenantId, params);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

// Project Analytics
router.get('/projects', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .parse(req.query);

    const metrics = await analyticsService.getProjectMetrics(req.tenantId, params);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

// Task Analytics
router.get('/tasks', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        projectId: z.string().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .parse(req.query);

    const metrics = await analyticsService.getTaskMetrics(req.tenantId, params);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

// Time Tracking Analytics
router.get('/time-tracking', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        projectId: z.string().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .parse(req.query);

    const metrics = await analyticsService.getTimeTrackingMetrics(req.tenantId, params);

    res.json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
});

// Comprehensive Overview Dashboard
router.get('/overview', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      })
      .parse(req.query);

    const overview = await analyticsService.getOverviewDashboard(req.tenantId, params);

    res.json({
      success: true,
      data: overview,
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Goals
// ==========================================

// GET /analytics/goals - List analytics goals
router.get('/goals', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(20),
        type: z.enum(['REVENUE', 'CONVERSION', 'ENGAGEMENT', 'RETENTION']).optional(),
        status: z.enum(['ACTIVE', 'COMPLETED', 'MISSED']).optional(),
      })
      .parse(req.query);

    // For now, return placeholder data until full implementation
    const goals = await analyticsService.getGoals(req.tenantId, params);

    res.json({
      success: true,
      ...goals,
    });
  } catch (error) {
    next(error);
  }
});

// POST /analytics/goals - Create analytics goal
router.post('/goals', requirePermission('analytics:write'), async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1),
        type: z.enum(['REVENUE', 'CONVERSION', 'ENGAGEMENT', 'RETENTION']),
        targetValue: z.number().min(0),
        startDate: z.string(),
        endDate: z.string(),
        metric: z.string().optional(),
        description: z.string().optional(),
      })
      .parse(req.body);

    const goal = await analyticsService.createGoal(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: goal,
    });
  } catch (error) {
    next(error);
  }
});

// GET /analytics/goals/:id - Get goal details
router.get('/goals/:id', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const goal = await analyticsService.getGoal(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: goal,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /analytics/goals/:id - Update goal
router.put('/goals/:id', requirePermission('analytics:write'), async (req, res, next) => {
  try {
    const goal = await analyticsService.updateGoal(req.tenantId, req.params.id, req.body);

    res.json({
      success: true,
      data: goal,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /analytics/goals/:id - Delete goal
router.delete('/goals/:id', requirePermission('analytics:write'), async (req, res, next) => {
  try {
    await analyticsService.deleteGoal(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Goal deleted',
    });
  } catch (error) {
    next(error);
  }
});

// POST /analytics/goals/bulk - Bulk create/update goals
router.post('/goals/bulk', requirePermission('analytics:write'), async (req, res, next) => {
  try {
    const { goals } = req.body;

    if (!goals || !Array.isArray(goals)) {
      return res.status(400).json({
        success: false,
        error: 'goals array is required',
      });
    }

    const result = await analyticsService.bulkGoals(req.tenantId, req.userId, goals);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// Reports
// ==========================================

// GET /analytics/reports - List reports
router.get('/reports', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(20),
        type: z.string().optional(),
      })
      .parse(req.query);

    const reports = await analyticsService.getReports(req.tenantId, params);

    res.json({
      success: true,
      ...reports,
    });
  } catch (error) {
    next(error);
  }
});

// POST /analytics/reports - Create report
router.post('/reports', requirePermission('analytics:write'), async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1),
        type: z.enum(['SALES', 'MARKETING', 'SUPPORT', 'CUSTOM']),
        config: z.record(z.any()).optional(),
        schedule: z
          .object({
            frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
            time: z.string().optional(),
            recipients: z.array(z.string()).optional(),
          })
          .optional(),
      })
      .parse(req.body);

    const report = await analyticsService.createReport(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

// GET /analytics/reports/:id - Get report
router.get('/reports/:id', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const report = await analyticsService.getReport(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

// POST /analytics/reports/:id/run - Run report
router.post('/reports/:id/run', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.body;

    const result = await analyticsService.runReport(req.tenantId, req.params.id, {
      startDate,
      endDate,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /analytics/reports/:id - Delete report
router.delete('/reports/:id', requirePermission('analytics:write'), async (req, res, next) => {
  try {
    await analyticsService.deleteReport(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Report deleted',
    });
  } catch (error) {
    next(error);
  }
});

// GET /analytics/reports/scheduled - List scheduled reports
router.get('/reports/scheduled', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const reports = await analyticsService.getScheduledReports(req.tenantId);

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// IP Lookup Routes (using ipapi.is)
// ==========================================

/**
 * @route GET /api/v1/analytics/ip-lookup
 * @desc Look up IP address details (company, location, ASN)
 */
router.get('/ip-lookup', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const { ip } = req.query;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'IP address is required (query param: ip)' },
      });
    }

    // Check cache
    const cached = ipCache.get(ip);
    if (cached && Date.now() - cached.timestamp < IP_CACHE_TIMEOUT) {
      return res.json({ success: true, data: cached.data, cached: true });
    }

    // Call IP API using axios
    const response = await ipApiClient.get('', {
      params: { q: ip, key: IPAPI_KEY },
    });
    const apiData = response.data;

    // Transform response
    const data = {
      ip,
      company: {
        name: apiData.company?.name || apiData.asn?.org || null,
        domain: apiData.company?.domain || null,
        type: apiData.company?.type || null,
      },
      asn: {
        number: apiData.asn?.asn || null,
        organization: apiData.asn?.org || null,
        route: apiData.asn?.route || null,
        type: apiData.asn?.type || null,
      },
      location: {
        city: apiData.location?.city || null,
        region: apiData.location?.state || apiData.location?.region || null,
        country: apiData.location?.country || null,
        countryCode: apiData.location?.country_code || null,
        postalCode: apiData.location?.postal || null,
        latitude: apiData.location?.latitude || null,
        longitude: apiData.location?.longitude || null,
        timezone: apiData.location?.timezone || null,
      },
      connection: {
        isp: apiData.asn?.org || null,
        isVpn: apiData.is_vpn || false,
        isProxy: apiData.is_proxy || false,
        isTor: apiData.is_tor || false,
        isDatacenter: apiData.is_datacenter || false,
      },
      raw: apiData,
    };

    // Cache result
    ipCache.set(ip, { data, timestamp: Date.now() });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /api/v1/analytics/ip-lookup/identify
 * @desc Identify company from visitor IP for lead enrichment
 */
router.get('/ip-lookup/identify', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const { ip } = req.query;

    if (!ip) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'IP address is required' },
      });
    }

    // Check cache
    const cached = ipCache.get(ip);
    let data;

    if (cached && Date.now() - cached.timestamp < IP_CACHE_TIMEOUT) {
      data = cached.data;
    } else {
      const response = await ipApiClient.get('', {
        params: { q: ip, key: IPAPI_KEY },
      });
      const apiData = response.data;

      data = {
        company: {
          name: apiData.company?.name || apiData.asn?.org || null,
          domain: apiData.company?.domain || null,
          type: apiData.company?.type || null,
        },
        location: {
          city: apiData.location?.city || null,
          region: apiData.location?.state || null,
          country: apiData.location?.country || null,
        },
        connection: {
          isVpn: apiData.is_vpn || false,
          isProxy: apiData.is_proxy || false,
          isTor: apiData.is_tor || false,
        },
      };

      ipCache.set(ip, { data: { ...data, raw: apiData }, timestamp: Date.now() });
    }

    // Check if it's a VPN/proxy
    if (data.connection?.isVpn || data.connection?.isProxy || data.connection?.isTor) {
      return res.json({
        success: true,
        data: {
          identified: false,
          reason: 'VPN/Proxy/Tor detected',
          ip,
          location: data.location,
        },
      });
    }

    // Check for business company
    if (data.company?.name && data.company?.type === 'business') {
      return res.json({
        success: true,
        data: {
          identified: true,
          company: data.company,
          location: data.location,
          ip,
        },
      });
    }

    res.json({
      success: true,
      data: {
        identified: false,
        reason: 'No business company identified',
        ip,
        location: data.location,
        company: data.company,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /api/v1/analytics/ip-lookup/batch
 * @desc Batch lookup multiple IPs
 */
router.post('/ip-lookup/batch', requirePermission('analytics:read'), async (req, res, next) => {
  try {
    const { ips } = req.body;

    if (!ips || !Array.isArray(ips) || ips.length === 0) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Array of IPs required in body' },
      });
    }

    if (ips.length > 50) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Maximum 50 IPs per batch' },
      });
    }

    const results = await Promise.allSettled(
      ips.map(async (ip) => {
        const cached = ipCache.get(ip);
        if (cached && Date.now() - cached.timestamp < IP_CACHE_TIMEOUT) {
          return { ip, ...cached.data, cached: true };
        }

        const response = await ipApiClient.get('', {
          params: { q: ip, key: IPAPI_KEY },
        });
        const apiData = response.data;

        const data = {
          ip,
          company: apiData.company?.name || apiData.asn?.org || null,
          location: {
            city: apiData.location?.city,
            country: apiData.location?.country,
          },
        };

        ipCache.set(ip, { data: { ...data, raw: apiData }, timestamp: Date.now() });
        return data;
      })
    );

    res.json({
      success: true,
      data: results.map((r, i) => ({
        ip: ips[i],
        success: r.status === 'fulfilled',
        data: r.status === 'fulfilled' ? r.value : null,
        error: r.status === 'rejected' ? r.reason.message : null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export { router as analyticsRouter };
