import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @crm360/database
vi.mock('@crm360/database', () => ({
  prisma: {
    conversation: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    conversationThread: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    conversationNote: {
      deleteMany: vi.fn(),
    },
    message_events: {
      findMany: vi.fn(),
    },
    channel: {
      findMany: vi.fn(),
    },
    channelAccount: {
      findFirst: vi.fn(),
    },
    signature: {
      findFirst: vi.fn(),
    },
    template: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    tag: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

// Mock @crm360/shared
vi.mock('@crm360/shared', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(message) {
      super(message);
      this.name = 'NotFoundError';
      this.statusCode = 404;
    }
  },
}));

// Mock logger
vi.mock('../../common/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock WhatsApp service
vi.mock('../../common/providers/whatsapp/whatsapp.service.js', () => ({
  whatsAppService: {
    sendText: vi.fn(),
  },
}));

// Mock WebSocket service
vi.mock('../../common/websocket/socket.service.js', () => ({
  broadcastNewMessage: vi.fn(),
  broadcastMessageStatus: vi.fn(),
}));

import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import { inboxService } from '../modules/inbox/inbox.service.js';
import { whatsAppService } from '../../common/providers/whatsapp/whatsapp.service.js';
import {
  broadcastNewMessage,
  broadcastMessageStatus,
} from '../../common/websocket/socket.service.js';

describe('InboxService', () => {
  const tenantId = 'tenant-123';
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ getChannelDisplayType ============
  describe('getChannelDisplayType', () => {
    it('should map WHATSAPP to whatsapp', () => {
      expect(inboxService.getChannelDisplayType('WHATSAPP')).toBe('whatsapp');
    });

    it('should map SMS to sms', () => {
      expect(inboxService.getChannelDisplayType('SMS')).toBe('sms');
    });

    it('should map EMAIL to email', () => {
      expect(inboxService.getChannelDisplayType('EMAIL')).toBe('email');
    });

    it('should map EMAIL_GMAIL to email', () => {
      expect(inboxService.getChannelDisplayType('EMAIL_GMAIL')).toBe('email');
    });

    it('should map EMAIL_MICROSOFT to email', () => {
      expect(inboxService.getChannelDisplayType('EMAIL_MICROSOFT')).toBe('email');
    });

    it('should map EMAIL_SMTP to email', () => {
      expect(inboxService.getChannelDisplayType('EMAIL_SMTP')).toBe('email');
    });

    it('should map VOICE to voice', () => {
      expect(inboxService.getChannelDisplayType('VOICE')).toBe('voice');
    });

    it('should return unknown for null/undefined', () => {
      expect(inboxService.getChannelDisplayType(null)).toBe('unknown');
      expect(inboxService.getChannelDisplayType(undefined)).toBe('unknown');
    });

    it('should lowercase unknown channel types', () => {
      expect(inboxService.getChannelDisplayType('CUSTOM')).toBe('custom');
    });
  });

  // ============ getConversations ============
  describe('getConversations', () => {
    const mockConversation = {
      id: 'conv-1',
      contactId: 'contact-1',
      channelId: 'channel-1',
      contactPhone: '+919876543210',
      status: 'OPEN',
      unreadCount: 2,
      lastMessagePreview: 'Hello!',
      lastCustomerMessageAt: new Date(),
      updatedAt: new Date(),
      contact: {
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        displayName: null,
        phone: '+919876543210',
        email: 'john@example.com',
      },
    };

    beforeEach(() => {
      prisma.conversation.findMany.mockResolvedValue([mockConversation]);
      prisma.conversation.count.mockResolvedValue(1);
      prisma.channel.findMany.mockResolvedValue([{ id: 'channel-1', type: 'WHATSAPP' }]);
    });

    it('should return conversations list with pagination', async () => {
      const result = await inboxService.getConversations(tenantId);

      expect(result.conversations).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 25,
        totalPages: 1,
      });
    });

    it('should filter by status', async () => {
      await inboxService.getConversations(tenantId, { status: 'OPEN' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'OPEN',
          }),
        })
      );
    });

    it('should filter by multiple statuses', async () => {
      await inboxService.getConversations(tenantId, { status: 'OPEN,PENDING' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['OPEN', 'PENDING'] },
          }),
        })
      );
    });

    it('should filter by bucket - all', async () => {
      await inboxService.getConversations(tenantId, { bucket: 'all' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['OPEN', 'PENDING'] },
          }),
        })
      );
    });

    it('should filter by bucket - unread', async () => {
      await inboxService.getConversations(tenantId, { bucket: 'unread' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            unreadCount: { gt: 0 },
          }),
        })
      );
    });

    it('should filter by bucket - resolved', async () => {
      await inboxService.getConversations(tenantId, { bucket: 'resolved' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'RESOLVED',
          }),
        })
      );
    });

    it('should filter by bucket - archived', async () => {
      await inboxService.getConversations(tenantId, { bucket: 'archived' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['RESOLVED', 'CLOSED'] },
          }),
        })
      );
    });

    it('should filter by unassigned', async () => {
      await inboxService.getConversations(tenantId, { unassigned: 'true' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedToId: null,
          }),
        })
      );
    });

    it('should filter by channelType', async () => {
      await inboxService.getConversations(tenantId, { channelType: 'whatsapp' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            channel: { type: 'WHATSAPP' },
          }),
        })
      );
    });

    it('should filter by assignedTo', async () => {
      await inboxService.getConversations(tenantId, { assignedTo: userId });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedToId: userId,
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      const dateFrom = '2024-01-01';
      const dateTo = '2024-12-31';
      await inboxService.getConversations(tenantId, { dateFrom, dateTo });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            updatedAt: {
              gte: new Date(dateFrom),
              lte: new Date(dateTo),
            },
          }),
        })
      );
    });

    it('should search conversations', async () => {
      await inboxService.getConversations(tenantId, { search: 'john' });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.any(Array),
          }),
        })
      );
    });

    it('should apply pagination', async () => {
      await inboxService.getConversations(tenantId, { page: 2, limit: 10 });

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        })
      );
    });

    it('should transform conversation to expected format', async () => {
      const result = await inboxService.getConversations(tenantId);

      expect(result.conversations[0]).toEqual(
        expect.objectContaining({
          id: 'conv-1',
          contactId: 'contact-1',
          contactName: 'John Doe',
          contactPhone: '+919876543210',
          status: 'open',
          channelType: 'whatsapp',
        })
      );
    });
  });

  // ============ getConversation ============
  describe('getConversation', () => {
    const mockConversation = {
      id: 'conv-1',
      contactId: 'contact-1',
      contactPhone: '+919876543210',
      status: 'OPEN',
      unreadCount: 2,
      priority: 'HIGH',
      lastCustomerMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      contact: {
        id: 'contact-1',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+919876543210',
        email: 'john@example.com',
      },
      channel: { type: 'WHATSAPP' },
    };

    it('should return conversation by id', async () => {
      prisma.conversation.findFirst.mockResolvedValue(mockConversation);

      const result = await inboxService.getConversation(tenantId, 'conv-1');

      expect(result.id).toBe('conv-1');
      expect(result.status).toBe('open');
      expect(result.channelType).toBe('whatsapp');
    });

    it('should throw NotFoundError if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(inboxService.getConversation(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============ getMessages ============
  describe('getMessages', () => {
    const mockMessages = [
      {
        id: 'msg-1',
        threadId: 'conv-1',
        direction: 'INBOUND',
        contentType: 'TEXT',
        textContent: 'Hello!',
        channel: 'WHATSAPP',
        sentAt: new Date(),
        deliveredAt: new Date(),
        readAt: null,
        failedAt: null,
      },
    ];

    it('should return messages for conversation', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1', tenantId });
      prisma.message_events.findMany.mockResolvedValue(mockMessages);

      const result = await inboxService.getMessages(tenantId, 'conv-1');

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].direction).toBe('inbound');
      expect(result.messages[0].status).toBe('delivered');
    });

    it('should throw NotFoundError if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(inboxService.getMessages(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should indicate hasMore when more messages exist', async () => {
      const manyMessages = Array(51)
        .fill(null)
        .map((_, i) => ({ id: `msg-${i}`, ...mockMessages[0] }));
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1', tenantId });
      prisma.message_events.findMany.mockResolvedValue(manyMessages);

      const result = await inboxService.getMessages(tenantId, 'conv-1', { limit: 50 });

      expect(result.hasMore).toBe(true);
      expect(result.messages).toHaveLength(50);
    });

    it('should derive correct message status', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1', tenantId });

      // Test read status
      prisma.message_events.findMany.mockResolvedValue([
        { ...mockMessages[0], readAt: new Date() },
      ]);
      let result = await inboxService.getMessages(tenantId, 'conv-1');
      expect(result.messages[0].status).toBe('read');

      // Test failed status
      prisma.message_events.findMany.mockResolvedValue([
        { ...mockMessages[0], failedAt: new Date() },
      ]);
      result = await inboxService.getMessages(tenantId, 'conv-1');
      expect(result.messages[0].status).toBe('failed');
    });
  });

  // ============ sendMessage ============
  describe('sendMessage', () => {
    const mockConversation = {
      id: 'conv-1',
      contactPhone: '+919876543210',
      channel: { type: 'WHATSAPP' },
      contact: { phone: '+919876543210', email: null },
    };

    const mockChannelAccount = {
      id: 'channel-acc-1',
      type: 'WHATSAPP',
      status: 'ACTIVE',
    };

    const mockMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      direction: 'OUTBOUND',
      contentType: 'TEXT',
      textContent: 'Hello!',
      sentAt: new Date(),
    };

    beforeEach(() => {
      prisma.conversation.findFirst.mockResolvedValue(mockConversation);
      prisma.channelAccount.findFirst.mockResolvedValue(mockChannelAccount);
      prisma.signature.findFirst.mockResolvedValue(null);
      prisma.conversationThread.create.mockResolvedValue(mockMessage);
      prisma.conversationThread.findUnique.mockResolvedValue(mockMessage);
      prisma.conversationThread.update.mockResolvedValue(mockMessage);
      prisma.conversation.update.mockResolvedValue({});
      whatsAppService.sendText.mockResolvedValue({ success: true, messageId: 'wa-msg-1' });
    });

    it('should send a message and return it', async () => {
      const result = await inboxService.sendMessage(tenantId, userId, 'conv-1', {
        content: 'Hello!',
        type: 'text',
      });

      expect(result.id).toBe('msg-1');
      expect(result.direction).toBe('outbound');
      expect(whatsAppService.sendText).toHaveBeenCalled();
    });

    it('should throw NotFoundError if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(
        inboxService.sendMessage(tenantId, userId, 'nonexistent', { content: 'Hello!' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw error if no active channel', async () => {
      prisma.channelAccount.findFirst.mockResolvedValue(null);

      await expect(
        inboxService.sendMessage(tenantId, userId, 'conv-1', { content: 'Hello!' })
      ).rejects.toThrow('No active channel available');
    });

    it('should throw error if no recipient phone', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        ...mockConversation,
        contactPhone: null,
        contact: { phone: null },
      });

      await expect(
        inboxService.sendMessage(tenantId, userId, 'conv-1', { content: 'Hello!' })
      ).rejects.toThrow('No recipient phone number found');
    });

    it('should append signature if available', async () => {
      prisma.signature.findFirst.mockResolvedValue({
        content: '\n-- Best regards, Team',
        isActive: true,
        isDefault: true,
      });

      await inboxService.sendMessage(tenantId, userId, 'conv-1', { content: 'Hello!' });

      expect(prisma.conversationThread.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            textContent: expect.stringContaining('Best regards'),
          }),
        })
      );
    });

    it('should handle WhatsApp send failure', async () => {
      whatsAppService.sendText.mockResolvedValue({ success: false, error: 'Rate limited' });

      const result = await inboxService.sendMessage(tenantId, userId, 'conv-1', {
        content: 'Hello!',
      });

      expect(prisma.conversationThread.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedAt: expect.any(Date),
          }),
        })
      );
    });

    it('should broadcast message via WebSocket', async () => {
      await inboxService.sendMessage(tenantId, userId, 'conv-1', { content: 'Hello!' });

      expect(broadcastNewMessage).toHaveBeenCalled();
    });
  });

  // ============ assignConversation ============
  describe('assignConversation', () => {
    it('should assign conversation to user', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1', tenantId });
      prisma.conversation.update.mockResolvedValue({ id: 'conv-1', assignedToId: userId });

      const result = await inboxService.assignConversation(tenantId, 'conv-1', userId);

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignedTo: { connect: { id: userId } },
          }),
        })
      );
    });

    it('should unassign conversation', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1', tenantId });
      prisma.conversation.update.mockResolvedValue({ id: 'conv-1', assignedToId: null });

      await inboxService.assignConversation(tenantId, 'conv-1', null);

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignedTo: { disconnect: true },
          }),
        })
      );
    });

    it('should throw NotFoundError if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(
        inboxService.assignConversation(tenantId, 'nonexistent', userId)
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ============ resolveConversation ============
  describe('resolveConversation', () => {
    it('should resolve conversation with outbound messages', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1', tenantId });
      prisma.conversationThread.count.mockResolvedValue(1);
      prisma.conversation.update.mockResolvedValue({ id: 'conv-1', status: 'RESOLVED' });

      const result = await inboxService.resolveConversation(tenantId, 'conv-1', { force: true });

      expect(result.status).toBe('RESOLVED');
    });

    it('should throw error if no outbound messages', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1', tenantId });
      prisma.conversationThread.count.mockResolvedValue(0);

      await expect(
        inboxService.resolveConversation(tenantId, 'conv-1', { force: true })
      ).rejects.toThrow('Cannot resolve: No reply has been sent to the customer');
    });

    it('should throw NotFoundError if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(inboxService.resolveConversation(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============ reopenConversation ============
  describe('reopenConversation', () => {
    it('should reopen conversation', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        tenantId,
        status: 'RESOLVED',
      });
      prisma.conversation.update.mockResolvedValue({
        id: 'conv-1',
        status: 'OPEN',
        closedAt: null,
      });

      const result = await inboxService.reopenConversation(tenantId, 'conv-1');

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'OPEN', closedAt: null },
        })
      );
    });

    it('should throw NotFoundError if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(inboxService.reopenConversation(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============ deleteConversation ============
  describe('deleteConversation', () => {
    it('should delete conversation and related data', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1', tenantId });
      prisma.conversationThread.deleteMany.mockResolvedValue({ count: 5 });
      prisma.conversationNote.deleteMany.mockResolvedValue({ count: 2 });
      prisma.conversation.delete.mockResolvedValue({});

      const result = await inboxService.deleteConversation(tenantId, 'conv-1');

      expect(prisma.conversationThread.deleteMany).toHaveBeenCalled();
      expect(prisma.conversationNote.deleteMany).toHaveBeenCalled();
      expect(prisma.conversation.delete).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should throw NotFoundError if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(inboxService.deleteConversation(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============ toggleStar ============
  describe('toggleStar', () => {
    it('should toggle star status', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1', tenantId, isStarred: false });
      prisma.conversation.update.mockResolvedValue({ id: 'conv-1', isStarred: true });

      const result = await inboxService.toggleStar(tenantId, 'conv-1');

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isStarred: true },
        })
      );
    });

    it('should throw NotFoundError if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(inboxService.toggleStar(tenantId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ============ archiveConversation ============
  describe('archiveConversation', () => {
    it('should archive conversation', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1', tenantId });
      prisma.conversation.update.mockResolvedValue({ id: 'conv-1', status: 'CLOSED' });

      const result = await inboxService.archiveConversation(tenantId, 'conv-1');

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'CLOSED' },
        })
      );
    });

    it('should throw NotFoundError if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(inboxService.archiveConversation(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============ unarchiveConversation ============
  describe('unarchiveConversation', () => {
    it('should unarchive conversation', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1', tenantId, status: 'CLOSED' });
      prisma.conversation.update.mockResolvedValue({ id: 'conv-1', status: 'OPEN' });

      const result = await inboxService.unarchiveConversation(tenantId, 'conv-1');

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'OPEN' },
        })
      );
    });

    it('should throw NotFoundError if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(inboxService.unarchiveConversation(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============ getChannels ============
  describe('getChannels', () => {
    it('should return channels with valid health status', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'ch-1',
          type: 'WHATSAPP',
          name: 'WhatsApp Business',
          phoneNumber: '+919876543210',
          status: 'ACTIVE',
          healthStatus: 'healthy',
          provider: 'MSG91',
        },
      ]);

      const result = await inboxService.getChannels(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          type: 'whatsapp',
          status: 'active',
          healthStatus: 'healthy',
        })
      );
    });

    it('should return unknown for invalid health status', async () => {
      prisma.$queryRaw.mockResolvedValue([
        {
          id: 'ch-1',
          type: 'WHATSAPP',
          name: 'WhatsApp Business',
          status: 'ACTIVE',
          healthStatus: 'INVALID_STATUS',
        },
      ]);

      const result = await inboxService.getChannels(tenantId);

      expect(result[0].healthStatus).toBe('unknown');
    });
  });

  // ============ getConversationStats ============
  describe('getConversationStats', () => {
    it('should return conversation counts by status', async () => {
      prisma.conversation.count
        .mockResolvedValueOnce(10) // open
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(20) // resolved
        .mockResolvedValueOnce(3); // closed

      const result = await inboxService.getConversationStats(tenantId);

      expect(result).toEqual({
        open: 10,
        pending: 5,
        resolved: 20,
        closed: 3,
        total: 38,
      });
    });
  });

  // ============ getInboxCounts ============
  describe('getInboxCounts', () => {
    it('should return all inbox counts', async () => {
      prisma.conversation.count.mockResolvedValue(5);

      const result = await inboxService.getInboxCounts(tenantId, userId);

      expect(result).toEqual(
        expect.objectContaining({
          all: expect.any(Number),
          unassigned: expect.any(Number),
          mine: expect.any(Number),
          starred: 0, // Always 0 as per implementation
          snoozed: 0, // Always 0 as per implementation
          archived: expect.any(Number),
          whatsapp: expect.any(Number),
          sms: expect.any(Number),
          email: expect.any(Number),
          voice: 0, // Always 0 as per implementation
        })
      );
    });

    it('should return 0 for mine if no userId', async () => {
      prisma.conversation.count.mockResolvedValue(5);

      const result = await inboxService.getInboxCounts(tenantId, null);

      expect(result.mine).toBe(0);
    });
  });

  // ============ markAsRead ============
  describe('markAsRead', () => {
    it('should mark all unread messages as read', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        tenantId,
        status: 'PENDING',
      });
      prisma.conversationThread.findMany.mockResolvedValue([{ id: 'msg-1' }, { id: 'msg-2' }]);
      prisma.conversationThread.updateMany.mockResolvedValue({ count: 2 });
      prisma.conversation.update.mockResolvedValue({});

      const result = await inboxService.markAsRead(tenantId, 'conv-1');

      expect(prisma.conversationThread.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            conversationId: 'conv-1',
            direction: 'INBOUND',
            readAt: null,
          }),
        })
      );
      expect(result.success).toBe(true);
    });

    it('should change PENDING status to OPEN when read', async () => {
      prisma.conversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        tenantId,
        status: 'PENDING',
      });
      prisma.conversationThread.findMany.mockResolvedValue([]);
      prisma.conversation.update.mockResolvedValue({});

      await inboxService.markAsRead(tenantId, 'conv-1');

      expect(prisma.conversation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'OPEN',
          }),
        })
      );
    });

    it('should broadcast read status via WebSocket', async () => {
      prisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1', tenantId, status: 'OPEN' });
      prisma.conversationThread.findMany.mockResolvedValue([{ id: 'msg-1' }]);
      prisma.conversationThread.updateMany.mockResolvedValue({ count: 1 });
      prisma.conversation.update.mockResolvedValue({});

      await inboxService.markAsRead(tenantId, 'conv-1');

      expect(broadcastMessageStatus).toHaveBeenCalledWith(tenantId, 'msg-1', 'conv-1', 'read');
    });

    it('should throw NotFoundError if conversation not found', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null);

      await expect(inboxService.markAsRead(tenantId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ============ Templates ============
  describe('Templates', () => {
    describe('getTemplates', () => {
      it('should return templates with pagination', async () => {
        prisma.template.findMany.mockResolvedValue([{ id: 'tpl-1', name: 'Welcome' }]);
        prisma.template.count.mockResolvedValue(1);

        const result = await inboxService.getTemplates(tenantId);

        expect(result.templates).toHaveLength(1);
        expect(result.meta.total).toBe(1);
      });

      it('should filter by type', async () => {
        prisma.template.findMany.mockResolvedValue([]);
        prisma.template.count.mockResolvedValue(0);

        await inboxService.getTemplates(tenantId, { type: 'WHATSAPP' });

        expect(prisma.template.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ type: 'WHATSAPP' }),
          })
        );
      });

      it('should filter by isActive', async () => {
        prisma.template.findMany.mockResolvedValue([]);
        prisma.template.count.mockResolvedValue(0);

        await inboxService.getTemplates(tenantId, { isActive: 'true' });

        expect(prisma.template.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({ isActive: true }),
          })
        );
      });

      it('should search templates', async () => {
        prisma.template.findMany.mockResolvedValue([]);
        prisma.template.count.mockResolvedValue(0);

        await inboxService.getTemplates(tenantId, { search: 'welcome' });

        expect(prisma.template.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              OR: expect.any(Array),
            }),
          })
        );
      });
    });

    describe('getTemplate', () => {
      it('should return template by id', async () => {
        prisma.template.findFirst.mockResolvedValue({ id: 'tpl-1', name: 'Welcome' });

        const result = await inboxService.getTemplate(tenantId, 'tpl-1');

        expect(result.id).toBe('tpl-1');
      });

      it('should throw NotFoundError if template not found', async () => {
        prisma.template.findFirst.mockResolvedValue(null);

        await expect(inboxService.getTemplate(tenantId, 'nonexistent')).rejects.toThrow(
          NotFoundError
        );
      });
    });

    describe('createTemplate', () => {
      it('should create template', async () => {
        prisma.template.create.mockResolvedValue({
          id: 'tpl-1',
          name: 'Welcome',
          type: 'WHATSAPP',
          content: 'Hello {{name}}!',
        });

        const result = await inboxService.createTemplate(tenantId, userId, {
          name: 'Welcome',
          type: 'WHATSAPP',
          content: 'Hello {{name}}!',
        });

        expect(result.id).toBe('tpl-1');
      });
    });

    describe('updateTemplate', () => {
      it('should update template', async () => {
        prisma.template.findFirst.mockResolvedValue({ id: 'tpl-1' });
        prisma.template.update.mockResolvedValue({ id: 'tpl-1', name: 'Updated' });

        const result = await inboxService.updateTemplate(tenantId, 'tpl-1', { name: 'Updated' });

        expect(result.name).toBe('Updated');
      });

      it('should throw NotFoundError if template not found', async () => {
        prisma.template.findFirst.mockResolvedValue(null);

        await expect(
          inboxService.updateTemplate(tenantId, 'nonexistent', { name: 'Updated' })
        ).rejects.toThrow(NotFoundError);
      });
    });

    describe('deleteTemplate', () => {
      it('should delete template', async () => {
        prisma.template.findFirst.mockResolvedValue({ id: 'tpl-1' });
        prisma.template.delete.mockResolvedValue({});

        await inboxService.deleteTemplate(tenantId, 'tpl-1');

        expect(prisma.template.delete).toHaveBeenCalled();
      });

      it('should throw NotFoundError if template not found', async () => {
        prisma.template.findFirst.mockResolvedValue(null);

        await expect(inboxService.deleteTemplate(tenantId, 'nonexistent')).rejects.toThrow(
          NotFoundError
        );
      });
    });
  });

  // ============ Tags ============
  describe('Tags', () => {
    describe('getTags', () => {
      it('should return tags with contact count', async () => {
        prisma.tag.findMany.mockResolvedValue([
          {
            id: 'tag-1',
            name: 'VIP',
            color: '#ff0000',
            createdAt: new Date(),
            _count: { contacts: 5 },
          },
        ]);

        const result = await inboxService.getTags(tenantId);

        expect(result).toHaveLength(1);
        expect(result[0].contactCount).toBe(5);
      });
    });

    describe('createTag', () => {
      it('should create tag with default color', async () => {
        prisma.tag.create.mockResolvedValue({
          id: 'tag-1',
          name: 'VIP',
          color: '#6366f1',
        });

        const result = await inboxService.createTag(tenantId, { name: 'VIP' });

        expect(result.color).toBe('#6366f1');
      });

      it('should create tag with custom color', async () => {
        prisma.tag.create.mockResolvedValue({
          id: 'tag-1',
          name: 'VIP',
          color: '#ff0000',
        });

        const result = await inboxService.createTag(tenantId, { name: 'VIP', color: '#ff0000' });

        expect(result.color).toBe('#ff0000');
      });
    });

    describe('updateTag', () => {
      it('should update tag', async () => {
        prisma.tag.findFirst.mockResolvedValue({ id: 'tag-1' });
        prisma.tag.update.mockResolvedValue({ id: 'tag-1', name: 'Premium' });

        const result = await inboxService.updateTag(tenantId, 'tag-1', { name: 'Premium' });

        expect(result.name).toBe('Premium');
      });

      it('should throw NotFoundError if tag not found', async () => {
        prisma.tag.findFirst.mockResolvedValue(null);

        await expect(
          inboxService.updateTag(tenantId, 'nonexistent', { name: 'Premium' })
        ).rejects.toThrow(NotFoundError);
      });
    });

    describe('deleteTag', () => {
      it('should delete tag', async () => {
        prisma.tag.findFirst.mockResolvedValue({ id: 'tag-1' });
        prisma.tag.delete.mockResolvedValue({});

        await inboxService.deleteTag(tenantId, 'tag-1');

        expect(prisma.tag.delete).toHaveBeenCalled();
      });

      it('should throw NotFoundError if tag not found', async () => {
        prisma.tag.findFirst.mockResolvedValue(null);

        await expect(inboxService.deleteTag(tenantId, 'nonexistent')).rejects.toThrow(
          NotFoundError
        );
      });
    });
  });

  // ============ Broadcasts (Coming Soon) ============
  describe('Broadcasts', () => {
    it('getBroadcasts should return coming soon placeholder', async () => {
      const result = await inboxService.getBroadcasts(tenantId);

      expect(result.comingSoon).toBe(true);
      expect(result.broadcasts).toEqual([]);
    });

    it('getBroadcast should throw coming soon error', async () => {
      await expect(inboxService.getBroadcast(tenantId, 'bc-1')).rejects.toThrow(
        'Broadcast feature is coming soon'
      );
    });

    it('createBroadcast should throw coming soon error', async () => {
      await expect(inboxService.createBroadcast(tenantId, userId, {})).rejects.toThrow(
        'Broadcast feature is coming soon'
      );
    });
  });

  // ============ Chatbots (Coming Soon) ============
  describe('Chatbots', () => {
    it('getChatbots should return coming soon placeholder', async () => {
      const result = await inboxService.getChatbots(tenantId);

      expect(result.comingSoon).toBe(true);
      expect(result.chatbots).toEqual([]);
    });

    it('getChatbot should throw coming soon error', async () => {
      await expect(inboxService.getChatbot(tenantId, 'bot-1')).rejects.toThrow(
        'Chatbot feature is coming soon'
      );
    });
  });

  // ============ Purpose Classification ============
  describe('Purpose Classification', () => {
    describe('getPurposeCounts', () => {
      it('should return counts by purpose', async () => {
        prisma.conversationThread.count
          .mockResolvedValueOnce(10) // general
          .mockResolvedValueOnce(20) // sales
          .mockResolvedValueOnce(15) // support
          .mockResolvedValueOnce(5) // service
          .mockResolvedValueOnce(8); // marketing

        const result = await inboxService.getPurposeCounts(tenantId);

        expect(result).toEqual({
          GENERAL: 10,
          SALES: 20,
          SUPPORT: 15,
          SERVICE: 5,
          MARKETING: 8,
          total: 58,
        });
      });
    });

    describe('updatePurpose', () => {
      it('should update conversation purpose', async () => {
        prisma.conversationThread.findFirst.mockResolvedValue({ id: 'conv-1', tenantId });
        prisma.conversationThread.update.mockResolvedValue({
          id: 'conv-1',
          purpose: 'SALES',
          contacts: [],
        });

        const result = await inboxService.updatePurpose(tenantId, 'conv-1', 'SALES', null, userId);

        expect(result.purpose).toBe('SALES');
      });

      it('should throw NotFoundError if conversation not found', async () => {
        prisma.conversationThread.findFirst.mockResolvedValue(null);

        await expect(
          inboxService.updatePurpose(tenantId, 'nonexistent', 'SALES', null, userId)
        ).rejects.toThrow(NotFoundError);
      });
    });
  });

  // ============ Tenant Isolation ============
  describe('Tenant Isolation', () => {
    it('should always include tenantId in queries', async () => {
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.conversation.count.mockResolvedValue(0);
      prisma.channel.findMany.mockResolvedValue([]);

      await inboxService.getConversations(tenantId);

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId }),
        })
      );
    });

    it('should prevent cross-tenant access in getConversation', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null); // Simulates wrong tenant

      await expect(
        inboxService.getConversation(tenantId, 'conv-from-other-tenant')
      ).rejects.toThrow(NotFoundError);
    });

    it('should prevent cross-tenant access in sendMessage', async () => {
      prisma.conversation.findFirst.mockResolvedValue(null); // Simulates wrong tenant

      await expect(
        inboxService.sendMessage(tenantId, userId, 'conv-from-other-tenant', { content: 'Hello!' })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
