/**
 * Inbox Agent Features Router
 *
 * Endpoints for agent productivity features:
 * - Canned Responses (Quick Replies)
 * - Internal Notes
 * - Snooze
 * - Team Assignment
 * - Auto-Assignment Rules
 * - SLA Policies
 * - AI Suggestions
 * - Conversation Summary
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@crm360/database';
import { assignmentService } from './assignment.service.js';

const router = Router();

// ============================================================================
// CANNED RESPONSES (Quick Replies)
// ============================================================================

/**
 * Get all canned response categories
 */
router.get('/canned-responses/categories', async (req, res, next) => {
  try {
    const categories = await prisma.cannedResponseCategory.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { order: 'asc' },
      include: {
        _count: { select: { responses: true } },
      },
    });

    res.json({
      success: true,
      data: categories.map((c) => ({
        ...c,
        responseCount: c._count.responses,
        _count: undefined,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a canned response category
 */
router.post('/canned-responses/categories', async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1),
        icon: z.string().optional(),
        color: z.string().optional(),
      })
      .parse(req.body);

    // Get max order
    const maxOrder = await prisma.cannedResponseCategory.aggregate({
      where: { tenantId: req.tenantId },
      _max: { order: true },
    });

    const category = await prisma.cannedResponseCategory.create({
      data: {
        ...data,
        tenantId: req.tenantId,
        order: (maxOrder._max.order || 0) + 1,
      },
    });

    res.status(201).json({
      success: true,
      data: category,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'DUPLICATE_NAME',
        message: 'A category with this name already exists',
      });
    }
    next(error);
  }
});

/**
 * Update a canned response category
 */
router.patch('/canned-responses/categories/:id', async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1).optional(),
        icon: z.string().optional(),
        color: z.string().optional(),
        order: z.number().optional(),
      })
      .parse(req.body);

    const category = await prisma.cannedResponseCategory.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      success: true,
      data: category,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a canned response category
 */
router.delete('/canned-responses/categories/:id', async (req, res, next) => {
  try {
    // Check if category has responses
    const responseCount = await prisma.cannedResponse.count({
      where: { categoryId: req.params.id },
    });

    if (responseCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'CATEGORY_NOT_EMPTY',
        message: `Cannot delete category with ${responseCount} responses. Move or delete them first.`,
      });
    }

    await prisma.cannedResponseCategory.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Category deleted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all canned responses
 */
router.get('/canned-responses', async (req, res, next) => {
  try {
    const params = z
      .object({
        categoryId: z.string().optional(),
        visibility: z.enum(['PERSONAL', 'TEAM']).optional(),
        search: z.string().optional(),
        favorite: z.string().optional(),
      })
      .parse(req.query);

    // Build visibility filter - show TEAM responses OR personal responses created by this user
    const visibilityFilter = [
      { visibility: 'TEAM' },
      { visibility: 'PERSONAL', createdById: req.userId },
    ];

    const where = {
      tenantId: req.tenantId,
    };

    if (params.categoryId) where.categoryId = params.categoryId;
    if (params.visibility) where.visibility = params.visibility;
    if (params.favorite === 'true') where.isFavorite = true;

    // Combine visibility and search filters properly
    if (params.search) {
      const searchFilter = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { shortcut: { contains: params.search, mode: 'insensitive' } },
        { content: { contains: params.search, mode: 'insensitive' } },
      ];
      // Must match visibility AND search
      where.AND = [{ OR: visibilityFilter }, { OR: searchFilter }];
    } else {
      where.OR = visibilityFilter;
    }

    const responses = await prisma.cannedResponse.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: [{ isFavorite: 'desc' }, { usageCount: 'desc' }],
    });

    res.json({
      success: true,
      data: responses,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get a single canned response
 */
router.get('/canned-responses/:id', async (req, res, next) => {
  try {
    const response = await prisma.cannedResponse.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId,
      },
      include: {
        category: true,
      },
    });

    if (!response) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Canned response not found',
      });
    }

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a canned response
 */
