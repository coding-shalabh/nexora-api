/**
 * Marketing Campaigns API Routes
 * Multi-channel marketing campaign management
 */

import { Router } from 'express';
import { z } from 'zod';
import { campaignService } from './campaigns.service.js';

const router = Router();

// Validation schemas
const createCampaignSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    description: z.string().optional(),
    type: z
      .enum([
        'BROADCAST',
        'DRIP',
        'NURTURE',
        'PROMOTIONAL',
        'ONBOARDING',
        'REENGAGEMENT',
        'EVENT',
        'CUSTOM',
        // Allow channel names as campaign types (for backward compatibility)
        'EMAIL',
        'WHATSAPP',
        'SMS',
        'VOICE',
      ])
      .default('PROMOTIONAL'),
    channels: z
      .array(z.enum(['EMAIL', 'WHATSAPP', 'SMS', 'VOICE', 'email', 'whatsapp', 'sms', 'voice']))
      .min(1, 'At least one channel (EMAIL, WHATSAPP, SMS, or VOICE) is required')
      .optional(),
    goal: z.string().optional(),
    goals: z.record(z.any()).optional(), // Accept both goal and goals
    targetAudience: z.enum(['ALL_CONTACTS', 'SEGMENT', 'SPECIFIC', 'CONTACTS']).optional(),
    segmentId: z.string().optional(),
    audienceFilter: z
      .object({
        status: z.string().optional(),
        source: z.string().optional(),
        tags: z.array(z.string()).optional(),
        lifecycleStage: z.string().optional(),
        hasPhone: z.boolean().optional(),
        hasEmail: z.boolean().optional(),
        marketingConsent: z.boolean().optional(),
      })
      .optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    timezone: z.string().default('UTC'),
    budget: z.number().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
  })
  .transform((data) => {
    // Auto-populate channels from type if not provided
    let channels = data.channels;
    if (!channels || channels.length === 0) {
      // If type is a channel name, use it as the channel
      if (['EMAIL', 'WHATSAPP', 'SMS', 'VOICE'].includes(data.type)) {
        channels = [data.type];
      }
    }

    // Normalize channel names to uppercase
    if (channels) {
      channels = channels.map((ch) => ch.toUpperCase());
    }

    // If type is a channel name, change it to PROMOTIONAL
    let campaignType = data.type;
    if (['EMAIL', 'WHATSAPP', 'SMS', 'VOICE'].includes(data.type)) {
      campaignType = 'PROMOTIONAL';
    }

    return {
      ...data,
      type: campaignType,
      channels,
      goal: data.goal || data.goals,
    };
  });

const updateCampaignSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    type: z
      .enum([
        'BROADCAST',
        'DRIP',
        'NURTURE',
        'PROMOTIONAL',
        'ONBOARDING',
        'REENGAGEMENT',
        'EVENT',
        'CUSTOM',
        'EMAIL',
        'WHATSAPP',
        'SMS',
        'VOICE',
      ])
      .optional(),
    channels: z
      .array(z.enum(['EMAIL', 'WHATSAPP', 'SMS', 'VOICE', 'email', 'whatsapp', 'sms', 'voice']))
      .optional(),
    goal: z.string().optional(),
    goals: z.record(z.any()).optional(),
    targetAudience: z.enum(['ALL_CONTACTS', 'SEGMENT', 'SPECIFIC', 'CONTACTS']).optional(),
    segmentId: z.string().optional(),
    audienceFilter: z.record(z.any()).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    timezone: z.string().optional(),
    budget: z.number().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
  })
  .transform((data) => {
    const normalized = { ...data };

    // Normalize channel names
    if (data.channels) {
      normalized.channels = data.channels.map((ch) => ch.toUpperCase());
    }

    // Convert channel type to PROMOTIONAL
    if (data.type && ['EMAIL', 'WHATSAPP', 'SMS', 'VOICE'].includes(data.type)) {
      normalized.type = 'PROMOTIONAL';
    }

    // Handle both goal and goals
    if (data.goals && !data.goal) {
      normalized.goal = data.goals;
    }

    return normalized;
  });

