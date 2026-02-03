import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import { eventBus, createEvent, EventTypes } from '../../common/events/event-bus.js';

class TicketsService {
  async getTickets(tenantId, filters) {
    const where = { tenantId };

    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedTo) where.assignedTo = filters.assignedTo;

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
        },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.ticket.count({ where }),
    ]);

    // Fetch assigned user info separately since assignedTo is a string field
    const assignedUserIds = [
      ...new Set(tickets.filter((t) => t.assignedTo).map((t) => t.assignedTo)),
    ];
    const assignedUsers =
      assignedUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: assignedUserIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : [];

    const userMap = new Map(assignedUsers.map((u) => [u.id, u]));

    // Enrich tickets with assigned user data
    const enrichedTickets = tickets.map((ticket) => ({
      ...ticket,
      assignedToUser: ticket.assignedTo ? userMap.get(ticket.assignedTo) || null : null,
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
      },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket not found');
    }

    // Fetch assigned user if exists
    let assignedToUser = null;
    if (ticket.assignedTo) {
      assignedToUser = await prisma.user.findUnique({
        where: { id: ticket.assignedTo },
        select: { id: true, firstName: true, lastName: true },
      });
    }

    // Note: Activity model doesn't have entityType/entityId/notes fields
    // Comments will be stored in ticket.metadata.comments for now
    const comments = ticket.metadata?.comments || [];

    return {
      ...ticket,
      assignedToUser,
      comments,
    };
  }

  async createTicket(tenantId, userId, data) {
    const ticket = await prisma.ticket.create({
      data: {
        tenantId,
        subject: data.subject,
        description: data.description,
        contactId: data.contactId,
        priority: data.priority || 'MEDIUM',
        category: data.category,
        status: 'OPEN',
        assignedTo: userId,
      },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Note: Activity model doesn't have entityType/entityId fields
    // Skipping activity creation for now - can be added later with proper schema

    try {
      eventBus.publish(
        createEvent(EventTypes.TICKET_CREATED, tenantId, { ticketId: ticket.id }, { userId })
      );
    } catch (e) {
      // Event bus errors shouldn't fail the operation
      console.error('Event publish error:', e);
    }

    return ticket;
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
    if (data.status !== undefined) updateData.status = data.status;
    if (data.category !== undefined) updateData.category = data.category;

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: updateData,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return updated;
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
      data: { assignedTo: assignedToId },
    });

    // Note: Skipping activity creation - Activity model doesn't have entityType/entityId

    try {
      eventBus.publish(
        createEvent(EventTypes.TICKET_ASSIGNED, tenantId, { ticketId, assignedToId })
      );
    } catch (e) {
      console.error('Event publish error:', e);
    }

    return {
      ...updated,
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

    const updated = await prisma.ticket.update({
      where: { id: ticketId },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });

    try {
      eventBus.publish(createEvent(EventTypes.TICKET_RESOLVED, tenantId, { ticketId }));
    } catch (e) {
      console.error('Event publish error:', e);
    }

    return updated;
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

    // Store comments in ticket.metadata
    const existingComments = ticket.metadata?.comments || [];
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
        metadata: {
          ...(ticket.metadata || {}),
          comments: updatedComments,
        },
      },
    });

    return newComment;
  }

  async getSLAPolicies(tenantId) {
    // Check if SLAPolicy model exists
    try {
      const policies = await prisma.sLAPolicy.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
      return policies;
    } catch (e) {
      // Model may not exist, return empty array
      console.error('SLAPolicy query error:', e.message);
      return [];
    }
  }

  async getTicketStats(tenantId) {
    try {
      const [open, inProgress, resolved, total] = await Promise.all([
        prisma.ticket.count({ where: { tenantId, status: 'OPEN' } }),
        prisma.ticket.count({ where: { tenantId, status: 'IN_PROGRESS' } }),
        prisma.ticket.count({ where: { tenantId, status: 'RESOLVED' } }),
        prisma.ticket.count({ where: { tenantId } }),
      ]);

      return { open, inProgress, resolved, total };
    } catch (error) {
      // Graceful degradation if stats query fails
      console.error('Ticket stats error:', error.message);
      return { open: 0, inProgress: 0, resolved: 0, total: 0 };
    }
  }
}

export const ticketsService = new TicketsService();
