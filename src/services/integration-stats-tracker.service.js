/**
 * Integration Stats Tracker Service
 * Tracks and aggregates stats across all messaging integrations
 */

import { prisma } from '@crm360/database';
import { logger } from '../common/logger.js';

class IntegrationStatsTrackerService {
  constructor() {
    this.logger = logger.child({ service: 'IntegrationStatsTracker' });
  }

  /**
   * Update integration stats when a message is sent
   */
  async recordMessageSent(tenantId, provider, channelType = 'whatsapp') {
    try {
      const integration = await prisma.integration.findFirst({
        where: {
          tenantId,
          provider,
          type: 'messaging_provider',
          status: 'CONNECTED',
        },
      });

      if (!integration) {
        this.logger.warn({ tenantId, provider }, 'Integration not found for stats update');
        return;
      }

      const currentConfig = integration.config || {};
      const currentStats = currentConfig.stats || {};
      const updatedStats = {
        ...currentStats,
        sent: (currentStats.sent || 0) + 1,
        lastSentAt: new Date().toISOString(),
      };

      // Recalculate delivery rate if we have delivered count
      if (updatedStats.sent > 0 && updatedStats.delivered !== undefined) {
        updatedStats.deliveryRate = Math.round((updatedStats.delivered / updatedStats.sent) * 100);
      }

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          config: {
            ...currentConfig,
            stats: updatedStats,
          },
        },
      });

      this.logger.info(
        {
          tenantId,
          provider,
          sent: updatedStats.sent,
        },
        'Message sent stats updated'
      );
    } catch (error) {
      this.logger.error({ error, tenantId, provider }, 'Failed to update sent stats');
    }
  }

  /**
   * Update integration stats when a message is delivered
   */
  async recordMessageDelivered(tenantId, provider) {
    try {
      const integration = await prisma.integration.findFirst({
        where: {
          tenantId,
          provider,
          type: 'messaging_provider',
          status: 'CONNECTED',
        },
      });

      if (!integration) {
        return;
      }

      const currentConfig = integration.config || {};
      const currentStats = currentConfig.stats || {};
      const updatedStats = {
        ...currentStats,
        delivered: (currentStats.delivered || 0) + 1,
        lastDeliveredAt: new Date().toISOString(),
      };

      // Recalculate delivery rate
      if (updatedStats.sent > 0) {
        updatedStats.deliveryRate = Math.round((updatedStats.delivered / updatedStats.sent) * 100);
      }

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          config: {
            ...currentConfig,
            stats: updatedStats,
          },
        },
      });

      this.logger.info(
        {
          tenantId,
          provider,
          delivered: updatedStats.delivered,
          deliveryRate: updatedStats.deliveryRate,
        },
        'Message delivered stats updated'
      );
    } catch (error) {
      this.logger.error({ error, tenantId, provider }, 'Failed to update delivered stats');
    }
  }

  /**
   * Update integration stats when a message fails
   */
  async recordMessageFailed(tenantId, provider) {
    try {
      const integration = await prisma.integration.findFirst({
        where: {
          tenantId,
          provider,
          type: 'messaging_provider',
          status: 'CONNECTED',
        },
      });

      if (!integration) {
        return;
      }

      const currentConfig = integration.config || {};
      const currentStats = currentConfig.stats || {};
      const updatedStats = {
        ...currentStats,
        failed: (currentStats.failed || 0) + 1,
        lastFailedAt: new Date().toISOString(),
      };

      // Recalculate delivery rate
      if (updatedStats.sent > 0) {
        updatedStats.deliveryRate = Math.round((updatedStats.delivered / updatedStats.sent) * 100);
      }

      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          config: {
            ...currentConfig,
            stats: updatedStats,
          },
        },
      });

      this.logger.info(
        {
          tenantId,
          provider,
          failed: updatedStats.failed,
        },
        'Message failed stats updated'
      );
    } catch (error) {
      this.logger.error({ error, tenantId, provider }, 'Failed to update failed stats');
    }
  }

  /**
   * Get combined stats across all integrations for a tenant
   */
  async getCombinedStats(tenantId, channelType = null) {
    try {
      const where = {
        tenantId,
        status: 'CONNECTED',
      };

      // For messaging integrations, try to filter by type if the field exists
      // Otherwise, filter by provider names that are known messaging providers
      const messagingProviders = [
        'msg91',
        'twilio',
        'gupshup',
        'infobip',
        'resend',
        'fast2sms',
        'telecmi',
      ];

      const integrations = await prisma.integration.findMany({
        where,
        select: {
          id: true,
          provider: true,
          name: true,
          config: true, // Using config instead of stats temporarily
          type: true,
        },
      });

      this.logger.info(
        {
          tenantId,
          channelType,
          integrationsFound: integrations.length,
          integrations: integrations.map((i) => ({
            provider: i.provider,
            type: i.type,
            services: i.config?.services,
          })),
        },
        'getCombinedStats - Integrations fetched from DB'
      );

      // Filter integrations to only messaging providers
      const messagingIntegrations = integrations.filter((integration) => {
        // If type is set and is messaging_provider, include it
        if (integration.type === 'messaging_provider') {
          return true;
        }
        // Otherwise check if provider is a known messaging provider
        return messagingProviders.includes(integration.provider.toLowerCase());
      });

      this.logger.info(
        { messagingIntegrationsCount: messagingIntegrations.length },
        'getCombinedStats - After messaging provider filter'
      );

      // If channelType is specified, further filter by services or provider name
      let filteredIntegrations = messagingIntegrations;
      if (channelType) {
        filteredIntegrations = messagingIntegrations.filter((integration) => {
          // Check if services array includes the channel type
          const services = integration.config?.services;
          if (services && Array.isArray(services) && services.includes(channelType)) {
            return true;
          }
          // Fallback: check if provider name contains the channel type
          // e.g., msg91 for whatsapp, fast2sms for sms
          const providerLower = integration.provider.toLowerCase();
          const channelLower = channelType.toLowerCase();

          // Provider-to-channel mapping
          if (channelLower === 'whatsapp') {
            return ['msg91', 'gupshup', 'infobip', 'twilio'].includes(providerLower);
          } else if (channelLower === 'sms') {
            return ['msg91', 'fast2sms', 'twilio', 'infobip'].includes(providerLower);
          } else if (channelLower === 'email') {
            return ['resend'].includes(providerLower);
          } else if (channelLower === 'voice') {
            return ['telecmi', 'twilio'].includes(providerLower);
          }

          return false;
        });
      }

      this.logger.info(
        { filteredIntegrationsCount: filteredIntegrations.length, channelType },
        'getCombinedStats - After channel type filter'
      );

      // Aggregate stats
      const combined = {
        totalIntegrations: filteredIntegrations.length,
        sent: 0,
        delivered: 0,
        failed: 0,
        deliveryRate: 0,
        byProvider: {},
      };

      filteredIntegrations.forEach((integration) => {
        const stats = integration.config?.stats || {};
        combined.sent += stats.sent || 0;
        combined.delivered += stats.delivered || 0;
        combined.failed += stats.failed || 0;

        combined.byProvider[integration.provider] = {
          name: integration.name || integration.provider,
          sent: stats.sent || 0,
          delivered: stats.delivered || 0,
          failed: stats.failed || 0,
          deliveryRate: stats.deliveryRate || 0,
        };
      });

      // Calculate overall delivery rate
      if (combined.sent > 0) {
        combined.deliveryRate = Math.round((combined.delivered / combined.sent) * 100);
      }

      return combined;
    } catch (error) {
      this.logger.error({ error, tenantId }, 'Failed to get combined stats');
      return {
        totalIntegrations: 0,
        sent: 0,
        delivered: 0,
        failed: 0,
        deliveryRate: 0,
        byProvider: {},
      };
    }
  }

  /**
   * Reset stats for an integration (for testing/admin purposes)
   */
  async resetStats(integrationId) {
    try {
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          stats: {
            sent: 0,
            delivered: 0,
            failed: 0,
            deliveryRate: 0,
          },
        },
      });

      this.logger.info({ integrationId }, 'Integration stats reset');
    } catch (error) {
      this.logger.error({ error, integrationId }, 'Failed to reset stats');
      throw error;
    }
  }
}

export const integrationStatsTracker = new IntegrationStatsTrackerService();
