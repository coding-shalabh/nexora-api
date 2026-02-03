/**
 * Segments Service
 * Business logic for audience segmentation with dynamic filter evaluation
 */

import { prisma } from '@crm360/database';

/**
 * Build Prisma where clause from segment conditions
 * Supports: equals, contains, gt, gte, lt, lte, in, notIn, isNull, isNotNull
 */
function buildContactFilter(conditions) {
  if (!conditions || !conditions.rules || conditions.rules.length === 0) {
    return {};
  }

  const operator = conditions.combinator || 'AND';
  const filters = conditions.rules
    .map((rule) => {
      if (rule.rules) {
        // Nested group
        return buildContactFilter(rule);
      }

      const { field, operator: op, value } = rule;

      // Handle special fields
      if (field === 'tags') {
        if (op === 'contains') {
          return { tags: { has: value } };
        }
        if (op === 'hasAny') {
          return { tags: { hasSome: value } };
        }
        if (op === 'hasAll') {
          return { tags: { hasEvery: value } };
        }
        return {};
      }

      // Handle date fields
      const dateFields = [
        'createdAt',
        'updatedAt',
        'lastActivityAt',
        'lastContactedAt',
        'lastSeenAt',
        'unsubscribedAt',
      ];
      if (dateFields.includes(field)) {
        if (op === 'lessThan') {
          const days = parseInt(value);
          const date = new Date();
          date.setDate(date.getDate() - days);
          return { [field]: { gte: date } };
        }
        if (op === 'moreThan') {
          const days = parseInt(value);
          const date = new Date();
          date.setDate(date.getDate() - days);
          return { [field]: { lte: date } };
        }
        if (op === 'equals') {
          return { [field]: new Date(value) };
        }
        if (op === 'between') {
          return {
            [field]: {
              gte: new Date(value.start),
              lte: new Date(value.end),
            },
          };
        }
      }

      // Standard operators
      switch (op) {
        case 'equals':
          return { [field]: value };
        case 'notEquals':
          return { [field]: { not: value } };
        case 'contains':
          return { [field]: { contains: value, mode: 'insensitive' } };
        case 'notContains':
          return { NOT: { [field]: { contains: value, mode: 'insensitive' } } };
        case 'startsWith':
          return { [field]: { startsWith: value, mode: 'insensitive' } };
        case 'endsWith':
          return { [field]: { endsWith: value, mode: 'insensitive' } };
        case 'gt':
          return { [field]: { gt: parseFloat(value) } };
        case 'gte':
          return { [field]: { gte: parseFloat(value) } };
        case 'lt':
          return { [field]: { lt: parseFloat(value) } };
        case 'lte':
          return { [field]: { lte: parseFloat(value) } };
        case 'in':
          return { [field]: { in: Array.isArray(value) ? value : [value] } };
        case 'notIn':
          return { [field]: { notIn: Array.isArray(value) ? value : [value] } };
        case 'isNull':
          return { [field]: null };
        case 'isNotNull':
          return { NOT: { [field]: null } };
        case 'isTrue':
          return { [field]: true };
        case 'isFalse':
          return { [field]: false };
        default:
          return {};
      }
    })
    .filter((f) => Object.keys(f).length > 0);

  if (filters.length === 0) return {};
  if (filters.length === 1) return filters[0];

  return operator === 'AND' ? { AND: filters } : { OR: filters };
}

