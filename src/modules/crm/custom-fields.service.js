import { prisma } from '@crm360/database';

class CustomFieldsService {
  /**
   * Get all custom fields for a specific entity type
   */
  async getFields(tenantId, entityType) {
    // TODO: Custom Fields feature not yet implemented - CustomField model doesn't exist
    // Return empty data with proper structure
    return [];
  }

  /**
   * Get a single custom field by ID
   */
  async getField(tenantId, fieldId) {
    const field = await prisma.customField.findFirst({
      where: {
        id: fieldId,
        tenantId,
      },
    });

    return field;
  }

  /**
   * Create a new custom field
   */
  async createField(tenantId, userId, data) {
    // Generate API name if not provided
    const apiName = data.apiName || this.generateApiName(data.name);

    // Check for duplicate apiName
    const existing = await prisma.customField.findFirst({
      where: {
        tenantId,
        entityType: data.entityType,
        apiName,
      },
    });

    if (existing) {
      throw new Error(`A field with API name "${apiName}" already exists for ${data.entityType}`);
    }

    // Get max sort order
    const maxOrder = await prisma.customField.aggregate({
      where: { tenantId, entityType: data.entityType },
      _max: { sortOrder: true },
    });

    const field = await prisma.customField.create({
      data: {
        tenantId,
        entityType: data.entityType,
        name: data.name,
        apiName,
        fieldType: data.fieldType || 'TEXT',
        description: data.description,
        isRequired: data.isRequired || false,
        options: data.options || null,
        defaultValue: data.defaultValue,
        placeholder: data.placeholder,
        sortOrder: (maxOrder._max.sortOrder || 0) + 1,
        createdById: userId,
      },
    });

    return field;
  }

  /**
   * Update a custom field
   */
  async updateField(tenantId, fieldId, data) {
    const field = await prisma.customField.findFirst({
      where: {
        id: fieldId,
        tenantId,
      },
    });

    if (!field) {
      throw new Error('Custom field not found');
    }

    // If apiName is being changed, check for duplicates
    if (data.apiName && data.apiName !== field.apiName) {
      const existing = await prisma.customField.findFirst({
        where: {
          tenantId,
          entityType: field.entityType,
          apiName: data.apiName,
          id: { not: fieldId },
        },
      });

      if (existing) {
        throw new Error(`A field with API name "${data.apiName}" already exists`);
      }
    }

    const updated = await prisma.customField.update({
      where: { id: fieldId },
      data: {
        name: data.name,
        apiName: data.apiName,
        fieldType: data.fieldType,
        description: data.description,
        isRequired: data.isRequired,
        options: data.options,
        defaultValue: data.defaultValue,
        placeholder: data.placeholder,
        sortOrder: data.sortOrder,
      },
    });

    return updated;
  }

  /**
   * Delete a custom field
   */
  async deleteField(tenantId, fieldId) {
    const field = await prisma.customField.findFirst({
      where: {
        id: fieldId,
        tenantId,
      },
    });

    if (!field) {
      throw new Error('Custom field not found');
    }

    await prisma.customField.delete({
      where: { id: fieldId },
    });

    return { success: true };
  }

  /**
   * Reorder custom fields
   */
  async reorderFields(tenantId, entityType, fieldIds) {
    const updates = fieldIds.map((id, index) =>
      prisma.customField.updateMany({
        where: { id, tenantId, entityType },
        data: { sortOrder: index },
      })
    );

    await prisma.$transaction(updates);

    return this.getFields(tenantId, entityType);
  }

  /**
   * Generate API name from field name
   */
  generateApiName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
  }
}

export const customFieldsService = new CustomFieldsService();
