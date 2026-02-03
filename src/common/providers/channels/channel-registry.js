/**
 * Channel Registry
 * Central registry for managing channel adapters
 * Provides adapter factory and lifecycle management
 */

import { prisma } from '@crm360/database';
import { logger } from '../../logger.js';

class ChannelRegistry {
  constructor() {
    this.adapterFactories = new Map();
    this.activeAdapters = new Map();
    this.logger = logger.child({ service: 'ChannelRegistry' });
  }

  /**
   * Register an adapter factory for a channel type
   * @param {string} channelType - WHATSAPP | SMS | EMAIL | VOICE
   * @param {Function} factory - Factory function that creates adapter instances
   */
  registerAdapterFactory(channelType, factory) {
    this.adapterFactories.set(channelType, factory);
    this.logger.info({ channelType }, 'Registered channel adapter factory');
  }

  /**
   * Get or create an adapter for a specific channel account
   * @param {string} channelAccountId
   * @returns {Promise<BaseChannelAdapter>}
   */
  async getAdapter(channelAccountId) {
    // Check cache first
    if (this.activeAdapters.has(channelAccountId)) {
      return this.activeAdapters.get(channelAccountId);
    }

    // Load channel account from database
    const channelAccount = await prisma.channelAccount.findUnique({
      where: { id: channelAccountId },
    });

    if (!channelAccount) {
      throw new Error(`Channel account not found: ${channelAccountId}`);
    }

    if (!channelAccount.isEnabled) {
      throw new Error(`Channel account is disabled: ${channelAccountId}`);
    }

    return this.createAdapter(channelAccount);
  }

  /**
   * Create a new adapter instance for a channel account
   * @param {object} channelAccount
   * @returns {BaseChannelAdapter}
   */
  createAdapter(channelAccount) {
    const factory = this.adapterFactories.get(channelAccount.channelType);

    if (!factory) {
      throw new Error(`No adapter registered for channel type: ${channelAccount.channelType}`);
    }

    const adapter = factory(channelAccount);
    this.activeAdapters.set(channelAccount.id, adapter);

    this.logger.debug({
      channelAccountId: channelAccount.id,
      channelType: channelAccount.channelType,
    }, 'Created channel adapter');

    return adapter;
  }

  /**
   * Remove an adapter from cache (e.g., when credentials change)
   * @param {string} channelAccountId
   */
  invalidateAdapter(channelAccountId) {
    this.activeAdapters.delete(channelAccountId);
    this.logger.debug({ channelAccountId }, 'Invalidated channel adapter');
  }

  /**
   * Get all adapters for a tenant
   * @param {string} tenantId
   * @returns {Promise<BaseChannelAdapter[]>}
   */
  async getAdaptersForTenant(tenantId) {
    const channelAccounts = await prisma.channelAccount.findMany({
      where: { tenantId, isEnabled: true },
    });

    return Promise.all(
      channelAccounts.map(account => this.getAdapter(account.id))
    );
  }

  /**
   * Get adapters by channel type for a tenant
   * @param {string} tenantId
   * @param {string} channelType
   * @returns {Promise<BaseChannelAdapter[]>}
   */
  async getAdaptersByType(tenantId, channelType) {
    const channelAccounts = await prisma.channelAccount.findMany({
      where: { tenantId, channelType, isEnabled: true },
    });

    return Promise.all(
      channelAccounts.map(account => this.getAdapter(account.id))
    );
  }

  /**
   * Find the best adapter to reach a contact
   * Uses channel preference and availability
   * @param {string} tenantId
   * @param {object} contact - Contact with phone, email fields
   * @param {string[]} preferredChannels - Ordered preference
   * @returns {Promise<BaseChannelAdapter | null>}
   */
  async findBestAdapter(tenantId, contact, preferredChannels = ['WHATSAPP', 'SMS', 'EMAIL']) {
    for (const channelType of preferredChannels) {
      // Check if contact has required identifier
      if (channelType === 'EMAIL' && !contact.email) continue;
      if (['WHATSAPP', 'SMS', 'VOICE'].includes(channelType) && !contact.phone) continue;

      // Try to get an enabled adapter
      const adapters = await this.getAdaptersByType(tenantId, channelType);
      if (adapters.length > 0) {
        // Return the first healthy adapter
        for (const adapter of adapters) {
          try {
            const health = await adapter.getHealthStatus();
            if (health.healthy) {
              return adapter;
            }
          } catch (e) {
            this.logger.warn({ error: e.message }, 'Adapter health check failed');
          }
        }
      }
    }

    return null;
  }

  /**
   * Get supported channel types
   * @returns {string[]}
   */
  getSupportedChannelTypes() {
    return Array.from(this.adapterFactories.keys());
  }

  /**
   * Check if a channel type is supported
   * @param {string} channelType
   * @returns {boolean}
   */
  isChannelTypeSupported(channelType) {
    return this.adapterFactories.has(channelType);
  }

  /**
   * Health check all active adapters for a tenant
   * @param {string} tenantId
   * @returns {Promise<object>}
   */
  async healthCheckTenant(tenantId) {
    const adapters = await this.getAdaptersForTenant(tenantId);
    const results = {};

    for (const adapter of adapters) {
      try {
        results[adapter.channelAccount.id] = await adapter.getHealthStatus();
      } catch (error) {
        results[adapter.channelAccount.id] = {
          healthy: false,
          error: error.message,
        };
      }
    }

    return results;
  }
}

// Singleton instance
export const channelRegistry = new ChannelRegistry();
