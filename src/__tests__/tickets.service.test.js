/**
 * Tickets Service Unit Tests
 *
 * Tests for ticket management, assignment, comments, and SLA
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing service
vi.mock('@crm360/database', () => ({
  prisma: {
    ticket: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    sLAPolicy: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@crm360/shared', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(message) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
}));

vi.mock('../../common/events/event-bus.js', () => ({
  eventBus: {
    publish: vi.fn(),
  },
  createEvent: vi.fn((type, tenantId, data, meta) => ({
    type,
    tenantId,
    data,
    meta,
  })),
  EventTypes: {
    TICKET_CREATED: 'TICKET_CREATED',
    TICKET_ASSIGNED: 'TICKET_ASSIGNED',
    TICKET_RESOLVED: 'TICKET_RESOLVED',
  },
}));

import { ticketsService } from '../modules/tickets/tickets.service.js';
import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import { eventBus, createEvent, EventTypes } from '../../common/events/event-bus.js';

describe('TicketsService', () => {
  const tenantId = 'tenant-123';
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ GET TICKETS TESTS ============

  describe('getTickets', () => {
    const filters = { page: 1, limit: 10 };

    it('should return tickets with pagination', async () => {
      const mockTickets = [
        {
          id: 'ticket-1',
          subject: 'Login Issue',
          status: 'OPEN',
          priority: 'HIGH',
          assignedTo: userId,
          contact: { id: 'c1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        },
        {
          id: 'ticket-2',
          subject: 'Feature Request',
          status: 'OPEN',
          priority: 'MEDIUM',
          assignedTo: null,
          contact: { id: 'c2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
        },
      ];

      const mockUsers = [{ id: userId, firstName: 'Support', lastName: 'Agent' }];

      prisma.ticket.findMany.mockResolvedValue(mockTickets);
      prisma.ticket.count.mockResolvedValue(2);
      prisma.user.findMany.mockResolvedValue(mockUsers);

      const result = await ticketsService.getTickets(tenantId, filters);

      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.tickets).toHaveLength(2);
      expect(result.tickets[0].assignedToUser).toEqual(mockUsers[0]);
      expect(result.tickets[1].assignedToUser).toBeNull();
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter tickets by status', async () => {
      const filtersWithStatus = { ...filters, status: 'OPEN' };

      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      await ticketsService.getTickets(tenantId, filtersWithStatus);

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, status: 'OPEN' },
        })
      );
    });

    it('should filter tickets by priority', async () => {
      const filtersWithPriority = { ...filters, priority: 'HIGH' };

      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      await ticketsService.getTickets(tenantId, filtersWithPriority);

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, priority: 'HIGH' },
        })
      );
    });

    it('should filter tickets by assignedTo', async () => {
      const filtersWithAssigned = { ...filters, assignedTo: userId };

      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      await ticketsService.getTickets(tenantId, filtersWithAssigned);

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, assignedTo: userId },
        })
      );
    });

    it('should search tickets by subject or description', async () => {
      const filtersWithSearch = { ...filters, search: 'login' };

      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      await ticketsService.getTickets(tenantId, filtersWithSearch);

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId,
            OR: [
              { subject: { contains: 'login', mode: 'insensitive' } },
              { description: { contains: 'login', mode: 'insensitive' } },
            ],
          },
        })
      );
    });

    it('should calculate pagination correctly', async () => {
      const filtersPage2 = { page: 2, limit: 5 };

      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(12);
      prisma.user.findMany.mockResolvedValue([]);

      const result = await ticketsService.getTickets(tenantId, filtersPage2);

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        })
      );
      expect(result.meta.totalPages).toBe(3);
    });

    it('should not query users when no tickets have assignments', async () => {
      const mockTickets = [{ id: 'ticket-1', assignedTo: null }];

      prisma.ticket.findMany.mockResolvedValue(mockTickets);
      prisma.ticket.count.mockResolvedValue(1);

      await ticketsService.getTickets(tenantId, filters);

      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });
  });

  // ============ GET TICKET TESTS ============

  describe('getTicket', () => {
    it('should return a ticket by id with comments', async () => {
      const mockTicket = {
        id: 'ticket-1',
        subject: 'Login Issue',
        tenantId,
        assignedTo: userId,
        contact: { id: 'c1', firstName: 'John', lastName: 'Doe' },
        metadata: {
          comments: [
            {
              id: 'comment-1',
              content: 'Working on this',
              userId,
              createdAt: '2024-01-15T10:00:00Z',
            },
          ],
        },
      };

      const mockUser = { id: userId, firstName: 'Support', lastName: 'Agent' };

      prisma.ticket.findFirst.mockResolvedValue(mockTicket);
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await ticketsService.getTicket(tenantId, 'ticket-1');

      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: 'ticket-1', tenantId },
        include: { contact: true },
      });
      expect(result.assignedToUser).toEqual(mockUser);
      expect(result.comments).toHaveLength(1);
    });

    it('should return empty comments when no metadata', async () => {
      const mockTicket = {
        id: 'ticket-1',
        tenantId,
        assignedTo: null,
        metadata: null,
      };

      prisma.ticket.findFirst.mockResolvedValue(mockTicket);

      const result = await ticketsService.getTicket(tenantId, 'ticket-1');

      expect(result.comments).toEqual([]);
      expect(result.assignedToUser).toBeNull();
    });

    it('should throw NotFoundError when ticket does not exist', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(ticketsService.getTicket(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============ CREATE TICKET TESTS ============

  describe('createTicket', () => {
    it('should create a new ticket', async () => {
      const data = {
        subject: 'New Support Request',
        description: 'Cannot login to the system',
        contactId: 'contact-1',
        priority: 'HIGH',
        category: 'Technical',
      };

      const mockTicket = {
        id: 'ticket-1',
        ...data,
        tenantId,
        status: 'OPEN',
        assignedTo: userId,
        contact: { id: 'contact-1', firstName: 'John', lastName: 'Doe' },
      };

      prisma.ticket.create.mockResolvedValue(mockTicket);

      const result = await ticketsService.createTicket(tenantId, userId, data);

      expect(prisma.ticket.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          subject: data.subject,
          description: data.description,
          contactId: data.contactId,
          priority: 'HIGH',
          category: data.category,
          status: 'OPEN',
          assignedTo: userId,
        },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      expect(result).toEqual(mockTicket);
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(
        EventTypes.TICKET_CREATED,
        tenantId,
        { ticketId: 'ticket-1' },
        { userId }
      );
    });

    it('should use MEDIUM as default priority', async () => {
      const data = {
        subject: 'General Inquiry',
        description: 'Question about features',
      };

      prisma.ticket.create.mockResolvedValue({ id: 'ticket-1', ...data });

      await ticketsService.createTicket(tenantId, userId, data);

      expect(prisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: 'MEDIUM',
          }),
        })
      );
    });

    it('should handle event bus errors gracefully', async () => {
      const data = { subject: 'Test', description: 'Test description' };

      prisma.ticket.create.mockResolvedValue({ id: 'ticket-1', ...data });
      eventBus.publish.mockImplementation(() => {
        throw new Error('Event bus error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ticketsService.createTicket(tenantId, userId, data);

      expect(result.id).toBe('ticket-1');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ============ UPDATE TICKET TESTS ============

  describe('updateTicket', () => {
    it('should update ticket fields', async () => {
      const existingTicket = { id: 'ticket-1', tenantId, subject: 'Old Subject' };
      const updateData = {
        subject: 'Updated Subject',
        description: 'Updated description',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
      };

      prisma.ticket.findFirst.mockResolvedValue(existingTicket);
      prisma.ticket.update.mockResolvedValue({
        ...existingTicket,
        ...updateData,
        contact: { id: 'c1', firstName: 'John', lastName: 'Doe' },
      });

      const result = await ticketsService.updateTicket(tenantId, 'ticket-1', updateData);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: {
          subject: 'Updated Subject',
          description: 'Updated description',
          priority: 'HIGH',
          status: 'IN_PROGRESS',
        },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      expect(result.subject).toBe('Updated Subject');
    });

    it('should only update provided fields', async () => {
      const existingTicket = { id: 'ticket-1', tenantId };
      const updateData = { priority: 'LOW' };

      prisma.ticket.findFirst.mockResolvedValue(existingTicket);
      prisma.ticket.update.mockResolvedValue({ ...existingTicket, priority: 'LOW' });

      await ticketsService.updateTicket(tenantId, 'ticket-1', updateData);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: { priority: 'LOW' },
        include: expect.anything(),
      });
    });

    it('should throw NotFoundError when ticket does not exist', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(ticketsService.updateTicket(tenantId, 'nonexistent', {})).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============ ASSIGN TICKET TESTS ============

  describe('assignTicket', () => {
    it('should assign ticket to a user', async () => {
      const existingTicket = { id: 'ticket-1', tenantId, assignedTo: null };
      const newAssignee = { id: 'user-456', firstName: 'New', lastName: 'Agent' };

      prisma.ticket.findFirst.mockResolvedValue(existingTicket);
      prisma.user.findUnique.mockResolvedValue(newAssignee);
      prisma.ticket.update.mockResolvedValue({
        ...existingTicket,
        assignedTo: 'user-456',
      });

      const result = await ticketsService.assignTicket(tenantId, 'ticket-1', 'user-456');

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: { assignedTo: 'user-456' },
      });
      expect(result.assignedToUser).toEqual(newAssignee);
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(EventTypes.TICKET_ASSIGNED, tenantId, {
        ticketId: 'ticket-1',
        assignedToId: 'user-456',
      });
    });

    it('should throw NotFoundError when ticket does not exist', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(ticketsService.assignTicket(tenantId, 'nonexistent', userId)).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError when user does not exist', async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: 'ticket-1', tenantId });
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        ticketsService.assignTicket(tenantId, 'ticket-1', 'nonexistent-user')
      ).rejects.toThrow(NotFoundError);
    });

    it('should handle event bus errors gracefully', async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: 'ticket-1', tenantId });
      prisma.user.findUnique.mockResolvedValue({ id: userId, firstName: 'Test', lastName: 'User' });
      prisma.ticket.update.mockResolvedValue({ id: 'ticket-1', assignedTo: userId });
      eventBus.publish.mockImplementation(() => {
        throw new Error('Event error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ticketsService.assignTicket(tenantId, 'ticket-1', userId);

      expect(result.assignedTo).toBe(userId);
      consoleSpy.mockRestore();
    });
  });

  // ============ RESOLVE TICKET TESTS ============

  describe('resolveTicket', () => {
    it('should resolve a ticket', async () => {
      const existingTicket = { id: 'ticket-1', tenantId, status: 'OPEN' };

      prisma.ticket.findFirst.mockResolvedValue(existingTicket);
      prisma.ticket.update.mockResolvedValue({
        ...existingTicket,
        status: 'RESOLVED',
        resolvedAt: new Date(),
      });

      const result = await ticketsService.resolveTicket(tenantId, 'ticket-1');

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: {
          status: 'RESOLVED',
          resolvedAt: expect.any(Date),
        },
      });
      expect(result.status).toBe('RESOLVED');
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(EventTypes.TICKET_RESOLVED, tenantId, {
        ticketId: 'ticket-1',
      });
    });

    it('should throw NotFoundError when ticket does not exist', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(ticketsService.resolveTicket(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should handle event bus errors gracefully', async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: 'ticket-1', tenantId });
      prisma.ticket.update.mockResolvedValue({ id: 'ticket-1', status: 'RESOLVED' });
      eventBus.publish.mockImplementation(() => {
        throw new Error('Event error');
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ticketsService.resolveTicket(tenantId, 'ticket-1');

      expect(result.status).toBe('RESOLVED');
      consoleSpy.mockRestore();
    });
  });

  // ============ ADD COMMENT TESTS ============

  describe('addComment', () => {
    it('should add a comment to a ticket', async () => {
      const existingTicket = {
        id: 'ticket-1',
        tenantId,
        metadata: { comments: [] },
      };
      const user = { id: userId, firstName: 'Support', lastName: 'Agent' };

      prisma.ticket.findFirst.mockResolvedValue(existingTicket);
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.ticket.update.mockResolvedValue({});

      const result = await ticketsService.addComment(
        tenantId,
        'ticket-1',
        userId,
        'Working on this issue',
        false
      );

      expect(result.content).toBe('Working on this issue');
      expect(result.isInternal).toBe(false);
      expect(result.userId).toBe(userId);
      expect(result.user).toEqual(user);
      expect(result.id).toMatch(/^comment-/);
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: {
          metadata: {
            comments: [expect.objectContaining({ content: 'Working on this issue' })],
          },
        },
      });
    });

    it('should add internal comment', async () => {
      const existingTicket = {
        id: 'ticket-1',
        tenantId,
        metadata: null,
      };
      const user = { id: userId, firstName: 'Support', lastName: 'Agent' };

      prisma.ticket.findFirst.mockResolvedValue(existingTicket);
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.ticket.update.mockResolvedValue({});

      const result = await ticketsService.addComment(
        tenantId,
        'ticket-1',
        userId,
        'Internal note for team',
        true
      );

      expect(result.isInternal).toBe(true);
    });

    it('should append to existing comments', async () => {
      const existingComment = {
        id: 'comment-1',
        content: 'First comment',
        userId: 'other-user',
        createdAt: '2024-01-15T10:00:00Z',
      };
      const existingTicket = {
        id: 'ticket-1',
        tenantId,
        metadata: { comments: [existingComment] },
      };
      const user = { id: userId, firstName: 'Support', lastName: 'Agent' };

      prisma.ticket.findFirst.mockResolvedValue(existingTicket);
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.ticket.update.mockResolvedValue({});

      await ticketsService.addComment(tenantId, 'ticket-1', userId, 'Second comment', false);

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: {
          metadata: {
            comments: [existingComment, expect.objectContaining({ content: 'Second comment' })],
          },
        },
      });
    });

    it('should throw NotFoundError when ticket does not exist', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        ticketsService.addComment(tenantId, 'nonexistent', userId, 'Comment', false)
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ============ SLA POLICIES TESTS ============

  describe('getSLAPolicies', () => {
    it('should return SLA policies for a tenant', async () => {
      const mockPolicies = [
        { id: 'sla-1', name: 'Critical', responseTime: 60, resolutionTime: 240 },
        { id: 'sla-2', name: 'Standard', responseTime: 480, resolutionTime: 1440 },
      ];

      prisma.sLAPolicy.findMany.mockResolvedValue(mockPolicies);

      const result = await ticketsService.getSLAPolicies(tenantId);

      expect(prisma.sLAPolicy.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockPolicies);
    });

    it('should return empty array when SLAPolicy model fails', async () => {
      prisma.sLAPolicy.findMany.mockRejectedValue(new Error('Model not found'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ticketsService.getSLAPolicies(tenantId);

      expect(result).toEqual([]);
      consoleSpy.mockRestore();
    });
  });

  // ============ TICKET STATS TESTS ============

  describe('getTicketStats', () => {
    it('should return ticket statistics', async () => {
      prisma.ticket.count
        .mockResolvedValueOnce(10) // open
        .mockResolvedValueOnce(5) // inProgress
        .mockResolvedValueOnce(15) // resolved
        .mockResolvedValueOnce(30); // total

      const result = await ticketsService.getTicketStats(tenantId);

      expect(prisma.ticket.count).toHaveBeenCalledTimes(4);
      expect(prisma.ticket.count).toHaveBeenNthCalledWith(1, {
        where: { tenantId, status: 'OPEN' },
      });
      expect(prisma.ticket.count).toHaveBeenNthCalledWith(2, {
        where: { tenantId, status: 'IN_PROGRESS' },
      });
      expect(prisma.ticket.count).toHaveBeenNthCalledWith(3, {
        where: { tenantId, status: 'RESOLVED' },
      });
      expect(prisma.ticket.count).toHaveBeenNthCalledWith(4, { where: { tenantId } });
      expect(result).toEqual({
        open: 10,
        inProgress: 5,
        resolved: 15,
        total: 30,
      });
    });

    it('should return zeros when no tickets exist', async () => {
      prisma.ticket.count.mockResolvedValue(0);

      const result = await ticketsService.getTicketStats(tenantId);

      expect(result).toEqual({
        open: 0,
        inProgress: 0,
        resolved: 0,
        total: 0,
      });
    });
  });

  // ============ TENANT ISOLATION TESTS ============

  describe('Tenant Isolation', () => {
    it('should not return tickets from other tenants', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(ticketsService.getTicket('different-tenant', 'ticket-1')).rejects.toThrow(
        NotFoundError
      );

      expect(prisma.ticket.findFirst).toHaveBeenCalledWith({
        where: { id: 'ticket-1', tenantId: 'different-tenant' },
        include: { contact: true },
      });
    });

    it('should not allow updating tickets from other tenants', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        ticketsService.updateTicket('different-tenant', 'ticket-1', { subject: 'Test' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should not allow assigning tickets from other tenants', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        ticketsService.assignTicket('different-tenant', 'ticket-1', userId)
      ).rejects.toThrow(NotFoundError);
    });

    it('should not allow resolving tickets from other tenants', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(ticketsService.resolveTicket('different-tenant', 'ticket-1')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should not allow adding comments to tickets from other tenants', async () => {
      prisma.ticket.findFirst.mockResolvedValue(null);

      await expect(
        ticketsService.addComment('different-tenant', 'ticket-1', userId, 'Comment', false)
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ============ EVENT PUBLISHING TESTS ============

  describe('Event Publishing', () => {
    it('should publish TICKET_CREATED event on creation', async () => {
      const data = { subject: 'Test', description: 'Test description' };
      prisma.ticket.create.mockResolvedValue({ id: 'ticket-1', ...data });

      await ticketsService.createTicket(tenantId, userId, data);

      expect(createEvent).toHaveBeenCalledWith(
        EventTypes.TICKET_CREATED,
        tenantId,
        { ticketId: 'ticket-1' },
        { userId }
      );
      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('should publish TICKET_ASSIGNED event on assignment', async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: 'ticket-1', tenantId });
      prisma.user.findUnique.mockResolvedValue({ id: 'user-456' });
      prisma.ticket.update.mockResolvedValue({ id: 'ticket-1', assignedTo: 'user-456' });

      await ticketsService.assignTicket(tenantId, 'ticket-1', 'user-456');

      expect(createEvent).toHaveBeenCalledWith(EventTypes.TICKET_ASSIGNED, tenantId, {
        ticketId: 'ticket-1',
        assignedToId: 'user-456',
      });
    });

    it('should publish TICKET_RESOLVED event on resolution', async () => {
      prisma.ticket.findFirst.mockResolvedValue({ id: 'ticket-1', tenantId });
      prisma.ticket.update.mockResolvedValue({ id: 'ticket-1', status: 'RESOLVED' });

      await ticketsService.resolveTicket(tenantId, 'ticket-1');

      expect(createEvent).toHaveBeenCalledWith(EventTypes.TICKET_RESOLVED, tenantId, {
        ticketId: 'ticket-1',
      });
    });
  });

  // ============ EDGE CASES ============

  describe('Edge Cases', () => {
    it('should handle tickets without contacts', async () => {
      const mockTicket = {
        id: 'ticket-1',
        tenantId,
        contactId: null,
        contact: null,
        assignedTo: null,
        metadata: null,
      };

      prisma.ticket.findFirst.mockResolvedValue(mockTicket);

      const result = await ticketsService.getTicket(tenantId, 'ticket-1');

      expect(result.contact).toBeNull();
      expect(result.assignedToUser).toBeNull();
      expect(result.comments).toEqual([]);
    });

    it('should handle empty update data', async () => {
      const existingTicket = { id: 'ticket-1', tenantId };

      prisma.ticket.findFirst.mockResolvedValue(existingTicket);
      prisma.ticket.update.mockResolvedValue(existingTicket);

      await ticketsService.updateTicket(tenantId, 'ticket-1', {});

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: {},
        include: expect.anything(),
      });
    });

    it('should handle multiple filters combined', async () => {
      const complexFilters = {
        page: 1,
        limit: 10,
        status: 'OPEN',
        priority: 'HIGH',
        assignedTo: userId,
        search: 'urgent',
      };

      prisma.ticket.findMany.mockResolvedValue([]);
      prisma.ticket.count.mockResolvedValue(0);
      prisma.user.findMany.mockResolvedValue([]);

      await ticketsService.getTickets(tenantId, complexFilters);

      expect(prisma.ticket.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId,
            status: 'OPEN',
            priority: 'HIGH',
            assignedTo: userId,
            OR: [
              { subject: { contains: 'urgent', mode: 'insensitive' } },
              { description: { contains: 'urgent', mode: 'insensitive' } },
            ],
          },
        })
      );
    });
  });
});
