/**
 * Segments API Routes
 * Audience segmentation with dynamic filters
 */

import { Router } from 'express';
import { z } from 'zod';
import { segmentsService } from './segments.service.js';

const router = Router();

// Validation schemas
const ruleSchema = z.object({
  field: z.string().min(1, 'Field is required'),
  operator: z.enum([
    'eq',
    'ne',
    'gt',
    'gte',
    'lt',
    'lte',
    'in',
    'nin',
    'contains',
    'startsWith',
    'endsWith',
    'exists',
    'notExists',
  ]),
  value: z.any(),
});

const createSegmentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.enum(['STATIC', 'DYNAMIC']).default('STATIC'),
  conditions: z
    .object({
      combinator: z.enum(['AND', 'OR']).default('AND'),
      rules: z.array(ruleSchema).min(1, 'At least one rule is required for dynamic segments'),
    })
    .optional(),
  contactIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const updateSegmentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  conditions: z
    .object({
      combinator: z.enum(['AND', 'OR']).default('AND'),
      rules: z.array(ruleSchema).min(1, 'At least one rule is required'),
    })
    .optional(),
  contactIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const previewSchema = z.object({
  conditions: z.object({
    combinator: z.enum(['AND', 'OR']).default('AND'),
    rules: z.array(ruleSchema).min(1, 'At least one rule is required'),
  }),
  limit: z.number().optional(),
});

const contactsSchema = z.object({
  contactIds: z.array(z.string()).min(1, 'At least one contact ID required'),
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

// GET /segments - List all segments
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { page, limit, type, search, isActive } = req.query;

    const result = await segmentsService.list({
      tenantId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 20,
      type,
      search,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('List segments error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /segments/fields - Get available filter fields
router.get('/fields', async (req, res) => {
  try {
    const fields = segmentsService.getFilterFields();
    return res.json({ success: true, data: fields });
  } catch (error) {
    console.error('Get filter fields error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /segments/preview - Preview segment without saving
router.post('/preview', validate(previewSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { conditions, limit } = req.validatedBody;

    const result = await segmentsService.preview({
      tenantId,
      conditions,
      limit: limit || 10,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Preview segment error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /segments/:id - Get a single segment
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const segmentId = req.params.id;

    const segment = await segmentsService.get({
      tenantId,
      segmentId,
    });

    return res.json({ success: true, data: segment });
  } catch (error) {
    console.error('Get segment error:', error);
    return res.status(404).json({ success: false, error: error.message });
  }
});

// GET /segments/:id/contacts - Get contacts in a segment
router.get('/:id/contacts', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const segmentId = req.params.id;
    const { page, limit } = req.query;

    const result = await segmentsService.getContacts({
      tenantId,
      segmentId,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });

    return res.json({ success: true, ...result });
  } catch (error) {
    console.error('Get segment contacts error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /segments - Create a new segment
router.post('/', validate(createSegmentSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;

    const segment = await segmentsService.create({
      tenantId,
      userId,
      data: req.validatedBody,
    });

    return res.status(201).json({ success: true, data: segment });
  } catch (error) {
    console.error('Create segment error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// PATCH /segments/:id - Update a segment
router.patch('/:id', validate(updateSegmentSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const segmentId = req.params.id;

    const segment = await segmentsService.update({
      tenantId,
      segmentId,
      data: req.validatedBody,
    });

    return res.json({ success: true, data: segment });
  } catch (error) {
    console.error('Update segment error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /segments/:id - Delete a segment
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const segmentId = req.params.id;

    await segmentsService.delete({
      tenantId,
      segmentId,
    });

    return res.json({ success: true, message: 'Segment deleted' });
  } catch (error) {
    console.error('Delete segment error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /segments/:id/sync - Sync a dynamic segment
router.post('/:id/sync', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const segmentId = req.params.id;

    const segment = await segmentsService.sync({
      tenantId,
      segmentId,
    });

    return res.json({ success: true, data: segment });
  } catch (error) {
    console.error('Sync segment error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /segments/:id/duplicate - Duplicate a segment
router.post('/:id/duplicate', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.userId;
    const segmentId = req.params.id;

    const segment = await segmentsService.duplicate({
      tenantId,
      segmentId,
      userId,
    });

    return res.status(201).json({ success: true, data: segment });
  } catch (error) {
    console.error('Duplicate segment error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// POST /segments/:id/contacts - Add contacts to a static segment
router.post('/:id/contacts', validate(contactsSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const segmentId = req.params.id;
    const { contactIds } = req.validatedBody;

    const segment = await segmentsService.addContacts({
      tenantId,
      segmentId,
      contactIds,
    });

    return res.json({ success: true, data: segment });
  } catch (error) {
    console.error('Add contacts to segment error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

// DELETE /segments/:id/contacts - Remove contacts from a static segment
router.delete('/:id/contacts', validate(contactsSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const segmentId = req.params.id;
    const { contactIds } = req.validatedBody;

    const segment = await segmentsService.removeContacts({
      tenantId,
      segmentId,
      contactIds,
    });

    return res.json({ success: true, data: segment });
  } catch (error) {
    console.error('Remove contacts from segment error:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
