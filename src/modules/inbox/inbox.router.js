import { Router } from 'express';
import { z } from 'zod';
import { inboxService } from './inbox.service.js';
import { inboxAgentRouter } from './inbox-agent.router.js';

const router = Router();

// Mount agent features router
router.use('/', inboxAgentRouter);

// Note: Authentication is handled by tenantMiddleware in server.js

// Root endpoint - returns conversations list (for backwards compatibility)
router.get('/', async (req, res, next) => {
  try {
    const params = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 25,
    };

    const result = await inboxService.getConversations(req.tenantId, params);
    res.json({ success: true, data: result.conversations, meta: result.meta });
  } catch (error) {
    next(error);
  }
});

// ============ CONVERSATIONS ============

/**
 * Get conversations list
 *
 * Query Parameters:
 * - page, limit: Pagination
 * - status: Filter by status (OPEN, PENDING, RESOLVED, CLOSED, SNOOZED) or comma-separated list
 * - bucket: Shorthand filter (all, unread, starred, snoozed, resolved, closed, archived, pending, open)
 * - channelType: Filter by channel (WHATSAPP, SMS, EMAIL, VOICE)
 * - channelAccountId: Filter by specific channel account
 * - assignedTo: Filter by assigned user ID
 * - unassigned: Show only unassigned conversations
 * - priority: Filter by priority (LOW, MEDIUM, HIGH, URGENT)
 * - starred: Show only starred conversations
 * - dateFrom, dateTo: Filter by date range
 * - search: Search in contact name, phone, email, or message content
 * - purpose: Filter by purpose (GENERAL, SALES, SUPPORT, SERVICE, MARKETING)
 */
