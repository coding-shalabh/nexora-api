/**
 * Dialer Router
 * API endpoints for voice calling and power dialer
 */

import { Router } from 'express';
import { dialerService } from './dialer.service.js';
import { validateRequest } from '../../common/middleware/validation.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { z } from 'zod';

const router = Router();

// All dialer routes require authentication
router.use(authenticate);

// Validation schemas
const initiateCallSchema = z.object({
  channelAccountId: z.string(),
  toNumber: z.string(),
  contactId: z.string().optional(),
  leadId: z.string().optional(),
  dealId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const powerDialerSchema = z.object({
  channelAccountId: z.string(),
  contacts: z.array(
    z.object({
      phone: z.string(),
      contactId: z.string().optional(),
      leadId: z.string().optional(),
      name: z.string().optional(),
    })
  ),
  settings: z
    .object({
      pauseBetweenCalls: z.number().int().positive().optional(),
      maxAttempts: z.number().int().min(1).max(5).optional(),
      dropVoicemail: z.boolean().optional(),
      voicemailMessage: z.string().optional(),
    })
    .optional(),
});

const dispositionSchema = z.object({
  disposition: z.enum([
    'INTERESTED',
    'NOT_INTERESTED',
    'CALLBACK_REQUESTED',
    'VOICEMAIL_LEFT',
    'WRONG_NUMBER',
    'DO_NOT_CALL',
    'FOLLOW_UP_NEEDED',
    'DEAL_CLOSED',
  ]),
  notes: z.string().optional(),
});

// =====================
// Dialer Status & Call History
// =====================

/**
 * Get dialer status
 * GET /dialer
 */
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    // TODO: Implement actual dialer status from database
    // For now, return default status
    res.json({
      success: true,
      data: {
        status: 'ready',
        activeCall: null,
        queuedCalls: 0,
        totalCallsToday: 0,
        isEnabled: true,
        channelAccountsConnected: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get dialer stats
 * GET /dialer/stats
 */
router.get('/stats', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    // TODO: Implement actual dialer stats from database
    // For now, return default stats
    res.json({
      success: true,
      data: {
        totalCalls: 0,
        callsToday: 0,
        averageCallDuration: 0,
        successRate: 0,
        missedCalls: 0,
        voicemailsLeft: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get call logs/history
 * GET /dialer/calls
 */
router.get('/calls', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;

    // TODO: Implement actual call logs from database
    // For now, return empty array
    res.json({
      success: true,
      data: [],
      meta: {
        total: 0,
        page,
        limit,
        totalPages: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// Call Management
// =====================

/**
 * Initiate outbound call
 */
router.post('/call', validateRequest({ body: initiateCallSchema }), async (req, res, next) => {
  try {
    const { tenantId, workspaceId, userId } = req.user;
    const result = await dialerService.initiateCall({
      tenantId,
      workspaceId,
      userId,
      ...req.body,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * End active call
 */
router.post('/call/:callId/end', async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const result = await dialerService.endCall(tenantId, req.params.callId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Transfer call
 */
router.post(
  '/call/:callId/transfer',
  validateRequest({ body: z.object({ transferTo: z.string() }) }),
  async (req, res, next) => {
    try {
      const { tenantId } = req.user;
      const result = await dialerService.transferCall(
        tenantId,
        req.params.callId,
        req.body.transferTo
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Hold call
 */
router.post('/call/:callId/hold', async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const result = await dialerService.holdCall(tenantId, req.params.callId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Resume call from hold
 */
router.post('/call/:callId/resume', async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const result = await dialerService.resumeCall(tenantId, req.params.callId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Set call disposition
 */
router.post(
  '/call/:callId/disposition',
  validateRequest({ body: dispositionSchema }),
  async (req, res, next) => {
    try {
      const { tenantId } = req.user;
      const result = await dialerService.setCallDisposition(
        tenantId,
        req.params.callId,
        req.body.disposition,
        req.body.notes
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Add note to call
 */
router.post(
  '/call/:callId/notes',
  validateRequest({ body: z.object({ note: z.string().min(1) }) }),
  async (req, res, next) => {
    try {
      const { tenantId, userId } = req.user;
      const result = await dialerService.addCallNote(
        tenantId,
        req.params.callId,
        userId,
        req.body.note
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// WebRTC Call Logging
// =====================

/**
 * Create a WebRTC call record
 * Called when a WebRTC call is initiated via PIOPIY SDK
 */
router.post(
  '/webrtc-call',
  validateRequest({
    body: z.object({
      toNumber: z.string(),
      contactId: z.string().optional(),
      direction: z.enum(['INBOUND', 'OUTBOUND']).default('OUTBOUND'),
    }),
  }),
  async (req, res, next) => {
    try {
      const { tenantId, workspaceId, userId } = req.user;
      const result = await dialerService.createWebRTCCallRecord({
        tenantId,
        workspaceId,
        userId,
        ...req.body,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update a WebRTC call record
 * Called when a WebRTC call status changes or ends
 */
router.patch('/webrtc-call/:callId', async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { status, duration, endedAt } = req.body;
    const result = await dialerService.updateWebRTCCallRecord(tenantId, req.params.callId, {
      status,
      duration,
      endedAt,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Cleanup stale call records
 * Marks old INITIATING/RINGING calls as FAILED
 */
router.post('/cleanup-stale', async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { maxAgeMinutes = 30 } = req.body;
    const result = await dialerService.cleanupStaleCalls(tenantId, maxAgeMinutes);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// =====================
// Call Logs & History
// =====================

/**
 * Get call logs
 */
router.get('/logs', async (req, res, next) => {
  try {
    const { tenantId, userId } = req.user;
    const filters = {
      userId: req.query.allUsers === 'true' ? undefined : userId,
      contactId: req.query.contactId,
      direction: req.query.direction,
      status: req.query.status,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
    };
    const result = await dialerService.getCallLogs(tenantId, filters);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Get active calls for current user
 */
router.get('/active', async (req, res, next) => {
  try {
    const { tenantId, userId } = req.user;
    const calls = await dialerService.getActiveCalls(tenantId, userId);
    res.json(calls);
  } catch (error) {
    next(error);
  }
});

/**
 * Get call recording
 */
router.get('/call/:callId/recording', async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const result = await dialerService.getRecording(tenantId, req.params.callId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// =====================
// Power Dialer
// =====================

/**
 * Start power dialer session
 */
router.post(
  '/power-dialer/start',
  validateRequest({ body: powerDialerSchema }),
  async (req, res, next) => {
    try {
      const { tenantId, workspaceId, userId } = req.user;
      const result = await dialerService.startPowerDialer({
        tenantId,
        workspaceId,
        userId,
        ...req.body,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get power dialer status
 */
router.get('/power-dialer/status', async (req, res, next) => {
  try {
    const { userId } = req.user;
    const status = dialerService.getPowerDialerStatus(userId);
    res.json(status || { active: false });
  } catch (error) {
    next(error);
  }
});

/**
 * Pause power dialer
 */
router.post('/power-dialer/pause', async (req, res, next) => {
  try {
    const { userId } = req.user;
    const result = dialerService.pausePowerDialer(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Resume power dialer
 */
router.post('/power-dialer/resume', async (req, res, next) => {
  try {
    const { userId } = req.user;
    const result = await dialerService.resumePowerDialer(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * Stop power dialer
 */
router.post('/power-dialer/stop', async (req, res, next) => {
  try {
    const { userId } = req.user;
    const result = dialerService.stopPowerDialer(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
