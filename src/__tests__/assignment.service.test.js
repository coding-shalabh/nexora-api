import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @crm360/database
vi.mock('@crm360/database', () => ({
  prisma: {
    autoAssignmentRule: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    conversation: {
      update: vi.fn(),
      groupBy: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    teamMember: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from '@crm360/database';
import { assignmentService } from '../modules/inbox/assignment.service.js';

describe('AssignmentService', () => {
  const tenantId = 'tenant-123';
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ matchesConditions ============
  describe('matchesConditions', () => {
    it('should return true when no conditions', () => {
      expect(assignmentService.matchesConditions(null, {})).toBe(true);
      expect(assignmentService.matchesConditions(undefined, {})).toBe(true);
    });

    it('should match channel condition', () => {
      const conditions = { channel: 'WHATSAPP' };
      expect(assignmentService.matchesConditions(conditions, { channel: 'WHATSAPP' })).toBe(true);
      expect(assignmentService.matchesConditions(conditions, { channel: 'SMS' })).toBe(false);
    });

    it('should match priority condition', () => {
      const conditions = { priority: 'HIGH' };
      expect(assignmentService.matchesConditions(conditions, { priority: 'HIGH' })).toBe(true);
      expect(assignmentService.matchesConditions(conditions, { priority: 'LOW' })).toBe(false);
    });

    it('should match keywords condition (case-insensitive)', () => {
      const conditions = { keywords: ['urgent', 'help'] };
      expect(
        assignmentService.matchesConditions(conditions, { content: 'I need URGENT help!' })
      ).toBe(true);
      expect(
        assignmentService.matchesConditions(conditions, { content: 'This is HELP request' })
      ).toBe(true);
      expect(
        assignmentService.matchesConditions(conditions, { content: 'Just a regular message' })
      ).toBe(false);
    });

    it('should match empty keywords array', () => {
      const conditions = { keywords: [] };
      expect(assignmentService.matchesConditions(conditions, { content: 'Any message' })).toBe(
        true
      );
    });

    it('should match multiple conditions', () => {
      const conditions = {
        channel: 'WHATSAPP',
        priority: 'HIGH',
        keywords: ['urgent'],
      };
      expect(
        assignmentService.matchesConditions(conditions, {
          channel: 'WHATSAPP',
          priority: 'HIGH',
          content: 'This is urgent!',
        })
      ).toBe(true);
      expect(
        assignmentService.matchesConditions(conditions, {
          channel: 'SMS', // Wrong channel
          priority: 'HIGH',
          content: 'This is urgent!',
        })
      ).toBe(false);
    });
  });

  // ============ isBusinessHours ============
  describe('isBusinessHours', () => {
    it('should be a function', () => {
      expect(typeof assignmentService.isBusinessHours).toBe('function');
    });

    // Note: This test is time-dependent, so we just verify it returns a boolean
    it('should return boolean', () => {
      const result = assignmentService.isBusinessHours();
      expect(typeof result).toBe('boolean');
    });
  });

  // ============ getSpecificUser ============
  describe('getSpecificUser', () => {
    it('should return user if online and active', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: userId,
        status: 'ACTIVE',
        isOnline: true,
      });

      const result = await assignmentService.getSpecificUser(tenantId, userId);

      expect(result).toEqual({ userId });
      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          id: userId,
          tenantId,
          status: 'ACTIVE',
          isOnline: true,
        },
      });
    });

    it('should return null if user not found or offline', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const result = await assignmentService.getSpecificUser(tenantId, userId);

      expect(result).toBeNull();
    });

    it('should return null if no userId provided', async () => {
      const result = await assignmentService.getSpecificUser(tenantId, null);

      expect(result).toBeNull();
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
    });
  });

  // ============ getAssignee ============
  describe('getAssignee', () => {
    it('should call getSpecificUser for USER type', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: userId });

      const rule = {
        assignToType: 'USER',
        assignToUserId: userId,
      };

      const result = await assignmentService.getAssignee(tenantId, rule);

      expect(result).toEqual({ userId });
    });

    it('should return team assignment for TEAM type', async () => {
      const rule = {
        assignToType: 'TEAM',
        assignToTeamId: 'team-123',
      };

      const result = await assignmentService.getAssignee(tenantId, rule);

      expect(result).toEqual({ userId: null, teamId: 'team-123' });
    });

    it('should return null for unknown type', async () => {
      const rule = {
        assignToType: 'UNKNOWN',
      };

      const result = await assignmentService.getAssignee(tenantId, rule);

      expect(result).toBeNull();
    });
  });

  // ============ getRoundRobinAssignee ============
  describe('getRoundRobinAssignee', () => {
    it('should return null if no team', async () => {
      const rule = { assignToTeamId: null };

      const result = await assignmentService.getRoundRobinAssignee(tenantId, rule);

      expect(result).toBeNull();
    });

    it('should return null if no online team members', async () => {
      prisma.teamMember.findMany.mockResolvedValue([
        { userId: 'user-1', user: null }, // Offline
        { userId: 'user-2', user: null }, // Offline
      ]);

      const rule = { id: 'rule-1', assignToTeamId: 'team-123' };

      const result = await assignmentService.getRoundRobinAssignee(tenantId, rule);

      expect(result).toBeNull();
    });

    it('should cycle through online members', async () => {
      prisma.teamMember.findMany.mockResolvedValue([
        { userId: 'user-1', user: { id: 'user-1', isOnline: true } },
        { userId: 'user-2', user: { id: 'user-2', isOnline: true } },
        { userId: 'user-3', user: { id: 'user-3', isOnline: true } },
      ]);
      prisma.autoAssignmentRule.update.mockResolvedValue({});

      // First call - should get user-1 (index 0)
      const rule = { id: 'rule-1', assignToTeamId: 'team-123', roundRobinConfig: null };
      const result = await assignmentService.getRoundRobinAssignee(tenantId, rule);

      expect(result).toEqual({ userId: 'user-1' });
      expect(prisma.autoAssignmentRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: {
          roundRobinConfig: { lastAssignedIndex: 0 },
        },
      });
    });

    it('should continue from last assigned index', async () => {
      prisma.teamMember.findMany.mockResolvedValue([
        { userId: 'user-1', user: { id: 'user-1', isOnline: true } },
        { userId: 'user-2', user: { id: 'user-2', isOnline: true } },
        { userId: 'user-3', user: { id: 'user-3', isOnline: true } },
      ]);
      prisma.autoAssignmentRule.update.mockResolvedValue({});

      const rule = {
        id: 'rule-1',
        assignToTeamId: 'team-123',
        roundRobinConfig: { lastAssignedIndex: 1 },
      };
      const result = await assignmentService.getRoundRobinAssignee(tenantId, rule);

      expect(result).toEqual({ userId: 'user-3' }); // Index 2
      expect(prisma.autoAssignmentRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: {
          roundRobinConfig: { lastAssignedIndex: 2 },
        },
      });
    });

    it('should wrap around to first member', async () => {
      prisma.teamMember.findMany.mockResolvedValue([
        { userId: 'user-1', user: { id: 'user-1', isOnline: true } },
        { userId: 'user-2', user: { id: 'user-2', isOnline: true } },
      ]);
      prisma.autoAssignmentRule.update.mockResolvedValue({});

      const rule = {
        id: 'rule-1',
        assignToTeamId: 'team-123',
        roundRobinConfig: { lastAssignedIndex: 1 }, // Was at index 1
      };
      const result = await assignmentService.getRoundRobinAssignee(tenantId, rule);

      expect(result).toEqual({ userId: 'user-1' }); // Wraps to index 0
    });
  });

  // ============ getLeastBusyAssignee ============
  describe('getLeastBusyAssignee', () => {
    it('should return null if no team', async () => {
      const rule = { assignToTeamId: null };

      const result = await assignmentService.getLeastBusyAssignee(tenantId, rule);

      expect(result).toBeNull();
    });

    it('should return null if no online team members', async () => {
      prisma.teamMember.findMany.mockResolvedValue([]);

      const rule = { assignToTeamId: 'team-123' };

      const result = await assignmentService.getLeastBusyAssignee(tenantId, rule);

      expect(result).toBeNull();
    });

    it('should return user with least conversations', async () => {
      prisma.teamMember.findMany.mockResolvedValue([
        { userId: 'user-1', user: { id: 'user-1', isOnline: true } },
        { userId: 'user-2', user: { id: 'user-2', isOnline: true } },
        { userId: 'user-3', user: { id: 'user-3', isOnline: true } },
      ]);
      prisma.conversation.groupBy.mockResolvedValue([
        { assignedToId: 'user-1', _count: { id: 5 } },
        { assignedToId: 'user-2', _count: { id: 2 } }, // Least busy
        { assignedToId: 'user-3', _count: { id: 8 } },
      ]);

      const rule = { assignToTeamId: 'team-123' };

      const result = await assignmentService.getLeastBusyAssignee(tenantId, rule);

      expect(result).toEqual({ userId: 'user-2' });
    });

    it('should return first user if all have 0 conversations', async () => {
      prisma.teamMember.findMany.mockResolvedValue([
        { userId: 'user-1', user: { id: 'user-1', isOnline: true } },
        { userId: 'user-2', user: { id: 'user-2', isOnline: true } },
      ]);
      prisma.conversation.groupBy.mockResolvedValue([]); // No active conversations

      const rule = { assignToTeamId: 'team-123' };

      const result = await assignmentService.getLeastBusyAssignee(tenantId, rule);

      expect(result).toEqual({ userId: 'user-1' });
    });
  });

  // ============ autoAssignConversation ============
  describe('autoAssignConversation', () => {
    it('should return null if no active rules', async () => {
      prisma.autoAssignmentRule.findMany.mockResolvedValue([]);

      const result = await assignmentService.autoAssignConversation(tenantId, 'conv-1', {});

      expect(result).toBeNull();
    });

    it('should match and apply first matching rule', async () => {
      prisma.autoAssignmentRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          name: 'High Priority Rule',
          conditions: { priority: 'HIGH' },
          assignToType: 'USER',
          assignToUserId: userId,
        },
      ]);
      prisma.autoAssignmentRule.update.mockResolvedValue({});
      prisma.user.findFirst.mockResolvedValue({ id: userId });
      prisma.conversation.update.mockResolvedValue({});

      const result = await assignmentService.autoAssignConversation(tenantId, 'conv-1', {
        priority: 'HIGH',
      });

      expect(result).toEqual({
        ruleId: 'rule-1',
        ruleName: 'High Priority Rule',
        assignedToId: userId,
        assignedToTeamId: undefined,
        assignmentType: 'USER',
      });
    });

    it('should skip rules that do not match conditions', async () => {
      prisma.autoAssignmentRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          name: 'WhatsApp Rule',
          conditions: { channel: 'WHATSAPP' },
          assignToType: 'USER',
          assignToUserId: userId,
        },
        {
          id: 'rule-2',
          name: 'SMS Rule',
          conditions: { channel: 'SMS' },
          assignToType: 'USER',
          assignToUserId: 'user-456',
        },
      ]);
      prisma.autoAssignmentRule.update.mockResolvedValue({});
      prisma.user.findFirst.mockResolvedValue({ id: 'user-456' });
      prisma.conversation.update.mockResolvedValue({});

      const result = await assignmentService.autoAssignConversation(tenantId, 'conv-1', {
        channel: 'SMS', // Matches rule-2
      });

      expect(result.ruleId).toBe('rule-2');
      expect(result.assignedToId).toBe('user-456');
    });

    it('should return null if no assignee found for matching rule', async () => {
      prisma.autoAssignmentRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          conditions: null, // Matches everything
          assignToType: 'USER',
          assignToUserId: userId,
        },
      ]);
      prisma.autoAssignmentRule.update.mockResolvedValue({});
      prisma.user.findFirst.mockResolvedValue(null); // User not available

      const result = await assignmentService.autoAssignConversation(tenantId, 'conv-1', {});

      expect(result).toBeNull();
    });

    it('should handle errors gracefully', async () => {
      prisma.autoAssignmentRule.findMany.mockRejectedValue(new Error('Database error'));

      const result = await assignmentService.autoAssignConversation(tenantId, 'conv-1', {});

      expect(result).toBeNull();
    });

    it('should increment matched count when rule matches', async () => {
      prisma.autoAssignmentRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          conditions: null,
          assignToType: 'USER',
          assignToUserId: userId,
        },
      ]);
      prisma.autoAssignmentRule.update.mockResolvedValue({});
      prisma.user.findFirst.mockResolvedValue({ id: userId });
      prisma.conversation.update.mockResolvedValue({});

      await assignmentService.autoAssignConversation(tenantId, 'conv-1', {});

      expect(prisma.autoAssignmentRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: { matchedCount: { increment: 1 } },
      });
    });

    it('should increment assigned count after successful assignment', async () => {
      prisma.autoAssignmentRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          conditions: null,
          assignToType: 'USER',
          assignToUserId: userId,
        },
      ]);
      prisma.autoAssignmentRule.update.mockResolvedValue({});
      prisma.user.findFirst.mockResolvedValue({ id: userId });
      prisma.conversation.update.mockResolvedValue({});

      await assignmentService.autoAssignConversation(tenantId, 'conv-1', {});

      // Should be called twice - once for matchedCount, once for assignedCount
      expect(prisma.autoAssignmentRule.update).toHaveBeenCalledTimes(2);
      expect(prisma.autoAssignmentRule.update).toHaveBeenLastCalledWith({
        where: { id: 'rule-1' },
        data: { assignedCount: { increment: 1 } },
      });
    });
  });

  // ============ updateAgentStatus ============
  describe('updateAgentStatus', () => {
    it('should update user online status', async () => {
      prisma.user.update.mockResolvedValue({
        id: userId,
        firstName: 'John',
        lastName: 'Doe',
        isOnline: true,
        lastSeenAt: new Date(),
      });

      const result = await assignmentService.updateAgentStatus(userId, true);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          isOnline: true,
          lastSeenAt: expect.any(Date),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          isOnline: true,
          lastSeenAt: true,
        },
      });
      expect(result.isOnline).toBe(true);
    });

    it('should set user offline', async () => {
      prisma.user.update.mockResolvedValue({
        id: userId,
        isOnline: false,
        lastSeenAt: new Date(),
      });

      await assignmentService.updateAgentStatus(userId, false);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isOnline: false,
          }),
        })
      );
    });
  });

  // ============ updateLastSeen ============
  describe('updateLastSeen', () => {
    it('should update last seen timestamp', async () => {
      prisma.user.update.mockResolvedValue({ id: userId });

      await assignmentService.updateLastSeen(userId);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          lastSeenAt: expect.any(Date),
        },
      });
    });
  });

  // ============ getOnlineAgents ============
  describe('getOnlineAgents', () => {
    it('should return online active agents', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          avatarUrl: 'http://example.com/avatar.png',
          isOnline: true,
          lastSeenAt: new Date(),
        },
      ]);

      const result = await assignmentService.getOnlineAgents(tenantId);

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          isOnline: true,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          isOnline: true,
          lastSeenAt: true,
        },
        orderBy: { firstName: 'asc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  // ============ getAgentsWithStatus ============
  describe('getAgentsWithStatus', () => {
    it('should return agents with conversation counts', async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Doe',
          avatarUrl: null,
          isOnline: true,
          lastSeenAt: new Date(),
          _count: {
            assignedConversations: 5,
          },
        },
        {
          id: 'user-2',
          firstName: 'Jane',
          lastName: 'Smith',
          avatarUrl: null,
          isOnline: false,
          lastSeenAt: new Date(),
          _count: {
            assignedConversations: 2,
          },
        },
      ]);

      const result = await assignmentService.getAgentsWithStatus(tenantId);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        avatarUrl: null,
        isOnline: true,
        lastSeenAt: expect.any(Date),
        activeConversations: 5,
      });
    });
  });

  // ============ markInactiveAgentsOffline ============
  describe('markInactiveAgentsOffline', () => {
    it('should mark inactive agents as offline', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 3 });

      const result = await assignmentService.markInactiveAgentsOffline(5);

      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: {
          isOnline: true,
          lastSeenAt: { lt: expect.any(Date) },
        },
        data: {
          isOnline: false,
        },
      });
      expect(result.count).toBe(3);
    });

    it('should use default threshold of 5 minutes', async () => {
      prisma.user.updateMany.mockResolvedValue({ count: 0 });

      await assignmentService.markInactiveAgentsOffline();

      expect(prisma.user.updateMany).toHaveBeenCalled();
    });
  });
});
