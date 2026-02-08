/**
 * Sales Module Service
 * Handles sales forecasts, goals, and analytics
 */

import { prisma } from '@crm360/database';

export const salesService = {
  // ==================== FORECASTS ====================

  async listForecasts({ tenantId, page = 1, limit = 20, period, userId }) {
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
    };

    if (period) {
      where.period = period;
    }

    if (userId) {
      where.userId = userId;
    }

    const [forecasts, total] = await Promise.all([
      prisma.salesForecast.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.salesForecast.count({ where }),
    ]);

    return {
      data: forecasts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getForecast({ tenantId, forecastId }) {
    const forecast = await prisma.salesForecast.findFirst({
      where: { id: forecastId, tenantId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!forecast) {
      throw new Error('Forecast not found');
    }

    return forecast;
  },

  async createForecast({ tenantId, userId, data }) {
    const forecast = await prisma.salesForecast.create({
      data: {
        tenantId,
        userId,
        name: data.name,
        period: data.period, // MONTHLY, QUARTERLY, YEARLY
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        targetAmount: data.targetAmount,
        actualAmount: 0,
        probability: data.probability || 80,
        status: 'ACTIVE',
        notes: data.notes,
      },
    });

    return forecast;
  },

  async updateForecast({ tenantId, forecastId, data }) {
    const existing = await prisma.salesForecast.findFirst({
      where: { id: forecastId, tenantId },
    });

    if (!existing) {
      throw new Error('Forecast not found');
    }

    const forecast = await prisma.salesForecast.update({
      where: { id: forecastId },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : existing.startDate,
        endDate: data.endDate ? new Date(data.endDate) : existing.endDate,
      },
    });

    return forecast;
  },

  async deleteForecast({ tenantId, forecastId }) {
    const existing = await prisma.salesForecast.findFirst({
      where: { id: forecastId, tenantId },
    });

    if (!existing) {
      throw new Error('Forecast not found');
    }

    await prisma.salesForecast.delete({
      where: { id: forecastId },
    });

    return { success: true };
  },

  async getForecastReport({ tenantId, startDate, endDate }) {
    const where = {
      tenantId,
      startDate: { gte: new Date(startDate) },
      endDate: { lte: new Date(endDate) },
    };

    const forecasts = await prisma.salesForecast.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Calculate totals
    const totalTarget = forecasts.reduce((sum, f) => sum + (f.targetAmount || 0), 0);
    const totalActual = forecasts.reduce((sum, f) => sum + (f.actualAmount || 0), 0);
    const achievement = totalTarget > 0 ? (totalActual / totalTarget) * 100 : 0;

    return {
      forecasts,
      summary: {
        totalTarget,
        totalActual,
        achievement: Math.round(achievement * 100) / 100,
        count: forecasts.length,
      },
    };
  },

  // ==================== GOALS ====================

  async listGoals({ tenantId, page = 1, limit = 20, type, status, userId }) {
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
    };

    if (type) {
      where.type = type;
    }

    if (status) {
      where.status = status;
    }

    if (userId) {
      where.userId = userId;
    }

    const [goals, total] = await Promise.all([
      prisma.salesGoal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.salesGoal.count({ where }),
    ]);

    return {
      data: goals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getGoal({ tenantId, goalId }) {
    const goal = await prisma.salesGoal.findFirst({
      where: { id: goalId, tenantId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!goal) {
      throw new Error('Goal not found');
    }

    return goal;
  },

  async createGoal({ tenantId, userId, data }) {
    const goal = await prisma.salesGoal.create({
      data: {
        tenantId,
        userId: data.assigneeId || userId,
        name: data.name,
        type: data.type, // REVENUE, DEALS, CALLS, MEETINGS
        targetValue: data.targetValue,
        currentValue: 0,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        period: data.period, // WEEKLY, MONTHLY, QUARTERLY, YEARLY
        status: 'ACTIVE',
        notes: data.notes,
      },
    });

    return goal;
  },

  async updateGoal({ tenantId, goalId, data }) {
    const existing = await prisma.salesGoal.findFirst({
      where: { id: goalId, tenantId },
    });

    if (!existing) {
      throw new Error('Goal not found');
    }

    const goal = await prisma.salesGoal.update({
      where: { id: goalId },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : existing.startDate,
        endDate: data.endDate ? new Date(data.endDate) : existing.endDate,
      },
    });

    return goal;
  },

  async deleteGoal({ tenantId, goalId }) {
    const existing = await prisma.salesGoal.findFirst({
      where: { id: goalId, tenantId },
    });

    if (!existing) {
      throw new Error('Goal not found');
    }

    await prisma.salesGoal.delete({
      where: { id: goalId },
    });

    return { success: true };
  },

  async getGoalProgress({ tenantId, goalId }) {
    const goal = await prisma.salesGoal.findFirst({
      where: { id: goalId, tenantId },
    });

    if (!goal) {
      throw new Error('Goal not found');
    }

    const progress = goal.targetValue > 0 ? (goal.currentValue / goal.targetValue) * 100 : 0;
    const daysRemaining = Math.ceil((goal.endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return {
      goal,
      progress: Math.round(progress * 100) / 100,
      daysRemaining: Math.max(0, daysRemaining),
      isCompleted: progress >= 100,
      isOnTrack: progress >= 100 - daysRemaining * 3, // Simple on-track calculation
    };
  },

  async updateGoalProgress({ tenantId, goalId, value }) {
    const existing = await prisma.salesGoal.findFirst({
      where: { id: goalId, tenantId },
    });

    if (!existing) {
      throw new Error('Goal not found');
    }

    const newValue = existing.currentValue + value;
    const status = newValue >= existing.targetValue ? 'COMPLETED' : 'ACTIVE';

    const goal = await prisma.salesGoal.update({
      where: { id: goalId },
      data: {
        currentValue: newValue,
        status,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    });

    return goal;
  },

  // ==================== LEADERBOARD ====================

  async getLeaderboard({ tenantId, period = 'MONTHLY', limit = 10 }) {
    // Get date range for the period
    const now = new Date();
    let startDate;

    switch (period) {
      case 'WEEKLY':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'MONTHLY':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'QUARTERLY':
        startDate = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case 'YEARLY':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }

    // Get deals closed in the period
    const deals = await prisma.deal.findMany({
      where: {
        tenantId,
        status: 'WON',
        closedAt: { gte: startDate },
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Aggregate by user
    const userStats = {};
    deals.forEach((deal) => {
      if (deal.assignedTo) {
        const key = deal.assignedTo.id;
        if (!userStats[key]) {
          userStats[key] = {
            user: deal.assignedTo,
            revenue: 0,
            deals: 0,
          };
        }
        userStats[key].revenue += deal.amount || 0;
        userStats[key].deals += 1;
      }
    });

    // Sort by revenue and limit
    const leaderboard = Object.values(userStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit)
      .map((entry, index) => ({
        rank: index + 1,
        ...entry,
      }));

    return {
      period,
      data: leaderboard,
    };
  },
};
