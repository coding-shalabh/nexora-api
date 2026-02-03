import { prisma } from '@crm360/database';
import { NotFoundError, BadRequestError } from '@crm360/shared';
import { eventBus, createEvent, EventTypes } from '../../common/events/event-bus.js';
import { logger } from '../../common/logger.js';

// Cost matrix for PAYG billing (in paise for INR)
const CHANNEL_COSTS = {
  WHATSAPP: {
    text: 50, // ₹0.50 per message
    template: 75, // ₹0.75 per template message
    media: 100, // ₹1.00 per media message
  },
  SMS: {
    transactional: 25, // ₹0.25 per SMS
    promotional: 20, // ₹0.20 per promotional SMS
  },
  EMAIL: {
    standard: 5, // ₹0.05 per email
    bulk: 3, // ₹0.03 for bulk emails
  },
  VOICE: {
    outbound: 150, // ₹1.50 per minute
    inbound: 100, // ₹1.00 per minute
    voicemail: 50, // ₹0.50 per voicemail
  },
};

class WalletService {
  constructor() {
    this.logger = logger.child({ service: 'WalletService' });
  }

  async getWallet(tenantId) {
    const wallet = await prisma.wallet.findUnique({
      where: { tenantId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    // Add usage summary for current month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthlyUsage = await this.getUsageSummary(tenantId, {
      startDate: monthStart,
      endDate: new Date(),
    });

    return {
      ...wallet,
      monthlyUsage,
      costMatrix: CHANNEL_COSTS,
    };
  }

  async getWalletDashboard(tenantId) {
    const wallet = await this.getWallet(tenantId);

    // Get daily usage for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyUsage = await prisma.$queryRaw`
      SELECT
        DATE(created_at) as date,
        channel,
        SUM(ABS(amount)) as total_amount,
        COUNT(*) as count
      FROM wallet_transactions
      WHERE tenant_id = ${tenantId}
        AND type = 'DEBIT'
        AND created_at >= ${thirtyDaysAgo}
      GROUP BY DATE(created_at), channel
      ORDER BY date ASC
    `;

    // Get recent transactions
    const recentTransactions = await prisma.walletTransaction.findMany({
      where: { tenantId },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    // Get spend limits
    const spendLimits = await this.getSpendLimits(tenantId);

    // Calculate spend limit usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySpending = await prisma.walletTransaction.groupBy({
      by: ['channel'],
      where: {
        tenantId,
        type: 'DEBIT',
        createdAt: { gte: today },
      },
      _sum: { amount: true },
    });

    const limitsWithUsage = spendLimits.map((limit) => {
      const spent = todaySpending.find((s) => s.channel === limit.channel);
      return {
        ...limit,
        todaySpent: Math.abs(spent?._sum.amount || 0),
        usagePercentage:
          limit.dailyLimit > 0
            ? ((Math.abs(spent?._sum.amount || 0) / limit.dailyLimit) * 100).toFixed(1)
            : 0,
      };
    });

    return {
      wallet,
      dailyUsage,
      recentTransactions,
      spendLimits: limitsWithUsage,
    };
  }

  async getTransactions(tenantId, filters) {
    const where = { tenantId };
    if (filters.type) where.type = filters.type;

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return {
      transactions,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async topUp(tenantId, userId, data) {
    const wallet = await prisma.wallet.findUnique({
      where: { tenantId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    // Create transaction and update balance atomically
    const [transaction] = await prisma.$transaction([
      prisma.walletTransaction.create({
        data: {
          tenantId,
          type: 'CREDIT',
          amount: data.amount,
          currency: wallet.currency,
          description: 'Wallet top-up',
          balanceAfter: wallet.balance + data.amount,
          reference: `TOPUP-${Date.now()}`,
          metadata: { paymentMethod: data.paymentMethod },
        },
      }),
      prisma.wallet.update({
        where: { tenantId },
        data: { balance: { increment: data.amount } },
      }),
    ]);

    eventBus.publish(
      createEvent(
        EventTypes.WALLET_CREDITED,
        tenantId,
        {
          amount: data.amount,
          transactionId: transaction.id,
        },
        { userId }
      )
    );

    return transaction;
  }

  async debit(tenantId, amount, channel, description, metadata) {
    const wallet = await prisma.wallet.findUnique({
      where: { tenantId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    if (wallet.balance < amount) {
      throw new BadRequestError('Insufficient balance');
    }

    // Check spend limits
    const spendLimit = await prisma.spendLimit.findFirst({
      where: { tenantId, channel },
    });

    if (spendLimit) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dailySpent = await prisma.walletTransaction.aggregate({
        where: {
          tenantId,
          type: 'DEBIT',
          channel,
          createdAt: { gte: today },
        },
        _sum: { amount: true },
      });

      if ((dailySpent._sum.amount || 0) + amount > spendLimit.dailyLimit) {
        throw new BadRequestError('Daily spend limit exceeded');
      }
    }

    const [transaction] = await prisma.$transaction([
      prisma.walletTransaction.create({
        data: {
          tenantId,
          type: 'DEBIT',
          amount: -amount,
          currency: wallet.currency,
          description,
          channel,
          balanceAfter: wallet.balance - amount,
          reference: `USAGE-${Date.now()}`,
          metadata: metadata || {},
        },
      }),
      prisma.wallet.update({
        where: { tenantId },
        data: { balance: { decrement: amount } },
      }),
    ]);

    // Check for low balance warning
    const updatedWallet = await prisma.wallet.findUnique({
      where: { tenantId },
    });

    if (updatedWallet && updatedWallet.balance <= updatedWallet.lowBalanceThreshold) {
      eventBus.publish(
        createEvent(EventTypes.WALLET_LOW_BALANCE, tenantId, {
          balance: updatedWallet.balance,
          threshold: updatedWallet.lowBalanceThreshold,
        })
      );
    }

    eventBus.publish(
      createEvent(EventTypes.WALLET_DEBITED, tenantId, {
        amount,
        channel,
        transactionId: transaction.id,
      })
    );

    return transaction;
  }

  async getUsageSummary(tenantId, params) {
    // TODO: Wallet feature not yet implemented - WalletTransaction model doesn't exist
    // Return empty usage data for now
    return [];
  }

  async getSpendLimits(tenantId) {
    const limits = await prisma.spendLimit.findMany({
      where: { tenantId },
    });

    return limits;
  }

  async setSpendLimit(tenantId, data) {
    const limit = await prisma.spendLimit.upsert({
      where: { tenantId_channel: { tenantId, channel: data.channel } },
      create: {
        tenantId,
        channel: data.channel,
        dailyLimit: data.dailyLimit,
        monthlyLimit: data.monthlyLimit,
      },
      update: {
        dailyLimit: data.dailyLimit,
        monthlyLimit: data.monthlyLimit,
      },
    });

    return limit;
  }

  async updateSettings(tenantId, data) {
    const wallet = await prisma.wallet.update({
      where: { tenantId },
      data: {
        lowBalanceThreshold: data.lowBalanceThreshold,
        autoRechargeEnabled: data.autoRechargeEnabled,
        autoRechargeAmount: data.autoRechargeAmount,
        autoRechargeThreshold: data.autoRechargeThreshold,
      },
    });

    return wallet;
  }

  // =====================
  // PAYG Metering
  // =====================

  /**
   * Calculate cost for a channel action
   */
  calculateCost(channel, actionType, quantity = 1) {
    const channelCosts = CHANNEL_COSTS[channel];
    if (!channelCosts) return 0;

    const unitCost = channelCosts[actionType] || Object.values(channelCosts)[0];
    return unitCost * quantity;
  }

  /**
   * Check if tenant has sufficient balance for an action
   */
  async checkBalance(tenantId, channel, actionType, quantity = 1) {
    const wallet = await prisma.wallet.findUnique({
      where: { tenantId },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    const cost = this.calculateCost(channel, actionType, quantity);
    const hasSufficientBalance = wallet.balance >= cost;

    return {
      hasSufficientBalance,
      balance: wallet.balance,
      requiredAmount: cost,
      shortfall: hasSufficientBalance ? 0 : cost - wallet.balance,
    };
  }

  /**
   * Record usage and debit wallet (atomic operation for PAYG)
   */
  async recordUsage(
    tenantId,
    { channel, actionType, quantity = 1, messageId, contactId, metadata = {} }
  ) {
    const cost = this.calculateCost(channel, actionType, quantity);

    if (cost === 0) {
      this.logger.warn({ channel, actionType }, 'No cost defined for action');
      return null;
    }

    const description = `${channel} ${actionType} x${quantity}`;

    try {
      const transaction = await this.debit(tenantId, cost, channel, description, {
        ...metadata,
        actionType,
        quantity,
        messageId,
        contactId,
        unitCost: this.calculateCost(channel, actionType, 1),
      });

      return transaction;
    } catch (error) {
      this.logger.error({ error, tenantId, channel, cost }, 'Failed to record usage');
      throw error;
    }
  }

  /**
   * Get cost breakdown by channel for a period
   */
  async getCostBreakdown(tenantId, startDate, endDate) {
    const transactions = await prisma.walletTransaction.findMany({
      where: {
        tenantId,
        type: 'DEBIT',
        createdAt: {
          gte: new Date(startDate),
          lte: new Date(endDate),
        },
      },
      select: {
        channel: true,
        amount: true,
        metadata: true,
        createdAt: true,
      },
    });

    // Group by channel and action type
    const breakdown = {};

    transactions.forEach((tx) => {
      const channel = tx.channel || 'OTHER';
      const actionType = tx.metadata?.actionType || 'unknown';

      if (!breakdown[channel]) {
        breakdown[channel] = {
          total: 0,
          count: 0,
          actions: {},
        };
      }

      breakdown[channel].total += Math.abs(tx.amount);
      breakdown[channel].count += 1;

      if (!breakdown[channel].actions[actionType]) {
        breakdown[channel].actions[actionType] = { amount: 0, count: 0 };
      }

      breakdown[channel].actions[actionType].amount += Math.abs(tx.amount);
      breakdown[channel].actions[actionType].count += 1;
    });

    return breakdown;
  }

  /**
   * Get usage forecast based on historical data
   */
  async getUsageForecast(tenantId) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const historicalUsage = await prisma.walletTransaction.aggregate({
      where: {
        tenantId,
        type: 'DEBIT',
        createdAt: { gte: thirtyDaysAgo },
      },
      _sum: { amount: true },
      _count: true,
    });

    const dailyAverage = Math.abs(historicalUsage._sum.amount || 0) / 30;
    const wallet = await prisma.wallet.findUnique({
      where: { tenantId },
    });

    const daysRemaining = wallet ? Math.floor(wallet.balance / (dailyAverage || 1)) : 0;

    return {
      dailyAverage: Math.round(dailyAverage),
      weeklyProjection: Math.round(dailyAverage * 7),
      monthlyProjection: Math.round(dailyAverage * 30),
      currentBalance: wallet?.balance || 0,
      daysRemaining: Math.min(daysRemaining, 365), // Cap at 1 year
      runOutDate:
        daysRemaining > 0 ? new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000) : null,
    };
  }

  /**
   * Get pricing tiers (for displaying to users)
   */
  getPricingTiers() {
    return Object.entries(CHANNEL_COSTS).map(([channel, costs]) => ({
      channel,
      costs: Object.entries(costs).map(([type, amount]) => ({
        type,
        amountPaise: amount,
        amountRupees: (amount / 100).toFixed(2),
      })),
    }));
  }

  /**
   * Bulk prepaid package purchase
   */
  async purchasePackage(tenantId, userId, packageType) {
    const packages = {
      starter: { credits: 100000, price: 80000, bonus: 0 }, // ₹800 for 1000 credits
      growth: { credits: 500000, price: 350000, bonus: 50000 }, // ₹3500 for 5000 + 500 bonus
      enterprise: { credits: 1000000, price: 600000, bonus: 150000 }, // ₹6000 for 10000 + 1500 bonus
    };

    const pkg = packages[packageType];
    if (!pkg) {
      throw new BadRequestError('Invalid package type');
    }

    const totalCredits = pkg.credits + pkg.bonus;

    const [transaction] = await prisma.$transaction([
      prisma.walletTransaction.create({
        data: {
          tenantId,
          type: 'CREDIT',
          amount: totalCredits,
          currency: 'INR',
          description: `Package purchase: ${packageType}`,
          reference: `PKG-${packageType.toUpperCase()}-${Date.now()}`,
          metadata: {
            packageType,
            baseCredits: pkg.credits,
            bonusCredits: pkg.bonus,
            pricePaid: pkg.price,
          },
        },
      }),
      prisma.wallet.update({
        where: { tenantId },
        data: { balance: { increment: totalCredits } },
      }),
    ]);

    eventBus.publish(
      createEvent(
        EventTypes.WALLET_CREDITED,
        tenantId,
        {
          amount: totalCredits,
          transactionId: transaction.id,
          packageType,
        },
        { userId }
      )
    );

    return {
      transaction,
      creditsAdded: totalCredits,
      bonusCredits: pkg.bonus,
    };
  }
}

export const walletService = new WalletService();
