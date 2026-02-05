import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import { eventBus, createEvent, EventTypes } from '../../common/events/event-bus.js';

class TicketsService {
  // Helper to get stage IDs by name from Support Pipeline
  async getStageByName(tenantId, stageName) {
    const pipeline = await prisma.pipeline.findFirst({
      where: { tenantId, name: 'Support Pipeline' },
      include: {
        stages: {
          where: { name: stageName },
          take: 1,
        },
      },
    });
    return pipeline?.stages[0];
  }

  async getTickets(tenantId, filters) {
    const where = { tenantId };

    // Use stageId for status filtering instead of non-existent status field
    if (filters.status) {
      const stage = await this.getStageByName(tenantId, filters.status);
      if (stage) {
        where.stageId = stage.id;
      }
    }
    if (filters.stageId) where.stageId = filters.stageId;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedTo) where.assignedToId = filters.assignedTo;

    if (filters.search) {
      where.OR = [
        { subject: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          stages: { select: { id: true, name: true, color: true } },
          users: { select: { id: true, firstName: true, lastName: true } },
        },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ticket.count({ where }),
    ]);

    // Map to include status from stage name for backwards compatibility
    const enrichedTickets = tickets.map((ticket) => ({
      ...ticket,
      status: ticket.stages?.name || 'Unknown',
      assignedToUser: ticket.users || null,
    }));

    return {
      tickets: enrichedTickets,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async getTicket(tenantId, ticketId) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
      include: {
        contact: true,
        stages: { select: { id: true, name: true, color: true } },
        users: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Get comments from customFields since metadata doesn't exist
    const comments = ticket.customFields?.comments || [];

    return {
      ...ticket,
      status: ticket.stages?.name || 'Unknown',
      assignedToUser: ticket.users || null,
      comments,
    };
  }

  async createTicket(tenantId, userId, data) {
    // Find support pipeline for this tenant
    const supportPipeline = await prisma.pipeline.findFirst({
      where: {
        tenantId,
        name: 'Support Pipeline',
      },
      include: {
        stages: {
          where: { name: 'New' },
          take: 1,
        },
      },
    });

    if (!supportPipeline) {
      throw new Error('Support pipeline not found. Please contact administrator.');
    }

    const newStage = supportPipeline.stages[0];
    if (!newStage) {
      throw new Error('Support pipeline "New" stage not found.');
    }

    const ticket = await prisma.ticket.create({
      data: {
        tenantId,
        subject: data.subject,
        description: data.description,
        contactId: data.contactId,
        priority: data.priority || 'MEDIUM',
        category: data.category,
        assignedToId: userId,
        pipelineId: supportPipeline.id,
        stageId: newStage.id,
      },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        stages: { select: { id: true, name: true, color: true } },
      },
    });

    try {
      eventBus.publish(
        createEvent(EventTypes.TICKET_CREATED, tenantId, { ticketId: ticket.id }, { userId })
      );
    } catch (e) {
      console.error('Event publish error:', e);
    }

    return {
      ...ticket,
      status: ticket.stages?.name || 'New',
    };
  }

  async updateTicket(tenantId, ticketId, data) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Build update data, only include fields that are provided
    const updateData = {};
    if (data.subject !== undefined) updateData.subject = data.subject;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.category !== undefined) updateData.category = data.category;

    // Handle status update by changing stageId
    if (data.status !== undefined) {
      const stage = await this.getStageByName(tenantId, data.status);
      if (stage) {
        updateData.stageId = stage.id;
      }
    }
    if (data.stageId !== undefined) updateData.stageId = data.stageId;

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        stages: { select: { id: true, name: true, color: true } },
      },
    });

    return {
      ...updated,
      status: updated.stages?.name || 'Unknown',
    };
  }

  async assignTicket(tenantId, ticketId, assignedToId) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Verify the user exists
    const user = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: { assignedToId: assignedToId },
      include: {
        stages: { select: { id: true, name: true, color: true } },
      },
    });

    try {
      eventBus.publish(
        createEvent(EventTypes.TICKET_ASSIGNED, tenantId, { ticketId, assignedToId })
      );
    } catch (e) {
      console.error('Event publish error:', e);
    }

    return {
      ...updated,
      status: updated.stages?.name || 'Unknown',
      assignedToUser: user,
    };
  }

  async resolveTicket(tenantId, ticketId) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Find the "Resolved" stage in Support Pipeline
    const resolvedStage = await this.getStageByName(tenantId, 'Resolved');

    const updateData = {
      resolvedAt: new Date(),
    };

    if (resolvedStage) {
      updateData.stageId = resolvedStage.id;
    }

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        stages: { select: { id: true, name: true, color: true } },
      },
    });

    try {
      eventBus.publish(createEvent(EventTypes.TICKET_RESOLVED, tenantId, { ticketId }));
    } catch (e) {
      console.error('Event publish error:', e);
    }

    return {
      ...updated,
      status: updated.stages?.name || 'Resolved',
    };
  }

  async addComment(tenantId, ticketId, userId, content, isInternal) {
    const ticket = await prisma.ticket.findFirst({
      where: { id: ticketId, tenantId },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true },
    });

    // Store comments in customFields since metadata doesn't exist
    const existingComments = ticket.customFields?.comments || [];
    const newComment = {
      id: `comment-${Date.now()}`,
      content,
      isInternal,
      userId,
      user,
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...existingComments, newComment];

    await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        customFields: {
          ...(ticket.customFields || {}),
          comments: updatedComments,
        },
      },
    });

    return newComment;
  }

  async getSLAPolicies(tenantId) {
    try {
      const policies = await prisma.sLAPolicy.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
      return policies;
    } catch (e) {
      console.error('SLAPolicy query error:', e.message);
      return [];
    }
  }

  async getTicketStats(tenantId) {
    try {
      // Get stages from Support Pipeline to count by stage name
      const pipeline = await prisma.pipeline.findFirst({
        where: { tenantId, name: 'Support Pipeline' },
        include: { stages: true },
      });

      if (!pipeline) {
        return { open: 0, inProgress: 0, resolved: 0, total: 0 };
      }

      const stageMap = new Map(pipeline.stages.map((s) => [s.name.toLowerCase(), s.id]));

      const openStageId = stageMap.get('new') || stageMap.get('open');
      const inProgressStageId = stageMap.get('in progress') || stageMap.get('in_progress');
      const resolvedStageId = stageMap.get('resolved') || stageMap.get('closed');

      const [open, inProgress, resolved, total] = await Promise.all([
        openStageId ? prisma.ticket.count({ where: { tenantId, stageId: openStageId } }) : 0,
        inProgressStageId
          ? prisma.ticket.count({ where: { tenantId, stageId: inProgressStageId } })
          : 0,
        resolvedStageId
          ? prisma.ticket.count({ where: { tenantId, stageId: resolvedStageId } })
          : 0,
        prisma.ticket.count({ where: { tenantId } }),
      ]);

      return { open, inProgress, resolved, total };
    } catch (error) {
      console.error('Ticket stats error:', error.message);
      return { open: 0, inProgress: 0, resolved: 0, total: 0 };
    }
  }
}

export const ticketsService = new TicketsService();
