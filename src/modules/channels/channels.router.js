/**
 * Channels API Router
 * Handles channel management and webhook endpoints
 */

import { Router } from 'express';
import { channelsService } from './channels.service.js';
import { authenticate, authorize } from '../../common/middleware/authenticate.js';

const router = Router();

// =====================
// Channel Configuration Status
// =====================

/**
 * Get channel configuration status for all channels
 * Returns whether each channel is configured and ready
 */
router.get('/config-status', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const configStatus = await channelsService.getChannelConfigStatus(tenantId);
    res.json({ success: true, data: configStatus });
  } catch (error) {
    next(error);
  }
});

/**
 * Set channel setup mode (Self-Service, Managed, BYOK)
 */
router.post('/setup-mode', authenticate, authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { channel, setupMode } = req.body;

    if (!channel || !setupMode) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: 'Channel and setupMode are required',
      });
    }

    const result = await channelsService.setChannelSetupMode(tenantId, channel, setupMode);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// =====================
// WhatsApp Configuration
// =====================

/**
 * Get WhatsApp configuration
 */
router.get('/whatsapp/config', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const config = await channelsService.getWhatsAppConfig(tenantId);
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

/**
 * Configure WhatsApp channel
 * Supports Self-Service (MSG91), Managed, and BYOK modes
 */
router.post('/whatsapp/configure', authenticate, async (req, res, next) => {
  try {
    const { tenantId, workspaceId, id: userId } = req.user;
    const config = req.body;

    // Validate required fields
    if (!config.setupMode) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: 'Setup mode is required',
      });
    }

    const result = await channelsService.configureWhatsApp({
      tenantId,
      workspaceId,
      userId,
      ...config,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Test WhatsApp connection (MSG91 or BYOK provider)
 */
router.post(
  '/whatsapp/test',
  authenticate,
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { provider, authKey, apiKey, accountSid, apiSecret } = req.body;

      if (!provider) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_INPUT',
          message: 'Provider is required',
        });
      }

      const result = await channelsService.testWhatsAppConnection({
        tenantId,
        provider,
        authKey,
        apiKey,
        accountSid,
        apiSecret,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get MSG91 WhatsApp balance
 */
router.get('/whatsapp/balance', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const balance = await channelsService.getMsg91Balance(tenantId);
    res.json({ success: true, data: balance });
  } catch (error) {
    next(error);
  }
});

/**
 * Update WhatsApp field mappings
 */
router.put(
  '/whatsapp/mappings',
  authenticate,
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { mappings } = req.body;

      if (!mappings || typeof mappings !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'INVALID_INPUT',
          message: 'Field mappings are required',
        });
      }

      const result = await channelsService.updateWhatsAppMappings(tenantId, mappings);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Submit managed setup request
 */
