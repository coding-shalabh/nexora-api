import { Router } from 'express';
import { z } from 'zod';
import { templatesService } from './templates.service.js';

const router = Router();

// Validation helper
const validate = (schema) => (req, res, next) => {
  try {
    req.validatedBody = schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: error.errors?.[0]?.message || 'Invalid request data',
    });
  }
};

// Get templates list
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { type, category, isActive, search } = req.query;

    const templates = await templatesService.getTemplates(tenantId, {
      type,
      category,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
    });

    return res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Get templates error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch templates',
    });
  }
});

// Get template stats
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.tenantId;

    const stats = await templatesService.getStats(tenantId);

    return res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Get template stats error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: 'Failed to fetch template stats',
    });
  }
});

// Get single template
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const templateId = req.params.id;

    const template = await templatesService.getTemplate(tenantId, templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Template not found',
      });
    }

    return res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Get template error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch template',
    });
  }
});

// Create template validation schema
const createTemplateSchema = z
  .object({
    name: z.string().min(1, 'Name is required'),
    type: z.enum(['email', 'whatsapp', 'sms', 'EMAIL', 'WHATSAPP', 'SMS']).default('email'),
    category: z.string().optional(),
    content: z.string().min(1, 'Content/body is required').optional(),
    body: z.string().min(1, 'Content/body is required').optional(),
    bodyContent: z.string().min(1, 'Content/body is required').optional(),
    subject: z.string().optional(),
    headerContent: z.string().optional(),
    isActive: z.boolean().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  })
  .refine((data) => data.content || data.body || data.bodyContent, {
    message: 'At least one of content, body, or bodyContent is required',
    path: ['content'],
  })
  .transform((data) => {
    // Normalize field names for service layer
    return {
      name: data.name,
      type: data.type,
      category: data.category,
      content: data.content || data.body || data.bodyContent,
      subject: data.subject || data.headerContent,
      isActive: data.isActive,
      status: data.status,
    };
  });

// Create template
router.post('/', validate(createTemplateSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const data = req.validatedBody;

    const template = await templatesService.createTemplate(tenantId, data);

    return res.status(201).json({
      success: true,
      data: template,
      message: 'Template created successfully',
    });
  } catch (error) {
    console.error('Create template error:', error);
    return res.status(500).json({
      success: false,
      error: 'CREATE_FAILED',
      message: error.message || 'Failed to create template',
    });
  }
});

// Update template validation schema
const updateTemplateSchema = z
  .object({
    name: z.string().min(1).optional(),
    type: z.enum(['email', 'whatsapp', 'sms', 'EMAIL', 'WHATSAPP', 'SMS']).optional(),
    category: z.string().optional(),
    content: z.string().optional(),
    body: z.string().optional(),
    bodyContent: z.string().optional(),
    subject: z.string().optional(),
    headerContent: z.string().optional(),
    isActive: z.boolean().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  })
  .transform((data) => {
    // Normalize field names for service layer
    const normalized = {
      name: data.name,
      type: data.type,
      category: data.category,
      subject: data.subject || data.headerContent,
      isActive: data.isActive,
      status: data.status,
    };
    // Only add content if at least one content field is provided
    if (data.content || data.body || data.bodyContent) {
      normalized.content = data.content || data.body || data.bodyContent;
    }
    return normalized;
  });

// Update template
router.patch('/:id', validate(updateTemplateSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const templateId = req.params.id;
    const data = req.validatedBody;

    const template = await templatesService.updateTemplate(tenantId, templateId, data);

    return res.json({
      success: true,
      data: template,
      message: 'Template updated successfully',
    });
  } catch (error) {
    console.error('Update template error:', error);

    if (error.message === 'Template not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Template not found',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: error.message || 'Failed to update template',
    });
  }
});

// Delete template
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const templateId = req.params.id;

    await templatesService.deleteTemplate(tenantId, templateId);

    return res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Delete template error:', error);

    if (error.message === 'Template not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Template not found',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: error.message || 'Failed to delete template',
    });
  }
});

// Duplicate template
router.post('/:id/duplicate', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const templateId = req.params.id;

    const template = await templatesService.duplicateTemplate(tenantId, templateId);

    return res.status(201).json({
      success: true,
      data: template,
      message: 'Template duplicated successfully',
    });
  } catch (error) {
    console.error('Duplicate template error:', error);

    if (error.message === 'Template not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Template not found',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'DUPLICATE_FAILED',
      message: error.message || 'Failed to duplicate template',
    });
  }
});

// Render template with variables (preview)
router.post('/:id/render', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const templateId = req.params.id;
    const { variables } = req.body;

    const template = await templatesService.getTemplate(tenantId, templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Template not found',
      });
    }

    const rendered = templatesService.renderTemplate(template, variables || {});

    return res.json({
      success: true,
      data: {
        subject: rendered.subject,
        content: rendered.content,
      },
    });
  } catch (error) {
    console.error('Render template error:', error);
    return res.status(500).json({
      success: false,
      error: 'RENDER_FAILED',
      message: error.message || 'Failed to render template',
    });
  }
});

export default router;