router.post('/canned-responses', async (req, res, next) => {
  try {
    const data = z
      .object({
        title: z.string().min(1),
        shortcut: z.string().min(1).startsWith('/'),
        content: z.string().min(1),
        categoryId: z.string().optional(),
        visibility: z.enum(['PERSONAL', 'TEAM']).default('TEAM'),
        variables: z
          .array(
            z.object({
              name: z.string(),
              label: z.string().optional(),
            })
          )
          .optional(),
      })
      .parse(req.body);

    const response = await prisma.cannedResponse.create({
      data: {
        ...data,
        tenantId: req.tenantId,
        createdById: req.userId,
      },
      include: {
        category: true,
      },
    });

    res.status(201).json({
      success: true,
      data: response,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'DUPLICATE_SHORTCUT',
        message: 'A response with this shortcut already exists',
      });
    }
    next(error);
  }
});

/**
 * Update a canned response
 */
router.patch('/canned-responses/:id', async (req, res, next) => {
  try {
    const data = z
      .object({
        title: z.string().min(1).optional(),
        shortcut: z.string().min(1).startsWith('/').optional(),
        content: z.string().min(1).optional(),
        categoryId: z.string().nullable().optional(),
        visibility: z.enum(['PERSONAL', 'TEAM']).optional(),
        isFavorite: z.boolean().optional(),
        variables: z
          .array(
            z.object({
              name: z.string(),
              label: z.string().optional(),
            })
          )
          .optional(),
      })
      .parse(req.body);

    const response = await prisma.cannedResponse.update({
      where: { id: req.params.id },
      data,
      include: {
        category: true,
      },
    });

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'DUPLICATE_SHORTCUT',
        message: 'A response with this shortcut already exists',
      });
    }
    next(error);
  }
});

/**
 * Delete a canned response
 */
