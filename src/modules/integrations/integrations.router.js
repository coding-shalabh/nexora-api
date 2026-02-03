/**
 * Integrations API Router
 * Handles third-party integrations and webhooks
 */

import { Router } from 'express';
import { z } from 'zod';
import { integrationsService } from './integrations.service.js';
import { authenticate, authorize } from '../../common/middleware/authenticate.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// =====================
// Integrations Catalog
// =====================

/**
 * Get available integrations
 */
router.get('/available', async (req, res, next) => {
  try {
    const integrations = integrationsService.getAvailableIntegrations();
    res.json({ data: integrations });
  } catch (error) {
    next(error);
  }
});

// =====================
// Messaging Providers (MUST be before /:id routes)
// =====================

/**
 * Get available messaging providers catalog
 */
router.get('/messaging/catalog', async (req, res, next) => {
  try {
    const providers = integrationsService.getAvailableMessagingProviders();
    res.json({ success: true, data: providers });
  } catch (error) {
    next(error);
  }
});

/**
 * Get validated messaging providers for tenant
 */
router.get('/messaging', authorize('settings:update', 'settings:read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const providers = await integrationsService.getMessagingProviders(tenantId);
    res.json({ success: true, data: providers });
  } catch (error) {
    next(error);
  }
});

/**
 * Get specific messaging provider
 */
router.get(
  '/messaging/:provider',
  authorize('settings:update', 'settings:read'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { provider } = req.params;
      const integration = await integrationsService.getMessagingProvider(tenantId, provider);
      res.json({ success: true, data: integration });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Test messaging provider connection
 */
router.post('/messaging/test', authorize('settings:update'), async (req, res, next) => {
  try {
    const schema = z.object({
      provider: z.enum(['msg91', 'twilio', 'gupshup', 'infobip', 'resend', 'fast2sms', 'telecmi']),
      credentials: z.record(z.unknown()),
    });

    const data = schema.parse(req.body);
    const result = await integrationsService.testProviderConnection(
      data.provider,
      data.credentials
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Save/update messaging provider
 */
router.post('/messaging', authorize('settings:update'), async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const schema = z.object({
      provider: z.enum(['msg91', 'twilio', 'gupshup', 'infobip', 'resend', 'fast2sms', 'telecmi']),
      name: z.string().optional(),
      credentials: z.record(z.unknown()),
    });

    const data = schema.parse(req.body);
    const result = await integrationsService.saveMessagingProvider(tenantId, userId, data);

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.status(201).json({ success: true, data: result.integration, message: result.message });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete messaging provider
 */
router.delete('/messaging/:provider', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { provider } = req.params;
    await integrationsService.deleteMessagingProvider(tenantId, provider);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Get provider balance
 * Fetches real-time balance from provider's API
 */
router.get(
  '/messaging/:provider/balance',
  authorize('settings:update', 'settings:read'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { provider } = req.params;
      const balance = await integrationsService.getProviderBalance(tenantId, provider);
      res.json({ success: true, data: balance });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get provider stats
 * Fetches usage statistics from provider's API
 */
router.get(
  '/messaging/:provider/stats',
  authorize('settings:update', 'settings:read'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { provider } = req.params;
      const stats = await integrationsService.getProviderStats(tenantId, provider);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get combined stats across all integrations
 */
router.get(
  '/messaging/combined-stats/:channelType?',
  authorize('settings:update', 'settings:read'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { channelType } = req.params;
      const { integrationStatsTracker } =
        await import('../../services/integration-stats-tracker.service.js');
      const stats = await integrationStatsTracker.getCombinedStats(tenantId, channelType);
      res.json({ success: true, data: stats });
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// Connected Integrations
// =====================

/**
 * Get connected integrations
 */
router.get('/', authorize('settings:update', 'settings:read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const integrations = await integrationsService.getIntegrations(tenantId);
    res.json({ data: integrations });
  } catch (error) {
    next(error);
  }
});

/**
 * Get single integration
 */
router.get('/:id', authorize('settings:update', 'settings:read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const integration = await integrationsService.getIntegration(tenantId, id);
    res.json({ data: integration });
  } catch (error) {
    next(error);
  }
});

/**
 * Connect integration
 */
router.post('/', authorize('settings:update'), async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const schema = z.object({
      name: z.string().min(1),
      type: z.string().min(1),
      provider: z.string().min(1),
      config: z.record(z.unknown()).optional(),
      credentials: z.record(z.unknown()).optional(),
    });

    const data = schema.parse(req.body);
    const integration = await integrationsService.connectIntegration(tenantId, userId, data);
    res.status(201).json({ data: integration });
  } catch (error) {
    next(error);
  }
});

/**
 * Update integration
 */
router.patch('/:id', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const integration = await integrationsService.updateIntegration(tenantId, id, req.body);
    res.json({ data: integration });
  } catch (error) {
    next(error);
  }
});

/**
 * Disconnect integration
 */
router.delete('/:id', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    await integrationsService.disconnectIntegration(tenantId, id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Sync integration
 */
router.post('/:id/sync', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const result = await integrationsService.syncIntegration(tenantId, id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// =====================
// Webhooks
// =====================

/**
 * Get webhooks
 */
router.get('/webhooks/list', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const webhooks = await integrationsService.getWebhooks(tenantId);
    res.json({ data: webhooks });
  } catch (error) {
    next(error);
  }
});

/**
 * Get single webhook
 */
router.get('/webhooks/:id', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const webhook = await integrationsService.getWebhook(tenantId, id);
    res.json({ data: webhook });
  } catch (error) {
    next(error);
  }
});

/**
 * Create webhook
 */
router.post('/webhooks', authorize('settings:update'), async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const schema = z.object({
      name: z.string().min(1),
      url: z.string().url(),
      events: z.array(z.string()),
      headers: z.record(z.string()).optional(),
      retryPolicy: z
        .object({
          maxRetries: z.number().min(0).max(10).optional(),
          retryDelay: z.number().min(10).max(3600).optional(),
        })
        .optional(),
    });

    const data = schema.parse(req.body);
    const webhook = await integrationsService.createWebhook(tenantId, userId, data);
    res.status(201).json({ data: webhook });
  } catch (error) {
    next(error);
  }
});

/**
 * Update webhook
 */
router.patch('/webhooks/:id', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const webhook = await integrationsService.updateWebhook(tenantId, id, req.body);
    res.json({ data: webhook });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete webhook
 */
router.delete('/webhooks/:id', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    await integrationsService.deleteWebhook(tenantId, id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Test webhook
 */
router.post('/webhooks/:id/test', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { eventType } = req.body;
    const result = await integrationsService.testWebhook(tenantId, id, eventType);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Get webhook deliveries
 */
router.get('/webhooks/:id/deliveries', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { limit, offset } = req.query;

    const result = await integrationsService.getWebhookDeliveries(tenantId, id, {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Retry webhook delivery
 */
router.post(
  '/webhooks/:id/deliveries/:deliveryId/retry',
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { id, deliveryId } = req.params;
      const result = await integrationsService.retryWebhookDelivery(tenantId, id, deliveryId);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
