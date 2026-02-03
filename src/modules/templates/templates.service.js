import { prisma } from '@crm360/database';

export class TemplatesService {
  // Get all templates for tenant
  async getTemplates(tenantId, filters = {}) {
    // Build SQL query with filters (exclude status to avoid schema mismatch)
    let sql = `
      SELECT id, name, category, "bodyContent" as content, "headerContent" as subject, variables, "createdAt", "updatedAt"
      FROM templates
      WHERE "tenantId" = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;

    // Map type filter to category
    if (filters.type) {
      sql += ` AND category = $${paramIndex}`;
      params.push(filters.type.toUpperCase());
      paramIndex++;
    }

    if (filters.category) {
      sql += ` AND category = $${paramIndex}`;
      params.push(filters.category.toUpperCase());
      paramIndex++;
    }

    if (filters.search) {
      sql += ` AND (name ILIKE $${paramIndex} OR "bodyContent" ILIKE $${paramIndex})`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    sql += ` ORDER BY "createdAt" DESC`;

    // Use raw query to bypass Prisma schema validation issues
    const templates = await prisma.$queryRawUnsafe(sql, ...params);

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      channel: t.category?.toLowerCase() || 'email',
      type: t.category?.toLowerCase() || 'email',
      category: t.category?.toLowerCase() || 'general',
      content: t.content || '',
      subject: t.subject,
      variables: t.variables || [],
      isActive: true,
      status: 'approved',
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  }

  // Get single template
  async getTemplate(tenantId, templateId) {
    const templates = await prisma.$queryRaw`
      SELECT id, name, category, "bodyContent" as content, "headerContent" as subject, variables, "createdAt", "updatedAt"
      FROM templates
      WHERE id = ${templateId} AND "tenantId" = ${tenantId}
      LIMIT 1
    `;

    if (!templates || templates.length === 0) {
      return null;
    }

    const t = templates[0];
    return {
      id: t.id,
      name: t.name,
      channel: t.category?.toLowerCase() || 'email',
      type: t.category?.toLowerCase() || 'email',
      category: t.category?.toLowerCase() || 'general',
      content: t.content || '',
      subject: t.subject,
      variables: t.variables || [],
      isActive: true,
      status: 'approved',
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  // Create template
  async createTemplate(tenantId, data) {
    // Extract variables from content
    const variables = this.extractVariables(data.content || data.bodyContent);

    // Get or create default channel for this type
    const channelType = (data.type || 'EMAIL').toUpperCase();
    const channel = await prisma.channel.findFirst({
      where: { tenantId, type: channelType },
    });

    if (!channel) {
      throw new Error(`No ${channelType} channel configured for this tenant`);
    }

    const template = await prisma.template.create({
      data: {
        tenantId,
        channelId: channel.id,
        name: data.name,
        category: (data.category || 'GENERAL').toUpperCase(),
        bodyContent: data.content || data.bodyContent,
        headerContent: data.subject || data.headerContent || null,
        variables,
        status: 'APPROVED',
      },
    });

    return {
      id: template.id,
      name: template.name,
      type: channelType.toLowerCase(),
      category: template.category?.toLowerCase(),
      content: template.bodyContent,
      subject: template.headerContent,
      variables: template.variables,
      isActive: template.status === 'APPROVED',
      createdAt: template.createdAt,
    };
  }

  // Update template
  async updateTemplate(tenantId, templateId, data) {
    // Verify template exists and belongs to tenant
    const existing = await prisma.template.findFirst({
      where: { id: templateId, tenantId },
    });

    if (!existing) {
      throw new Error('Template not found');
    }

    // Extract variables if content changed
    const newContent = data.content || data.bodyContent;
    const variables = newContent ? this.extractVariables(newContent) : existing.variables;

    const template = await prisma.template.update({
      where: { id: templateId },
      data: {
        name: data.name ?? existing.name,
        category: data.category ? data.category.toUpperCase() : existing.category,
        bodyContent: newContent ?? existing.bodyContent,
        headerContent: data.subject ?? data.headerContent ?? existing.headerContent,
        variables,
      },
      include: {
        channel: true,
      },
    });

    return {
      id: template.id,
      name: template.name,
      type: template.channel?.type?.toLowerCase() || 'email',
      category: template.category?.toLowerCase(),
      content: template.bodyContent,
      subject: template.headerContent,
      variables: template.variables,
      isActive: template.status === 'APPROVED',
      updatedAt: template.updatedAt,
    };
  }

  // Delete template
  async deleteTemplate(tenantId, templateId) {
    // Verify template exists and belongs to tenant
    const existing = await prisma.template.findFirst({
      where: { id: templateId, tenantId },
    });

    if (!existing) {
      throw new Error('Template not found');
    }

    await prisma.template.delete({
      where: { id: templateId },
    });

    return { success: true };
  }

  // Duplicate template
  async duplicateTemplate(tenantId, templateId) {
    const original = await prisma.template.findFirst({
      where: { id: templateId, tenantId },
    });

    if (!original) {
      throw new Error('Template not found');
    }

    const duplicate = await prisma.template.create({
      data: {
        tenantId,
        name: `${original.name} (Copy)`,
        type: original.type,
        category: original.category,
        content: original.content,
        subject: original.subject,
        variables: original.variables,
        isActive: true,
      },
    });

    return {
      id: duplicate.id,
      name: duplicate.name,
      type: duplicate.type?.toLowerCase(),
      category: duplicate.category?.toLowerCase(),
      content: duplicate.content,
      subject: duplicate.subject,
      variables: duplicate.variables,
      isActive: duplicate.isActive,
      createdAt: duplicate.createdAt,
    };
  }

  // Get template stats
  async getStats(tenantId) {
    // Use raw SQL for stats to bypass Prisma schema issues
    const totalResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM templates WHERE "tenantId" = ${tenantId}
    `;
    const activeResult = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM templates WHERE "tenantId" = ${tenantId} AND "isActive" = true
    `;
    const byTypeResult = await prisma.$queryRaw`
      SELECT type, COUNT(*) as count FROM templates WHERE "tenantId" = ${tenantId} GROUP BY type
    `;

    const total = Number(totalResult[0]?.count || 0);
    const active = Number(activeResult[0]?.count || 0);

    const typeStats = {};
    byTypeResult.forEach((item) => {
      typeStats[item.type?.toLowerCase() || 'unknown'] = Number(item.count);
    });

    return {
      total,
      active,
      inactive: total - active,
      byType: typeStats,
    };
  }

  // Helper: Extract variables from template content
  extractVariables(content) {
    if (!content) return [];
    const matches = content.match(/\{\{([^}]+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()))];
  }

  // Render template with variables
  renderTemplate(template, variables = {}) {
    let content = template.content;
    let subject = template.subject;

    // Replace all variables
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      content = content.replace(regex, value || '');
      if (subject) {
        subject = subject.replace(regex, value || '');
      }
    });

    return {
      content,
      subject,
    };
  }

  // Get template by name (for programmatic use)
  async getTemplateByName(tenantId, name, type = 'EMAIL') {
    const template = await prisma.template.findFirst({
      where: {
        tenantId,
        name,
        type: type.toUpperCase(),
        isActive: true,
      },
    });

    if (!template) {
      return null;
    }

    return {
      id: template.id,
      name: template.name,
      type: template.type?.toLowerCase(),
      category: template.category?.toLowerCase(),
      content: template.content,
      subject: template.subject,
      variables: template.variables || [],
      isActive: template.isActive,
    };
  }
}

export const templatesService = new TemplatesService();