router.get('/conversations', async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        status: z.string().optional(), // Supports comma-separated: "OPEN,PENDING"
        bucket: z
          .enum([
            'all',
            'unread',
            'starred',
            'snoozed',
            'resolved',
            'closed',
            'archived',
            'pending',
            'open',
          ])
          .optional(),
        channelType: z
          .enum([
            'WHATSAPP',
            'SMS',
            'EMAIL',
            'EMAIL_SMTP',
            'EMAIL_GMAIL',
            'EMAIL_MICROSOFT',
            'VOICE',
          ])
          .optional(),
        channelAccountId: z.string().optional(),
        assignedTo: z.string().optional(),
        unassigned: z.string().optional(), // 'true' or 'false'
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        starred: z.string().optional(), // 'true' or 'false'
        dateFrom: z.string().optional(), // ISO date string
        dateTo: z.string().optional(), // ISO date string
        search: z.string().optional(),
        purpose: z.enum(['GENERAL', 'SALES', 'SUPPORT', 'SERVICE', 'MARKETING']).optional(),
      })
      .parse(req.query);

    // Resolve 'me' to current user ID for My Chats filter
    if (params.assignedTo === 'me') {
      params.assignedTo = req.userId;
    }

    const result = await inboxService.getConversations(req.tenantId, params);

    res.json({
      success: true,
      data: result.conversations,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a new conversation
 */
router.post('/conversations', async (req, res, next) => {
  try {
    const data = z
      .object({
        channelType: z.enum(['WHATSAPP', 'SMS', 'EMAIL', 'VOICE']),
        channelAccountId: z.string().optional(),
        contactId: z.string(),
        initialMessage: z.string().optional(),
      })
      .parse(req.body);

    // TODO: Implement conversation creation in service
    // For now, return mock conversation
    const conversation = {
      id: 'conv_' + Date.now(),
      channelType: data.channelType,
      contactId: data.contactId,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
      tenantId: req.tenantId,
    };

    res.status(201).json({
      success: true,
      data: conversation,
      message: 'Conversation created successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update conversation details
 */
router.patch('/conversations/:id', async (req, res, next) => {
  try {
    const data = z
      .object({
        status: z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED', 'SNOOZED']).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        purpose: z.enum(['GENERAL', 'SALES', 'SUPPORT', 'SERVICE', 'MARKETING']).optional(),
        assignedTo: z.string().optional(),
      })
      .parse(req.body);

    // TODO: Implement conversation update in service
    // For now, return mock updated conversation
    const conversation = {
      id: req.params.id,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: conversation,
      message: 'Conversation updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get conversation stats (includes status counts, bucket counts, and purpose counts)
 */
router.get('/stats', async (req, res, next) => {
  try {
    // Get status stats, bucket counts, and purpose counts
    const [statusStats, bucketCounts, purposeCounts] = await Promise.all([
      inboxService.getConversationStats(req.tenantId),
      inboxService.getInboxCounts(req.tenantId, req.userId),
      inboxService.getPurposeCounts(req.tenantId),
    ]);

    res.json({
      success: true,
      data: {
        ...statusStats,
        // Rename 'mine' to 'assigned' for frontend consistency
        assigned: bucketCounts.mine,
        unassigned: bucketCounts.unassigned,
        starred: bucketCounts.starred,
        snoozed: bucketCounts.snoozed,
        archived: bucketCounts.archived,
        // Purpose counts for sidebar
        byPurpose: purposeCounts,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get inbox counts for sidebar badges
 */
router.get('/counts', async (req, res, next) => {
  try {
    const counts = await inboxService.getInboxCounts(req.tenantId, req.userId);

    res.json({
      success: true,
      data: counts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get inbox analytics
 */
router.get('/analytics', async (req, res, next) => {
  try {
    const params = z
      .object({
        period: z.enum(['24h', '7d', '30d', '90d']).default('7d'),
      })
      .parse(req.query);

    // Calculate date range based on period
    const now = new Date();
    let dateFrom;
    switch (params.period) {
      case '24h':
        dateFrom = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get analytics data from service
    const analytics = await inboxService.getAnalytics(req.tenantId, dateFrom, now);

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get inbox activity logs
 */
router.get('/activity', async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(10),
        period: z.enum(['today', 'week', 'month', 'all']).default('today'),
        type: z
          .enum([
            'MESSAGE_SENT',
            'MESSAGE_RECEIVED',
            'CONVERSATION_ASSIGNED',
            'CONVERSATION_RESOLVED',
            'NOTE_ADDED',
            'TAG_ADDED',
          ])
          .optional(),
      })
      .parse(req.query);

    // For now, return empty array - will implement service method later
    res.json({
      success: true,
      data: [],
      meta: {
        page: params.page,
        limit: params.limit,
        total: 0,
        totalPages: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get single conversation
 */
router.get('/conversations/:id', async (req, res, next) => {
  try {
    const conversation = await inboxService.getConversation(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get conversation messages
 */
router.get('/conversations/:id/messages', async (req, res, next) => {
  try {
    const params = z
      .object({
        cursor: z.string().optional(),
        limit: z.coerce.number().min(1).max(100).default(50),
      })
      .parse(req.query);

    const result = await inboxService.getMessages(req.tenantId, req.params.id, params);

    res.json({
      success: true,
      data: result.messages,
      meta: {
        hasMore: result.hasMore,
        cursor: result.cursor,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Send message in conversation
 */
router.post('/conversations/:id/messages', async (req, res, next) => {
  try {
    const data = z
      .object({
        content: z.string().min(1),
        type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'TEMPLATE']).default('TEXT'),
      })
      .parse(req.body);

    const message = await inboxService.sendMessage(req.tenantId, req.userId, req.params.id, data);

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get conversation notes
 */
router.get('/conversations/:id/notes', async (req, res, next) => {
  try {
    const notes = await inboxService.getConversationNotes(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: notes,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Add note to conversation
 */
router.post('/conversations/:id/notes', async (req, res, next) => {
  try {
    const data = z
      .object({
        content: z.string().min(1),
      })
      .parse(req.body);

    const note = await inboxService.addConversationNote(
      req.tenantId,
      req.params.id,
      req.userId,
      data.content
    );

    res.status(201).json({
      success: true,
      data: note,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Mark conversation as read
 */
router.post('/conversations/:id/read', async (req, res, next) => {
  try {
    const result = await inboxService.markAsRead(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Assign conversation
 * assignedTo can be 'me' (resolves to current user) or a valid UUID
 */
router.patch('/conversations/:id/assign', async (req, res, next) => {
  try {
    const { assignedTo } = z
      .object({
        assignedTo: z
          .string()
          .nullable()
          .refine(
            (val) =>
              val === null ||
              val === 'me' ||
              val === 'unassign' ||
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),
            {
              message: 'Must be "me", "unassign", null, or a valid UUID',
            }
          ),
      })
      .parse(req.body);

    // Resolve assignee: 'me' -> current user, 'unassign' or null -> null (disconnect)
    const resolvedAssignee =
      assignedTo === 'me'
        ? req.userId
        : assignedTo === 'unassign' || assignedTo === null
          ? null
          : assignedTo;

    const conversation = await inboxService.assignConversation(
      req.tenantId,
      req.params.id,
      resolvedAssignee
    );

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Resolve conversation
 * Body options:
 * - force: boolean - If true, skip feedback check and force resolve
 */
router.patch('/conversations/:id/resolve', async (req, res, next) => {
  try {
    const { force } = req.body || {};
    const conversation = await inboxService.resolveConversation(req.tenantId, req.params.id, {
      force: !!force,
    });

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Reopen conversation
 */
router.patch('/conversations/:id/reopen', async (req, res, next) => {
  try {
    const conversation = await inboxService.reopenConversation(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete conversation
 */
router.delete('/conversations/:id', async (req, res, next) => {
  try {
    await inboxService.deleteConversation(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Toggle star on conversation
 */
router.patch('/conversations/:id/star', async (req, res, next) => {
  try {
    const conversation = await inboxService.toggleStar(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Archive conversation
 */
router.patch('/conversations/:id/archive', async (req, res, next) => {
  try {
    const conversation = await inboxService.archiveConversation(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Unarchive conversation
 */
router.patch('/conversations/:id/unarchive', async (req, res, next) => {
  try {
    const conversation = await inboxService.unarchiveConversation(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Change conversation purpose (Sales, Support, Service, Marketing)
 */
router.patch('/conversations/:id/purpose', async (req, res, next) => {
  try {
    const data = z
      .object({
        purpose: z.enum(['GENERAL', 'SALES', 'SUPPORT', 'SERVICE', 'MARKETING']),
        subCategory: z.string().optional(),
      })
      .parse(req.body);

    const conversation = await inboxService.updatePurpose(
      req.tenantId,
      req.params.id,
      data.purpose,
      data.subCategory,
      req.userId
    );

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    next(error);
  }
});

// ============ CHANNELS ============

/**
 * Get channels
 */
router.get('/channels', async (req, res, next) => {
  try {
    const channels = await inboxService.getChannels(req.tenantId);

    res.json({
      success: true,
      data: channels,
    });
  } catch (error) {
    next(error);
  }
});

// ============ TEMPLATES ============

router.get('/templates', async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        channelId: z.string().optional(),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
        category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']).optional(),
        search: z.string().optional(),
      })
      .parse(req.query);

    const result = await inboxService.getTemplates(req.tenantId, params);

    res.json({
      success: true,
      data: result.templates,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/templates/:id', async (req, res, next) => {
  try {
    const template = await inboxService.getTemplate(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/templates', async (req, res, next) => {
  try {
    const data = z
      .object({
        channelId: z.string(),
        name: z.string().min(1),
        category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']),
        language: z.string().default('en'),
        headerType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
        headerContent: z.string().optional(),
        bodyContent: z.string().min(1),
        footerContent: z.string().optional(),
        buttons: z.array(z.record(z.unknown())).optional(),
        variables: z.array(z.record(z.unknown())).optional(),
      })
      .parse(req.body);

    const template = await inboxService.createTemplate(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/templates/:id', async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1).optional(),
        category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']).optional(),
        language: z.string().optional(),
        headerType: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT']).optional(),
        headerContent: z.string().optional(),
        bodyContent: z.string().optional(),
        footerContent: z.string().optional(),
        buttons: z.array(z.record(z.unknown())).optional(),
        variables: z.array(z.record(z.unknown())).optional(),
      })
      .parse(req.body);

    const template = await inboxService.updateTemplate(req.tenantId, req.params.id, data);

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/templates/:id', async (req, res, next) => {
  try {
    await inboxService.deleteTemplate(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Template deleted',
    });
  } catch (error) {
    next(error);
  }
});

// ============ BROADCASTS ============

router.get('/broadcasts', async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        status: z
          .enum(['DRAFT', 'SCHEDULED', 'SENDING', 'COMPLETED', 'CANCELLED', 'FAILED'])
          .optional(),
        channelType: z.enum(['WHATSAPP', 'SMS', 'EMAIL']).optional(),
        search: z.string().optional(),
      })
      .parse(req.query);

    const result = await inboxService.getBroadcasts(req.tenantId, params);

    res.json({
      success: true,
      data: result.broadcasts,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/broadcasts/:id', async (req, res, next) => {
  try {
    const broadcast = await inboxService.getBroadcast(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: broadcast,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/broadcasts', async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1),
        description: z.string().optional(),
        channelType: z.enum(['WHATSAPP', 'SMS', 'EMAIL']),
        channelAccountId: z.string().optional(),
        templateId: z.string().optional(),
        content: z.string().optional(),
        mediaUrl: z.string().url().optional(),
        segmentId: z.string().optional(),
        contactIds: z.array(z.string()).optional(),
        scheduledAt: z.string().datetime().optional(),
      })
      .parse(req.body);

    const broadcast = await inboxService.createBroadcast(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: broadcast,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/broadcasts/:id', async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        templateId: z.string().optional(),
        content: z.string().optional(),
        mediaUrl: z.string().url().optional(),
        segmentId: z.string().optional(),
        contactIds: z.array(z.string()).optional(),
        scheduledAt: z.string().datetime().optional(),
      })
      .parse(req.body);

    const broadcast = await inboxService.updateBroadcast(req.tenantId, req.params.id, data);

    res.json({
      success: true,
      data: broadcast,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/broadcasts/:id', async (req, res, next) => {
  try {
    await inboxService.deleteBroadcast(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Broadcast deleted',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/broadcasts/:id/send', async (req, res, next) => {
  try {
    const broadcast = await inboxService.sendBroadcast(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: broadcast,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/broadcasts/:id/cancel', async (req, res, next) => {
  try {
    const broadcast = await inboxService.cancelBroadcast(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: broadcast,
    });
  } catch (error) {
    next(error);
  }
});

// ============ TAGS ============

router.get('/tags', async (req, res, next) => {
  try {
    const tags = await inboxService.getTags(req.tenantId);

    res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/tags', async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1),
        color: z.string().optional(),
        description: z.string().optional(),
      })
      .parse(req.body);

    const tag = await inboxService.createTag(req.tenantId, data);

    res.status(201).json({
      success: true,
      data: tag,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/tags/:id', async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1).optional(),
        color: z.string().optional(),
        description: z.string().optional(),
      })
      .parse(req.body);

    const tag = await inboxService.updateTag(req.tenantId, req.params.id, data);

    res.json({
      success: true,
      data: tag,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/tags/:id', async (req, res, next) => {
  try {
    await inboxService.deleteTag(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Tag deleted',
    });
  } catch (error) {
    next(error);
  }
});

// ============ CHATBOTS ============

router.get('/chatbots', async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        isActive: z.coerce.boolean().optional(),
        channelType: z.enum(['WHATSAPP', 'SMS', 'EMAIL']).optional(),
        search: z.string().optional(),
      })
      .parse(req.query);

    const result = await inboxService.getChatbots(req.tenantId, params);

    res.json({
      success: true,
      data: result.chatbots,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/chatbots/:id', async (req, res, next) => {
  try {
    const chatbot = await inboxService.getChatbot(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: chatbot,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/chatbots', async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1),
        description: z.string().optional(),
        channelType: z.enum(['WHATSAPP', 'SMS', 'EMAIL']),
        welcomeMessage: z.string().optional(),
        fallbackMessage: z.string().optional(),
        handoffMessage: z.string().optional(),
        handoffTriggers: z.array(z.string()).optional(),
        flowConfig: z.record(z.unknown()).optional(),
      })
      .parse(req.body);

    const chatbot = await inboxService.createChatbot(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: chatbot,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/chatbots/:id', async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        welcomeMessage: z.string().optional(),
        fallbackMessage: z.string().optional(),
        handoffMessage: z.string().optional(),
        handoffTriggers: z.array(z.string()).optional(),
        flowConfig: z.record(z.unknown()).optional(),
      })
      .parse(req.body);

    const chatbot = await inboxService.updateChatbot(req.tenantId, req.params.id, data);

    res.json({
      success: true,
      data: chatbot,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/chatbots/:id', async (req, res, next) => {
  try {
    await inboxService.deleteChatbot(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Chatbot deleted',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/chatbots/:id/activate', async (req, res, next) => {
  try {
    const chatbot = await inboxService.activateChatbot(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: chatbot,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/chatbots/:id/deactivate', async (req, res, next) => {
  try {
    const chatbot = await inboxService.deactivateChatbot(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: chatbot,
    });
  } catch (error) {
    next(error);
  }
});

export { router as inboxRouter };