router.post(
  '/whatsapp/managed-request',
  authenticate,
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const { tenantId, workspaceId, id: userId } = req.user;
      const requestData = req.body;

      if (!requestData.businessName || !requestData.contactEmail) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_INPUT',
          message: 'Business name and contact email are required',
        });
      }

      const result = await channelsService.submitManagedSetupRequest({
        tenantId,
        workspaceId,
        userId,
        ...requestData,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// Channel Account Management
// =====================

/**
 * Get all channel accounts for workspace
 */
router.get(
  '/',
  authenticate,
  authorize('settings:update', 'settings:read'),
  async (req, res, next) => {
    try {
      const { tenantId, workspaceId } = req.user;
      const { channelType } = req.query;

      const accounts = await channelsService.getChannelAccounts(tenantId, workspaceId, channelType);

      res.json(accounts);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get single channel account
 */
router.get(
  '/:id',
  authenticate,
  authorize('settings:update', 'settings:read'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;

      const account = await channelsService.getChannelAccount(tenantId, id);

      res.json({ data: account });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Create channel account
 */
router.post('/', authenticate, authorize('settings:update'), async (req, res, next) => {
  try {
    const { tenantId, workspaceId, id: userId } = req.user;

    const account = await channelsService.createChannelAccount({
      tenantId,
      workspaceId,
      userId,
      ...req.body,
    });

    res.status(201).json({ data: account });
  } catch (error) {
    next(error);
  }
});

/**
 * Update channel account
 */
router.patch('/:id', authenticate, authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const account = await channelsService.updateChannelAccount(tenantId, id, req.body);

    res.json({ data: account });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete channel account
 */
router.delete('/:id', authenticate, authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    await channelsService.deleteChannelAccount(tenantId, id);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Validate channel credentials
 */
router.post('/:id/validate', authenticate, authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    const result = await channelsService.validateChannelCredentials(tenantId, id);

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Get channel health status
 */
router.get(
  '/:id/health',
  authenticate,
  authorize('settings:update', 'settings:read'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;

      const health = await channelsService.getChannelHealth(tenantId, id);

      res.json({ data: health });
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// Messaging
// =====================

/**
 * Send a message
 */
router.post('/send', authenticate, async (req, res, next) => {
  try {
    const { tenantId, workspaceId } = req.user;

    const result = await channelsService.sendMessage({
      tenantId,
      workspaceId,
      ...req.body,
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Send a template message
 */
router.post('/send-template', authenticate, async (req, res, next) => {
  try {
    const { tenantId, workspaceId } = req.user;

    const result = await channelsService.sendTemplate({
      tenantId,
      workspaceId,
      ...req.body,
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// =====================
// Usage & Analytics
// =====================

/**
 * Get usage summary
 */
router.get(
  '/usage/summary',
  authenticate,
  authorize('settings:update', 'settings:read'),
  async (req, res, next) => {
    try {
      const { tenantId, workspaceId } = req.user;
      const { startDate, endDate } = req.query;

      const summary = await channelsService.getUsageSummary(
        tenantId,
        workspaceId,
        new Date(startDate),
        new Date(endDate)
      );

      res.json({ data: summary });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get rate limit status
 */
router.get(
  '/:id/rate-limits',
  authenticate,
  authorize('settings:update', 'settings:read'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;

      const status = await channelsService.getRateLimitStatus(tenantId, id);

      res.json({ data: status });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get channel statistics
 */
router.get(
  '/:id/stats',
  authenticate,
  authorize('settings:update', 'settings:read'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;
      const { period } = req.query;

      const stats = await channelsService.getChannelStats(tenantId, id, period);

      res.json({ data: stats });
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// DLT Compliance (India SMS)
// =====================

/**
 * Get DLT settings
 */
router.get('/dlt/settings', authenticate, authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const settings = await channelsService.getDltSettings(tenantId);
    res.json({ data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * Update DLT settings
 */
router.put('/dlt/settings', authenticate, authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const settings = await channelsService.updateDltSettings(tenantId, req.body);
    res.json({ data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * Add DLT Sender ID
 */
router.post(
  '/dlt/sender-ids',
  authenticate,
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const senderIds = await channelsService.addDltSenderId(tenantId, req.body);
      res.status(201).json({ data: senderIds });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Remove DLT Sender ID
 */
router.delete(
  '/dlt/sender-ids/:senderId',
  authenticate,
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { senderId } = req.params;
      const senderIds = await channelsService.removeDltSenderId(tenantId, senderId);
      res.json({ data: senderIds });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Add DLT Template
 */
router.post(
  '/dlt/templates',
  authenticate,
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const templates = await channelsService.addDltTemplate(tenantId, req.body);
      res.status(201).json({ data: templates });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Remove DLT Template
 */
router.delete(
  '/dlt/templates/:templateId',
  authenticate,
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { templateId } = req.params;
      const templates = await channelsService.removeDltTemplate(tenantId, templateId);
      res.json({ data: templates });
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// Email OAuth
// =====================

/**
 * Initiate Gmail OAuth
 */
router.post(
  '/oauth/gmail/initiate',
  authenticate,
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const { tenantId, workspaceId } = req.user;
      const { redirectUri } = req.body;

      const result = await channelsService.initiateGmailOAuth(tenantId, workspaceId, redirectUri);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Initiate Microsoft OAuth
 */
router.post(
  '/oauth/microsoft/initiate',
  authenticate,
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const { tenantId, workspaceId } = req.user;
      const { redirectUri } = req.body;

      const result = await channelsService.initiateMicrosoftOAuth(
        tenantId,
        workspaceId,
        redirectUri
      );
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Complete Email OAuth callback
 */
router.post(
  '/oauth/callback',
  authenticate,
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const { code, state } = req.body;
      const account = await channelsService.completeEmailOAuth(code, state);
      res.json({ data: account });
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// Voice Configuration
// =====================

/**
 * Configure Voice channel
 * Supports Self-Service (MSG91) mode
 */
router.post('/voice/configure', authenticate, async (req, res, next) => {
  try {
    const { tenantId, workspaceId, id: userId } = req.user;
    const config = req.body;

    // Validate required fields
    if (!config.setupMode) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_INPUT',
        message: 'Setup mode is required',
      });
    }

    const result = await channelsService.configureVoice({
      tenantId,
      workspaceId,
      userId,
      ...config,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// =====================
// Email Configuration
// =====================

/**
 * Configure Email channel
 * Supports OAuth (Gmail, Microsoft) modes
 */
router.post('/email/configure', authenticate, async (req, res, next) => {
  try {
    const { tenantId, workspaceId, id: userId } = req.user;
    const config = req.body;

    // For OAuth providers, return the auth URL
    if (config.provider === 'gmail' || config.provider === 'microsoft') {
      const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/settings/email/callback`;

      let authUrl;
      if (config.provider === 'gmail') {
        const result = await channelsService.initiateGmailOAuth(tenantId, workspaceId, redirectUri);
        authUrl = result.authUrl;
      } else {
        const result = await channelsService.initiateMicrosoftOAuth(
          tenantId,
          workspaceId,
          redirectUri
        );
        authUrl = result.authUrl;
      }

      return res.json({ success: true, data: { authUrl, provider: config.provider } });
    }

    // For SMTP/IMAP configuration
    const result = await channelsService.configureEmail({
      tenantId,
      workspaceId,
      userId,
      ...config,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// =====================
// Voice Settings
// =====================

/**
 * Get voice settings
 */
router.get(
  '/:id/voice-settings',
  authenticate,
  authorize('settings:update', 'settings:read'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;

      const settings = await channelsService.getVoiceSettings(tenantId, id);
      res.json({ data: settings });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update voice settings
 */
router.patch(
  '/:id/voice-settings',
  authenticate,
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { id } = req.params;

      const settings = await channelsService.updateVoiceSettings(tenantId, id, req.body);
      res.json({ data: settings });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