const addBroadcastSchema = z.object({
  broadcastId: z.string().min(1, 'Broadcast ID is required'),
});

const addSequenceSchema = z.object({
  sequenceId: z.string().min(1, 'Sequence ID is required'),
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

// GET /campaigns - List all campaigns
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page, limit, status, type, search } = req.query;

    const result = await campaignService.list({
      tenantId,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100), // Cap at 100
      status,
      type,
      search,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('List campaigns error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /campaigns/stats - Get marketing stats overview
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { startDate, endDate } = req.query;

    const stats = await campaignService.getOverallStats({
      tenantId,
      startDate,
      endDate,
    });

    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Get campaign stats error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /campaigns/:id - Get a single campaign
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const campaignId = req.params.id;

    const campaign = await campaignService.get({
      tenantId,
      campaignId,
    });

    return res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Get campaign error:', error);
    return res.status(404).json({ success: false, error: error.message });
  }
});

// GET /campaigns/:id/analytics - Get campaign analytics
router.get('/:id/analytics', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const campaignId = req.params.id;

    const analytics = await campaignService.getAnalytics({
      tenantId,
      campaignId,
    });

    return res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Get campaign analytics error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /campaigns/:id/activities - Get campaign activities (timeline)
router.get('/:id/activities', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const campaignId = req.params.id;
    const { page, limit, type } = req.query;

    const result = await campaignService.getActivities({
      tenantId,
      campaignId,
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 50, 100), // Cap at 100
      type,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Get campaign activities error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /campaigns - Create a new campaign
router.post('/', validate(createCampaignSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;

    const campaign = await campaignService.create({
      tenantId,
      userId,
      data: req.validatedBody,
    });

    return res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    console.error('Create campaign error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PATCH /campaigns/:id - Update a campaign
router.patch('/:id', validate(updateCampaignSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const campaignId = req.params.id;

    const campaign = await campaignService.update({
      tenantId,
      campaignId,
      data: req.validatedBody,
    });

    return res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Update campaign error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /campaigns/:id - Delete a campaign
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const campaignId = req.params.id;

    await campaignService.delete({
      tenantId,
      campaignId,
    });

    return res.json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    console.error('Delete campaign error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /campaigns/:id/activate - Activate a campaign
router.post('/:id/activate', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const campaignId = req.params.id;

    const campaign = await campaignService.activate({
      tenantId,
      campaignId,
    });

    return res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Activate campaign error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /campaigns/:id/pause - Pause a campaign
router.post('/:id/pause', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const campaignId = req.params.id;

    const campaign = await campaignService.pause({
      tenantId,
      campaignId,
    });

    return res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Pause campaign error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /campaigns/:id/complete - Mark campaign as completed
router.post('/:id/complete', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const campaignId = req.params.id;

    const campaign = await campaignService.complete({
      tenantId,
      campaignId,
    });

    return res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Complete campaign error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /campaigns/:id/duplicate - Duplicate a campaign
router.post('/:id/duplicate', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const campaignId = req.params.id;

    const campaign = await campaignService.duplicate({
      tenantId,
      campaignId,
      userId,
    });

    return res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    console.error('Duplicate campaign error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /campaigns/:id/broadcasts - Add broadcast to campaign
router.post('/:id/broadcasts', validate(addBroadcastSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const campaignId = req.params.id;
    const { broadcastId } = req.validatedBody;

    const campaign = await campaignService.addBroadcast({
      tenantId,
      campaignId,
      broadcastId,
    });

    return res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Add broadcast to campaign error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /campaigns/:id/sequences - Add sequence to campaign
router.post('/:id/sequences', validate(addSequenceSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const campaignId = req.params.id;
    const { sequenceId } = req.validatedBody;

    const campaign = await campaignService.addSequence({
      tenantId,
      campaignId,
      sequenceId,
    });

    return res.json({ success: true, data: campaign });
  } catch (error) {
    console.error('Add sequence to campaign error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