export const segmentsService = {
  /**
   * List segments with pagination and filters
   */
  async list({ tenantId, page = 1, limit = 20, type, search, isActive }) {
    // TODO: Segments feature not yet implemented - Segment model doesn't exist
    // Return empty data for now with proper structure
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  },

  /**
   * Get a single segment by ID
   */
  async get({ tenantId, segmentId }) {
    const segment = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    return segment;
  },

  /**
   * Get contacts in a segment (with evaluation for dynamic segments)
   */
  async getContacts({ tenantId, segmentId, page = 1, limit = 50 }) {
    const segment = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    let contactWhere = { tenantId };

    if (segment.type === 'STATIC') {
      // For static segments, use stored contact IDs
      if (segment.contactIds && segment.contactIds.length > 0) {
        contactWhere.id = { in: segment.contactIds };
      } else {
        return {
          data: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        };
      }
    } else {
      // For dynamic segments, evaluate conditions
      const filterConditions = buildContactFilter(segment.conditions);
      contactWhere = { ...contactWhere, ...filterConditions };
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where: contactWhere,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          lifecycleStage: true,
          tags: true,
          createdAt: true,
        },
      }),
      prisma.contact.count({ where: contactWhere }),
    ]);

    return {
      data: contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Preview segment (evaluate conditions without saving)
   */
  async preview({ tenantId, conditions, limit = 10 }) {
    const filterConditions = buildContactFilter(conditions);
    const where = { tenantId, ...filterConditions };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          status: true,
          tags: true,
        },
      }),
      prisma.contact.count({ where }),
    ]);

    return {
      contacts,
      total,
      preview: true,
    };
  },

  /**
   * Create a new segment
   */
  async create({ tenantId, userId, data }) {
    // Check for duplicate name
    const existing = await prisma.segment.findFirst({
      where: { tenantId, name: data.name },
    });

    if (existing) {
      throw new Error('A segment with this name already exists');
    }

    // If dynamic segment, evaluate initial contact count
    let contactCount = 0;
    if (data.type === 'DYNAMIC' && data.conditions) {
      const filterConditions = buildContactFilter(data.conditions);
      contactCount = await prisma.contact.count({
        where: { tenantId, ...filterConditions },
      });
    } else if (data.type === 'STATIC' && data.contactIds) {
      contactCount = data.contactIds.length;
    }

    const segment = await prisma.segment.create({
      data: {
        tenantId,
        createdById: userId,
        name: data.name,
        description: data.description,
        type: data.type || 'STATIC',
        conditions: data.conditions,
        contactIds: data.contactIds || [],
        contactCount,
        isActive: data.isActive !== false,
        lastSyncAt: data.type === 'DYNAMIC' ? new Date() : null,
      },
    });

    return segment;
  },

  /**
   * Update a segment
   */
  async update({ tenantId, segmentId, data }) {
    const segment = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    // Check for duplicate name if name is being changed
    if (data.name && data.name !== segment.name) {
      const existing = await prisma.segment.findFirst({
        where: { tenantId, name: data.name, id: { not: segmentId } },
      });
      if (existing) {
        throw new Error('A segment with this name already exists');
      }
    }

    const updateData = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.conditions !== undefined) {
      updateData.conditions = data.conditions;
      // Recalculate contact count for dynamic segments
      if (segment.type === 'DYNAMIC') {
        const filterConditions = buildContactFilter(data.conditions);
        updateData.contactCount = await prisma.contact.count({
          where: { tenantId, ...filterConditions },
        });
        updateData.lastSyncAt = new Date();
      }
    }
    if (data.contactIds !== undefined) {
      updateData.contactIds = data.contactIds;
      // Update contact count for static segments
      if (segment.type === 'STATIC') {
        updateData.contactCount = data.contactIds.length;
      }
    }
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await prisma.segment.update({
      where: { id: segmentId },
      data: updateData,
    });

    return updated;
  },

  /**
   * Delete a segment
   */
  async delete({ tenantId, segmentId }) {
    const segment = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    await prisma.segment.delete({
      where: { id: segmentId },
    });
  },

  /**
   * Sync a dynamic segment (recalculate contact count)
   */
  async sync({ tenantId, segmentId }) {
    const segment = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    if (segment.type !== 'DYNAMIC') {
      throw new Error('Only dynamic segments can be synced');
    }

    const filterConditions = buildContactFilter(segment.conditions);
    const contactCount = await prisma.contact.count({
      where: { tenantId, ...filterConditions },
    });

    const updated = await prisma.segment.update({
      where: { id: segmentId },
      data: {
        contactCount,
        lastSyncAt: new Date(),
      },
    });

    return updated;
  },

  /**
   * Duplicate a segment
   */
  async duplicate({ tenantId, segmentId, userId }) {
    const segment = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    // Generate unique name
    let newName = `${segment.name} (Copy)`;
    let counter = 1;
    while (await prisma.segment.findFirst({ where: { tenantId, name: newName } })) {
      counter++;
      newName = `${segment.name} (Copy ${counter})`;
    }

    const newSegment = await prisma.segment.create({
      data: {
        tenantId,
        createdById: userId,
        name: newName,
        description: segment.description,
        type: segment.type,
        conditions: segment.conditions,
        contactIds: segment.type === 'STATIC' ? segment.contactIds : [],
        contactCount: segment.contactCount,
        isActive: true,
        lastSyncAt: segment.type === 'DYNAMIC' ? new Date() : null,
      },
    });

    return newSegment;
  },

  /**
   * Add contacts to a static segment
   */
  async addContacts({ tenantId, segmentId, contactIds }) {
    const segment = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    if (segment.type !== 'STATIC') {
      throw new Error('Can only add contacts to static segments');
    }

    // Verify contacts exist and belong to tenant
    const validContacts = await prisma.contact.findMany({
      where: { tenantId, id: { in: contactIds } },
      select: { id: true },
    });

    const validIds = validContacts.map((c) => c.id);
    const existingIds = segment.contactIds || [];
    const newIds = [...new Set([...existingIds, ...validIds])];

    const updated = await prisma.segment.update({
      where: { id: segmentId },
      data: {
        contactIds: newIds,
        contactCount: newIds.length,
      },
    });

    return updated;
  },

  /**
   * Remove contacts from a static segment
   */
  async removeContacts({ tenantId, segmentId, contactIds }) {
    const segment = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!segment) {
      throw new Error('Segment not found');
    }

    if (segment.type !== 'STATIC') {
      throw new Error('Can only remove contacts from static segments');
    }

    const existingIds = segment.contactIds || [];
    const newIds = existingIds.filter((id) => !contactIds.includes(id));

    const updated = await prisma.segment.update({
      where: { id: segmentId },
      data: {
        contactIds: newIds,
        contactCount: newIds.length,
      },
    });

    return updated;
  },

  /**
   * Get available filter fields for segment builder
   */
  getFilterFields() {
    return {
      contact: [
        {
          field: 'status',
          label: 'Status',
          type: 'select',
          options: ['ACTIVE', 'INACTIVE', 'ARCHIVED', 'BLOCKED'],
        },
        {
          field: 'lifecycleStage',
          label: 'Lifecycle Stage',
          type: 'select',
          options: [
            'SUBSCRIBER',
            'LEAD',
            'MQL',
            'SQL',
            'OPPORTUNITY',
            'CUSTOMER',
            'EVANGELIST',
            'OTHER',
          ],
        },
        { field: 'source', label: 'Source', type: 'text' },
        { field: 'email', label: 'Email', type: 'text' },
        { field: 'phone', label: 'Phone', type: 'text' },
        { field: 'firstName', label: 'First Name', type: 'text' },
        { field: 'lastName', label: 'Last Name', type: 'text' },
        { field: 'city', label: 'City', type: 'text' },
        { field: 'state', label: 'State', type: 'text' },
        { field: 'country', label: 'Country', type: 'text' },
        { field: 'tags', label: 'Tags', type: 'tags' },
        { field: 'createdAt', label: 'Created', type: 'date' },
        { field: 'lastActivityAt', label: 'Last Activity', type: 'date' },
        { field: 'lastContactedAt', label: 'Last Contacted', type: 'date' },
      ],
      consent: [
        { field: 'marketingConsent', label: 'Marketing Consent', type: 'boolean' },
        { field: 'emailConsent', label: 'Email Consent', type: 'boolean' },
        { field: 'smsConsent', label: 'SMS Consent', type: 'boolean' },
        { field: 'whatsappConsent', label: 'WhatsApp Consent', type: 'boolean' },
        { field: 'voiceConsent', label: 'Voice Consent', type: 'boolean' },
      ],
      engagement: [
        { field: 'marketingEmailCount', label: 'Marketing Emails Received', type: 'number' },
        { field: 'marketingEmailOpenCount', label: 'Marketing Emails Opened', type: 'number' },
        { field: 'marketingEmailClickCount', label: 'Marketing Emails Clicked', type: 'number' },
        { field: 'broadcastCount', label: 'Broadcasts Received', type: 'number' },
        { field: 'sequenceCount', label: 'Sequences Enrolled', type: 'number' },
        { field: 'marketingScore', label: 'Marketing Score', type: 'number' },
      ],
    };
  },
};
