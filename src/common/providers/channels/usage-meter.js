/**
 * Usage Metering Service
 * Tracks channel usage for PAYG billing
 * Integrates with wallet for real-time balance deduction
 */

import { prisma } from '@crm360/database';
import { logger } from '../../logger.js';
import { eventBus, createEvent } from '../../events/event-bus.js';

/**
 * Default cost matrix (in paise for INR)
 * These are base costs, actual costs come from provider reconciliation
 */
const DEFAULT_COSTS = {
  WHATSAPP: {
    MARKETING: 100, // 1.00 INR for marketing template
    UTILITY: 50, // 0.50 INR for utility template
    AUTHENTICATION: 40, // 0.40 INR for auth template
    SERVICE: 0, // Free within 24h window
    USER_INITIATED: 0, // Free response
    MEDIA: 20, // 0.20 INR per media message
  },
  SMS: {
    TRANSACTIONAL: 20, // 0.20 INR
    PROMOTIONAL: 25, // 0.25 INR
    OTP: 15, // 0.15 INR
  },
  EMAIL: {
    TRANSACTIONAL: 5, // 0.05 INR
    MARKETING: 10, // 0.10 INR
    BULK: 3, // 0.03 INR (volume)
  },
  VOICE: {
    OUTBOUND_PER_MIN: 100, // 1.00 INR per minute
    INBOUND_PER_MIN: 50, // 0.50 INR per minute
    IVR_PER_MIN: 80, // 0.80 INR per minute
    RECORDING_PER_MIN: 20, // 0.20 INR per minute
  },
};

class UsageMeterService {
  constructor() {
    this.logger = logger.child({ service: 'UsageMeter' });
    this.pendingEvents = new Map(); // Buffer for batch processing
  }

  /**
   * Record a usage event
   * @param {object} params
   * @returns {Promise<object>} Usage event record
   */
  async recordUsage({
    tenantId,
    workspaceId,
    channelAccountId,
    channelType,
    eventType, // WHATSAPP_MARKETING, SMS_TRANSACTIONAL, etc.
    messageEventId,
    callSessionId,
    direction,
    units = 1,
    durationSeconds = null,
    metadata = {},
  }) {
    const costConfig = this.getCostConfig(channelType, eventType);
    const estimatedCost = this.calculateCost(channelType, eventType, units, durationSeconds);

    const usageEvent = await prisma.usageEvent.create({
      data: {
        tenantId,
        workspaceId,
        channelAccountId,
        channelType,
        eventType,
        messageEventId,
        callSessionId,
        direction,
        units,
        durationSeconds,
        estimatedCost,
        currency: 'INR',
        billedAt: new Date(),
        metadata,
      },
    });

    // Deduct from wallet
    await this.deductFromWallet(tenantId, workspaceId, estimatedCost, usageEvent.id);

    this.logger.info({
      usageEventId: usageEvent.id,
      tenantId,
      channelType,
      eventType,
      estimatedCost,
    }, 'Usage recorded');

    return usageEvent;
  }

  /**
   * Get cost configuration for a channel/event type
   */
  getCostConfig(channelType, eventType) {
    const channelCosts = DEFAULT_COSTS[channelType];
    if (!channelCosts) return { cost: 0 };

    // Extract the event subtype (e.g., MARKETING from WHATSAPP_MARKETING)
    const subtype = eventType.replace(`${channelType}_`, '');
    return {
      cost: channelCosts[subtype] || 0,
      subtype,
    };
  }

  /**
   * Calculate cost for a usage event
   */
  calculateCost(channelType, eventType, units, durationSeconds) {
    const { cost } = this.getCostConfig(channelType, eventType);

    // Voice billing is per-minute
    if (channelType === 'VOICE' && durationSeconds) {
      const minutes = Math.ceil(durationSeconds / 60);
      return cost * minutes;
    }

    return cost * units;
  }

