/**
 * Channel Connection Router
 * Unified API for connecting Email, WhatsApp, and SMS accounts
 * Supports multiple providers per channel
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { channelConnectionService } from '../../services/channel-connection.service.js';
import {
  CHANNEL_TYPES,
  getProvidersForChannel,
  getProviderById,
  detectEmailProvider,
} from '../../config/channel-providers.js';

const router = Router();

// =====================
// ROOT ENDPOINT
// =====================

/**
 * Get channel connection status
 * GET /api/v1/channel-connect
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req.user;

    res.json({
      success: true,
      data: {
        available: true,
        channels: {
          email: { connected: 0, available: true },
          whatsapp: { connected: 0, available: true },
          sms: { connected: 0, available: true },
          voice: { connected: 0, available: false },
        },
        message: 'Channel connection service is available',
      },
    });
  } catch (error) {
    next(error);
  }
});

// =====================
// Provider Discovery
// =====================

/**
 * Get all available providers for all channels
 * GET /api/v1/channel-connect/providers
 */
router.get('/providers', authenticate, async (req, res) => {
  try {
    const providers = {
      email: getProvidersForChannel(CHANNEL_TYPES.EMAIL).map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        icon: p.icon,
        color: p.color,
        requiredFields: p.requiredFields,
        notes: p.notes,
      })),
      whatsapp: getProvidersForChannel(CHANNEL_TYPES.WHATSAPP).map((p) => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        color: p.color,
        requiredFields: p.requiredFields,
        features: p.features,
        documentation: p.documentation,
      })),
      sms: getProvidersForChannel(CHANNEL_TYPES.SMS).map((p) => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        color: p.color,
        country: p.country,
        requiredFields: p.requiredFields,
        optionalFields: p.optionalFields,
        dltRequired: p.dltRequired,
        features: p.features,
        documentation: p.documentation,
      })),
    };

    return res.json({ success: true, data: providers });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get providers for a specific channel
 * GET /api/v1/channel-connect/providers/:channelType
 */
