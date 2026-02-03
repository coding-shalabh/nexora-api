import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../common/middleware/tenant.js';
import { kbService } from './kb.service.js';

const router = Router();

// ==========================================
// STATS (must be before /:id routes)
// ==========================================

router.get('/stats', requirePermission('kb:read'), async (req, res, next) => {
  try {
    const stats = await kbService.getStats(req.tenantId);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// CATEGORIES
// ==========================================

router.get('/categories', requirePermission('kb:read'), async (req, res, next) => {
  try {
    const filters = z
      .object({
        parentId: z.string().optional(),
        isPublished: z.coerce.boolean().optional(),
      })
      .parse(req.query);

    const categories = await kbService.getCategories(req.tenantId, filters);
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

router.get('/categories/:id', requirePermission('kb:read'), async (req, res, next) => {
  try {
    const category = await kbService.getCategory(req.tenantId, req.params.id);
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
});

router.post('/categories', requirePermission('kb:create'), async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1),
        description: z.string().optional(),
        icon: z.string().optional(),
        parentId: z.string().optional(),
        order: z.number().optional(),
        isPublished: z.boolean().optional(),
      })
      .parse(req.body);

    const category = await kbService.createCategory(req.tenantId, data);
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
});

router.patch('/categories/:id', requirePermission('kb:update'), async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        parentId: z.string().nullable().optional(),
        order: z.number().optional(),
        isPublished: z.boolean().optional(),
      })
      .parse(req.body);

    const category = await kbService.updateCategory(req.tenantId, req.params.id, data);
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
});

router.delete('/categories/:id', requirePermission('kb:delete'), async (req, res, next) => {
  try {
    await kbService.deleteCategory(req.tenantId, req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// ARTICLES
// ==========================================

router.get('/articles', requirePermission('kb:read'), async (req, res, next) => {
  try {
    const filters = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        categoryId: z.string().optional(),
        status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']).optional(),
        isPublished: z.coerce.boolean().optional(),
        isFeatured: z.coerce.boolean().optional(),
        search: z.string().optional(),
        orderBy: z.enum(['recent', 'popular']).default('recent'),
      })
      .parse(req.query);

    const result = await kbService.getArticles(req.tenantId, filters);
    res.json({ success: true, data: result.articles, meta: result.meta });
  } catch (error) {
    next(error);
  }
});

router.get('/articles/slug/:slug', requirePermission('kb:read'), async (req, res, next) => {
  try {
    const article = await kbService.getArticleBySlug(req.tenantId, req.params.slug);
    res.json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
});

router.get('/articles/:id', requirePermission('kb:read'), async (req, res, next) => {
  try {
    const article = await kbService.getArticle(req.tenantId, req.params.id);
    res.json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
});

router.post('/articles', requirePermission('kb:create'), async (req, res, next) => {
  try {
    const data = z
      .object({
        title: z.string().min(1),
        content: z.string().min(1),
        excerpt: z.string().optional(),
        categoryId: z.string().optional(),
        status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']).optional(),
        isPublished: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const article = await kbService.createArticle(req.tenantId, req.userId, data);
    res.status(201).json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
});

router.patch('/articles/:id', requirePermission('kb:update'), async (req, res, next) => {
  try {
    const data = z
      .object({
        title: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        excerpt: z.string().optional(),
        categoryId: z.string().nullable().optional(),
        status: z.enum(['DRAFT', 'REVIEW', 'PUBLISHED', 'ARCHIVED']).optional(),
        isPublished: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const article = await kbService.updateArticle(req.tenantId, req.params.id, data);
    res.json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
});

router.delete('/articles/:id', requirePermission('kb:delete'), async (req, res, next) => {
  try {
    await kbService.deleteArticle(req.tenantId, req.params.id);
    res.json({ success: true, message: 'Article deleted' });
  } catch (error) {
    next(error);
  }
});

router.post('/articles/:id/vote', requirePermission('kb:read'), async (req, res, next) => {
  try {
    const { helpful } = z.object({ helpful: z.boolean() }).parse(req.body);
    const article = await kbService.voteArticle(req.tenantId, req.params.id, helpful);
    res.json({ success: true, data: article });
  } catch (error) {
    next(error);
  }
});

export { router as kbRouter };
