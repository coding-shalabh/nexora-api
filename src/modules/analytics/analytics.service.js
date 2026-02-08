import { prisma } from '@crm360/database';

class AnalyticsService {
  getDateRange(params) {
    const endDate = params.endDate ? new Date(params.endDate) : new Date();
    const startDate = params.startDate
      ? new Date(params.startDate)
      : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

    return { startDate, endDate };
  }

  async getDashboard(tenantId, params) {
    const { startDate, endDate } = this.getDateRange(params);

    // Get won/lost stage IDs for deals
    const stages = await prisma.stage.findMany({
      where: { pipeline: { tenantId } },
      select: { id: true, name: true },
    });
    const wonStageIds = stages.filter((s) => s.name.toLowerCase().includes('won')).map((s) => s.id);
    const lostStageIds = stages
      .filter((s) => s.name.toLowerCase().includes('lost'))
      .map((s) => s.id);
    const openStageIds = stages
      .filter((s) => !wonStageIds.includes(s.id) && !lostStageIds.includes(s.id))
      .map((s) => s.id);

    const [
      contactsCount,
      newContactsCount,
      dealsCount,
      openDealsValue,
      wonDealsValue,
      conversationsCount,
      ticketsCount,
    ] = await Promise.all([
      prisma.contact.count({ where: { tenantId } }),
      prisma.contact.count({
        where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.deal.count({ where: { tenantId, stageId: { in: openStageIds } } }),
      prisma.deal.aggregate({
        where: { tenantId, stageId: { in: openStageIds } },
        _sum: { amount: true },
      }),
      prisma.deal.aggregate({
        where: {
          tenantId,
          stageId: { in: wonStageIds },
          closedAt: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
      }),
      prisma.conversation.count({
        where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.ticket.count({
        where: { tenantId },
      }),
    ]);

    return {
      contacts: {
        total: contactsCount,
        new: newContactsCount,
      },
      deals: {
        open: dealsCount,
        openValue: openDealsValue._sum.amount || 0,
        wonValue: wonDealsValue._sum.amount || 0,
      },
      conversations: conversationsCount,
      tickets: ticketsCount,
    };
  }

  async getPipelineMetrics(tenantId, params) {
    const { startDate, endDate } = this.getDateRange(params);

    const where = { tenantId };
    if (params.pipelineId) where.pipelineId = params.pipelineId;

    // Get stages for this pipeline/tenant
    const stagesWhere = params.pipelineId
      ? { pipelineId: params.pipelineId }
      : { pipeline: { tenantId } };

    const stages = await prisma.stage.findMany({
      where: stagesWhere,
      select: { id: true, name: true },
    });

    const wonStageIds = stages.filter((s) => s.name.toLowerCase().includes('won')).map((s) => s.id);
    const lostStageIds = stages
      .filter((s) => s.name.toLowerCase().includes('lost'))
      .map((s) => s.id);
    const openStageIds = stages
      .filter((s) => !wonStageIds.includes(s.id) && !lostStageIds.includes(s.id))
      .map((s) => s.id);

    const [totalValue, dealsByStage, wonDeals, lostDeals] = await Promise.all([
      prisma.deal.aggregate({
        where: { ...where, stageId: { in: openStageIds } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.deal.groupBy({
        by: ['stageId'],
        where: { ...where, stageId: { in: openStageIds } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.deal.count({
        where: {
          ...where,
          stageId: { in: wonStageIds },
          closedAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.deal.count({
        where: {
          ...where,
          stageId: { in: lostStageIds },
          closedAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    const winRate = wonDeals + lostDeals > 0 ? (wonDeals / (wonDeals + lostDeals)) * 100 : 0;

    return {
      totalValue: totalValue._sum.amount || 0,
      totalDeals: totalValue._count,
      byStage: dealsByStage.map((s) => ({
        stageId: s.stageId,
        value: s._sum.amount || 0,
        count: s._count,
      })),
      wonDeals,
      lostDeals,
      winRate: Math.round(winRate * 10) / 10,
    };
  }

  async getInboxMetrics(tenantId, params) {
    const { startDate, endDate } = this.getDateRange(params);

    const [totalConversations, byChannel, byStatus, avgResponseTime] = await Promise.all([
      prisma.conversation.count({
        where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.conversation.groupBy({
        by: ['lastMessageChannel'],
        where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
        _count: true,
      }),
      prisma.conversation.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
      // This would need actual message timestamp analysis
      Promise.resolve({ avgMinutes: 5 }),
    ]);

    return {
      totalConversations,
      byChannel: byChannel.map((c) => ({
        channel: c.lastMessageChannel,
        count: c._count,
      })),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      avgResponseTime: avgResponseTime.avgMinutes,
    };
  }

  async getTicketMetrics(tenantId, params) {
    const { startDate, endDate } = this.getDateRange(params);

    // Get ticket stages to determine resolved status
    const stages = await prisma.stage.findMany({
      where: { pipeline: { tenantId, type: 'TICKET' } },
      select: { id: true, name: true },
    });
    const resolvedStageIds = stages
      .filter(
        (s) => s.name.toLowerCase().includes('resolved') || s.name.toLowerCase().includes('closed')
      )
      .map((s) => s.id);

    const [totalTickets, byPriority, resolvedCount] = await Promise.all([
      prisma.ticket.count({
        where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.ticket.groupBy({
        by: ['priority'],
        where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
        _count: true,
      }),
      prisma.ticket.count({
        where: {
          tenantId,
          stageId: { in: resolvedStageIds },
          updatedAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    return {
      totalTickets,
      byPriority: byPriority.map((p) => ({
        priority: p.priority,
        count: p._count,
      })),
      resolvedCount,
    };
  }

  async getTeamPerformance(tenantId, params) {
    const { startDate, endDate } = this.getDateRange(params);

    // Get won stages
    const stages = await prisma.stage.findMany({
      where: { pipeline: { tenantId } },
      select: { id: true, name: true },
    });
    const wonStageIds = stages.filter((s) => s.name.toLowerCase().includes('won')).map((s) => s.id);
    const resolvedStageIds = stages
      .filter(
        (s) => s.name.toLowerCase().includes('resolved') || s.name.toLowerCase().includes('closed')
      )
      .map((s) => s.id);

    const [dealsByUser, conversationsByUser, ticketsByUser] = await Promise.all([
      prisma.deal.groupBy({
        by: ['ownerId'],
        where: {
          tenantId,
          stageId: { in: wonStageIds },
          closedAt: { gte: startDate, lte: endDate },
        },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.conversation.groupBy({
        by: ['assignedToId'],
        where: {
          tenantId,
          createdAt: { gte: startDate, lte: endDate },
        },
        _count: true,
      }),
      prisma.ticket.groupBy({
        by: ['assignedToId'],
        where: {
          tenantId,
          stageId: { in: resolvedStageIds },
          updatedAt: { gte: startDate, lte: endDate },
        },
        _count: true,
      }),
    ]);

    // Get user names
    const userIds = [
      ...new Set(
        [
          ...dealsByUser.map((d) => d.ownerId),
          ...conversationsByUser.map((c) => c.assignedToId),
          ...ticketsByUser.map((t) => t.assignedToId),
        ].filter(Boolean)
      ),
    ];

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Combine metrics
    const performance = userIds.map((userId) => {
      const user = userMap.get(userId);
      const deals = dealsByUser.find((d) => d.ownerId === userId);
      const conversations = conversationsByUser.find((c) => c.assignedToId === userId);
      const tickets = ticketsByUser.find((t) => t.assignedToId === userId);

      return {
        userId,
        name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
        dealsWon: deals?._count || 0,
        dealsValue: deals?._sum.amount || 0,
        conversationsHandled: conversations?._count || 0,
        ticketsResolved: tickets?._count || 0,
      };
    });

    return performance;
  }

  // ==================== PROJECT ANALYTICS ====================

  async getProjectMetrics(tenantId, params) {
    const { startDate, endDate } = this.getDateRange(params);

    const [
      totalProjects,
      projectsByStatus,
      projectsByPriority,
      newProjects,
      completedProjects,
      budgetMetrics,
    ] = await Promise.all([
      prisma.project.count({ where: { tenantId } }),
      prisma.project.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
      prisma.project.groupBy({
        by: ['priority'],
        where: { tenantId },
        _count: true,
      }),
      prisma.project.count({
        where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.project.count({
        where: {
          tenantId,
          status: 'COMPLETED',
          completedAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.project.aggregate({
        where: { tenantId },
        _sum: { budget: true, actualCost: true },
        _avg: { progress: true },
      }),
    ]);

    // Calculate on-time completion rate
    const projectsWithDeadlines = await prisma.project.findMany({
      where: {
        tenantId,
        status: 'COMPLETED',
        completedAt: { gte: startDate, lte: endDate },
        endDate: { not: null },
      },
      select: { completedAt: true, endDate: true },
    });

    const onTimeCompleted = projectsWithDeadlines.filter((p) => p.completedAt <= p.endDate).length;

    const onTimeRate =
      projectsWithDeadlines.length > 0
        ? Math.round((onTimeCompleted / projectsWithDeadlines.length) * 100)
        : 0;

    return {
      total: totalProjects,
      new: newProjects,
      completed: completedProjects,
      avgProgress: Math.round(budgetMetrics._avg.progress || 0),
      totalBudget: budgetMetrics._sum.budget || 0,
      totalActualCost: budgetMetrics._sum.actualCost || 0,
      onTimeCompletionRate: onTimeRate,
      byStatus: projectsByStatus.reduce((acc, s) => {
        acc[s.status] = s._count;
        return acc;
      }, {}),
      byPriority: projectsByPriority.reduce((acc, p) => {
        acc[p.priority] = p._count;
        return acc;
      }, {}),
    };
  }

  async getTaskMetrics(tenantId, params) {
    const { startDate, endDate } = this.getDateRange(params);

    const where = { tenantId };
    if (params.projectId) where.projectId = params.projectId;

    const [
      totalTasks,
      tasksByStatus,
      tasksByPriority,
      newTasks,
      completedTasks,
      overdueTasks,
      hoursMetrics,
    ] = await Promise.all([
      prisma.task.count({ where }),
      prisma.task.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      prisma.task.groupBy({
        by: ['priority'],
        where,
        _count: true,
      }),
      prisma.task.count({
        where: { ...where, createdAt: { gte: startDate, lte: endDate } },
      }),
      prisma.task.count({
        where: {
          ...where,
          status: 'COMPLETED',
          completedAt: { gte: startDate, lte: endDate },
        },
      }),
      prisma.task.count({
        where: {
          ...where,
          dueDate: { lt: new Date() },
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        },
      }),
      prisma.task.aggregate({
        where,
        _sum: { estimatedHours: true, actualHours: true },
      }),
    ]);

    const completed = tasksByStatus.find((s) => s.status === 'COMPLETED')?._count || 0;
    const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

    return {
      total: totalTasks,
      new: newTasks,
      completed: completedTasks,
      overdue: overdueTasks,
      completionRate,
      estimatedHours: hoursMetrics._sum.estimatedHours || 0,
      actualHours: hoursMetrics._sum.actualHours || 0,
      byStatus: tasksByStatus.reduce((acc, s) => {
        acc[s.status] = s._count;
        return acc;
      }, {}),
      byPriority: tasksByPriority.reduce((acc, p) => {
        acc[p.priority] = p._count;
        return acc;
      }, {}),
    };
  }

  async getTimeTrackingMetrics(tenantId, params) {
    const { startDate, endDate } = this.getDateRange(params);

    const where = { tenantId, date: { gte: startDate, lte: endDate } };
    if (params.projectId) where.projectId = params.projectId;

    const [totalEntries, totalHours, billableHours, byProject, byUser, dailyTrend] =
      await Promise.all([
        prisma.timeEntry.count({ where }),
        prisma.timeEntry.aggregate({
          where,
          _sum: { hours: true },
        }),
        prisma.timeEntry.aggregate({
          where: { ...where, billable: true },
          _sum: { hours: true },
        }),
        prisma.timeEntry.groupBy({
          by: ['projectId'],
          where,
          _sum: { hours: true },
          _count: true,
        }),
        prisma.timeEntry.groupBy({
          by: ['userId'],
          where,
          _sum: { hours: true },
          _count: true,
        }),
        // Get daily hours for the past week
        this.getDailyTimeEntries(tenantId, params),
      ]);

    // Get project names
    const projectIds = byProject.map((p) => p.projectId).filter(Boolean);
    const projects =
      projectIds.length > 0
        ? await prisma.project.findMany({
            where: { id: { in: projectIds } },
            select: { id: true, name: true, color: true },
          })
        : [];
    const projectMap = new Map(projects.map((p) => [p.id, p]));

    // Get user names
    const userIds = byUser.map((u) => u.userId);
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      totalEntries,
      totalHours: totalHours._sum.hours || 0,
      billableHours: billableHours._sum.hours || 0,
      nonBillableHours: (totalHours._sum.hours || 0) - (billableHours._sum.hours || 0),
      byProject: byProject.map((p) => {
        const project = projectMap.get(p.projectId);
        return {
          projectId: p.projectId,
          name: project?.name || 'Unassigned',
          color: project?.color || '#6366f1',
          hours: p._sum.hours || 0,
          entries: p._count,
        };
      }),
      byUser: byUser.map((u) => {
        const user = userMap.get(u.userId);
        return {
          userId: u.userId,
          name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          hours: u._sum.hours || 0,
          entries: u._count,
        };
      }),
      dailyTrend,
    };
  }

  async getDailyTimeEntries(tenantId, params) {
    const endDate = params.endDate ? new Date(params.endDate) : new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const entries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        date: { gte: startDate, lte: endDate },
      },
      select: { date: true, hours: true },
    });

    // Group by date
    const byDate = entries.reduce((acc, e) => {
      const dateKey = e.date.toISOString().split('T')[0];
      acc[dateKey] = (acc[dateKey] || 0) + (e.hours || 0);
      return acc;
    }, {});

    // Create array for last 7 days
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(endDate);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      result.push({
        date: dateKey,
        hours: byDate[dateKey] || 0,
      });
    }

    return result;
  }

  async getOverviewDashboard(tenantId, params) {
    const [dashboard, projectMetrics, taskMetrics, timeMetrics] = await Promise.all([
      this.getDashboard(tenantId, params),
      this.getProjectMetrics(tenantId, params),
      this.getTaskMetrics(tenantId, params),
      this.getTimeTrackingMetrics(tenantId, params),
    ]);

    return {
      ...dashboard,
      projects: projectMetrics,
      tasks: taskMetrics,
      timeTracking: timeMetrics,
    };
  }

  // ==================== GOALS ====================

  async getGoals(tenantId, params) {
    const { page = 1, limit = 20, type, status } = params;
    const skip = (page - 1) * limit;

    const where = { tenantId };
    if (type) where.type = type;
    if (status) where.status = status;

    const [goals, total] = await Promise.all([
      prisma.analyticsGoal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.analyticsGoal.count({ where }),
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
  }

  async getGoal(tenantId, goalId) {
    const goal = await prisma.analyticsGoal.findFirst({
      where: { id: goalId, tenantId },
    });

    if (!goal) {
      throw new Error('Goal not found');
    }

    return goal;
  }

  async createGoal(tenantId, userId, data) {
    const goal = await prisma.analyticsGoal.create({
      data: {
        tenantId,
        createdBy: userId,
        name: data.name,
        type: data.type,
        targetValue: data.targetValue,
        currentValue: 0,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        metric: data.metric,
        description: data.description,
        status: 'ACTIVE',
      },
    });

    return goal;
  }

  async updateGoal(tenantId, goalId, data) {
    const existing = await prisma.analyticsGoal.findFirst({
      where: { id: goalId, tenantId },
    });

    if (!existing) {
      throw new Error('Goal not found');
    }

    const goal = await prisma.analyticsGoal.update({
      where: { id: goalId },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : existing.startDate,
        endDate: data.endDate ? new Date(data.endDate) : existing.endDate,
      },
    });

    return goal;
  }

  async deleteGoal(tenantId, goalId) {
    const existing = await prisma.analyticsGoal.findFirst({
      where: { id: goalId, tenantId },
    });

    if (!existing) {
      throw new Error('Goal not found');
    }

    await prisma.analyticsGoal.delete({
      where: { id: goalId },
    });

    return { success: true };
  }

  async bulkGoals(tenantId, userId, goals) {
    const results = [];

    for (const goalData of goals) {
      if (goalData.id) {
        // Update existing
        const goal = await this.updateGoal(tenantId, goalData.id, goalData);
        results.push({ action: 'updated', goal });
      } else {
        // Create new
        const goal = await this.createGoal(tenantId, userId, goalData);
        results.push({ action: 'created', goal });
      }
    }

    return {
      processed: results.length,
      results,
    };
  }

  // ==================== REPORTS ====================

  async getReports(tenantId, params) {
    const { page = 1, limit = 20, type } = params;
    const skip = (page - 1) * limit;

    const where = { tenantId };
    if (type) where.type = type;

    const [reports, total] = await Promise.all([
      prisma.analyticsReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.analyticsReport.count({ where }),
    ]);

    return {
      data: reports,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getReport(tenantId, reportId) {
    const report = await prisma.analyticsReport.findFirst({
      where: { id: reportId, tenantId },
    });

    if (!report) {
      throw new Error('Report not found');
    }

    return report;
  }

  async createReport(tenantId, userId, data) {
    const report = await prisma.analyticsReport.create({
      data: {
        tenantId,
        createdBy: userId,
        name: data.name,
        type: data.type,
        config: data.config || {},
        schedule: data.schedule,
        status: 'ACTIVE',
      },
    });

    return report;
  }

  async runReport(tenantId, reportId, params) {
    const report = await this.getReport(tenantId, reportId);
    const { startDate, endDate } = params;

    // Generate report data based on type
    let reportData = {};

    switch (report.type) {
      case 'SALES':
        reportData = await this.getDashboard(tenantId, { startDate, endDate });
        break;
      case 'MARKETING':
        // Placeholder - can be expanded
        reportData = { message: 'Marketing report generated' };
        break;
      case 'SUPPORT':
        reportData = await this.getTicketMetrics(tenantId, { startDate, endDate });
        break;
      default:
        reportData = { message: 'Custom report generated' };
    }

    // Log the run
    await prisma.analyticsReport.update({
      where: { id: reportId },
      data: { lastRunAt: new Date() },
    });

    return {
      report,
      data: reportData,
      generatedAt: new Date(),
      period: { startDate, endDate },
    };
  }

  async deleteReport(tenantId, reportId) {
    const existing = await prisma.analyticsReport.findFirst({
      where: { id: reportId, tenantId },
    });

    if (!existing) {
      throw new Error('Report not found');
    }

    await prisma.analyticsReport.delete({
      where: { id: reportId },
    });

    return { success: true };
  }

  async getScheduledReports(tenantId) {
    const reports = await prisma.analyticsReport.findMany({
      where: {
        tenantId,
        schedule: { not: null },
        status: 'ACTIVE',
      },
      orderBy: { createdAt: 'desc' },
    });

    return reports;
  }
}

export const analyticsService = new AnalyticsService();
