/**
 * Broadcast API Routes
 * Marketing and bulk messaging endpoints
 */

import { Router } from 'express';
import { z } from 'zod';
import { broadcastService } from './broadcast.service.js';

const router = Router();

// Validation schemas
const createBroadcastSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    channel: z.enum(['WHATSAPP', 'SMS', 'EMAIL']),
    channelAccountId: z.string().min(1, 'Channel account ID is required'),
    templateId: z.string().optional(),
    templateName: z.string().optional(),
    subject: z.string().optional(),
    content: z.string().optional(),
    contentHtml: z.string().optional(),
    body: z.string().optional(), // Alias for content
    audienceType: z.enum(['ALL_CONTACTS', 'SEGMENT', 'FILTER', 'CONTACTS']).default('CONTACTS'),
    audienceFilter: z
      .object({
        status: z.string().optional(),
        source: z.string().optional(),
        tags: z.array(z.string()).optional(),
        hasPhone: z.boolean().optional(),
        hasEmail: z.boolean().optional(),
      })
      .optional(),
    segmentId: z.string().optional(),
    contactIds: z.array(z.string()).optional(),
    scheduledAt: z.string().optional(),
    timezone: z.string().default('UTC'),
  })
  .refine(
    (data) => {
      // Must have either templateId/templateName OR content/body
      return data.templateId || data.templateName || data.content || data.contentHtml || data.body;
    },
    {
      message: 'Either templateId/templateName OR content/contentHtml/body is required',
      path: ['content'],
    }
  )
  .refine(
    (data) => {
      // Must have audience specified
      if (data.audienceType === 'ALL_CONTACTS') return true;
      if (data.audienceType === 'SEGMENT') return !!data.segmentId;
      if (data.audienceType === 'FILTER') return !!data.audienceFilter;
      if (data.audienceType === 'CONTACTS') return !!data.contactIds && data.contactIds.length > 0;
      return false;
    },
    {
      message:
        'Audience must be specified: segmentId for SEGMENT, contactIds for CONTACTS, or audienceFilter for FILTER',
      path: ['audienceType'],
    }
  )
  .transform((data) => {
    // Normalize content field
    return {
      ...data,
      content: data.content || data.body || data.contentHtml,
    };
  });

const updateBroadcastSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  templateId: z.string().optional(),
  templateName: z.string().optional(),
  subject: z.string().optional(),
  content: z.string().optional(),
  contentHtml: z.string().optional(),
  audienceType: z.enum(['ALL_CONTACTS', 'SEGMENT', 'FILTER', 'CONTACTS']).optional(),
  audienceFilter: z
    .object({
      status: z.string().optional(),
      source: z.string().optional(),
      tags: z.array(z.string()).optional(),
      hasPhone: z.boolean().optional(),
      hasEmail: z.boolean().optional(),
    })
    .optional(),
  segmentId: z.string().optional(),
  contactIds: z.array(z.string()).optional(),
  scheduledAt: z.string().optional(),
  timezone: z.string().optional(),
});

// Helper for validation
const validate = (schema) => (req, res, next) => {
  try {
    req.validatedBody = schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.errors,
    });
  }
};

// GET /broadcasts/templates/:channelAccountId - Get templates for a channel account
// Must be before /:id to avoid route conflict
router.get('/templates/:channelAccountId', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { channelAccountId } = req.params;

    const result = await broadcastService.getTemplates({
      tenantId,
      channelAccountId,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Get templates error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /broadcasts - List all broadcasts
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page, limit, status, channel } = req.query;

    const result = await broadcastService.list({
      tenantId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      status,
      channel,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('List broadcasts error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /broadcasts/:id - Get a single broadcast
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const broadcastId = req.params.id;

    const broadcast = await broadcastService.get({
      tenantId,
      broadcastId,
    });

    return res.json({ success: true, data: broadcast });
  } catch (error) {
    console.error('Get broadcast error:', error);
    return res.status(404).json({ success: false, error: error.message });
  }
});

// GET /broadcasts/:id/recipients - Get broadcast recipients
router.get('/:id/recipients', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const broadcastId = req.params.id;
    const { page, limit } = req.query;

    const result = await broadcastService.getWithRecipients({
      tenantId,
      broadcastId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Get broadcast recipients error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /broadcasts/:id/analytics - Get broadcast analytics
router.get('/:id/analytics', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const broadcastId = req.params.id;

    const analytics = await broadcastService.getAnalytics({
      tenantId,
      broadcastId,
    });

    return res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Get broadcast analytics error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /broadcasts - Create a new broadcast
router.post('/', validate(createBroadcastSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;

    const broadcast = await broadcastService.create({
      tenantId,
      userId,
      data: req.validatedBody,
    });

    return res.status(201).json({ success: true, data: broadcast });
  } catch (error) {
    console.error('Create broadcast error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PATCH /broadcasts/:id - Update a broadcast
router.patch('/:id', validate(updateBroadcastSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const broadcastId = req.params.id;

    const broadcast = await broadcastService.update({
      tenantId,
      broadcastId,
      data: req.validatedBody,
    });

    return res.json({ success: true, data: broadcast });
  } catch (error) {
    console.error('Update broadcast error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /broadcasts/:id - Delete a broadcast
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const broadcastId = req.params.id;

    await broadcastService.delete({
      tenantId,
      broadcastId,
    });

    return res.json({ success: true, message: 'Broadcast deleted' });
  } catch (error) {
    console.error('Delete broadcast error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /broadcasts/:id/send - Send a broadcast
router.post('/:id/send', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const broadcastId = req.params.id;

    const result = await broadcastService.send({
      tenantId,
      broadcastId,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Send broadcast error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /broadcasts/:id/duplicate - Duplicate a broadcast
router.post('/:id/duplicate', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const broadcastId = req.params.id;

    const broadcast = await broadcastService.duplicate({
      tenantId,
      broadcastId,
      userId,
    });

    return res.status(201).json({ success: true, data: broadcast });
  } catch (error) {
    console.error('Duplicate broadcast error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /broadcasts/:id/cancel - Cancel a scheduled broadcast
router.post('/:id/cancel', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const broadcastId = req.params.id;

    await broadcastService.cancel({
      tenantId,
      broadcastId,
    });

    return res.json({ success: true, message: 'Broadcast cancelled' });
  } catch (error) {
    console.error('Cancel broadcast error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