router.delete('/canned-responses/:id', async (req, res, next) => {
  try {
    await prisma.cannedResponse.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Canned response deleted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Increment usage count for a canned response
 */
router.post('/canned-responses/:id/use', async (req, res, next) => {
  try {
    const response = await prisma.cannedResponse.update({
      where: { id: req.params.id },
      data: {
        usageCount: { increment: 1 },
      },
    });

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// INTERNAL NOTES
// ============================================================================

/**
 * Get notes for a conversation
 */
router.get('/conversations/:threadId/notes', async (req, res, next) => {
  try {
    const notes = await prisma.conversation_notes.findMany({
      where: {
        threadId: req.params.threadId,
        tenantId: req.tenantId,
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });

    // Fetch user details for each note
    const userIds = [...new Set(notes.map((n) => n.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    res.json({
      success: true,
      data: notes.map((note) => ({
        ...note,
        user: userMap[note.userId] || null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a note
 */
router.post('/conversations/:threadId/notes', async (req, res, next) => {
  try {
    const data = z
      .object({
        content: z.string().min(1),
        mentions: z.array(z.string()).optional(),
      })
      .parse(req.body);

    // Verify conversation exists and belongs to tenant (check Conversation, ConversationThread, and CallSession)
    let conversation = await prisma.conversation.findFirst({
      where: { id: req.params.threadId, tenantId: req.tenantId },
    });

    let isConversation = !!conversation;
    let isCallSession = false;

    if (!conversation) {
      conversation = await prisma.conversationThread.findFirst({
        where: { id: req.params.threadId, tenantId: req.tenantId },
      });
    }

    // Also check for CallSession (Voice channel)
    if (!conversation) {
      conversation = await prisma.callSession.findFirst({
        where: { id: req.params.threadId, tenantId: req.tenantId },
      });
      isCallSession = !!conversation;
    }

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Conversation or call not found',
      });
    }

    const note = await prisma.conversation_notes.create({
      data: {
        ...data,
        threadId: req.params.threadId,
        conversationId: isConversation ? req.params.threadId : null,
        tenantId: req.tenantId,
        userId: req.userId,
      },
    });

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });

    res.status(201).json({
      success: true,
      data: { ...note, user },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update a note
 */
router.patch('/conversations/:threadId/notes/:noteId', async (req, res, next) => {
  try {
    const data = z
      .object({
        content: z.string().min(1).optional(),
        isPinned: z.boolean().optional(),
        mentions: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const note = await prisma.conversation_notes.update({
      where: { id: req.params.noteId },
      data,
    });

    res.json({
      success: true,
      data: note,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a note
 */
router.delete('/conversations/:threadId/notes/:noteId', async (req, res, next) => {
  try {
    await prisma.conversation_notes.delete({
      where: { id: req.params.noteId },
    });

    res.json({
      success: true,
      message: 'Note deleted',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// SNOOZE
// ============================================================================

/**
 * Snooze a conversation
 */
router.post('/conversations/:id/snooze', async (req, res, next) => {
  try {
    const data = z
      .object({
        duration: z.enum(['1h', '3h', '24h', '3d', '1w', 'custom']),
        customUntil: z.string().datetime().optional(),
        reason: z.string().optional(),
      })
      .parse(req.body);

    let snoozedUntil;
    const now = new Date();

    switch (data.duration) {
      case '1h':
        snoozedUntil = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      case '3h':
        snoozedUntil = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        break;
      case '24h':
        snoozedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        break;
      case '3d':
        snoozedUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        break;
      case '1w':
        snoozedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        if (!data.customUntil) {
          return res.status(400).json({
            success: false,
            error: 'INVALID_DURATION',
            message: 'Custom duration requires customUntil date',
          });
        }
        snoozedUntil = new Date(data.customUntil);
        break;
    }

    const thread = await prisma.conversation.update({
      where: { id: req.params.id },
      data: {
        status: 'SNOOZED',
        snoozedUntil,
        snoozedAt: now,
        snoozedById: req.userId,
        snoozeReason: data.reason,
      },
    });

    res.json({
      success: true,
      data: thread,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Unsnooze a conversation
 */
router.post('/conversations/:id/unsnooze', async (req, res, next) => {
  try {
    const thread = await prisma.conversation.update({
      where: { id: req.params.id },
      data: {
        status: 'OPEN',
        snoozedUntil: null,
        snoozedAt: null,
        snoozedById: null,
        snoozeReason: null,
      },
    });

    res.json({
      success: true,
      data: thread,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// TEAM ASSIGNMENT
// ============================================================================

/**
 * Get teams for assignment dropdown
 */
router.get('/teams', async (req, res, next) => {
  try {
    const teams = await prisma.team.findMany({
      where: { tenantId: req.tenantId },
      include: {
        members: {
          select: {
            id: true,
            userId: true,
            role: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            conversation_threads: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Fetch user details for members
    const allUserIds = teams.flatMap((t) => t.members.map((m) => m.userId));
    const users = await prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    res.json({
      success: true,
      data: teams.map((team) => ({
        ...team,
        members: team.members.map((m) => ({
          ...m,
          user: userMap[m.userId] || null,
        })),
        assignedCount: team._count.conversation_threads,
        _count: undefined,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Assign conversation to team
 */
router.patch('/conversations/:id/assign-team', async (req, res, next) => {
  try {
    const data = z
      .object({
        teamId: z.string().nullable(),
      })
      .parse(req.body);

    const thread = await prisma.conversation.update({
      where: { id: req.params.id },
      data: {
        assignedToTeamId: data.teamId,
        // Optionally clear individual assignment when assigning to team
        // assignedToId: data.teamId ? null : undefined,
      },
      include: {
        assignedToTeam: true,
      },
    });

    res.json({
      success: true,
      data: thread,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// AUTO-ASSIGNMENT RULES
// ============================================================================

/**
 * Get auto-assignment rules
 */
router.get('/auto-assignment-rules', async (req, res, next) => {
  try {
    const rules = await prisma.autoAssignmentRule.findMany({
      where: { tenantId: req.tenantId },
      include: {
        assignToTeam: true,
      },
      orderBy: { priority: 'desc' },
    });

    // Fetch user details for USER type assignments
    const userIds = rules.filter((r) => r.assignToUserId).map((r) => r.assignToUserId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    res.json({
      success: true,
      data: rules.map((rule) => ({
        ...rule,
        assignToUser: rule.assignToUserId ? userMap[rule.assignToUserId] : null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create auto-assignment rule
 */
router.post('/auto-assignment-rules', async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1),
        description: z.string().optional(),
        priority: z.number().default(0),
        isActive: z.boolean().default(true),
        conditions: z.object({
          channel: z.enum(['WHATSAPP', 'SMS', 'EMAIL']).optional(),
          keywords: z.array(z.string()).optional(),
          businessHours: z.boolean().optional(),
          priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        }),
        assignToType: z.enum(['USER', 'TEAM', 'ROUND_ROBIN', 'LEAST_BUSY']),
        assignToUserId: z.string().optional(),
        assignToTeamId: z.string().optional(),
        roundRobinConfig: z
          .object({
            userIds: z.array(z.string()),
          })
          .optional(),
      })
      .parse(req.body);

    const rule = await prisma.autoAssignmentRule.create({
      data: {
        ...data,
        tenantId: req.tenantId,
      },
      include: {
        assignToTeam: true,
      },
    });

    res.status(201).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'DUPLICATE_NAME',
        message: 'A rule with this name already exists',
      });
    }
    next(error);
  }
});

/**
 * Update auto-assignment rule
 */
router.patch('/auto-assignment-rules/:id', async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        priority: z.number().optional(),
        isActive: z.boolean().optional(),
        conditions: z
          .object({
            channel: z.enum(['WHATSAPP', 'SMS', 'EMAIL']).optional(),
            keywords: z.array(z.string()).optional(),
            businessHours: z.boolean().optional(),
            priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
          })
          .optional(),
        assignToType: z.enum(['USER', 'TEAM', 'ROUND_ROBIN', 'LEAST_BUSY']).optional(),
        assignToUserId: z.string().nullable().optional(),
        assignToTeamId: z.string().nullable().optional(),
        roundRobinConfig: z
          .object({
            userIds: z.array(z.string()),
          })
          .optional(),
      })
      .parse(req.body);

    const rule = await prisma.autoAssignmentRule.update({
      where: { id: req.params.id },
      data,
      include: {
        assignToTeam: true,
      },
    });

    res.json({
      success: true,
      data: rule,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete auto-assignment rule
 */
router.delete('/auto-assignment-rules/:id', async (req, res, next) => {
  try {
    await prisma.autoAssignmentRule.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'Rule deleted',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// SLA POLICIES
// ============================================================================

/**
 * Get SLA policies
 */
router.get('/sla-policies', async (req, res, next) => {
  try {
    const policies = await prisma.inboxSLAPolicy.findMany({
      where: { tenantId: req.tenantId },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: policies,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create SLA policy
 */
router.post('/sla-policies', async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1),
        description: z.string().optional(),
        isDefault: z.boolean().default(false),
        firstResponseTime: z.number().min(1),
        firstResponseBreach: z.number().optional(),
        resolutionTime: z.number().min(1),
        resolutionBreach: z.number().optional(),
        useBusinessHours: z.boolean().default(true),
        businessHoursConfig: z
          .object({
            timezone: z.string(),
            hours: z.record(z.unknown()),
            holidays: z.array(z.string()).optional(),
          })
          .optional(),
        priorityOverrides: z
          .record(
            z.object({
              firstResponse: z.number().optional(),
              resolution: z.number().optional(),
            })
          )
          .optional(),
        escalationEnabled: z.boolean().default(false),
        escalationConfig: z
          .object({
            levels: z.array(
              z.object({
                after: z.number(),
                notifyUsers: z.array(z.string()).optional(),
                notifyTeams: z.array(z.string()).optional(),
              })
            ),
          })
          .optional(),
      })
      .parse(req.body);

    // If this is default, unset other defaults
    if (data.isDefault) {
      await prisma.inboxSLAPolicy.updateMany({
        where: { tenantId: req.tenantId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const policy = await prisma.inboxSLAPolicy.create({
      data: {
        ...data,
        tenantId: req.tenantId,
      },
    });

    res.status(201).json({
      success: true,
      data: policy,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'DUPLICATE_NAME',
        message: 'A policy with this name already exists',
      });
    }
    next(error);
  }
});

/**
 * Update SLA policy
 */
router.patch('/sla-policies/:id', async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        isDefault: z.boolean().optional(),
        isActive: z.boolean().optional(),
        firstResponseTime: z.number().min(1).optional(),
        firstResponseBreach: z.number().optional(),
        resolutionTime: z.number().min(1).optional(),
        resolutionBreach: z.number().optional(),
        useBusinessHours: z.boolean().optional(),
        businessHoursConfig: z
          .object({
            timezone: z.string(),
            hours: z.record(z.unknown()),
            holidays: z.array(z.string()).optional(),
          })
          .optional(),
        priorityOverrides: z
          .record(
            z.object({
              firstResponse: z.number().optional(),
              resolution: z.number().optional(),
            })
          )
          .optional(),
        escalationEnabled: z.boolean().optional(),
        escalationConfig: z
          .object({
            levels: z.array(
              z.object({
                after: z.number(),
                notifyUsers: z.array(z.string()).optional(),
                notifyTeams: z.array(z.string()).optional(),
              })
            ),
          })
          .optional(),
      })
      .parse(req.body);

    // If making this default, unset other defaults
    if (data.isDefault) {
      await prisma.inboxSLAPolicy.updateMany({
        where: {
          tenantId: req.tenantId,
          isDefault: true,
          id: { not: req.params.id },
        },
        data: { isDefault: false },
      });
    }

    const policy = await prisma.inboxSLAPolicy.update({
      where: { id: req.params.id },
      data,
    });

    res.json({
      success: true,
      data: policy,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete SLA policy
 */
router.delete('/sla-policies/:id', async (req, res, next) => {
  try {
    await prisma.inboxSLAPolicy.delete({
      where: { id: req.params.id },
    });

    res.json({
      success: true,
      message: 'SLA policy deleted',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// AI SUGGESTIONS (Placeholder - integrate with AI provider)
// ============================================================================

/**
 * Get AI-suggested reply for a conversation
 */
router.post('/conversations/:id/ai-suggest', async (req, res, next) => {
  try {
    const data = z
      .object({
        context: z.string().optional(), // Additional context from agent
        tone: z.enum(['professional', 'friendly', 'formal', 'casual']).default('professional'),
      })
      .parse(req.body);

    // Fetch recent messages for context
    const messages = await prisma.conversationThread.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // TODO: Integrate with OpenAI/Anthropic for actual suggestions
    // For now, return placeholder suggestions based on last message
    const lastCustomerMessage = messages.find((m) => m.direction === 'INBOUND');

    const suggestions = [
      {
        id: '1',
        content: `Thank you for reaching out! I understand your concern and I'm here to help.`,
        confidence: 0.9,
      },
      {
        id: '2',
        content: `I appreciate your patience. Let me look into this for you right away.`,
        confidence: 0.85,
      },
      {
        id: '3',
        content: `Thanks for the information! I'll check this and get back to you shortly.`,
        confidence: 0.8,
      },
    ];

    res.json({
      success: true,
      data: {
        suggestions,
        basedOnMessages: messages.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get conversation summary using AI
 */
router.post('/conversations/:id/summarize', async (req, res, next) => {
  try {
    // Fetch all messages for the conversation
    const messages = await prisma.conversationThread.findMany({
      where: { conversationId: req.params.id },
      orderBy: { createdAt: 'asc' },
    });

    const thread = await prisma.conversation.findUnique({
      where: { id: req.params.id },
      include: { contact: true },
    });

    // TODO: Integrate with AI for actual summarization
    // For now, return basic statistics
    const inboundCount = messages.filter((m) => m.direction === 'INBOUND').length;
    const outboundCount = messages.filter((m) => m.direction === 'OUTBOUND').length;

    const summary = {
      totalMessages: messages.length,
      inboundMessages: inboundCount,
      outboundMessages: outboundCount,
      duration:
        messages.length > 1
          ? Math.round(
              (new Date(messages[messages.length - 1].createdAt) -
                new Date(messages[0].createdAt)) /
                60000
            )
          : 0,
      status: thread?.status,
      keyTopics: ['General inquiry'], // AI would extract these
      sentiment: 'neutral', // AI would analyze this
      summary: `Conversation with ${thread?.contact?.firstName || 'customer'} containing ${messages.length} messages.`,
    };

    res.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// INBOX ANALYTICS
// ============================================================================

/**
 * Get inbox analytics
 */
router.get('/analytics', async (req, res, next) => {
  try {
    const params = z
      .object({
        period: z.enum(['today', '7d', '30d', '90d']).default('7d'),
      })
      .parse(req.query);

    let startDate = new Date();
    switch (params.period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    // Get conversation counts by status
    const conversationsByStatus = await prisma.conversation.groupBy({
      by: ['status'],
      where: {
        tenantId: req.tenantId,
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    // Get message counts
    const messageStats = await prisma.conversationThread.aggregate({
      where: {
        tenantId: req.tenantId,
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    // Get messages by direction (using message_events which has direction field)
    const messagesByDirection = await prisma.message_events.groupBy({
      by: ['direction'],
      where: {
        tenantId: req.tenantId,
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    // Get messages by channel (using message_events which has channel field)
    const conversationsByChannel = await prisma.message_events.groupBy({
      by: ['channel'],
      where: {
        tenantId: req.tenantId,
        createdAt: { gte: startDate },
      },
      _count: { _all: true },
    });

    // Get agent performance
    const agentPerformance = await prisma.conversation.groupBy({
      by: ['assignedToId'],
      where: {
        tenantId: req.tenantId,
        assignedToId: { not: null },
        createdAt: { gte: startDate },
      },
      _count: true,
    });

    // Fetch agent details
    const agentIds = agentPerformance.map((a) => a.assignedToId).filter(Boolean);
    const agents = await prisma.user.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true },
    });
    const agentMap = Object.fromEntries(agents.map((a) => [a.id, a]));

    // Calculate basic stats for response time (simplified)
    const conversationsWithResponse = await prisma.conversation.count({
      where: {
        tenantId: req.tenantId,
        firstResponseAt: { not: null },
        createdAt: { gte: startDate },
      },
    });

    // Calculate resolution rate
    const resolvedCount = conversationsByStatus.find((s) => s.status === 'RESOLVED')?._count || 0;
    const totalConversationsCount = conversationsByStatus.reduce((sum, s) => sum + s._count, 0);
    const resolutionRate =
      totalConversationsCount > 0 ? Math.round((resolvedCount / totalConversationsCount) * 100) : 0;

    res.json({
      success: true,
      data: {
        period: params.period,
        overview: {
          totalConversations: totalConversationsCount,
          totalMessages: messageStats._count,
          avgResponseTime: 'N/A', // Would need computed column for actual calculation
          resolutionRate,
          conversationsWithResponse,
        },
        conversationsByStatus: conversationsByStatus.map((s) => ({
          status: s.status,
          count: s._count,
        })),
        messagesByDirection: messagesByDirection.map((m) => ({
          direction: m.direction,
          count: m._count,
        })),
        conversationsByChannel: conversationsByChannel.map((c) => ({
          channel: c.channel,
          count: c._count._all,
        })),
        agentPerformance: agentPerformance.map((a) => ({
          agent: agentMap[a.assignedToId] || { id: a.assignedToId },
          conversationsHandled: a._count,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// AGENT STATUS (Online/Offline)
// ============================================================================

/**
 * Get all agents with their online status
 */
router.get('/agents/status', async (req, res, next) => {
  try {
    const agents = await assignmentService.getAgentsWithStatus(req.tenantId);

    res.json({
      success: true,
      data: agents,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get only online agents
 */
router.get('/agents/online', async (req, res, next) => {
  try {
    const agents = await assignmentService.getOnlineAgents(req.tenantId);

    res.json({
      success: true,
      data: agents,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Update current user's online status
 */
router.post('/agents/status', async (req, res, next) => {
  try {
    const data = z
      .object({
        isOnline: z.boolean(),
      })
      .parse(req.body);

    const agent = await assignmentService.updateAgentStatus(req.userId, data.isOnline);

    res.json({
      success: true,
      data: agent,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Heartbeat - Update last seen timestamp
 */
router.post('/agents/heartbeat', async (req, res, next) => {
  try {
    await assignmentService.updateLastSeen(req.userId);

    res.json({
      success: true,
      message: 'Heartbeat recorded',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Go online
 */
router.post('/agents/go-online', async (req, res, next) => {
  try {
    const agent = await assignmentService.updateAgentStatus(req.userId, true);

    res.json({
      success: true,
      data: agent,
      message: 'You are now online',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Go offline
 */
router.post('/agents/go-offline', async (req, res, next) => {
  try {
    const agent = await assignmentService.updateAgentStatus(req.userId, false);

    res.json({
      success: true,
      data: agent,
      message: 'You are now offline',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================================
// MANUAL ASSIGNMENT
// ============================================================================

/**
 * Manually trigger auto-assignment for a conversation
 */
router.post('/conversations/:id/auto-assign', async (req, res, next) => {
  try {
    const { channel, content } = req.body || {};

    const result = await assignmentService.autoAssignConversation(req.tenantId, req.params.id, {
      channel,
      content,
    });

    if (!result) {
      return res.json({
        success: true,
        data: null,
        message: 'No matching assignment rule found',
      });
    }

    res.json({
      success: true,
      data: result,
      message: `Assigned via rule: ${result.ruleName}`,
    });
  } catch (error) {
    next(error);
  }
});

export { router as inboxAgentRouter };
