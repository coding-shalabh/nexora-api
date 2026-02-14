/**
 * Data Fetcher Service
 * Fetches data from various Nexora modules with permission checks
 */

import { prisma } from '@nexora/database';
import { logger } from '../../common/utils/logger.js';

export class DataFetcherService {
  /**
   * Fetch sales data
   */
  async fetchSalesData(tenantId, { startDate, endDate, pipelineId }, permissions) {
    try {
      // Default to last 30 days if no dates provided
      const start = startDate
        ? new Date(startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      // Build query
      const where = {
        tenantId,
        createdAt: {
          gte: start,
          lte: end,
        },
      };

      if (pipelineId) {
        where.pipelineId = pipelineId;
      }

      // Fetch deals
      const [totalDeals, wonDeals, lostDeals, openDeals] = await Promise.all([
        prisma.deal.count({ where }),
        prisma.deal.count({ where: { ...where, status: 'WON' } }),
        prisma.deal.count({ where: { ...where, status: 'LOST' } }),
        prisma.deal.count({ where: { ...where, status: 'OPEN' } }),
      ]);

      // Calculate revenue (from won deals)
      const wonDealsData = await prisma.deal.findMany({
        where: { ...where, status: 'WON' },
        select: { value: true, ownerName: true },
      });

      const totalRevenue = wonDealsData.reduce((sum, deal) => sum + Number(deal.value || 0), 0);

      // Pipeline value (open deals)
      const openDealsData = await prisma.deal.findMany({
        where: { ...where, status: 'OPEN' },
        select: { value: true },
      });

      const pipelineValue = openDealsData.reduce((sum, deal) => sum + Number(deal.value || 0), 0);

      // Win rate
      const closedDeals = wonDeals + lostDeals;
      const winRate = closedDeals > 0 ? ((wonDeals / closedDeals) * 100).toFixed(1) : 0;

      // Top performer
      const performerMap = {};
      wonDealsData.forEach((deal) => {
        const owner = deal.ownerName || 'Unknown';
        if (!performerMap[owner]) {
          performerMap[owner] = { count: 0, value: 0 };
        }
        performerMap[owner].count++;
        performerMap[owner].value += Number(deal.value || 0);
      });

      const topPerformer = Object.entries(performerMap).sort((a, b) => b[1].value - a[1].value)[0];

      return {
        period: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        },
        metrics: {
          totalRevenue,
          wonDeals,
          lostDeals,
          openDeals,
          pipelineValue,
          winRate: `${winRate}%`,
        },
        topPerformer: topPerformer
          ? {
              name: topPerformer[0],
              deals: topPerformer[1].count,
              revenue: topPerformer[1].value,
            }
          : null,
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to fetch sales data');
      throw error;
    }
  }

  /**
   * Fetch CRM data
   */
  async fetchCRMData(tenantId, { metric, startDate, endDate }, permissions) {
    try {
      const start = startDate
        ? new Date(startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      if (metric === 'contacts') {
        const [total, newInPeriod, bySource] = await Promise.all([
          prisma.contact.count({ where: { tenantId } }),
          prisma.contact.count({
            where: {
              tenantId,
              createdAt: { gte: start, lte: end },
            },
          }),
          prisma.contact.groupBy({
            by: ['source'],
            where: { tenantId },
            _count: true,
          }),
        ]);

        return {
          type: 'contacts',
          total,
          newInPeriod,
          bySource: bySource.map((s) => ({ source: s.source || 'Unknown', count: s._count })),
        };
      }

      if (metric === 'companies') {
        const [total, newInPeriod] = await Promise.all([
          prisma.company.count({ where: { tenantId } }),
          prisma.company.count({
            where: {
              tenantId,
              createdAt: { gte: start, lte: end },
            },
          }),
        ]);

        return {
          type: 'companies',
          total,
          newInPeriod,
        };
      }

      if (metric === 'activities') {
        const activities = await prisma.activity.count({
          where: {
            tenantId,
            createdAt: { gte: start, lte: end },
          },
        });

        return {
          type: 'activities',
          count: activities,
          period: {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
          },
        };
      }

      throw new Error(`Unknown CRM metric: ${metric}`);
    } catch (error) {
      logger.error({ error, tenantId, metric }, 'Failed to fetch CRM data');
      throw error;
    }
  }

  /**
   * Fetch HR data (requires HR permissions)
   */
  async fetchHRData(tenantId, { type, date }, permissions) {
    // Permission check already done in tool-executor
    // This is a placeholder - actual HR module needs to be implemented
    return {
      type,
      message: 'HR module implementation pending',
      note: 'This will fetch attendance, leave, or employee data based on type',
    };
  }

  /**
   * Fetch project data
   */
  async fetchProjectData(tenantId, { projectId, metric }, permissions) {
    // Placeholder - actual project module needs to be queried
    return {
      metric,
      projectId,
      message: 'Project metrics implementation pending',
      note: 'This will fetch project status, tasks, or time tracking based on metric',
    };
  }

  /**
   * Fetch ticket data
   */
  async fetchTicketData(tenantId, { startDate, endDate, priority }, permissions) {
    try {
      const start = startDate
        ? new Date(startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      const where = {
        tenantId,
        createdAt: { gte: start, lte: end },
      };

      if (priority) {
        where.priority = priority;
      }

      const [total, byPriority, byStatus, resolved] = await Promise.all([
        prisma.ticket.count({ where }),
        prisma.ticket.groupBy({
          by: ['priority'],
          where,
          _count: true,
        }),
        prisma.ticket.groupBy({
          by: ['status'],
          where,
          _count: true,
        }),
        prisma.ticket.count({
          where: { ...where, status: 'RESOLVED' },
        }),
      ]);

      const resolutionRate = total > 0 ? ((resolved / total) * 100).toFixed(1) : 0;

      return {
        period: {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0],
        },
        total,
        resolved,
        resolutionRate: `${resolutionRate}%`,
        byPriority: byPriority.map((p) => ({
          priority: p.priority,
          count: p._count,
        })),
        byStatus: byStatus.map((s) => ({
          status: s.status,
          count: s._count,
        })),
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to fetch ticket data');
      throw error;
    }
  }

  /**
   * Fetch commerce data
   */
  async fetchCommerceData(tenantId, { type, startDate, endDate }, permissions) {
    // Placeholder - actual commerce module needs to be queried
    return {
      type,
      message: 'Commerce module implementation pending',
      note: 'This will fetch orders, invoices, or payments based on type',
    };
  }

  /**
   * Fetch subscription info
   */
  async fetchSubscriptionInfo(tenantId, permissions) {
    try {
      // Fetch tenant with subscription details
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true,
          subscriptionPlan: true,
          subscriptionStatus: true,
          subscriptionStartDate: true,
          subscriptionEndDate: true,
          billingAmount: true,
          billingCycle: true,
        },
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      return {
        tenantName: tenant.name,
        plan: tenant.subscriptionPlan || 'Free',
        status: tenant.subscriptionStatus || 'Active',
        billingAmount: tenant.billingAmount || 0,
        billingCycle: tenant.billingCycle || 'monthly',
        nextBillingDate: tenant.subscriptionEndDate
          ? tenant.subscriptionEndDate.toISOString().split('T')[0]
          : 'N/A',
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to fetch subscription info');
      throw error;
    }
  }
}
