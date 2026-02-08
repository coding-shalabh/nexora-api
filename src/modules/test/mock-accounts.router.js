/**
 * Mock Accounts Router
 * Creates temporary mock accounts for local testing (WhatsApp, SMS, Voice, Email)
 * ONLY ENABLED IN DEVELOPMENT MODE
 */

import { Router } from 'express';
import { prisma } from '@crm360/database';
import { nanoid } from 'nanoid';
import { environmentConfig } from '../../config/environment.js';
import { logger } from '../../common/logger.js';

const router = Router();

// Only allow in development mode
router.use((req, res, next) => {
  if (!environmentConfig.isDevelopment()) {
    return res.status(403).json({
      success: false,
      error: 'Mock accounts are only available in development mode',
    });
  }
  next();
});

/**
 * GET /test/mock-accounts/status
 * Check mock mode status for all channels
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      environment: environmentConfig.mode,
      mockEnabled: {
        whatsapp: environmentConfig.channels.whatsapp.bypassMSG91,
        email:
          environmentConfig.channels.email.bypassResend ||
          environmentConfig.channels.email.bypassMSG91,
        sms:
          environmentConfig.channels.sms.bypassFast2SMS ||
          environmentConfig.channels.sms.bypassInfobip ||
          environmentConfig.channels.sms.bypassMSG91,
        voice: environmentConfig.channels.voice.bypassTeleCMI,
      },
      logOnly: {
        whatsapp: environmentConfig.channels.whatsapp.logOnly,
        email: environmentConfig.channels.email.logOnly,
        sms: environmentConfig.channels.sms.logOnly,
        voice: environmentConfig.channels.voice.logOnly,
      },
      instructions: {
        enableMockMode: 'Set these in your .env file:',
        envVars: [
          'BYPASS_WHATSAPP=true',
          'BYPASS_EMAIL=true',
          'BYPASS_SMS_MSG91=true',
          'BYPASS_VOICE=true',
          'LOG_CHANNEL_MOCKS=true (to see mock logs)',
        ],
      },
    };

    res.json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /test/mock-accounts/create
 * Create temporary mock accounts for testing
 */