  /**
   * Deduct amount from wallet
   */
  async deductFromWallet(tenantId, workspaceId, amount, usageEventId) {
    if (amount <= 0) return;

    try {
      // Get or create wallet
      const wallet = await prisma.wallet.findFirst({
        where: { tenantId, workspaceId },
      });

      if (!wallet) {
        this.logger.warn({ tenantId, workspaceId }, 'No wallet found for tenant');
        return;
      }

      // Check balance
      if (wallet.balance < amount) {
        // Emit low balance warning
        eventBus.publish(createEvent('wallet.low_balance', tenantId, {
          workspaceId,
          currentBalance: wallet.balance,
          requiredAmount: amount,
        }));
      }

      // Create transaction and update balance
      await prisma.$transaction([
        prisma.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'DEBIT',
            amount: -amount,
            description: `Channel usage: ${usageEventId}`,
            referenceType: 'USAGE_EVENT',
            referenceId: usageEventId,
          },
        }),
        prisma.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { decrement: amount },
          },
        }),
      ]);
    } catch (error) {
      this.logger.error({ error, tenantId, amount }, 'Failed to deduct from wallet');
      throw error;
    }
  }

  /**
   * Reconcile usage with provider costs
   * Called when we receive actual costs from providers
   */
  async reconcileUsage({
    tenantId,
    channelType,
    periodStart,
    periodEnd,
    providerCosts, // Array of {externalId, actualCost}
    totalProviderCost,
    metadata = {},
  }) {
    const reconciliation = await prisma.walletReconciliation.create({
      data: {
        tenantId,
        channelType,
        periodStart,
        periodEnd,
        totalEstimated: 0, // Will be calculated
        totalActual: totalProviderCost,
        difference: 0, // Will be calculated
        status: 'PENDING',
        providerData: providerCosts,
        metadata,
      },
    });

    // Update individual usage events with actual costs
    let totalEstimated = 0;
    for (const { externalId, actualCost } of providerCosts) {
      const messageEvent = await prisma.messageEvent.findFirst({
        where: { externalId },
        include: { usageEvents: true },
      });

      if (messageEvent && messageEvent.usageEvents.length > 0) {
        const usageEvent = messageEvent.usageEvents[0];
        totalEstimated += usageEvent.estimatedCost || 0;

        await prisma.usageEvent.update({
          where: { id: usageEvent.id },
          data: {
            actualCost,
            reconciledAt: new Date(),
          },
        });
      }
    }

    // Update reconciliation with totals
    const difference = totalProviderCost - totalEstimated;
    await prisma.walletReconciliation.update({
      where: { id: reconciliation.id },
      data: {
        totalEstimated,
        difference,
        status: 'COMPLETED',
      },
    });

    // If there's a significant difference, adjust wallet
    if (Math.abs(difference) > 100) { // More than 1 INR difference
      await this.adjustWalletForReconciliation(tenantId, difference, reconciliation.id);
    }

    this.logger.info({
      reconciliationId: reconciliation.id,
      totalEstimated,
      totalActual: totalProviderCost,
      difference,
    }, 'Usage reconciliation completed');

    return reconciliation;
  }

  /**
   * Adjust wallet balance based on reconciliation
   */
  async adjustWalletForReconciliation(tenantId, difference, reconciliationId) {
    const wallet = await prisma.wallet.findFirst({
      where: { tenantId },
    });

    if (!wallet) return;

    await prisma.$transaction([
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: difference > 0 ? 'DEBIT' : 'CREDIT',
          amount: difference,
          description: `Reconciliation adjustment`,
          referenceType: 'RECONCILIATION',
          referenceId: reconciliationId,
        },
      }),
      prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: difference },
        },
      }),
    ]);
  }

  /**
   * Get usage summary for a tenant
   */
  async getUsageSummary(tenantId, workspaceId, startDate, endDate) {
    const usage = await prisma.usageEvent.groupBy({
      by: ['channelType', 'eventType'],
      where: {
        tenantId,
        workspaceId,
        billedAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        units: true,
        durationSeconds: true,
        estimatedCost: true,
        actualCost: true,
      },
      _count: true,
    });

    const summary = {
      period: { startDate, endDate },
      byChannel: {},
      totals: {
        events: 0,
        estimatedCost: 0,
        actualCost: 0,
      },
    };

    for (const row of usage) {
      if (!summary.byChannel[row.channelType]) {
        summary.byChannel[row.channelType] = {
          events: 0,
          estimatedCost: 0,
          actualCost: 0,
          byType: {},
        };
      }

      const channel = summary.byChannel[row.channelType];
      channel.events += row._count;
      channel.estimatedCost += row._sum.estimatedCost || 0;
      channel.actualCost += row._sum.actualCost || 0;
      channel.byType[row.eventType] = {
        count: row._count,
        units: row._sum.units,
        durationSeconds: row._sum.durationSeconds,
        estimatedCost: row._sum.estimatedCost,
        actualCost: row._sum.actualCost,
      };

      summary.totals.events += row._count;
      summary.totals.estimatedCost += row._sum.estimatedCost || 0;
      summary.totals.actualCost += row._sum.actualCost || 0;
    }

    return summary;
  }

  /**
   * Check if tenant has sufficient balance for an action
   */
  async checkBalance(tenantId, workspaceId, channelType, eventType, units = 1) {
    const wallet = await prisma.wallet.findFirst({
      where: { tenantId, workspaceId },
    });

    if (!wallet) {
      return { sufficient: false, reason: 'NO_WALLET' };
    }

    const estimatedCost = this.calculateCost(channelType, eventType, units, null);

    if (wallet.balance < estimatedCost) {
      return {
        sufficient: false,
        reason: 'INSUFFICIENT_BALANCE',
        currentBalance: wallet.balance,
        requiredAmount: estimatedCost,
      };
    }

    return {
      sufficient: true,
      currentBalance: wallet.balance,
      estimatedCost,
      remainingAfter: wallet.balance - estimatedCost,
    };
  }

  /**
   * Get cost estimate for a message
   */
  getCostEstimate(channelType, eventType, units = 1, durationSeconds = null) {
    return {
      channelType,
      eventType,
      units,
      durationSeconds,
      estimatedCost: this.calculateCost(channelType, eventType, units, durationSeconds),
      currency: 'INR',
    };
  }
}

// Singleton instance
export const usageMeter = new UsageMeterService();
