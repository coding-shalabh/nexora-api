import { Router } from 'express';
import { prisma } from '@crm360/database';
import { authenticate } from '../../common/middleware/authenticate.js';

const router = Router();

/**
 * GET /dashboard
 * Get dashboard data including KPIs and basic stats
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { tenantId, userId } = req.user;

    // Get user and workspace info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
      },
    });

    // Get counts in parallel for performance
    const [
      openConversationsCount,
      totalContactsCount,
      totalDealsCount,
      totalTicketsCount,
      unreadInboxCount,
    ] = await Promise.all([
      // Open conversations count
      prisma.conversation.count({
        where: {
          tenantId,
          status: { in: ['OPEN', 'PENDING'] },
        },
      }),

      // Total contacts count
      prisma.contact.count({
        where: { tenantId },
      }),

      // Total deals count
      prisma.deal.count({
        where: { tenantId },
      }),

      // Total tickets count
      prisma.ticket.count({
        where: { tenantId },
      }),

      // Unread inbox (conversations with unread messages)
      prisma.conversation.count({
        where: {
          tenantId,
          unreadCount: { gt: 0 },
        },
      }),
    ]);

    // Pipeline stats - sum of all deal amounts
    let pipelineValue = 0;
    try {
      const pipelineStats = await prisma.deal.aggregate({
        where: { tenantId },
        _sum: { amount: true },
      });
      pipelineValue = pipelineStats._sum.amount ? Number(pipelineStats._sum.amount) : 0;
    } catch (e) {
      // Ignore if aggregate fails
    }

    // Format response
    res.json({
      success: true,
      data: {
        user: {
          firstName: user?.firstName || 'User',
          lastName: user?.lastName || '',
          email: user?.email,
        },
        workspace: {
          name: user?.tenant?.name || 'Workspace',
          plan: 'Pro',
        },
        kpis: {
          openConversations: {
            value: openConversationsCount,
            change: null,
          },
          totalContacts: {
            value: totalContactsCount,
            change: null,
          },
          activeDeals: {
            value: totalDealsCount,
            change: null,
          },
          openTickets: {
            value: totalTicketsCount,
            change: null,
          },
          walletBalance: {
            value: 0,
            currency: 'INR',
          },
        },
        badges: {
          inbox: unreadInboxCount,
          tickets: totalTicketsCount,
        },
        recentActivity: [],
        upcomingTasks: [],
        stats: {
          pipelineValue,
          avgResponseTime: 0,
          conversionRate: 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /dashboard/activity
 * Get paginated activity feed
 */
router.get('/activity', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req.user;

    res.json({
      success: true,
      data: [],
      meta: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as dashboardRouter };
