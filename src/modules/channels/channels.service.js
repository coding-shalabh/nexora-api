/**
 * Channels Service
 * Business logic for channel management and messaging
 */

import { prisma } from '@crm360/database';
import { NotFoundError, ValidationError } from '@crm360/shared';
import {
  channelService,
  channelRegistry,
  rateLimiter,
  usageMeter,
} from '../../common/providers/channels/index.js';
import { logger } from '../../common/logger.js';
import { eventBus, createEvent } from '../../common/events/event-bus.js';

class ChannelsService {
  constructor() {
    this.logger = logger.child({ service: 'ChannelsService' });
    this.initialized = false;
  }

  /**
   * Initialize the channels service
   */
  async initialize() {
    if (this.initialized) return;
    await channelService.initialize();
    this.initialized = true;
  }

  // =====================
  // Channel Account Management
  // =====================

  async getChannelAccounts(tenantId, workspaceId, channelType = null) {
    const where = { tenantId };
    if (channelType) where.type = channelType;

    const accounts = await prisma.channelAccount.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        provider: true,
        phoneNumber: true,
        emailAddress: true,
        senderId: true,
        status: true,
        healthStatus: true,
        lastHealthCheck: true,
        whatsappSetupMode: true,
        msg91AuthKey: true,
        isConfigComplete: true,
        createdAt: true,
        updatedAt: true,
        lastSyncAt: true,
      },
    });

    // Transform data for frontend
    const data = accounts.map((account) => ({
      id: account.id,
      name: account.name,
      channelType: account.type,
      provider: account.provider,
      status: account.status,
      healthStatus: account.healthStatus,
      lastHealthCheck: account.lastHealthCheck,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      lastSyncAt: account.lastSyncAt,
      credentials: {
        phoneNumber: account.phoneNumber,
        email: account.emailAddress,
        senderId: account.senderId,
        authKey: account.msg91AuthKey ? '••••••••' : null,
      },
      settings: {
        setupMode: account.whatsappSetupMode,
        isConfigComplete: account.isConfigComplete,
      },
      stats: {
        messagesSent: 0,
        messagesReceived: 0,
        activeConversations: 0,
      },
    }));

    return { success: true, data };
  }

  async getChannelAccount(tenantId, id) {
    const account = await prisma.channelAccount.findFirst({
      where: { id, tenantId },
    });

    if (!account) {
      throw new NotFoundError('Channel account not found');
    }

    // Don't expose sensitive credentials
    const { credentials, ...safeAccount } = account;
    safeAccount.hasCredentials = !!credentials;

    return safeAccount;
  }

  async createChannelAccount({
    tenantId,
    workspaceId,
    userId,
    name,
    channelType,
    identifier,
    credentials,
    dltEntityId,
    dltTemplateId,
    metadata = {},
  }) {
    // Validate channel type
    if (!['WHATSAPP', 'SMS', 'EMAIL', 'VOICE'].includes(channelType)) {
      throw new ValidationError('Invalid channel type');
    }

    // Check for duplicate identifier
    const existing = await prisma.channelAccount.findFirst({
      where: { tenantId, channelType, identifier },
    });

    if (existing) {
      throw new ValidationError('Channel account with this identifier already exists');
    }

    const account = await prisma.channelAccount.create({
      data: {
        tenantId,
        workspaceId,
        name,
        channelType,
        identifier,
        credentials,
        dltEntityId,
        dltTemplateId,
        metadata,
        isEnabled: true,
        healthStatus: 'UNKNOWN',
      },
    });

    // Validate credentials
    try {
      const result = await this.validateChannelCredentials(tenantId, account.id);
      await prisma.channelAccount.update({
        where: { id: account.id },
        data: {
          healthStatus: result.valid ? 'HEALTHY' : 'ERROR',
          lastHealthCheck: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn({ error, accountId: account.id }, 'Failed to validate new channel');
    }

    return account;
  }

  async updateChannelAccount(tenantId, id, data) {
    const account = await prisma.channelAccount.findFirst({
      where: { id, tenantId },
    });

    if (!account) {
      throw new NotFoundError('Channel account not found');
    }

    const updated = await prisma.channelAccount.update({
      where: { id },
      data,
    });

    // Invalidate cached adapter if credentials changed
    if (data.credentials) {
      channelRegistry.invalidateAdapter(id);
    }

    return updated;
  }

  async deleteChannelAccount(tenantId, id) {
    const account = await prisma.channelAccount.findFirst({
      where: { id, tenantId },
    });

    if (!account) {
      throw new NotFoundError('Channel account not found');
    }

    // Soft delete - set status to INACTIVE instead of hard delete
    await prisma.channelAccount.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    channelRegistry.invalidateAdapter(id);
  }

  async validateChannelCredentials(tenantId, id) {
    const adapter = await channelRegistry.getAdapter(id);
    const result = await adapter.validateCredentials();

    await prisma.channelAccount.update({
      where: { id },
      data: {
        healthStatus: result.valid ? 'HEALTHY' : 'ERROR',
        lastHealthCheck: new Date(),
      },
    });

    return result;
  }

  async getChannelHealth(tenantId, id) {
    const adapter = await channelRegistry.getAdapter(id);
    return adapter.getHealthStatus();
  }

  // =====================
  // Messaging
  // =====================

  async sendMessage(params) {
    await this.initialize();
    return channelService.sendMessage(params);
  }

  async sendTemplate(params) {
    await this.initialize();
    return channelService.sendTemplate(params);
  }

  // =====================
  // Webhook Processing
  // =====================

  async processInboundWebhook(channelAccountId, payload) {
    await this.initialize();
    return channelService.processInboundWebhook(channelAccountId, payload);
  }

  async processStatusWebhook(channelAccountId, payload) {
    await this.initialize();
    return channelService.processStatusWebhook(channelAccountId, payload);
  }

  async processVoiceStatusWebhook(channelAccountId, payload) {
    const adapter = await channelRegistry.getAdapter(channelAccountId);
    return adapter.parseStatusWebhook(payload);
  }

  async processIncomingCall(channelAccountId, payload) {
    const adapter = await channelRegistry.getAdapter(channelAccountId);
    return adapter.handleIncomingCall(payload);
  }

  async processEmailEvents(channelAccountId, events) {
    // Process email tracking events (opens, clicks, bounces)
    for (const event of events) {
      if (event.type === 'open') {
        await this.processEmailOpen(channelAccountId, event);
      } else if (event.type === 'click') {
        await this.processEmailClick(channelAccountId, event);
      } else if (event.type === 'bounce') {
        await this.processEmailBounce(channelAccountId, event);
      } else if (event.type === 'complaint') {
        await this.processEmailComplaint(channelAccountId, event);
      }
    }
  }

  async processEmailOpen(channelAccountId, event) {
    const messageEvent = await prisma.messageEvent.findFirst({
      where: { externalId: event.messageId },
    });

    if (messageEvent) {
      await prisma.messageEvent.update({
        where: { id: messageEvent.id },
        data: { readAt: new Date() },
      });
    }
  }

  async processEmailClick(channelAccountId, event) {
    const messageEvent = await prisma.messageEvent.findFirst({
      where: { externalId: event.messageId },
    });

    if (messageEvent) {
      const clicks = messageEvent.metadata?.clicks || [];
      clicks.push({
        url: event.url,
        timestamp: new Date(),
      });

      await prisma.messageEvent.update({
        where: { id: messageEvent.id },
        data: {
          metadata: {
            ...messageEvent.metadata,
            clicks,
          },
        },
      });
    }
  }

  async processEmailBounce(channelAccountId, event) {
    const messageEvent = await prisma.messageEvent.findFirst({
      where: { externalId: event.messageId },
    });

    if (messageEvent) {
      await prisma.messageEvent.update({
        where: { id: messageEvent.id },
        data: {
          status: 'FAILED',
          errorCode: 'BOUNCED',
          errorMessage: event.reason,
        },
      });
    }
  }

  async processEmailComplaint(channelAccountId, event) {
    // Record opt-out
    const channelAccount = await prisma.channelAccount.findUnique({
      where: { id: channelAccountId },
    });

    if (channelAccount) {
      await this.recordOptOut(channelAccountId, {
        identifier: event.recipient,
        channelType: 'EMAIL',
        source: 'COMPLAINT',
      });
    }
  }

  async processGmailPush(channelAccountId, payload) {
    // Gmail push notifications for new messages
    // Decode the push notification and sync new messages
    const message = payload.message;
    if (message && message.data) {
      const data = JSON.parse(Buffer.from(message.data, 'base64').toString());
      this.logger.info({ data }, 'Gmail push notification received');
      // TODO: Implement email sync
    }
  }

  async processMicrosoftNotifications(channelAccountId, payload) {
    // Microsoft Graph change notifications
    if (payload.value) {
      for (const notification of payload.value) {
        this.logger.info({ notification }, 'Microsoft notification received');
        // TODO: Implement email sync
      }
    }
  }

  // =====================
  // Opt-out Management
  // =====================

  async recordOptOut(channelAccountId, { identifier, channelType, source }) {
    const channelAccount = await prisma.channelAccount.findUnique({
      where: { id: channelAccountId },
    });

    if (!channelAccount) {
      throw new NotFoundError('Channel account not found');
    }

    await channelService.recordOptOut(channelAccount.tenantId, channelType, identifier, source);
  }

  // =====================
  // Usage & Analytics
  // =====================

  async getUsageSummary(tenantId, workspaceId, startDate, endDate) {
    return usageMeter.getUsageSummary(tenantId, workspaceId, startDate, endDate);
  }

  async getRateLimitStatus(tenantId, channelAccountId) {
    const account = await prisma.channelAccount.findFirst({
      where: { id: channelAccountId, tenantId },
    });

    if (!account) {
      throw new NotFoundError('Channel account not found');
    }

    return rateLimiter.getStatus(channelAccountId, account.channelType);
  }

  // =====================
  // DLT Compliance (India SMS)
  // =====================

  async getDltSettings(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    return (
      tenant?.settings?.dltConfig || {
        entityId: null,
        senderIds: [],
        templates: [],
      }
    );
  }

  async updateDltSettings(tenantId, dltConfig) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const currentSettings = tenant?.settings || {};

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...currentSettings,
          dltConfig,
        },
      },
    });

    return dltConfig;
  }

  async addDltSenderId(tenantId, { senderId, entityId, description }) {
    const settings = await this.getDltSettings(tenantId);
    const senderIds = settings.senderIds || [];

    // Check for duplicate
    if (senderIds.find((s) => s.senderId === senderId)) {
      throw new ValidationError('Sender ID already exists');
    }

    senderIds.push({
      id: `dlt_sender_${Date.now()}`,
      senderId,
      entityId,
      description,
      isActive: true,
      createdAt: new Date(),
    });

    await this.updateDltSettings(tenantId, { ...settings, senderIds });
    return senderIds;
  }

  async removeDltSenderId(tenantId, senderId) {
    const settings = await this.getDltSettings(tenantId);
    const senderIds = (settings.senderIds || []).filter((s) => s.senderId !== senderId);
    await this.updateDltSettings(tenantId, { ...settings, senderIds });
    return senderIds;
  }

  async addDltTemplate(tenantId, { templateId, name, content, senderId, category }) {
    const settings = await this.getDltSettings(tenantId);
    const templates = settings.templates || [];

    if (templates.find((t) => t.templateId === templateId)) {
      throw new ValidationError('DLT Template ID already exists');
    }

    templates.push({
      id: `dlt_tpl_${Date.now()}`,
      templateId,
      name,
      content,
      senderId,
      category,
      isActive: true,
      createdAt: new Date(),
    });

    await this.updateDltSettings(tenantId, { ...settings, templates });
    return templates;
  }

  async removeDltTemplate(tenantId, templateId) {
    const settings = await this.getDltSettings(tenantId);
    const templates = (settings.templates || []).filter((t) => t.templateId !== templateId);
    await this.updateDltSettings(tenantId, { ...settings, templates });
    return templates;
  }

  // =====================
  // Email OAuth Management
  // =====================

  async initiateGmailOAuth(tenantId, workspaceId, redirectUri) {
    // Generate OAuth URL for Gmail
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ];

    const state = Buffer.from(
      JSON.stringify({ tenantId, workspaceId, provider: 'gmail' })
    ).toString('base64');

    const oauthUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${process.env.GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes.join(' '))}` +
      `&state=${state}` +
      `&access_type=offline` +
      `&prompt=consent`;

    return { url: oauthUrl, state };
  }

  async initiateMicrosoftOAuth(tenantId, workspaceId, redirectUri) {
    // Generate OAuth URL for Microsoft 365
    const scopes = [
      'https://graph.microsoft.com/Mail.Read',
      'https://graph.microsoft.com/Mail.Send',
      'https://graph.microsoft.com/Mail.ReadWrite',
      'offline_access',
    ];

    const state = Buffer.from(
      JSON.stringify({ tenantId, workspaceId, provider: 'microsoft' })
    ).toString('base64');

    const oauthUrl =
      `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${process.env.MICROSOFT_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes.join(' '))}` +
      `&state=${state}` +
      `&response_mode=query`;

    return { url: oauthUrl, state };
  }

  async completeEmailOAuth(code, state) {
    const { tenantId, workspaceId, provider } = JSON.parse(Buffer.from(state, 'base64').toString());

    if (provider === 'gmail') {
      return this.completeGmailOAuth(tenantId, workspaceId, code);
    } else if (provider === 'microsoft') {
      return this.completeMicrosoftOAuth(tenantId, workspaceId, code);
    }

    throw new ValidationError('Unknown OAuth provider');
  }

  async completeGmailOAuth(tenantId, workspaceId, code) {
    // Exchange code for tokens (in production, call Google's token endpoint)
    // For now, return mock data structure
    const tokenData = {
      access_token: 'gmail_access_token',
      refresh_token: 'gmail_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer',
    };

    // Get user info
    const emailAddress = 'user@gmail.com'; // Would come from Google API

    // Create channel account
    const account = await this.createChannelAccount({
      tenantId,
      workspaceId,
      name: `Gmail - ${emailAddress}`,
      channelType: 'EMAIL',
      identifier: emailAddress,
      credentials: {
        provider: 'gmail',
        ...tokenData,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
      metadata: {
        provider: 'gmail',
        email: emailAddress,
      },
    });

    // Set up Gmail push notifications (watch)
    await this.setupGmailWatch(account.id);

    return account;
  }

  async completeMicrosoftOAuth(tenantId, workspaceId, code) {
    // Exchange code for tokens
    const tokenData = {
      access_token: 'microsoft_access_token',
      refresh_token: 'microsoft_refresh_token',
      expires_in: 3600,
      token_type: 'Bearer',
    };

    const emailAddress = 'user@outlook.com';

    const account = await this.createChannelAccount({
      tenantId,
      workspaceId,
      name: `Microsoft 365 - ${emailAddress}`,
      channelType: 'EMAIL',
      identifier: emailAddress,
      credentials: {
        provider: 'microsoft',
        ...tokenData,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
      metadata: {
        provider: 'microsoft',
        email: emailAddress,
      },
    });

    // Set up Microsoft Graph subscription
    await this.setupMicrosoftSubscription(account.id);

    return account;
  }

  async setupGmailWatch(channelAccountId) {
    // Set up Gmail push notifications
    // In production, call Gmail API to create watch
    const watchExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.channelAccount.update({
      where: { id: channelAccountId },
      data: {
        metadata: {
          watchExpiry: watchExpiry.toISOString(),
          lastSync: new Date().toISOString(),
        },
      },
    });

    this.logger.info({ channelAccountId }, 'Gmail watch setup complete');
  }

  async setupMicrosoftSubscription(channelAccountId) {
    // Set up Microsoft Graph subscription
    const subscriptionExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

    await prisma.channelAccount.update({
      where: { id: channelAccountId },
      data: {
        metadata: {
          subscriptionExpiry: subscriptionExpiry.toISOString(),
          lastSync: new Date().toISOString(),
        },
      },
    });

    this.logger.info({ channelAccountId }, 'Microsoft subscription setup complete');
  }

  async refreshEmailTokens(channelAccountId) {
    const account = await prisma.channelAccount.findUnique({
      where: { id: channelAccountId },
    });

    if (!account || account.channelType !== 'EMAIL') {
      throw new NotFoundError('Email channel not found');
    }

    const { provider, refresh_token } = account.credentials;

    // Refresh tokens based on provider
    // In production, call respective token refresh endpoints

    this.logger.info({ channelAccountId, provider }, 'Email tokens refreshed');
  }

  // =====================
  // Voice/Call Settings
  // =====================

  async getVoiceSettings(tenantId, channelAccountId) {
    const account = await prisma.channelAccount.findFirst({
      where: { id: channelAccountId, tenantId, type: 'VOICE' },
    });

    if (!account) {
      throw new NotFoundError('Voice channel not found');
    }

    return {
      callerId: account.identifier,
      callMasking: account.metadata?.callMasking || false,
      recordCalls: account.metadata?.recordCalls || true,
      voicemailEnabled: account.metadata?.voicemailEnabled || false,
      workingHours: account.metadata?.workingHours || null,
      dispositionsRequired: account.metadata?.dispositionsRequired || true,
      dispositions: account.metadata?.dispositions || [
        'Answered - Interested',
        'Answered - Not Interested',
        'Answered - Call Back',
        'No Answer',
        'Busy',
        'Voicemail',
        'Wrong Number',
      ],
    };
  }

  async updateVoiceSettings(tenantId, channelAccountId, settings) {
    const account = await prisma.channelAccount.findFirst({
      where: { id: channelAccountId, tenantId, type: 'VOICE' },
    });

    if (!account) {
      throw new NotFoundError('Voice channel not found');
    }

    await prisma.channelAccount.update({
      where: { id: channelAccountId },
      data: {
        metadata: {
          ...account.metadata,
          ...settings,
        },
      },
    });

    return settings;
  }

  // =====================
  // Channel Statistics
  // =====================

  async getChannelStats(tenantId, channelAccountId, period = '7d') {
    const account = await prisma.channelAccount.findFirst({
      where: { id: channelAccountId, tenantId },
    });

    if (!account) {
      throw new NotFoundError('Channel account not found');
    }

    const periodDays = parseInt(period) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const stats = await prisma.messageEvent.groupBy({
      by: ['status'],
      where: {
        channelAccountId,
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    const totalMessages = stats.reduce((sum, s) => sum + s._count, 0);
    const delivered = stats.find((s) => s.status === 'DELIVERED')?._count || 0;
    const read = stats.find((s) => s.status === 'READ')?._count || 0;
    const failed = stats.find((s) => s.status === 'FAILED')?._count || 0;

    return {
      period,
      totalMessages,
      delivered,
      read,
      failed,
      deliveryRate: totalMessages ? ((delivered / totalMessages) * 100).toFixed(1) : 0,
      readRate: delivered ? ((read / delivered) * 100).toFixed(1) : 0,
    };
  }

  // =====================
  // Channel Configuration Status
  // =====================

  /**
   * Get channel configuration status for all channels
   * Returns whether each channel is configured and ready
   */
  async getChannelConfigStatus(tenantId) {
    // Get tenant with channel config fields, active channel accounts, and existing channels with conversations
    const [tenant, channelAccounts, channelsWithConversations] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          hasWhatsApp: true,
          whatsAppSetupMode: true,
          whatsAppConfigStatus: true,
          whatsAppAccountId: true,
          hasSMS: true,
          smsConfigStatus: true,
          smsAccountId: true,
          hasEmail: true,
          emailConfigStatus: true,
          emailAccountId: true,
          hasVoice: true,
          voiceConfigStatus: true,
          voiceAccountId: true,
          hasAnyChannelReady: true,
        },
      }),
      prisma.channelAccount.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          // Only include channels with valid ChannelAccountType values
          type: {
            in: ['WHATSAPP', 'SMS', 'VOICE', 'EMAIL_GMAIL', 'EMAIL_MICROSOFT', 'EMAIL_SMTP'],
          },
        },
        select: {
          id: true,
          type: true,
          name: true,
        },
      }),
      // Also check for existing channels that have conversations (indicates channel is working)
      prisma.channel.findMany({
        where: {
          tenantId,
          conversations: { some: {} },
        },
        select: {
          type: true,
        },
      }),
    ]);

    // Group active accounts by channel type
    const hasActiveWhatsApp = channelAccounts.some((a) => a.type === 'WHATSAPP');
    const hasActiveSMS = channelAccounts.some((a) => a.type === 'SMS');
    const hasActiveEmail = channelAccounts.some(
      (a) => a.type === 'EMAIL_GMAIL' || a.type === 'EMAIL_MICROSOFT' || a.type === 'EMAIL_SMTP'
    );
    const hasActiveVoice = channelAccounts.some((a) => a.type === 'VOICE');

    // Check for channels with existing conversations (indicates channel is functional)
    const hasWhatsAppConversations = channelsWithConversations.some((c) => c.type === 'WHATSAPP');
    const hasSMSConversations = channelsWithConversations.some((c) => c.type === 'SMS');
    const hasEmailConversations = channelsWithConversations.some((c) => c.type === 'EMAIL');
    // Note: VOICE is not a valid ChannelType, so no voice conversations check

    if (!tenant) {
      // Return status based on active channel accounts and conversations
      return {
        whatsapp: {
          configured: hasActiveWhatsApp || hasWhatsAppConversations,
          status: hasActiveWhatsApp || hasWhatsAppConversations ? 'READY' : 'NOT_STARTED',
        },
        sms: {
          configured: hasActiveSMS || hasSMSConversations,
          status: hasActiveSMS || hasSMSConversations ? 'READY' : 'NOT_STARTED',
        },
        email: {
          configured: hasActiveEmail || hasEmailConversations,
          status: hasActiveEmail || hasEmailConversations ? 'READY' : 'NOT_STARTED',
        },
        voice: { configured: hasActiveVoice, status: hasActiveVoice ? 'READY' : 'NOT_STARTED' },
      };
    }

    // Check tenant flags, active channel accounts, AND existing conversations
    const whatsappConfigured =
      (tenant.hasWhatsApp && tenant.whatsAppConfigStatus === 'READY') ||
      hasActiveWhatsApp ||
      hasWhatsAppConversations;
    const smsConfigured =
      (tenant.hasSMS && tenant.smsConfigStatus === 'READY') || hasActiveSMS || hasSMSConversations;
    const emailConfigured =
      (tenant.hasEmail && tenant.emailConfigStatus === 'READY') ||
      hasActiveEmail ||
      hasEmailConversations;
    // Voice requires an actual account - can't have voice without integration
    const voiceConfigured =
      (tenant.hasVoice && tenant.voiceConfigStatus === 'READY' && tenant.voiceAccountId) ||
      hasActiveVoice;

    return {
      whatsapp: {
        configured: whatsappConfigured,
        status: whatsappConfigured ? 'READY' : tenant.whatsAppConfigStatus || 'NOT_STARTED',
        setupMode: tenant.whatsAppSetupMode,
        accountId: tenant.whatsAppAccountId,
      },
      sms: {
        configured: smsConfigured,
        status: smsConfigured ? 'READY' : tenant.smsConfigStatus || 'NOT_STARTED',
        accountId: tenant.smsAccountId,
      },
      email: {
        configured: emailConfigured,
        status: emailConfigured ? 'READY' : tenant.emailConfigStatus || 'NOT_STARTED',
        accountId: tenant.emailAccountId,
      },
      voice: {
        configured: voiceConfigured,
        status: voiceConfigured ? 'READY' : tenant.voiceConfigStatus || 'NOT_STARTED',
        accountId: tenant.voiceAccountId,
      },
    };
  }

  // =====================
  // WhatsApp Configuration
  // =====================

  /**
   * Get WhatsApp configuration for tenant
   */
  async getWhatsAppConfig(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        hasWhatsApp: true,
        whatsAppSetupMode: true,
        whatsAppConfigStatus: true,
        whatsAppAccountId: true,
        whatsAppReadyAt: true,
      },
    });

    if (!tenant) {
      return {
        configured: false,
        status: 'NOT_STARTED',
        setupMode: null,
        fieldMappings: null,
      };
    }

    // Get WhatsApp channel account if exists
    let accountDetails = null;
    let fieldMappings = null;

    if (tenant.whatsAppAccountId) {
      const account = await prisma.channelAccount.findUnique({
        where: { id: tenant.whatsAppAccountId },
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          type: true,
          status: true,
          healthStatus: true,
          providerConfig: true,
          msg91AuthKey: true,
          whatsappSetupMode: true,
        },
      });

      if (account) {
        accountDetails = {
          id: account.id,
          name: account.name,
          phoneNumber: account.phoneNumber,
          isEnabled: account.status === 'ACTIVE',
          healthStatus: account.healthStatus,
          provider: account.providerConfig?.provider || 'msg91',
        };
        fieldMappings = account.providerConfig?.fieldMappings || null;
      }
    }

    return {
      configured: tenant.hasWhatsApp && tenant.whatsAppConfigStatus === 'READY',
      status: tenant.whatsAppConfigStatus || 'NOT_STARTED',
      setupMode: tenant.whatsAppSetupMode,
      readyAt: tenant.whatsAppReadyAt,
      account: accountDetails,
      fieldMappings,
    };
  }

  /**
   * Configure WhatsApp channel
   * Handles Self-Service, Managed, and BYOK modes
   */
  async configureWhatsApp({
    tenantId,
    workspaceId,
    userId,
    setupMode,
    provider = 'msg91',
    authKey,
    apiKey,
    apiSecret,
    accountSid,
    phoneNumber,
    phoneNumberId,
    senderId,
    webhookSecret,
    apiEndpoint,
    fieldMappings,
    managedRequest,
  }) {
    const setupModeMap = {
      self_service: 'SELF_SERVICE',
      managed: 'MANAGED',
      byok: 'BYOK',
    };
    const normalizedSetupMode = setupModeMap[setupMode] || setupMode;

    // For managed requests, just save the request and set status to PENDING
    if (normalizedSetupMode === 'MANAGED') {
      return this.submitManagedSetupRequest({
        tenantId,
        workspaceId,
        userId,
        ...managedRequest,
        fieldMappings,
      });
    }

    // Build credentials based on provider
    let credentials = {};
    if (provider === 'msg91' || normalizedSetupMode === 'SELF_SERVICE') {
      credentials = {
        authKey,
        senderId,
      };
    } else if (provider === 'twilio') {
      credentials = {
        accountSid,
        authToken: apiSecret || apiKey,
      };
    } else {
      // Generic BYOK provider
      credentials = {
        apiKey,
        apiSecret,
        webhookSecret,
        apiEndpoint,
      };
    }

    // Create or update channel account
    let account = await prisma.channelAccount.findFirst({
      where: {
        tenantId,
        type: 'WHATSAPP',
      },
    });

    if (account) {
      // Update existing account
      account = await prisma.channelAccount.update({
        where: { id: account.id },
        data: {
          name: `WhatsApp - ${phoneNumber || senderId || 'Business'}`,
          phoneNumber: phoneNumber,
          msg91AuthKey: authKey,
          msg91SenderId: senderId,
          whatsappSetupMode: normalizedSetupMode,
          providerConfig: {
            ...account.providerConfig,
            provider,
            phoneNumberId,
            fieldMappings,
            updatedBy: userId,
            updatedAt: new Date(),
          },
          status: 'ACTIVE',
        },
      });
    } else {
      // Create new account
      account = await prisma.channelAccount.create({
        data: {
          tenantId,
          name: `WhatsApp - ${phoneNumber || senderId || 'Business'}`,
          type: 'WHATSAPP',
          provider: provider || 'msg91',
          phoneNumber: phoneNumber,
          msg91AuthKey: authKey,
          msg91SenderId: senderId,
          whatsappSetupMode: normalizedSetupMode,
          providerConfig: {
            provider,
            phoneNumberId,
            fieldMappings,
            createdBy: userId,
          },
          status: 'ACTIVE',
          healthStatus: 'UNKNOWN',
        },
      });
    }

    // Update tenant configuration
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        hasWhatsApp: true,
        whatsAppSetupMode: normalizedSetupMode,
        whatsAppConfigStatus: 'READY',
        whatsAppAccountId: account.id,
        whatsAppReadyAt: new Date(),
        hasAnyChannelReady: true,
      },
    });

    // Validate credentials
    try {
      const testResult = await this.testWhatsAppConnection({
        tenantId,
        provider,
        authKey,
        apiKey,
        accountSid,
        apiSecret,
      });

      await prisma.channelAccount.update({
        where: { id: account.id },
        data: {
          healthStatus: testResult.valid ? 'HEALTHY' : 'ERROR',
          lastHealthCheck: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn({ error, accountId: account.id }, 'Failed to validate WhatsApp credentials');
    }

    this.logger.info(
      { tenantId, accountId: account.id, setupMode: normalizedSetupMode },
      'WhatsApp configured'
    );

    return {
      success: true,
      accountId: account.id,
      phoneNumber,
      setupMode: normalizedSetupMode,
      status: 'READY',
    };
  }

  /**
   * Test WhatsApp connection with provider
   */
  async testWhatsAppConnection({ tenantId, provider, authKey, apiKey, accountSid, apiSecret }) {
    try {
      if (provider === 'msg91') {
        // Test MSG91 connection using validate.php endpoint
        if (!authKey) {
          return { valid: false, error: 'Auth key is required' };
        }

        // Use MSG91 validate.php endpoint
        // Returns "Valid" for valid keys, "201" for invalid keys
        const response = await fetch(
          `https://api.msg91.com/api/validate.php?authkey=${encodeURIComponent(authKey)}`,
          { method: 'GET' }
        );

        const responseText = await response.text();
        const trimmedResponse = responseText.trim().toLowerCase();

        this.logger.info(
          { responseStatus: response.status, responseText: trimmedResponse },
          'MSG91 validate response'
        );

        if (trimmedResponse === 'valid') {
          return {
            valid: true,
            message: 'MSG91 credentials are valid',
          };
        }

        // Any other response means invalid key
        return {
          valid: false,
          error: 'Invalid MSG91 auth key',
        };
      } else if (provider === 'twilio') {
        // Test Twilio connection
        if (!accountSid || !apiSecret) {
          return { valid: false, error: 'Account SID and Auth Token are required' };
        }

        const credentials = Buffer.from(`${accountSid}:${apiSecret}`).toString('base64');
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
          {
            method: 'GET',
            headers: {
              Authorization: `Basic ${credentials}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          return {
            valid: true,
            message: 'Twilio credentials are valid',
            accountName: data.friendly_name,
          };
        } else {
          return {
            valid: false,
            error: 'Invalid Twilio credentials',
          };
        }
      } else {
        // For other providers, just check that required fields are present
        if (!apiKey) {
          return { valid: false, error: 'API key is required' };
        }

        return {
          valid: true,
          message: 'Credentials saved. Please test by sending a message.',
          warning: 'Automatic validation not available for this provider',
        };
      }
    } catch (error) {
      this.logger.error({ error, provider }, 'WhatsApp connection test failed');
      return {
        valid: false,
        error: error.message || 'Connection test failed',
      };
    }
  }

  /**
   * Get MSG91 account balance and info
   */
  async getMsg91Balance(tenantId) {
    try {
      // Get WhatsApp channel account
      const account = await prisma.channelAccount.findFirst({
        where: {
          tenantId,
          type: 'WHATSAPP',
          provider: 'MSG91',
        },
      });

      if (!account || !account.msg91AuthKey) {
        return { balance: null, error: 'No MSG91 account configured' };
      }

      const authKey = account.msg91AuthKey;

      // Try WhatsApp prepaid balance API first
      try {
        const balanceResponse = await fetch(
          'https://api.msg91.com/api/v5/whatsapp/check-whatsapp-prepaid-balance',
          {
            method: 'POST',
            headers: {
              authkey: authKey,
            },
          }
        );

        const balanceData = await balanceResponse.json();
        this.logger.info({ balanceData }, 'MSG91 WhatsApp balance response');

        if (balanceData && !balanceData.hasError && balanceData.data) {
          return {
            balance: balanceData.data?.balance || balanceData.balance,
            currency: balanceData.data?.currency || 'INR',
            accountInfo: balanceData.data,
          };
        }
      } catch (waErr) {
        this.logger.warn({ error: waErr }, 'WhatsApp balance API failed, trying SMS balance');
      }

      // Fallback to SMS balance API
      const smsBalanceResponse = await fetch(
        `https://api.msg91.com/api/balance.php?authkey=${encodeURIComponent(authKey)}&type=1`,
        { method: 'GET' }
      );

      const responseText = await smsBalanceResponse.text();
      this.logger.info({ responseText }, 'MSG91 SMS balance response');

      const balance = parseFloat(responseText);

      if (isNaN(balance)) {
        // Try parsing as JSON in case it's a JSON error response
        try {
          const jsonResponse = JSON.parse(responseText);
          return { balance: null, error: jsonResponse.message || 'Invalid response' };
        } catch {
          return { balance: null, error: responseText };
        }
      }

      return { balance, currency: 'INR' };
    } catch (error) {
      this.logger.error({ error }, 'Failed to get MSG91 balance');
      return { balance: null, error: error.message };
    }
  }

  /**
   * Update WhatsApp field mappings
   */
  async updateWhatsAppMappings(tenantId, mappings) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { whatsAppAccountId: true },
    });

    if (!tenant?.whatsAppAccountId) {
      throw new NotFoundError('WhatsApp is not configured');
    }

    const account = await prisma.channelAccount.update({
      where: { id: tenant.whatsAppAccountId },
      data: {
        metadata: {
          ...((await prisma.channelAccount.findUnique({ where: { id: tenant.whatsAppAccountId } }))
            ?.metadata || {}),
          fieldMappings: mappings,
          mappingsUpdatedAt: new Date(),
        },
      },
    });

    this.logger.info({ tenantId, accountId: account.id }, 'WhatsApp field mappings updated');

    return {
      success: true,
      mappings,
    };
  }

  /**
   * Submit managed setup request
   */
  async submitManagedSetupRequest({
    tenantId,
    workspaceId,
    userId,
    businessName,
    contactEmail,
    contactPhone,
    expectedVolume,
    notes,
    fieldMappings,
  }) {
    // Get current tenant settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const currentSettings = tenant?.settings || {};

    // Save the managed request in tenant settings JSON field
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        whatsAppSetupMode: 'MANAGED',
        whatsAppConfigStatus: 'PENDING_VERIFICATION',
        settings: {
          ...currentSettings,
          whatsappManagedRequest: {
            businessName,
            contactEmail,
            contactPhone,
            expectedVolume,
            notes,
            fieldMappings,
            requestedBy: userId,
            requestedAt: new Date(),
            status: 'PENDING',
          },
        },
      },
    });

    this.logger.info(
      { tenantId, businessName, contactEmail },
      'WhatsApp managed setup request submitted'
    );

    // TODO: Send notification email to admin about new managed setup request

    return {
      success: true,
      message: 'Your request has been submitted. Our team will contact you within 24-48 hours.',
      status: 'PENDING_VERIFICATION',
    };
  }

  /**
   * Configure Voice channel
   * Handles Self-Service (MSG91) mode
   */
  async configureVoice({
    tenantId,
    workspaceId,
    userId,
    setupMode,
    provider = 'msg91',
    msg91AuthKey,
    callerId,
    name,
    enableRecording = true,
    enableCallMasking = false,
    requireDisposition = false,
  }) {
    const setupModeMap = {
      self_service: 'SELF_SERVICE',
      managed: 'MANAGED',
      byok: 'BYOK',
    };
    const normalizedSetupMode =
      setupModeMap[setupMode?.toLowerCase()] || setupMode || 'SELF_SERVICE';

    // Create or update channel account
    let account = await prisma.channelAccount.findFirst({
      where: {
        tenantId,
        type: 'VOICE',
      },
    });

    const accountData = {
      name: name || `Voice - ${callerId || 'Sales Team'}`,
      phoneNumber: callerId,
      msg91AuthKey: msg91AuthKey,
      provider: provider || 'msg91',
      providerConfig: {
        provider,
        callerId,
        enableRecording,
        enableCallMasking,
        requireDisposition,
        updatedBy: userId,
        updatedAt: new Date(),
      },
      status: 'ACTIVE',
      healthStatus: 'UNKNOWN',
    };

    if (account) {
      account = await prisma.channelAccount.update({
        where: { id: account.id },
        data: accountData,
      });
    } else {
      account = await prisma.channelAccount.create({
        data: {
          tenantId,
          type: 'VOICE',
          ...accountData,
          providerConfig: {
            ...accountData.providerConfig,
            createdBy: userId,
          },
        },
      });
    }

    // Update tenant configuration
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        hasVoice: true,
        voiceConfigStatus: 'READY',
        voiceAccountId: account.id,
        hasAnyChannelReady: true,
      },
    });

    this.logger.info(
      { tenantId, accountId: account.id, setupMode: normalizedSetupMode },
      'Voice channel configured'
    );

    return {
      success: true,
      accountId: account.id,
      callerId,
      setupMode: normalizedSetupMode,
      status: 'READY',
    };
  }

  /**
   * Configure Email channel
   * Handles SMTP/IMAP configuration (for non-OAuth)
   */
  async configureEmail({
    tenantId,
    workspaceId,
    userId,
    name,
    email,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    imapHost,
    imapPort,
    imapUser,
    imapPass,
    useTls = true,
  }) {
    // Create or update channel account
    let account = await prisma.channelAccount.findFirst({
      where: {
        tenantId,
        type: 'EMAIL',
        email: email,
      },
    });

    const accountData = {
      name: name || `Email - ${email}`,
      email: email,
      provider: 'smtp',
      providerConfig: {
        smtp: {
          host: smtpHost,
          port: smtpPort,
          user: smtpUser,
          pass: smtpPass,
          secure: useTls,
        },
        imap: imapHost
          ? {
              host: imapHost,
              port: imapPort,
              user: imapUser || smtpUser,
              pass: imapPass || smtpPass,
              tls: useTls,
            }
          : null,
        updatedBy: userId,
        updatedAt: new Date(),
      },
      status: 'ACTIVE',
      healthStatus: 'UNKNOWN',
    };

    if (account) {
      account = await prisma.channelAccount.update({
        where: { id: account.id },
        data: accountData,
      });
    } else {
      account = await prisma.channelAccount.create({
        data: {
          tenantId,
          type: 'EMAIL',
          ...accountData,
          providerConfig: {
            ...accountData.providerConfig,
            createdBy: userId,
          },
        },
      });
    }

    // Update tenant configuration
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        hasEmail: true,
        emailConfigStatus: 'READY',
        emailAccountId: account.id,
        hasAnyChannelReady: true,
      },
    });

    this.logger.info({ tenantId, accountId: account.id, email }, 'Email channel configured');

    return {
      success: true,
      accountId: account.id,
      email,
      status: 'READY',
    };
  }

  /**
   * Set channel setup mode (Self-Service, Managed, BYOK)
   */
  async setChannelSetupMode(tenantId, channel, setupMode) {
    // Map setup mode to enum values
    const setupModeMap = {
      self_service: 'SELF_SERVICE',
      managed: 'MANAGED',
      byok: 'BYOK',
      msg91: 'SELF_SERVICE', // SMS via MSG91
      gmail: 'SELF_SERVICE', // Email via Gmail
      microsoft: 'SELF_SERVICE', // Email via Microsoft
      smtp: 'BYOK', // Custom SMTP
      telecmi: 'SELF_SERVICE', // Voice via TeleCMI
    };

    const normalizedSetupMode = setupModeMap[setupMode] || setupMode.toUpperCase();

    // Update tenant with the setup mode
    const updateData = {};

    switch (channel) {
      case 'whatsapp':
        updateData.whatsAppSetupMode = normalizedSetupMode;
        updateData.whatsAppConfigStatus = 'IN_PROGRESS';
        break;
      case 'sms':
        updateData.smsConfigStatus = 'IN_PROGRESS';
        break;
      case 'email':
        updateData.emailConfigStatus = 'IN_PROGRESS';
        break;
      case 'voice':
        updateData.voiceConfigStatus = 'IN_PROGRESS';
        break;
      default:
        throw new ValidationError(`Invalid channel: ${channel}`);
    }

    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: updateData,
    });

    this.logger.info({ tenantId, channel, setupMode }, 'Channel setup mode set');

    return {
      channel,
      setupMode: normalizedSetupMode,
      status: 'IN_PROGRESS',
    };
  }
}

export const channelsService = new ChannelsService();