router.get('/providers/:channelType', authenticate, async (req, res) => {
  try {
    const { channelType } = req.params;
    const type = channelType.toUpperCase();

    if (!CHANNEL_TYPES[type]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid channel type. Use: email, whatsapp, sms',
      });
    }

    const providers = getProvidersForChannel(type);

    return res.json({
      success: true,
      data: providers.map((p) => ({
        id: p.id,
        name: p.name,
        icon: p.icon,
        color: p.color,
        requiredFields: p.requiredFields,
        optionalFields: p.optionalFields,
        features: p.features,
        documentation: p.documentation,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Auto-detect email provider from email address
 * POST /api/v1/channel-connect/detect-email-provider
 */
router.post('/detect-email-provider', authenticate, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Valid email address required',
      });
    }

    const provider = detectEmailProvider(email);

    return res.json({
      success: true,
      data: provider
        ? {
            detected: true,
            provider: {
              id: provider.id,
              name: provider.name,
              type: provider.type,
              icon: provider.icon,
              color: provider.color,
              requiresOAuth: provider.type === 'oauth',
            },
          }
        : {
            detected: false,
            message: 'Unknown provider - use Custom SMTP',
            provider: {
              id: 'custom_smtp',
              name: 'Custom SMTP Server',
              type: 'smtp',
            },
          },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// Connected Accounts
// =====================

/**
 * Get all connected accounts
 * GET /api/v1/channel-connect/accounts
 */
router.get('/accounts', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { channelType } = req.query;

    const accounts = await channelConnectionService.getConnectedAccounts(
      tenantId,
      channelType?.toUpperCase()
    );

    return res.json({ success: true, data: accounts });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Disconnect an account
 * DELETE /api/v1/channel-connect/accounts/:id
 */
router.delete('/accounts/:id', authenticate, async (req, res) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { channelType } = req.query;

    const result = await channelConnectionService.disconnectAccount(
      tenantId,
      id,
      channelType?.toUpperCase()
    );

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// EMAIL Connection
// =====================

const emailConnectSchema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
  provider: z.string().optional(),
  name: z.string().optional(),
  // For custom SMTP
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  imapHost: z.string().optional(),
  imapPort: z.number().optional(),
});

/**
 * Connect Email account
 * POST /api/v1/channel-connect/email
 */
router.post('/email', authenticate, async (req, res) => {
  try {
    const validation = emailConnectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const { tenantId, workspaceId } = req.user;

    const result = await channelConnectionService.connectEmailAccount(
      tenantId,
      workspaceId,
      validation.data
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Test Email connection (send test email)
 * POST /api/v1/channel-connect/email/:id/test
 */
router.post('/email/:id/test', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { toEmail } = req.body;

    if (!toEmail) {
      return res.status(400).json({
        success: false,
        error: 'toEmail is required',
      });
    }

    const result = await channelConnectionService.sendTestEmail(id, toEmail);

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// WHATSAPP Connection
// =====================

const whatsappConnectSchema = z.object({
  provider: z.enum(['msg91', 'gupshup', 'meta_cloud', 'interakt', 'twilio', 'wati']),
  name: z.string().optional(),
  // MSG91
  authKey: z.string().optional(),
  integratedNumber: z.string().optional(),
  // Gupshup
  apiKey: z.string().optional(),
  appName: z.string().optional(),
  sourceNumber: z.string().optional(),
  // Meta Cloud
  accessToken: z.string().optional(),
  phoneNumberId: z.string().optional(),
  businessAccountId: z.string().optional(),
  // Twilio
  accountSid: z.string().optional(),
  authToken: z.string().optional(),
  phoneNumber: z.string().optional(),
  // WATI
  region: z.string().optional(),
});

/**
 * Connect WhatsApp account
 * POST /api/v1/channel-connect/whatsapp
 */
router.post('/whatsapp', authenticate, async (req, res) => {
  try {
    const validation = whatsappConnectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const { tenantId, workspaceId } = req.user;

    const result = await channelConnectionService.connectWhatsAppAccount(
      tenantId,
      workspaceId,
      validation.data
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Test WhatsApp connection (send test message)
 * POST /api/v1/channel-connect/whatsapp/:id/test
 */
router.post('/whatsapp/:id/test', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { toPhone, message } = req.body;

    if (!toPhone) {
      return res.status(400).json({
        success: false,
        error: 'toPhone is required',
      });
    }

    const result = await channelConnectionService.sendTestWhatsApp(id, toPhone, message);

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// SMS Connection
// =====================

const smsConnectSchema = z.object({
  provider: z.enum(['fast2sms', 'msg91_sms', 'textlocal', '2factor', 'kaleyra', 'twilio_sms']),
  name: z.string().optional(),
  // Common
  apiKey: z.string().optional(),
  authKey: z.string().optional(),
  senderId: z.string().optional(),
  // DLT (India compliance)
  dltEntityId: z.string().optional(),
  dltTemplateId: z.string().optional(),
  // MSG91
  flowId: z.string().optional(),
  // TextLocal
  sender: z.string().optional(),
  // Kaleyra
  sid: z.string().optional(),
  // Twilio
  accountSid: z.string().optional(),
  authToken: z.string().optional(),
  phoneNumber: z.string().optional(),
});

/**
 * Connect SMS account
 * POST /api/v1/channel-connect/sms
 */
router.post('/sms', authenticate, async (req, res) => {
  try {
    const validation = smsConnectSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: validation.error.errors[0].message,
      });
    }

    const { tenantId, workspaceId } = req.user;

    const result = await channelConnectionService.connectSMSAccount(
      tenantId,
      workspaceId,
      validation.data
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Test SMS connection (send test SMS)
 * POST /api/v1/channel-connect/sms/:id/test
 */
router.post('/sms/:id/test', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { toPhone, message } = req.body;

    if (!toPhone) {
      return res.status(400).json({
        success: false,
        error: 'toPhone is required',
      });
    }

    const result = await channelConnectionService.sendTestSMS(id, toPhone, message);

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// =====================
// Quick Test (without saving)
// =====================

/**
 * Test credentials without saving
 * POST /api/v1/channel-connect/test
 */
router.post('/test', authenticate, async (req, res) => {
  try {
    const { channelType, provider, credentials } = req.body;

    if (!channelType || !provider || !credentials) {
      return res.status(400).json({
        success: false,
        error: 'channelType, provider, and credentials are required',
      });
    }

    let result;

    switch (channelType.toUpperCase()) {
      case 'EMAIL':
        result = await channelConnectionService.testEmailSMTP(credentials);
        break;
      case 'WHATSAPP':
        // Test based on provider
        const whatsappTesters = {
          msg91: async (c) => {
            const resp = await fetch('https://api.msg91.com/api/v5/whatsapp/getTemplates', {
              headers: { authkey: c.authKey },
            });
            const data = await resp.json();
            return { success: resp.ok, message: resp.ok ? 'Connected' : data.message };
          },
          gupshup: async (c) => {
            const resp = await fetch(
              `https://api.gupshup.io/sm/api/v1/template/list/${c.appName}`,
              { headers: { apikey: c.apiKey } }
            );
            const data = await resp.json();
            return { success: data.status === 'success', message: data.message || 'Connected' };
          },
          meta_cloud: async (c) => {
            const resp = await fetch(
              `https://graph.facebook.com/v18.0/${c.phoneNumberId}?access_token=${c.accessToken}`
            );
            const data = await resp.json();
            return {
              success: resp.ok && data.id,
              message: data.error?.message || 'Connected',
              phoneNumber: data.display_phone_number,
            };
          },
        };
        result = whatsappTesters[provider]
          ? await whatsappTesters[provider](credentials)
          : { success: false, error: 'Provider test not implemented' };
        break;
      case 'SMS':
        const smsTesters = {
          fast2sms: async (c) => {
            const resp = await fetch('https://www.fast2sms.com/dev/wallet', {
              headers: { authorization: c.apiKey },
            });
            const data = await resp.json();
            return { success: data.return, balance: data.wallet, message: data.message };
          },
          msg91_sms: async (c) => {
            const resp = await fetch('https://api.msg91.com/api/v5/balance.json', {
              headers: { authkey: c.authKey },
            });
            const data = await resp.json();
            return { success: resp.ok, balance: data.balance, message: data.message };
          },
          textlocal: async (c) => {
            const resp = await fetch(`https://api.textlocal.in/balance/?apiKey=${c.apiKey}`);
            const data = await resp.json();
            return { success: data.status === 'success', balance: data.balance?.sms };
          },
        };
        result = smsTesters[provider]
          ? await smsTesters[provider](credentials)
          : { success: false, error: 'Provider test not implemented' };
        break;
      default:
        return res.status(400).json({ success: false, error: 'Invalid channel type' });
    }

    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
