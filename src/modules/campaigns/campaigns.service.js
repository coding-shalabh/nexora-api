/**
 * Marketing Campaigns Service
 * Business logic for multi-channel marketing campaigns
 */

import { prisma } from '@crm360/database';

export const campaignService = {
  /**
   * List campaigns with pagination and filters
   */
  async list({ tenantId, page = 1, limit = 20, status, type, search }) {
    const where = { tenantId };

    if (status) where.status = status;
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [campaigns, total, statusCounts] = await Promise.all([
      prisma.marketing_campaigns.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.marketing_campaigns.count({ where }),
      prisma.marketing_campaigns.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { status: true },
      }),
    ]);

    const counts = {
      total: 0,
      DRAFT: 0,
      SCHEDULED: 0,
      ACTIVE: 0,
      PAUSED: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    statusCounts.forEach(({ status, _count }) => {
      counts[status] = _count.status;
      counts.total += _count.status;
    });

    return {
      data: campaigns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts,
    };
  },

  /**
   * Get a single campaign by ID
   */
  async get({ tenantId, campaignId }) {
    const campaign = await prisma.marketing_campaigns.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        broadcasts: {
          include: {
            _count: { select: { broadcast_recipients: true } },
          },
        },
        sequences: {
          include: {
            _count: { select: { sequence_steps: true, sequence_enrollments: true } },
          },
        },
      },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    return campaign;
  },

  /**
   * Get overall marketing stats
   */
  async getOverallStats({ tenantId, startDate, endDate }) {
    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const whereDate = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

    // Campaign stats
    const campaignStats = await prisma.marketing_campaigns.aggregate({
      where: { tenantId, ...whereDate },
      _sum: {
        sentCount: true,
        deliveredCount: true,
        openedCount: true,
        clickedCount: true,
        convertedCount: true,
        unsubscribedCount: true,
        attributedRevenue: true,
      },
      _count: { id: true },
    });

    // Broadcast stats
    const broadcastStats = await prisma.broadcasts.aggregate({
      where: { tenantId, ...whereDate },
      _sum: {
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        clickCount: true,
        optOutCount: true,
      },
      _count: { id: true },
    });

    // Contact marketing stats
    const contactStats = await prisma.contact.aggregate({
      where: { tenantId },
      _sum: {
        marketingEmailCount: true,
        marketingEmailOpenCount: true,
        marketingEmailClickCount: true,
        broadcastCount: true,
        sequenceCount: true,
      },
      _count: { id: true },
      _avg: { marketingScore: true },
    });

    // Consent stats
    const consentStats = await prisma.contact.groupBy({
      by: ['marketingConsent', 'emailConsent', 'smsConsent', 'whatsappConsent'],
      where: { tenantId, status: 'ACTIVE' },
      _count: { id: true },
    });

    // Calculate rates
    const totalSent = campaignStats._sum.sentCount || 0;
    const totalDelivered = campaignStats._sum.deliveredCount || 0;
    const totalOpened = campaignStats._sum.openedCount || 0;
    const totalClicked = campaignStats._sum.clickedCount || 0;

    return {
      campaigns: {
        total: campaignStats._count.id,
        sent: totalSent,
        delivered: totalDelivered,
        opened: totalOpened,
        clicked: totalClicked,
        converted: campaignStats._sum.convertedCount || 0,
        unsubscribed: campaignStats._sum.unsubscribedCount || 0,
        revenue: campaignStats._sum.attributedRevenue || 0,
      },
      broadcasts: {
        total: broadcastStats._count.id,
        sent: broadcastStats._sum.sentCount || 0,
        delivered: broadcastStats._sum.deliveredCount || 0,
        read: broadcastStats._sum.readCount || 0,
        clicked: broadcastStats._sum.clickCount || 0,
        optedOut: broadcastStats._sum.optOutCount || 0,
      },
      contacts: {
        total: contactStats._count.id,
        totalEmails: contactStats._sum.marketingEmailCount || 0,
        emailsOpened: contactStats._sum.marketingEmailOpenCount || 0,
        emailsClicked: contactStats._sum.marketingEmailClickCount || 0,
        broadcastsReceived: contactStats._sum.broadcastCount || 0,
        sequencesEnrolled: contactStats._sum.sequenceCount || 0,
        averageMarketingScore: contactStats._avg.marketingScore || 0,
      },
      rates: {
        deliveryRate: totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(2) : 0,
        openRate: totalDelivered > 0 ? ((totalOpened / totalDelivered) * 100).toFixed(2) : 0,
        clickRate: totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(2) : 0,
        conversionRate:
          totalClicked > 0
            ? (((campaignStats._sum.convertedCount || 0) / totalClicked) * 100).toFixed(2)
            : 0,
      },
      consent: consentStats,
    };
  },

  /**
   * Get campaign analytics
   */
  async getAnalytics({ tenantId, campaignId }) {
    const campaign = await prisma.marketing_campaigns.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Get broadcast stats for this campaign
    const broadcastStats = await prisma.broadcasts.aggregate({
      where: { tenantId, campaignId },
      _sum: {
        totalRecipients: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
        clickCount: true,
        replyCount: true,
        optOutCount: true,
      },
      _count: { id: true },
    });

    // Get sequence stats for this campaign
    const sequenceStats = await prisma.sequence_enrollments.aggregate({
      where: {
        sequences: { campaignId, tenantId },
      },
      _count: { id: true },
    });

    const sequenceStatusCounts = await prisma.sequence_enrollments.groupBy({
      by: ['status'],
      where: {
        sequences: { campaignId, tenantId },
      },
      _count: { status: true },
    });

    // Get activity counts by type
    const activityCounts = await prisma.activity.groupBy({
      by: ['type'],
      where: { tenantId, campaignId },
      _count: { type: true },
    });

    // Calculate rates
    const totalSent = campaign.sentCount || 0;
    const totalDelivered = campaign.deliveredCount || 0;
    const totalOpened = campaign.openedCount || 0;
    const totalClicked = campaign.clickedCount || 0;

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        type: campaign.type,
        channels: campaign.channels,
      },
      stats: {
        totalRecipients: campaign.totalRecipients,
        sent: totalSent,
        delivered: totalDelivered,
        opened: totalOpened,
        clicked: totalClicked,
        converted: campaign.convertedCount || 0,
        unsubscribed: campaign.unsubscribedCount || 0,
        revenue: campaign.attributedRevenue || 0,
      },
      rates: {
        deliveryRate: totalSent > 0 ? ((totalDelivered / totalSent) * 100).toFixed(2) : 0,
        openRate: totalDelivered > 0 ? ((totalOpened / totalDelivered) * 100).toFixed(2) : 0,
        clickRate: totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(2) : 0,
        conversionRate:
          totalClicked > 0 ? (((campaign.convertedCount || 0) / totalClicked) * 100).toFixed(2) : 0,
      },
      broadcasts: {
        count: broadcastStats._count.id,
        stats: broadcastStats._sum,
      },
      sequences: {
        enrollments: sequenceStats._count.id,
        byStatus: sequenceStatusCounts.reduce((acc, { status, _count }) => {
          acc[status.toLowerCase()] = _count.status;
          return acc;
        }, {}),
      },
      activities: activityCounts.reduce((acc, { type, _count }) => {
        acc[type] = _count.type;
        return acc;
      }, {}),
      timing: {
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        createdAt: campaign.createdAt,
        updatedAt: campaign.updatedAt,
      },
    };
  },

  /**
   * Get campaign activities timeline
   */
  async getActivities({ tenantId, campaignId, page = 1, limit = 50, type }) {
    const where = { tenantId, campaignId };

    if (type) {
      where.type = type;
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      prisma.activity.count({ where }),
    ]);

    return {
      data: activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Create a new campaign
   */
  async create({ tenantId, userId, data }) {
    const campaign = await prisma.marketing_campaigns.create({
      data: {
        tenantId,
        createdById: userId,
        name: data.name,
        description: data.description,
        type: data.type,
        status: 'DRAFT',
        channels: data.channels,
        goal: data.goal,
        targetAudience: data.targetAudience,
        segmentId: data.segmentId,
        audienceFilter: data.audienceFilter,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        timezone: data.timezone || 'UTC',
        budget: data.budget,
        tags: data.tags || [],
        metadata: data.metadata,
      },
    });

    return campaign;
  },

  /**
   * Update a campaign
   */
  async update({ tenantId, campaignId, data }) {
    const campaign = await prisma.marketing_campaigns.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Only allow updates on DRAFT and PAUSED campaigns
    if (!['DRAFT', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
      throw new Error(`Cannot update campaign in ${campaign.status} status`);
    }

    const updateData = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.channels !== undefined) updateData.channels = data.channels;
    if (data.goal !== undefined) updateData.goal = data.goal;
    if (data.targetAudience !== undefined) updateData.targetAudience = data.targetAudience;
    if (data.segmentId !== undefined) updateData.segmentId = data.segmentId;
    if (data.audienceFilter !== undefined) updateData.audienceFilter = data.audienceFilter;
    if (data.startDate !== undefined)
      updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined)
      updateData.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.timezone !== undefined) updateData.timezone = data.timezone;
    if (data.budget !== undefined) updateData.budget = data.budget;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    const updated = await prisma.marketing_campaigns.update({
      where: { id: campaignId },
      data: updateData,
    });

    return updated;
  },

  /**
   * Delete a campaign
   */
  async delete({ tenantId, campaignId }) {
    const campaign = await prisma.marketing_campaigns.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Only allow deletion of DRAFT campaigns
    if (campaign.status !== 'DRAFT') {
      throw new Error('Can only delete DRAFT campaigns');
    }

    await prisma.marketing_campaigns.delete({
      where: { id: campaignId },
    });
  },

  /**
   * Activate a campaign
   */
  async activate({ tenantId, campaignId }) {
    const campaign = await prisma.marketing_campaigns.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (!['DRAFT', 'PAUSED', 'SCHEDULED'].includes(campaign.status)) {
      throw new Error(`Cannot activate campaign in ${campaign.status} status`);
    }

    const updated = await prisma.marketing_campaigns.update({
      where: { id: campaignId },
      data: { status: 'ACTIVE' },
    });

    return updated;
  },

  /**
   * Pause a campaign
   */
  async pause({ tenantId, campaignId }) {
    const campaign = await prisma.marketing_campaigns.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status !== 'ACTIVE') {
      throw new Error('Can only pause ACTIVE campaigns');
    }

    const updated = await prisma.marketing_campaigns.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    });

    return updated;
  },

  /**
   * Complete a campaign
   */
  async complete({ tenantId, campaignId }) {
    const campaign = await prisma.marketing_campaigns.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const updated = await prisma.marketing_campaigns.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED' },
    });

    return updated;
  },

  /**
   * Duplicate a campaign
   */
  async duplicate({ tenantId, campaignId, userId }) {
    const campaign = await prisma.marketing_campaigns.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const newCampaign = await prisma.marketing_campaigns.create({
      data: {
        tenantId,
        createdById: userId,
        name: `${campaign.name} (Copy)`,
        description: campaign.description,
        type: campaign.type,
        status: 'DRAFT',
        channels: campaign.channels,
        goal: campaign.goal,
        targetAudience: campaign.targetAudience,
        segmentId: campaign.segmentId,
        audienceFilter: campaign.audienceFilter,
        timezone: campaign.timezone,
        budget: campaign.budget,
        tags: campaign.tags,
        metadata: campaign.metadata,
      },
    });

    return newCampaign;
  },

  /**
   * Add broadcast to campaign
   */
  async addBroadcast({ tenantId, campaignId, broadcastId }) {
    const campaign = await prisma.marketing_campaigns.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const broadcast = await prisma.broadcasts.findFirst({
      where: { id: broadcastId, tenantId },
    });

    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    await prisma.broadcasts.update({
      where: { id: broadcastId },
      data: { campaignId },
    });

    return prisma.marketing_campaigns.findFirst({
      where: { id: campaignId },
      include: {
        broadcasts: true,
        sequences: true,
      },
    });
  },

  /**
   * Add sequence to campaign
   */
  async addSequence({ tenantId, campaignId, sequenceId }) {
    const campaign = await prisma.marketing_campaigns.findFirst({
      where: { id: campaignId, tenantId },
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const sequence = await prisma.sequences.findFirst({
      where: { id: sequenceId, tenantId },
    });

    if (!sequence) {
      throw new Error('Sequence not found');
    }

    await prisma.sequences.update({
      where: { id: sequenceId },
      data: { campaignId },
    });

    return prisma.marketing_campaigns.findFirst({
      where: { id: campaignId },
      include: {
        broadcasts: true,
        sequences: true,
      },
    });
  },
};
