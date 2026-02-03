import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';

class KBService {
  // ==========================================
  // CATEGORIES
  // ==========================================

  async getCategories(tenantId, filters = {}) {
    const where = { tenantId };

    if (filters.parentId !== undefined) {
      where.parentId = filters.parentId;
    }

    if (filters.isPublished !== undefined) {
      where.isPublished = filters.isPublished;
    }

    const categories = await prisma.kBCategory.findMany({
      where,
      include: {
        _count: {
          select: { articles: { where: { isPublished: true } } },
        },
        children: {
          where: { isPublished: true },
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    return categories.map((cat) => ({
      ...cat,
      articleCount: cat._count.articles,
    }));
  }

  async getCategory(tenantId, categoryId) {
    const category = await prisma.kBCategory.findFirst({
      where: { id: categoryId, tenantId },
      include: {
        articles: {
          where: { isPublished: true },
          orderBy: { createdAt: 'desc' },
        },
        children: true,
        parent: true,
      },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    return category;
  }

  async createCategory(tenantId, data) {
    const slug = this.generateSlug(data.name);

    const category = await prisma.kBCategory.create({
      data: {
        tenantId,
        name: data.name,
        slug,
        description: data.description,
        icon: data.icon,
        parentId: data.parentId,
        order: data.order || 0,
        isPublished: data.isPublished ?? true,
      },
    });

    return category;
  }

  async updateCategory(tenantId, categoryId, data) {
    const category = await prisma.kBCategory.findFirst({
      where: { id: categoryId, tenantId },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    const updateData = {};
    if (data.name !== undefined) {
      updateData.name = data.name;
      updateData.slug = this.generateSlug(data.name);
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon !== undefined) updateData.icon = data.icon;
    if (data.parentId !== undefined) updateData.parentId = data.parentId;
    if (data.order !== undefined) updateData.order = data.order;
    if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;

    return prisma.kBCategory.update({
      where: { id: categoryId },
      data: updateData,
    });
  }

  async deleteCategory(tenantId, categoryId) {
    const category = await prisma.kBCategory.findFirst({
      where: { id: categoryId, tenantId },
    });

    if (!category) {
      throw new NotFoundError('Category not found');
    }

    await prisma.kBCategory.delete({
      where: { id: categoryId },
    });

    return { success: true };
  }

  // ==========================================
  // ARTICLES
  // ==========================================

  async getArticles(tenantId, filters = {}) {
    // TODO: KB feature not yet implemented - KBArticle model doesn't exist
    // Return empty articles data for now
    const page = filters.page || 1;
    const limit = filters.limit || 25;

    return {
      articles: [],
      meta: {
        total: 0,
        page,
        limit,
        totalPages: 0,
      },
    };
  }

  async getArticle(tenantId, articleId) {
    const article = await prisma.kBArticle.findFirst({
      where: { id: articleId, tenantId },
      include: {
        category: true,
      },
    });

    if (!article) {
      throw new NotFoundError('Article not found');
    }

    // Increment view count
    await prisma.kBArticle.update({
      where: { id: articleId },
      data: { viewCount: { increment: 1 } },
    });

    return article;
  }

  async getArticleBySlug(tenantId, slug) {
    const article = await prisma.kBArticle.findFirst({
      where: { slug, tenantId },
      include: {
        category: true,
      },
    });

    if (!article) {
      throw new NotFoundError('Article not found');
    }

    // Increment view count
    await prisma.kBArticle.update({
      where: { id: article.id },
      data: { viewCount: { increment: 1 } },
    });

    return article;
  }

  async createArticle(tenantId, userId, data) {
    const slug = this.generateSlug(data.title);

    const article = await prisma.kBArticle.create({
      data: {
        tenantId,
        categoryId: data.categoryId,
        title: data.title,
        slug,
        content: data.content,
        excerpt: data.excerpt || data.content.substring(0, 200),
        authorId: userId,
        status: data.status || 'DRAFT',
        isPublished: data.isPublished ?? false,
        isFeatured: data.isFeatured ?? false,
        tags: data.tags || [],
        publishedAt: data.isPublished ? new Date() : null,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    return article;
  }

  async updateArticle(tenantId, articleId, data) {
    const article = await prisma.kBArticle.findFirst({
      where: { id: articleId, tenantId },
    });

    if (!article) {
      throw new NotFoundError('Article not found');
    }

    const updateData = {};
    if (data.title !== undefined) {
      updateData.title = data.title;
      updateData.slug = this.generateSlug(data.title);
    }
    if (data.content !== undefined) updateData.content = data.content;
    if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.isPublished !== undefined) {
      updateData.isPublished = data.isPublished;
      if (data.isPublished && !article.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }
    if (data.isFeatured !== undefined) updateData.isFeatured = data.isFeatured;
    if (data.tags !== undefined) updateData.tags = data.tags;

    return prisma.kBArticle.update({
      where: { id: articleId },
      data: updateData,
      include: {
        category: { select: { id: true, name: true } },
      },
    });
  }

  async deleteArticle(tenantId, articleId) {
    const article = await prisma.kBArticle.findFirst({
      where: { id: articleId, tenantId },
    });

    if (!article) {
      throw new NotFoundError('Article not found');
    }

    await prisma.kBArticle.delete({
      where: { id: articleId },
    });

    return { success: true };
  }

  async voteArticle(tenantId, articleId, helpful) {
    const article = await prisma.kBArticle.findFirst({
      where: { id: articleId, tenantId },
    });

    if (!article) {
      throw new NotFoundError('Article not found');
    }

    return prisma.kBArticle.update({
      where: { id: articleId },
      data: helpful ? { helpfulYes: { increment: 1 } } : { helpfulNo: { increment: 1 } },
    });
  }

  // ==========================================
  // STATS
  // ==========================================

  async getStats(tenantId) {
    const [totalArticles, totalCategories, publishedArticles, totalViews] = await Promise.all([
      prisma.kBArticle.count({ where: { tenantId } }),
      prisma.kBCategory.count({ where: { tenantId } }),
      prisma.kBArticle.count({ where: { tenantId, isPublished: true } }),
      prisma.kBArticle.aggregate({
        where: { tenantId },
        _sum: { viewCount: true },
      }),
    ]);

    const helpfulVotes = await prisma.kBArticle.aggregate({
      where: { tenantId },
      _sum: { helpfulYes: true, helpfulNo: true },
    });

    return {
      totalArticles,
      totalCategories,
      publishedArticles,
      draftArticles: totalArticles - publishedArticles,
      totalViews: totalViews._sum.viewCount || 0,
      helpfulYes: helpfulVotes._sum.helpfulYes || 0,
      helpfulNo: helpfulVotes._sum.helpfulNo || 0,
    };
  }

  // ==========================================
  // HELPERS
  // ==========================================

  generateSlug(text) {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') +
      '-' +
      Date.now().toString(36)
    );
  }
}

export const kbService = new KBService();
