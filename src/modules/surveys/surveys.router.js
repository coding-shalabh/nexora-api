import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../common/middleware/tenant.js';
import { surveysService } from './surveys.service.js';

const router = Router();

// ==========================================
// STATS (must be before /:id routes)
// ==========================================

router.get('/stats', requirePermission('surveys:read'), async (req, res, next) => {
  try {
    const stats = await surveysService.getStats(req.tenantId);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// SURVEYS
// ==========================================

router.get('/', requirePermission('surveys:read'), async (req, res, next) => {
  try {
    const filters = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
        type: z.enum(['CSAT', 'NPS', 'CES', 'CUSTOM']).optional(),
        search: z.string().optional(),
      })
      .parse(req.query);

    const result = await surveysService.getSurveys(req.tenantId, filters);
    res.json({ success: true, data: result.surveys, meta: result.meta });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requirePermission('surveys:read'), async (req, res, next) => {
  try {
    const survey = await surveysService.getSurvey(req.tenantId, req.params.id);
    res.json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/analytics', requirePermission('surveys:read'), async (req, res, next) => {
  try {
    const analytics = await surveysService.getSurveyAnalytics(req.tenantId, req.params.id);
    res.json({ success: true, data: analytics });
  } catch (error) {
    next(error);
  }
});

router.post('/', requirePermission('surveys:create'), async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1),
        description: z.string().optional(),
        type: z.enum(['CSAT', 'NPS', 'CES', 'CUSTOM']).default('CUSTOM'),
        status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
        isAnonymous: z.boolean().optional(),
        showProgressBar: z.boolean().optional(),
        allowMultiple: z.boolean().optional(),
        thankYouMessage: z.string().optional(),
        redirectUrl: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
      .parse(req.body);

    const survey = await surveysService.createSurvey(req.tenantId, data);
    res.status(201).json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', requirePermission('surveys:update'), async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        type: z.enum(['CSAT', 'NPS', 'CES', 'CUSTOM']).optional(),
        status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
        isAnonymous: z.boolean().optional(),
        showProgressBar: z.boolean().optional(),
        allowMultiple: z.boolean().optional(),
        thankYouMessage: z.string().optional(),
        redirectUrl: z.string().optional(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
      })
      .parse(req.body);

    const survey = await surveysService.updateSurvey(req.tenantId, req.params.id, data);
    res.json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requirePermission('surveys:delete'), async (req, res, next) => {
  try {
    await surveysService.deleteSurvey(req.tenantId, req.params.id);
    res.json({ success: true, message: 'Survey deleted' });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/duplicate', requirePermission('surveys:create'), async (req, res, next) => {
  try {
    const survey = await surveysService.duplicateSurvey(req.tenantId, req.params.id);
    res.status(201).json({ success: true, data: survey });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// QUESTIONS
// ==========================================

router.post('/:id/questions', requirePermission('surveys:update'), async (req, res, next) => {
  try {
    const data = z
      .object({
        type: z.enum([
          'RATING',
          'NPS',
          'TEXT',
          'TEXTAREA',
          'SINGLE_CHOICE',
          'MULTIPLE_CHOICE',
          'SCALE',
          'DATE',
          'YES_NO',
        ]),
        question: z.string().min(1),
        description: z.string().optional(),
        options: z.any().optional(),
        isRequired: z.boolean().optional(),
        order: z.number().optional(),
        settings: z.any().optional(),
      })
      .parse(req.body);

    const question = await surveysService.addQuestion(req.tenantId, req.params.id, data);
    res.status(201).json({ success: true, data: question });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/:id/questions/:questionId',
  requirePermission('surveys:update'),
  async (req, res, next) => {
    try {
      const data = z
        .object({
          type: z
            .enum([
              'RATING',
              'NPS',
              'TEXT',
              'TEXTAREA',
              'SINGLE_CHOICE',
              'MULTIPLE_CHOICE',
              'SCALE',
              'DATE',
              'YES_NO',
            ])
            .optional(),
          question: z.string().min(1).optional(),
          description: z.string().optional(),
          options: z.any().optional(),
          isRequired: z.boolean().optional(),
          order: z.number().optional(),
          settings: z.any().optional(),
        })
        .parse(req.body);

      const question = await surveysService.updateQuestion(
        req.tenantId,
        req.params.id,
        req.params.questionId,
        data
      );
      res.json({ success: true, data: question });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/:id/questions/:questionId',
  requirePermission('surveys:update'),
  async (req, res, next) => {
    try {
      await surveysService.deleteQuestion(req.tenantId, req.params.id, req.params.questionId);
      res.json({ success: true, message: 'Question deleted' });
    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// RESPONSES
// ==========================================

router.get('/:id/responses', requirePermission('surveys:read'), async (req, res, next) => {
  try {
    const filters = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
      })
      .parse(req.query);

    const result = await surveysService.getResponses(req.tenantId, req.params.id, filters);
    res.json({ success: true, data: result.responses, meta: result.meta });
  } catch (error) {
    next(error);
  }
});

// Public endpoint for submitting survey responses (no auth required)
router.post('/:id/submit', async (req, res, next) => {
  try {
    const data = z
      .object({
        contactId: z.string().optional(),
        ticketId: z.string().optional(),
        sessionId: z.string().optional(),
        answers: z.array(
          z.object({
            questionId: z.string(),
            value: z.string().optional(),
            numericValue: z.number().optional(),
            metadata: z.any().optional(),
          })
        ),
        metadata: z.any().optional(),
      })
      .parse(req.body);

    // Add IP and user agent
    data.ipAddress = req.ip;
    data.userAgent = req.headers['user-agent'];

    const response = await surveysService.submitResponse(req.params.id, data);
    res.status(201).json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
});

export { router as surveysRouter };