router.post('/create', async (req, res) => {
  try {
    const { tenantId: bodyTenantId, workspaceId: bodyWorkspaceId } = req.body || {};
    const { tenantId: ctxTenantId, workspaceId: ctxWorkspaceId } = req.tenant || {};

    // Use provided IDs or fallback to test defaults
    const finalTenantId = bodyTenantId || ctxTenantId || 'test-tenant';
    const finalWorkspaceId = bodyWorkspaceId || ctxWorkspaceId;

    // Find or create workspace
    let workspace = await prisma.workspace.findFirst({
      where: { tenantId: finalTenantId },
    });

    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          id: finalWorkspaceId || `ws-${nanoid(10)}`,
          tenantId: finalTenantId,
          name: 'Test Workspace',
          slug: 'test-workspace',
        },
      });
    }

    const createdAccounts = [];

    // Create mock WhatsApp account
    const whatsappAccount = await prisma.channelAccount.upsert({
      where: {
        tenantId_channelType_identifier: {
          tenantId: finalTenantId,
          channelType: 'WHATSAPP',
          identifier: 'mock-whatsapp',
        },
      },
      update: {
        name: 'Mock WhatsApp',
        isActive: true,
        config: {
          mock: true,
          phoneNumber: '+1234567890',
          provider: 'mock',
        },
      },
      create: {
        tenantId: finalTenantId,
        workspaceId: workspace.id,
        channelType: 'WHATSAPP',
        name: 'Mock WhatsApp',
        identifier: 'mock-whatsapp',
        isActive: true,
        config: {
          mock: true,
          phoneNumber: '+1234567890',
          provider: 'mock',
        },
      },
    });
    createdAccounts.push(whatsappAccount);

    // Create mock SMS account
    const smsAccount = await prisma.channelAccount.upsert({
      where: {
        tenantId_channelType_identifier: {
          tenantId: finalTenantId,
          channelType: 'SMS',
          identifier: 'mock-sms',
        },
      },
      update: {
        name: 'Mock SMS',
        isActive: true,
        config: {
          mock: true,
          senderId: 'NEXORA',
          provider: 'mock',
        },
      },
      create: {
        tenantId: finalTenantId,
        workspaceId: workspace.id,
        channelType: 'SMS',
        name: 'Mock SMS',
        identifier: 'mock-sms',
        isActive: true,
        config: {
          mock: true,
          senderId: 'NEXORA',
          provider: 'mock',
        },
      },
    });
    createdAccounts.push(smsAccount);

    // Create mock Email account
    const emailAccount = await prisma.channelAccount.upsert({
      where: {
        tenantId_channelType_identifier: {
          tenantId: finalTenantId,
          channelType: 'EMAIL',
          identifier: 'mock-email',
        },
      },
      update: {
        name: 'Mock Email',
        isActive: true,
        config: {
          mock: true,
          email: 'test@mock.nexora.local',
          smtpHost: 'mock',
          provider: 'mock',
        },
      },
      create: {
        tenantId: finalTenantId,
        workspaceId: workspace.id,
        channelType: 'EMAIL',
        name: 'Mock Email',
        identifier: 'mock-email',
        isActive: true,
        config: {
          mock: true,
          email: 'test@mock.nexora.local',
          smtpHost: 'mock',
          provider: 'mock',
        },
      },
    });
    createdAccounts.push(emailAccount);

    // Create mock Voice account
    const voiceAccount = await prisma.channelAccount.upsert({
      where: {
        tenantId_channelType_identifier: {
          tenantId: finalTenantId,
          channelType: 'VOICE',
          identifier: 'mock-voice',
        },
      },
      update: {
        name: 'Mock Voice',
        isActive: true,
        config: {
          mock: true,
          phoneNumber: '+1234567890',
          provider: 'mock',
        },
      },
      create: {
        tenantId: finalTenantId,
        workspaceId: workspace.id,
        channelType: 'VOICE',
        name: 'Mock Voice',
        identifier: 'mock-voice',
        isActive: true,
        config: {
          mock: true,
          phoneNumber: '+1234567890',
          provider: 'mock',
        },
      },
    });
    createdAccounts.push(voiceAccount);

    logger.info('[Mock Accounts] Created mock channel accounts', {
      tenantId: finalTenantId,
      accounts: createdAccounts.map((a) => ({ id: a.id, type: a.channelType, name: a.name })),
    });

    res.json({
      success: true,
      message: 'Mock accounts created successfully',
      data: {
        tenantId: finalTenantId,
        workspaceId: workspace.id,
        accounts: createdAccounts.map((a) => ({
          id: a.id,
          type: a.channelType,
          name: a.name,
          identifier: a.identifier,
        })),
        usage: {
          note: 'These accounts work with mock mode. Messages are logged but not sent externally.',
          envRequired: [
            'BYPASS_WHATSAPP=true',
            'BYPASS_EMAIL=true',
            'BYPASS_SMS_MSG91=true',
            'BYPASS_VOICE=true',
          ],
        },
      },
    });
  } catch (error) {
    logger.error('[Mock Accounts] Error creating accounts', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /test/mock-accounts/send-test
 * Send a test message through mock channels
 */
router.post('/send-test', async (req, res) => {
  try {
    const { channel, to, message, subject } = req.body;

    if (!channel || !to || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: channel, to, message',
      });
    }

    // Import mock service
    const { channelMockService } = await import('../../services/channel-mock.service.js');

    let result;
    switch (channel.toLowerCase()) {
      case 'whatsapp':
        result = await channelMockService.sendWhatsApp(to, message);
        break;
      case 'email':
        result = await channelMockService.sendEmail(to, subject || 'Test Email', message);
        break;
      case 'sms':
        result = await channelMockService.sendSMS(to, message);
        break;
      case 'voice':
        result = await channelMockService.makeCall(to, { message });
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid channel. Use: whatsapp, email, sms, or voice',
        });
    }

    res.json({
      success: true,
      message: `Mock ${channel} message processed`,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /test/mock-accounts/cleanup
 * Remove all mock accounts
 */
router.delete('/cleanup', async (req, res) => {
  try {
    const deleted = await prisma.channelAccount.deleteMany({
      where: {
        identifier: {
          in: ['mock-whatsapp', 'mock-sms', 'mock-email', 'mock-voice'],
        },
      },
    });

    res.json({
      success: true,
      message: `Cleaned up ${deleted.count} mock accounts`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /test/mock-accounts/list
 * List all mock accounts
 */
router.get('/list', async (req, res) => {
  try {
    const accounts = await prisma.channelAccount.findMany({
      where: {
        identifier: {
          in: ['mock-whatsapp', 'mock-sms', 'mock-email', 'mock-voice'],
        },
      },
      select: {
        id: true,
        tenantId: true,
        channelType: true,
        name: true,
        identifier: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: accounts,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
