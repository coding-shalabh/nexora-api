/**
 * Integrations Service
 * Handles third-party integrations and webhooks
 */

import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import crypto from 'crypto';

class IntegrationsService {
  // =====================
  // Integrations
  // =====================

  async getIntegrations(tenantId) {
    const integrations = await prisma.integration.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        type: true,
        provider: true,
        status: true,
        config: true,
        lastSyncAt: true,
        syncStatus: true,
        createdAt: true,
        connectedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return integrations.map((i) => ({
      ...i,
      connectedByName: i.connectedBy
        ? `${i.connectedBy.firstName} ${i.connectedBy.lastName}`
        : 'System',
      connectedBy: undefined,
    }));
  }

  async getIntegration(tenantId, integrationId) {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId, tenantId },
      select: {
        id: true,
        name: true,
        type: true,
        provider: true,
        status: true,
        config: true,
        lastSyncAt: true,
        syncStatus: true,
        syncErrors: true,
        createdAt: true,
      },
    });

    if (!integration) {
      throw new NotFoundError('Integration not found');
    }

    return integration;
  }

  async connectIntegration(tenantId, userId, data) {
    const integration = await prisma.integration.create({
      data: {
        tenantId,
        connectedById: userId,
        name: data.name,
        type: data.type,
        provider: data.provider,
        status: 'CONNECTED',
        config: data.config || {},
        credentials: data.credentials || {},
      },
      select: {
        id: true,
        name: true,
        type: true,
        provider: true,
        status: true,
        createdAt: true,
      },
    });

    return integration;
  }

  async updateIntegration(tenantId, integrationId, data) {
    const integration = await prisma.integration.update({
      where: { id: integrationId, tenantId },
      data: {
        name: data.name,
        config: data.config,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        type: true,
        provider: true,
        status: true,
        config: true,
      },
    });

    return integration;
  }

  async disconnectIntegration(tenantId, integrationId) {
    await prisma.integration.update({
      where: { id: integrationId, tenantId },
      data: {
        status: 'DISCONNECTED',
        disconnectedAt: new Date(),
        credentials: null,
      },
    });

    return { success: true };
  }

  async syncIntegration(tenantId, integrationId) {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId, tenantId },
    });

    if (!integration) {
      throw new NotFoundError('Integration not found');
    }

    // Mark as syncing
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        syncStatus: 'SYNCING',
        lastSyncAt: new Date(),
      },
    });

    // TODO: Implement actual sync logic based on integration type
    // This would typically be done via a background job

    // For now, simulate success
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        syncStatus: 'SUCCESS',
        syncErrors: null,
      },
    });

    return { success: true, message: 'Sync initiated' };
  }

  // =====================
  // Webhooks
  // =====================

  async getWebhooks(tenantId) {
    const webhooks = await prisma.webhook.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        url: true,
        status: true,
        events: true,
        secret: false, // Never expose secret
        lastTriggeredAt: true,
        successCount: true,
        failureCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return webhooks.map((w) => ({
      ...w,
      successRate:
        w.successCount + w.failureCount > 0
          ? ((w.successCount / (w.successCount + w.failureCount)) * 100).toFixed(1)
          : 100,
      totalDeliveries: w.successCount + w.failureCount,
    }));
  }

  async getWebhook(tenantId, webhookId) {
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId, tenantId },
      select: {
        id: true,
        name: true,
        url: true,
        status: true,
        events: true,
        headers: true,
        retryPolicy: true,
        lastTriggeredAt: true,
        successCount: true,
        failureCount: true,
        createdAt: true,
      },
    });

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    return webhook;
  }

  async createWebhook(tenantId, userId, data) {
    // Generate webhook secret
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.webhook.create({
      data: {
        tenantId,
        createdById: userId,
        name: data.name,
        url: data.url,
        events: data.events || [],
        secret,
        headers: data.headers || {},
        status: 'ACTIVE',
        retryPolicy: data.retryPolicy || { maxRetries: 3, retryDelay: 60 },
      },
      select: {
        id: true,
        name: true,
        url: true,
        status: true,
        events: true,
        createdAt: true,
      },
    });

    // Return secret only on creation
    return {
      ...webhook,
      secret,
    };
  }

  async updateWebhook(tenantId, webhookId, data) {
    const webhook = await prisma.webhook.update({
      where: { id: webhookId, tenantId },
      data: {
        name: data.name,
        url: data.url,
        events: data.events,
        headers: data.headers,
        status: data.status,
        retryPolicy: data.retryPolicy,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        url: true,
        status: true,
        events: true,
      },
    });

    return webhook;
  }

  async deleteWebhook(tenantId, webhookId) {
    await prisma.webhook.delete({
      where: { id: webhookId, tenantId },
    });

    return { success: true };
  }

  async testWebhook(tenantId, webhookId, eventType) {
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId, tenantId },
      select: { url: true, secret: true, headers: true },
    });

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    // Create test payload
    const payload = {
      event: eventType || 'test.event',
      timestamp: new Date().toISOString(),
      data: {
        id: 'test_123',
        type: 'test',
        message: 'This is a test webhook delivery',
      },
    };

    // Create signature
    const signature = crypto
      .createHmac('sha256', webhook.secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          ...webhook.headers,
        },
        body: JSON.stringify(payload),
      });

      const success = response.ok;
      const statusCode = response.status;

      // Log the delivery
      await prisma.webhookDelivery.create({
        data: {
          webhookId,
          event: eventType || 'test.event',
          status: success ? 'DELIVERED' : 'FAILED',
          statusCode,
          duration: 0, // Would be calculated with timing
          requestPayload: payload,
          responseBody: await response.text().catch(() => null),
        },
      });

      return {
        success,
        statusCode,
        message: success ? 'Test webhook delivered successfully' : 'Webhook delivery failed',
      };
    } catch (error) {
      // Log failed delivery
      await prisma.webhookDelivery.create({
        data: {
          webhookId,
          event: eventType || 'test.event',
          status: 'FAILED',
          statusCode: 0,
          duration: 0,
          requestPayload: payload,
          error: error.message,
        },
      });

      return {
        success: false,
        statusCode: 0,
        message: `Webhook delivery failed: ${error.message}`,
      };
    }
  }

  async getWebhookDeliveries(tenantId, webhookId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId, tenantId },
      select: { id: true },
    });

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    const [deliveries, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where: { webhookId },
        select: {
          id: true,
          event: true,
          status: true,
          statusCode: true,
          duration: true,
          error: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.webhookDelivery.count({ where: { webhookId } }),
    ]);

    return {
      deliveries,
      total,
      hasMore: offset + deliveries.length < total,
    };
  }

  async retryWebhookDelivery(tenantId, webhookId, deliveryId) {
    const delivery = await prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        webhook: {
          select: { tenantId: true, url: true, secret: true, headers: true },
        },
      },
    });

    if (!delivery || delivery.webhook.tenantId !== tenantId) {
      throw new NotFoundError('Delivery not found');
    }

    // Re-send the webhook
    const result = await this.testWebhook(tenantId, webhookId, delivery.event);

    return result;
  }

  // =====================
  // Messaging Provider Integrations
  // =====================

  /**
   * Test messaging provider API connection
   * Uses actual API endpoints to verify credentials are valid
   */
  async testProviderConnection(provider, credentials) {
    try {
      if (provider === 'msg91') {
        const { authKey } = credentials;
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

        if (trimmedResponse === 'valid') {
          return {
            valid: true,
            message: 'MSG91 credentials are valid',
          };
        }

        // Any other response means invalid key
        return { valid: false, error: 'Invalid MSG91 auth key' };
      }

      if (provider === 'twilio') {
        const { accountSid, authToken } = credentials;
        if (!accountSid || !authToken) {
          return { valid: false, error: 'Account SID and Auth Token are required' };
        }

        // Validate by fetching account info
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`,
          {
            method: 'GET',
            headers: { Authorization: `Basic ${auth}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          return {
            valid: true,
            message: `Twilio credentials valid. Account: ${data.friendly_name}`,
            accountName: data.friendly_name,
            status: data.status,
          };
        }

        // Parse error response
        let errorMessage = 'Invalid Twilio credentials';
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Ignore JSON parse errors
        }

        return { valid: false, error: errorMessage };
      }

      if (provider === 'gupshup') {
        const { apiKey, appName } = credentials;
        if (!apiKey) {
          return { valid: false, error: 'API key is required' };
        }
        if (!appName) {
          return { valid: false, error: 'App name is required' };
        }

        // Validate by fetching wallet balance
        const response = await fetch(`https://api.gupshup.io/wa/api/v1/wallet/balance`, {
          method: 'GET',
          headers: {
            apikey: apiKey,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'success' || data.wallet) {
            return {
              valid: true,
              message: 'Gupshup credentials are valid',
              balance: data.wallet?.balance,
            };
          }
        }

        let errorMessage = 'Invalid Gupshup credentials';
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Ignore JSON parse errors
        }

        return { valid: false, error: errorMessage };
      }

      if (provider === 'infobip') {
        const { apiKey, baseUrl } = credentials;
        if (!apiKey) {
          return { valid: false, error: 'API key is required' };
        }
        if (!baseUrl) {
          return { valid: false, error: 'Base URL is required' };
        }

        // Validate by fetching account balance
        const response = await fetch(`${baseUrl}/account/1/balance`, {
          method: 'GET',
          headers: {
            Authorization: `App ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          return {
            valid: true,
            message: `Infobip credentials valid. Balance: ${data.balance} ${data.currency}`,
            balance: data.balance,
            currency: data.currency,
          };
        }

        let errorMessage = 'Invalid Infobip credentials';
        try {
          const errorData = await response.json();
          if (errorData.requestError?.serviceException?.text) {
            errorMessage = errorData.requestError.serviceException.text;
          }
        } catch {
          // Ignore JSON parse errors
        }

        return { valid: false, error: errorMessage };
      }

      // =====================
      // Resend (Email)
      // =====================
      if (provider === 'resend') {
        const { apiKey } = credentials;
        if (!apiKey) {
          return { valid: false, error: 'API key is required' };
        }

        // Validate by listing domains (simplest authenticated endpoint)
        const response = await fetch('https://api.resend.com/domains', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const domains = data.data || [];
          const verifiedDomains = domains.filter((d) => d.status === 'verified');
          return {
            valid: true,
            message: `Resend credentials valid. ${verifiedDomains.length} verified domain(s)`,
            domains: domains.length,
            verifiedDomains: verifiedDomains.length,
          };
        }

        let errorMessage = 'Invalid Resend API key';
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Ignore JSON parse errors
        }

        return { valid: false, error: errorMessage };
      }

      // =====================
      // Fast2SMS (SMS)
      // =====================
      if (provider === 'fast2sms') {
        const { apiKey } = credentials;
        if (!apiKey) {
          return { valid: false, error: 'API key is required' };
        }

        // Validate by checking wallet balance
        const response = await fetch('https://www.fast2sms.com/dev/wallet', {
          method: 'GET',
          headers: {
            authorization: apiKey,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.return === true) {
            return {
              valid: true,
              message: `Fast2SMS credentials valid. Balance: ₹${data.wallet}`,
              balance: data.wallet,
            };
          }
        }

        let errorMessage = 'Invalid Fast2SMS API key';
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Ignore JSON parse errors
        }

        return { valid: false, error: errorMessage };
      }

      // =====================
      // TeleCMI (Voice)
      // =====================
      if (provider === 'telecmi') {
        const { appId, appSecret } = credentials;
        if (!appId) {
          return { valid: false, error: 'App ID is required' };
        }
        if (!appSecret) {
          return { valid: false, error: 'App Secret is required' };
        }

        // Validate by fetching account info
        const response = await fetch('https://rest.telecmi.com/v2/account', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${appId}:${appSecret}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.code === 200 || data.status === 'success') {
            return {
              valid: true,
              message: `TeleCMI credentials valid. Account: ${data.data?.name || 'Active'}`,
              accountName: data.data?.name,
              balance: data.data?.balance,
            };
          }
        }

        // TeleCMI may use different error format
        let errorMessage = 'Invalid TeleCMI credentials';
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // Ignore JSON parse errors
        }

        return { valid: false, error: errorMessage };
      }

      return { valid: false, error: `Unknown provider: ${provider}` };
    } catch (error) {
      return { valid: false, error: error.message || 'Connection failed' };
    }
  }

  /**
   * Save or update messaging provider integration
   */
  async saveMessagingProvider(tenantId, userId, data) {
    const { provider, name, credentials } = data;

    // First test the connection
    const testResult = await this.testProviderConnection(provider, credentials);
    if (!testResult.valid) {
      return { success: false, error: testResult.error };
    }

    // Check if integration already exists
    const existing = await prisma.integration.findFirst({
      where: { tenantId, provider },
    });

    if (existing) {
      // Update existing
      const updated = await prisma.integration.update({
        where: { id: existing.id },
        data: {
          name: name || existing.name,
          credentials,
          status: 'CONNECTED',
          isValidated: true,
          lastTestedAt: new Date(),
          testResult: testResult.message,
          updatedAt: new Date(),
        },
        select: {
          id: true,
          name: true,
          provider: true,
          status: true,
          isValidated: true,
          lastTestedAt: true,
        },
      });

      return { success: true, integration: updated, message: 'Integration updated' };
    }

    // Create new integration
    const integration = await prisma.integration.create({
      data: {
        tenantId,
        connectedById: userId,
        name: name || `${provider.toUpperCase()} Integration`,
        type: 'messaging_provider',
        provider,
        status: 'CONNECTED',
        credentials,
        isValidated: true,
        lastTestedAt: new Date(),
        testResult: testResult.message,
      },
      select: {
        id: true,
        name: true,
        provider: true,
        status: true,
        isValidated: true,
        lastTestedAt: true,
      },
    });

    return { success: true, integration, message: 'Integration created' };
  }

  /**
   * Get validated messaging providers for a tenant
   */
  async getMessagingProviders(tenantId) {
    const providers = await prisma.integration.findMany({
      where: {
        tenantId,
        type: 'messaging_provider',
        status: 'CONNECTED',
        isValidated: true,
      },
      select: {
        id: true,
        name: true,
        provider: true,
        status: true,
        isValidated: true,
        lastTestedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return providers;
  }

  /**
   * Get a specific messaging provider integration
   */
  async getMessagingProvider(tenantId, provider) {
    const integration = await prisma.integration.findFirst({
      where: {
        tenantId,
        provider,
        type: 'messaging_provider',
      },
      select: {
        id: true,
        name: true,
        provider: true,
        status: true,
        isValidated: true,
        lastTestedAt: true,
        testResult: true,
        createdAt: true,
        // Don't expose credentials
      },
    });

    return integration;
  }

  /**
   * Delete/disconnect a messaging provider
   */
  async deleteMessagingProvider(tenantId, provider) {
    const integration = await prisma.integration.findFirst({
      where: { tenantId, provider, type: 'messaging_provider' },
    });

    if (!integration) {
      throw new NotFoundError('Integration not found');
    }

    await prisma.integration.delete({
      where: { id: integration.id },
    });

    return { success: true };
  }

  /**
   * Get provider balance
   * Fetches real-time balance from provider's API
   */
  async getProviderBalance(tenantId, provider) {
    // Get the integration with credentials
    const integration = await prisma.integration.findFirst({
      where: {
        tenantId,
        provider,
        type: 'messaging_provider',
        status: 'CONNECTED',
      },
    });

    if (!integration) {
      throw new NotFoundError(`${provider} integration not found`);
    }

    const credentials = integration.credentials;

    try {
      // MSG91 - SMS/WhatsApp/Email/Voice
      if (provider === 'msg91') {
        const { authKey } = credentials;

        // MSG91 has different routes: Promotional (type=1) and Transactional (type=4)
        // Fetch balance from both routes and sum them
        const [promoResponse, transResponse] = await Promise.all([
          fetch(
            `https://api.msg91.com/api/balance.php?authkey=${encodeURIComponent(authKey)}&type=1`,
            { method: 'GET' }
          ),
          fetch(
            `https://api.msg91.com/api/balance.php?authkey=${encodeURIComponent(authKey)}&type=4`,
            { method: 'GET' }
          ),
        ]);

        let totalBalance = 0;
        const balanceDetails = {};

        // Parse Promotional route balance
        if (promoResponse.ok) {
          const promoText = await promoResponse.text();
          const promoBalance = parseFloat(promoText.trim()) || 0;
          balanceDetails.promotional = promoBalance;
          totalBalance += promoBalance;
          console.log('MSG91 Promotional Balance (type=1):', promoBalance);
        }

        // Parse Transactional route balance
        if (transResponse.ok) {
          const transText = await transResponse.text();
          const transBalance = parseFloat(transText.trim()) || 0;
          balanceDetails.transactional = transBalance;
          totalBalance += transBalance;
          console.log('MSG91 Transactional Balance (type=4):', transBalance);
        }

        console.log('MSG91 Total Balance:', totalBalance, 'Details:', balanceDetails);

        return {
          balance: totalBalance,
          currency: 'INR',
          type: 'SMS',
          provider: 'MSG91',
          balanceDetails,
        };
      }

      // Twilio - SMS/WhatsApp/Voice
      if (provider === 'twilio') {
        const { accountSid, authToken } = credentials;
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Balance.json`,
          {
            method: 'GET',
            headers: { Authorization: `Basic ${auth}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          return {
            balance: parseFloat(data.balance),
            currency: data.currency,
            type: 'USD',
            provider: 'Twilio',
          };
        }

        throw new Error('Failed to fetch Twilio balance');
      }

      // Gupshup - WhatsApp
      if (provider === 'gupshup') {
        const { apiKey } = credentials;
        const response = await fetch(`https://api.gupshup.io/wa/api/v1/wallet/balance`, {
          method: 'GET',
          headers: {
            apikey: apiKey,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          return {
            balance: data.wallet?.balance || 0,
            currency: 'USD',
            type: 'WhatsApp',
            provider: 'Gupshup',
          };
        }

        throw new Error('Failed to fetch Gupshup balance');
      }

      // Infobip - SMS/WhatsApp/Email/Voice
      if (provider === 'infobip') {
        const { apiKey, baseUrl } = credentials;
        const response = await fetch(`${baseUrl}/account/1/balance`, {
          method: 'GET',
          headers: {
            Authorization: `App ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          return {
            balance: parseFloat(data.balance),
            currency: data.currency,
            type: 'Multi-channel',
            provider: 'Infobip',
          };
        }

        throw new Error('Failed to fetch Infobip balance');
      }

      // Resend - Email (no balance API, return 0)
      if (provider === 'resend') {
        return {
          balance: 0,
          currency: 'USD',
          type: 'Email',
          provider: 'Resend',
          note: 'Resend uses a different pricing model',
        };
      }

      // Fast2SMS - SMS
      if (provider === 'fast2sms') {
        const { apiKey } = credentials;
        const response = await fetch('https://www.fast2sms.com/dev/wallet', {
          method: 'GET',
          headers: {
            authorization: apiKey,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          return {
            balance: data.wallet || 0,
            currency: 'INR',
            type: 'SMS',
            provider: 'Fast2SMS',
          };
        }

        throw new Error('Failed to fetch Fast2SMS balance');
      }

      // TeleCMI - Voice
      if (provider === 'telecmi') {
        const { appId, appSecret } = credentials;
        const response = await fetch('https://rest.telecmi.com/v2/account', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${appId}:${appSecret}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          return {
            balance: data.data?.balance || 0,
            currency: 'INR',
            type: 'Voice',
            provider: 'TeleCMI',
          };
        }

        throw new Error('Failed to fetch TeleCMI balance');
      }

      throw new Error(`Balance API not implemented for provider: ${provider}`);
    } catch (error) {
      console.error(`Error fetching balance for ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Get provider stats
   * Fetches usage statistics from provider's API
   */
  async getProviderStats(tenantId, provider) {
    // Get the integration with credentials
    const integration = await prisma.integration.findFirst({
      where: {
        tenantId,
        provider,
        type: 'messaging_provider',
        status: 'CONNECTED',
      },
    });

    if (!integration) {
      throw new NotFoundError(`${provider} integration not found`);
    }

    const credentials = integration.credentials;

    try {
      // MSG91 - SMS/WhatsApp/Email/Voice
      if (provider === 'msg91') {
        const { authKey } = credentials;

        // MSG91 doesn't have a direct stats API, return stored stats if available
        // You can implement custom stats tracking in the database
        return {
          sent: integration.stats?.sent || 0,
          delivered: integration.stats?.delivered || 0,
          failed: integration.stats?.failed || 0,
          deliveryRate: integration.stats?.deliveryRate || 0,
          provider: 'MSG91',
        };
      }

      // Twilio - SMS/WhatsApp/Voice
      if (provider === 'twilio') {
        const { accountSid, authToken } = credentials;
        const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

        // Fetch today's messages
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?DateSent>=${today}`,
          {
            method: 'GET',
            headers: { Authorization: `Basic ${auth}` },
          }
        );

        if (response.ok) {
          const data = await response.json();
          const messages = data.messages || [];
          const sent = messages.length;
          const delivered = messages.filter((m) => m.status === 'delivered').length;
          const failed = messages.filter((m) => m.status === 'failed').length;

          return {
            sent,
            delivered,
            failed,
            deliveryRate: sent > 0 ? ((delivered / sent) * 100).toFixed(2) : 0,
            provider: 'Twilio',
          };
        }

        throw new Error('Failed to fetch Twilio stats');
      }

      // Gupshup - WhatsApp
      if (provider === 'gupshup') {
        // Gupshup doesn't provide direct stats API
        // Return stored stats if available
        return {
          sent: integration.stats?.sent || 0,
          delivered: integration.stats?.delivered || 0,
          failed: integration.stats?.failed || 0,
          deliveryRate: integration.stats?.deliveryRate || 0,
          provider: 'Gupshup',
        };
      }

      // Infobip - SMS/WhatsApp/Email/Voice
      if (provider === 'infobip') {
        // Infobip has analytics API, but requires date range
        // Return stored stats if available
        return {
          sent: integration.stats?.sent || 0,
          delivered: integration.stats?.delivered || 0,
          failed: integration.stats?.failed || 0,
          deliveryRate: integration.stats?.deliveryRate || 0,
          provider: 'Infobip',
        };
      }

      // Resend - Email
      if (provider === 'resend') {
        // Resend doesn't provide stats API
        // Return stored stats if available
        return {
          sent: integration.stats?.sent || 0,
          delivered: integration.stats?.delivered || 0,
          bounced: integration.stats?.bounced || 0,
          opened: integration.stats?.opened || 0,
          clicked: integration.stats?.clicked || 0,
          provider: 'Resend',
        };
      }

      // Fast2SMS - SMS
      if (provider === 'fast2sms') {
        // Fast2SMS doesn't provide stats API
        // Return stored stats if available
        return {
          sent: integration.stats?.sent || 0,
          delivered: integration.stats?.delivered || 0,
          failed: integration.stats?.failed || 0,
          deliveryRate: integration.stats?.deliveryRate || 0,
          provider: 'Fast2SMS',
        };
      }

      // TeleCMI - Voice
      if (provider === 'telecmi') {
        // TeleCMI has call logs API
        // Return stored stats if available
        return {
          calls: integration.stats?.calls || 0,
          answered: integration.stats?.answered || 0,
          missed: integration.stats?.missed || 0,
          duration: integration.stats?.duration || 0,
          provider: 'TeleCMI',
        };
      }

      throw new Error(`Stats API not implemented for provider: ${provider}`);
    } catch (error) {
      console.error(`Error fetching stats for ${provider}:`, error);
      throw error;
    }
  }

  /**
   * Get available messaging providers catalog
   */
  getAvailableMessagingProviders() {
    return [
      // Email Providers
      {
        id: 'resend',
        name: 'Resend',
        description: 'Modern email API for developers',
        logo: '/integrations/resend.png',
        services: ['email'],
        category: 'email',
        credentials: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
        docsUrl: 'https://resend.com/docs',
        features: ['Transactional emails', 'Email templates', 'Delivery tracking'],
      },
      // SMS Providers
      {
        id: 'fast2sms',
        name: 'Fast2SMS',
        description: 'Quick SMS gateway for India',
        logo: '/integrations/fast2sms.png',
        services: ['sms'],
        category: 'sms',
        credentials: [{ key: 'apiKey', label: 'API Key', type: 'password', required: true }],
        docsUrl: 'https://docs.fast2sms.com/',
        features: ['DLT compliant', 'Quick SMS', 'Bulk SMS', 'OTP delivery'],
      },
      {
        id: 'msg91',
        name: 'MSG91',
        description: 'SMS, WhatsApp, Email, and Voice services',
        logo: '/integrations/msg91.png',
        services: ['sms', 'whatsapp', 'email', 'voice'],
        category: 'multi',
        credentials: [{ key: 'authKey', label: 'Auth Key', type: 'password', required: true }],
        docsUrl: 'https://docs.msg91.com/',
        features: ['Multi-channel', 'DLT compliant', 'OTP service', 'WhatsApp Business'],
      },
      // WhatsApp Providers
      {
        id: 'gupshup',
        name: 'Gupshup',
        description: 'WhatsApp Business API',
        logo: '/integrations/gupshup.png',
        services: ['whatsapp'],
        category: 'whatsapp',
        credentials: [
          { key: 'apiKey', label: 'API Key', type: 'password', required: true },
          { key: 'appName', label: 'App Name', type: 'text', required: true },
        ],
        docsUrl: 'https://docs.gupshup.io/',
        features: ['WhatsApp Business API', 'Rich messaging', 'Chatbot support'],
      },
      // Voice Providers
      {
        id: 'telecmi',
        name: 'TeleCMI',
        description: 'Cloud telephony and voice API',
        logo: '/integrations/telecmi.png',
        services: ['voice'],
        category: 'voice',
        credentials: [
          { key: 'appId', label: 'App ID', type: 'text', required: true },
          { key: 'appSecret', label: 'App Secret', type: 'password', required: true },
        ],
        docsUrl: 'https://doc.telecmi.com/',
        features: ['Click-to-call', 'Call recording', 'IVR', 'Virtual numbers'],
      },
      // Multi-Channel Providers
      {
        id: 'twilio',
        name: 'Twilio',
        description: 'SMS, WhatsApp, and Voice services',
        logo: '/integrations/twilio.png',
        services: ['sms', 'whatsapp', 'voice'],
        category: 'multi',
        credentials: [
          { key: 'accountSid', label: 'Account SID', type: 'text', required: true },
          { key: 'authToken', label: 'Auth Token', type: 'password', required: true },
        ],
        docsUrl: 'https://www.twilio.com/docs',
        features: ['Global coverage', 'Programmable messaging', 'Voice API'],
      },
      {
        id: 'infobip',
        name: 'Infobip',
        description: 'SMS, WhatsApp, Email, and Voice',
        logo: '/integrations/infobip.png',
        services: ['sms', 'whatsapp', 'email', 'voice'],
        category: 'multi',
        credentials: [
          { key: 'apiKey', label: 'API Key', type: 'password', required: true },
          { key: 'baseUrl', label: 'Base URL', type: 'text', required: true },
        ],
        docsUrl: 'https://www.infobip.com/docs',
        features: ['Omnichannel', 'Global reach', 'Analytics'],
      },
    ];
  }

  // =====================
  // Available Integrations Catalog
  // =====================

  getAvailableIntegrations() {
    return [
      {
        id: 'salesforce',
        name: 'Salesforce',
        description: 'Sync contacts and deals with Salesforce CRM',
        category: 'CRM',
        logo: 'salesforce',
        popular: true,
        features: ['Contact sync', 'Deal sync', 'Real-time updates'],
      },
      {
        id: 'hubspot',
        name: 'HubSpot',
        description: 'Sync contacts and deals with HubSpot CRM',
        category: 'CRM',
        logo: 'hubspot',
        popular: true,
        features: ['Contact sync', 'Company sync', 'Deal sync'],
      },
      {
        id: 'zoho',
        name: 'Zoho CRM',
        description: 'Two-way sync with Zoho CRM',
        category: 'CRM',
        logo: 'zoho',
        popular: true,
        features: ['Contact sync', 'Lead sync', 'Deal sync'],
      },
      {
        id: 'slack',
        name: 'Slack',
        description: 'Send notifications to Slack channels',
        category: 'Communication',
        logo: 'slack',
        popular: true,
        features: ['Notifications', 'Alerts', 'Team updates'],
      },
      {
        id: 'teams',
        name: 'Microsoft Teams',
        description: 'Send notifications to Teams channels',
        category: 'Communication',
        logo: 'teams',
        popular: true,
        features: ['Notifications', 'Alerts', 'Team updates'],
      },
      {
        id: 'zapier',
        name: 'Zapier',
        description: 'Connect with 5000+ apps via Zapier',
        category: 'Automation',
        logo: 'zapier',
        popular: true,
        features: ['Triggers', 'Actions', 'Multi-step workflows'],
      },
      {
        id: 'shopify',
        name: 'Shopify',
        description: 'Sync customers and orders from Shopify',
        category: 'E-commerce',
        logo: 'shopify',
        popular: true,
        features: ['Customer sync', 'Order notifications', 'Abandoned cart'],
      },
      {
        id: 'google_calendar',
        name: 'Google Calendar',
        description: 'Sync meetings and appointments',
        category: 'Productivity',
        logo: 'google_calendar',
        popular: true,
        features: ['Event sync', 'Meeting reminders', 'Availability'],
      },
      {
        id: 'google_sheets',
        name: 'Google Sheets',
        description: 'Export data to Google Sheets',
        category: 'Productivity',
        logo: 'google_sheets',
        popular: false,
        features: ['Data export', 'Scheduled sync', 'Custom mapping'],
      },
    ];
  }
}

export const integrationsService = new IntegrationsService();
