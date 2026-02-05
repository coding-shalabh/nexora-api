import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import { eventBus, createEvent, EventTypes } from '../../common/events/event-bus.js';

class CrmService {
  async getContacts(tenantId, filters) {
    const where = { tenantId };

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
      ];
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.companyId) {
      where.companyId = filters.companyId;
    }

    // Additional filters
    if (filters.lifecycleStage) {
      where.lifecycleStage = filters.lifecycleStage;
    }

    if (filters.leadStatus) {
      where.leadStatus = filters.leadStatus;
    }

    if (filters.source) {
      where.source = filters.source;
    }

    // Filter by tags
    if (filters.tags) {
      const tagNames = filters.tags.split(',').map((t) => t.trim());
      where.tags = {
        some: {
          tag: {
            name: { in: tagNames },
          },
        },
      };
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          tags: {
            include: {
              tag: { select: { id: true, name: true, color: true } },
            },
          },
        },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contact.count({ where }),
    ]);

    // Transform tags from ContactTag[] to Tag[]
    const transformedContacts = contacts.map((contact) => ({
      ...contact,
      tags: contact.tags.map((ct) => ct.tag),
    }));

    return {
      contacts: transformedContacts,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async getContact(tenantId, contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      include: {
        company: true,
        tags: {
          include: {
            tag: true,
          },
        },
        activities: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        deals: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            amount: true,
            currency: true,
            expectedCloseDate: true,
            closedAt: true,
            createdAt: true,
            stage: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    if (!contact) {
      throw new NotFoundError('Contact not found');
    }

    // Transform tags from ContactTag[] to Tag[]
    return {
      ...contact,
      tags: contact.tags.map((ct) => ct.tag),
    };
  }

  async createContact(tenantId, userId, data) {
    // If tags are provided, first ensure they exist in the Tag table
    let tagConnections = [];
    if (data.tags && data.tags.length > 0) {
      for (const tagName of data.tags) {
        const tag = await prisma.tag.upsert({
          where: { tenantId_name: { tenantId, name: tagName } },
          update: {},
          create: { tenantId, name: tagName },
        });
        tagConnections.push({ tagId: tag.id });
      }
    }

    // Build create data - only include fields that exist in the Prisma schema
    // NOTE: Some fields may not be available in the Prisma client, so we only include essential fields
    const createData = {
      tenantId,
      // Basic (required)
      firstName: data.firstName || null,
      lastName: data.lastName || null,
      // Basic (optional)
      displayName:
        data.displayName ||
        (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}` : null),
      email: data.email || null,
      phone: data.phone || null,
      // Company - use relation syntax
      ...(data.companyId ? { company: { connect: { id: data.companyId } } } : {}),
      // Social
      linkedinUrl: data.linkedinUrl || null,
      twitterUrl: data.twitterUrl || null,
      facebookUrl: data.facebookUrl || null,
      // Consent
      marketingConsent: data.marketingConsent ?? false,
      whatsappConsent: data.whatsappConsent ?? false,
      // Status - default to ACTIVE
      status: data.status || 'ACTIVE',
    };

    // Add tags if provided
    if (tagConnections.length > 0) {
      createData.tags = { create: tagConnections };
    }

    const contact = await prisma.contact.create({
      data: createData,
      include: {
        company: { select: { id: true, name: true } },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    // Emit event
    eventBus.publish(
      createEvent(EventTypes.CONTACT_CREATED, tenantId, { contactId: contact.id }, { userId })
    );

    // Transform tags
    return {
      ...contact,
      tags: contact.tags.map((ct) => ct.tag),
    };
  }

  async updateContact(tenantId, contactId, data) {
    const existing = await prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Contact not found');
    }

    // Build update data - only include fields that exist in the schema
    const updateData = {
      updatedAt: new Date(),
    };

    // Basic contact info (all exist in schema)
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone;

    // Company & Work
    if (data.companyId !== undefined) {
      updateData.company = data.companyId
        ? { connect: { id: data.companyId } }
        : { disconnect: true };
    }
    if (data.jobTitle !== undefined) updateData.jobTitle = data.jobTitle;
    if (data.department !== undefined) updateData.department = data.department;

    // Lead Management (fields that exist in schema)
    if (data.lifecycleStage !== undefined) updateData.lifecycleStage = data.lifecycleStage;
    if (data.leadStatus !== undefined) updateData.leadStatus = data.leadStatus;
    if (data.leadScore !== undefined) updateData.leadScore = data.leadScore;
    if (data.rating !== undefined) updateData.rating = data.rating;
    if (data.priority !== undefined) updateData.priority = data.priority;

    // Social (fields that exist in schema)
    if (data.linkedinUrl !== undefined) updateData.linkedinUrl = data.linkedinUrl;
    if (data.twitterUrl !== undefined) updateData.twitterUrl = data.twitterUrl;
    if (data.facebookUrl !== undefined) updateData.facebookUrl = data.facebookUrl;

    // Consent (fields that exist in schema)
    if (data.marketingConsent !== undefined) {
      updateData.marketingConsent = data.marketingConsent;
      updateData.consentUpdatedAt = new Date();
    }
    if (data.whatsappConsent !== undefined) {
      updateData.whatsappConsent = data.whatsappConsent;
      updateData.consentUpdatedAt = new Date();
    }

    // Source & Status (fields that exist in schema)
    if (data.source !== undefined) updateData.source = data.source;
    if (data.sourceDetails !== undefined) updateData.sourceDetails = data.sourceDetails;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.ownerId !== undefined) updateData.ownerId = data.ownerId;

    // Address fields (use generic address field that exists in schema)
    if (data.address !== undefined) updateData.address = data.address;
    if (data.city !== undefined) updateData.city = data.city;
    if (data.state !== undefined) updateData.state = data.state;
    if (data.postalCode !== undefined) updateData.postalCode = data.postalCode;
    if (data.country !== undefined) updateData.country = data.country;

    // GSTIN & Avatar (fields that exist in schema)
    if (data.gstin !== undefined) updateData.gstin = data.gstin;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

    // Custom fields
    if (data.customFields !== undefined) updateData.customFields = data.customFields;

    const contact = await prisma.contact.update({
      where: { id: contactId },
      data: updateData,
      include: {
        company: { select: { id: true, name: true } },
        tags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    eventBus.publish(createEvent(EventTypes.CONTACT_UPDATED, tenantId, { contactId: contact.id }));

    // Transform tags
    return {
      ...contact,
      tags: contact.tags.map((ct) => ct.tag),
    };
  }

  async deleteContact(tenantId, contactId) {
    const existing = await prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Contact not found');
    }

    await prisma.contact.delete({
      where: { id: contactId },
    });

    eventBus.publish(createEvent(EventTypes.CONTACT_DELETED, tenantId, { contactId }));
  }

  async deleteAllContacts(tenantId) {
    // First delete related records (activities, contact tags, etc.)
    await prisma.activity.deleteMany({
      where: { tenantId, contactId: { not: null } },
    });

    await prisma.contactTag.deleteMany({
      where: { contact: { tenantId } },
    });

    // Delete all contacts
    const result = await prisma.contact.deleteMany({
      where: { tenantId },
    });

    eventBus.publish(
      createEvent(EventTypes.CONTACTS_BULK_DELETED, tenantId, { count: result.count })
    );

    return { count: result.count };
  }

  // ============ BULK OPERATIONS ============

  async bulkAddTags(tenantId, contactIds, tagNames) {
    const results = { updated: 0, errors: [] };

    // First ensure all tags exist
    const tags = await Promise.all(
      tagNames.map(async (name) => {
        return prisma.tag.upsert({
          where: { tenantId_name: { tenantId, name } },
          update: {},
          create: { tenantId, name },
        });
      })
    );

    // Add tags to each contact
    for (const contactId of contactIds) {
      try {
        // Verify contact belongs to tenant
        const contact = await prisma.contact.findFirst({
          where: { id: contactId, tenantId },
        });
        if (!contact) continue;

        // Add each tag to the contact
        for (const tag of tags) {
          await prisma.contactTag.upsert({
            where: { contactId_tagId: { contactId, tagId: tag.id } },
            update: {},
            create: { contactId, tagId: tag.id },
          });
        }
        results.updated++;
      } catch (error) {
        results.errors.push({ contactId, error: error.message });
      }
    }

    eventBus.publish(
      createEvent(EventTypes.CONTACTS_BULK_UPDATED, tenantId, {
        operation: 'addTags',
        count: results.updated,
        tagNames,
      })
    );

    return results;
  }

  async bulkRemoveTags(tenantId, contactIds, tagNames) {
    const results = { updated: 0, errors: [] };

    // Find tag IDs
    const tags = await prisma.tag.findMany({
      where: { tenantId, name: { in: tagNames } },
    });
    const tagIds = tags.map((t) => t.id);

    if (tagIds.length === 0) {
      return results;
    }

    // Remove tags from contacts
    const result = await prisma.contactTag.deleteMany({
      where: {
        contactId: { in: contactIds },
        tagId: { in: tagIds },
        contact: { tenantId },
      },
    });

    results.updated = result.count;

    eventBus.publish(
      createEvent(EventTypes.CONTACTS_BULK_UPDATED, tenantId, {
        operation: 'removeTags',
        count: results.updated,
        tagNames,
      })
    );

    return results;
  }

  async bulkUpdateOwner(tenantId, contactIds, ownerId) {
    // Verify owner belongs to tenant
    if (ownerId) {
      const owner = await prisma.user.findFirst({
        where: { id: ownerId, tenantId },
      });
      if (!owner) {
        throw new NotFoundError('Owner not found');
      }
    }

    const result = await prisma.contact.updateMany({
      where: {
        id: { in: contactIds },
        tenantId,
      },
      data: {
        ownerId: ownerId || null,
      },
    });

    eventBus.publish(
      createEvent(EventTypes.CONTACTS_BULK_UPDATED, tenantId, {
        operation: 'updateOwner',
        count: result.count,
        ownerId,
      })
    );

    return { updated: result.count };
  }

  async bulkUpdateStatus(tenantId, contactIds, data) {
    const updateData = {};

    if (data.status) {
      updateData.status = data.status;
    }
    if (data.lifecycleStage) {
      updateData.lifecycleStage = data.lifecycleStage;
    }
    if (data.leadStatus) {
      updateData.leadStatus = data.leadStatus;
    }

    if (Object.keys(updateData).length === 0) {
      return { updated: 0 };
    }

    const result = await prisma.contact.updateMany({
      where: {
        id: { in: contactIds },
        tenantId,
      },
      data: updateData,
    });

    eventBus.publish(
      createEvent(EventTypes.CONTACTS_BULK_UPDATED, tenantId, {
        operation: 'updateStatus',
        count: result.count,
        ...data,
      })
    );

    return { updated: result.count };
  }

  async bulkDeleteContacts(tenantId, contactIds) {
    let deletedCount = 0;

    for (const id of contactIds) {
      try {
        // Verify contact belongs to tenant
        const contact = await prisma.contact.findFirst({
          where: { id, tenantId },
        });
        if (!contact) continue;

        // Delete related records first
        await prisma.contactTag.deleteMany({ where: { contactId: id } });
        await prisma.activity.deleteMany({ where: { contactId: id } });

        // Delete the contact
        await prisma.contact.delete({ where: { id } });
        deletedCount++;
      } catch (error) {
        // Skip failed deletes
        console.error(`Failed to delete contact ${id}:`, error.message);
      }
    }

    eventBus.publish(
      createEvent(EventTypes.CONTACTS_BULK_DELETED, tenantId, { count: deletedCount })
    );

    return { deletedCount };
  }

  // ============ DUPLICATE DETECTION & MERGE ============

  async findDuplicateContacts(tenantId, options = {}) {
    const { matchBy = 'email', threshold = 0.8 } = options;
    const duplicates = [];

    // Get all contacts
    const contacts = await prisma.contact.findMany({
      where: { tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        email: true,
        phone: true,
        mobilePhone: true,
        createdAt: true,
        updatedAt: true,
        company: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const processed = new Set();

    for (let i = 0; i < contacts.length; i++) {
      const contact1 = contacts[i];
      if (processed.has(contact1.id)) continue;

      const matches = [];

      for (let j = i + 1; j < contacts.length; j++) {
        const contact2 = contacts[j];
        if (processed.has(contact2.id)) continue;

        let isMatch = false;
        let matchType = '';
        let confidence = 0;

        // Match by email
        if (matchBy === 'email' || matchBy === 'all') {
          if (
            contact1.email &&
            contact2.email &&
            contact1.email.toLowerCase() === contact2.email.toLowerCase()
          ) {
            isMatch = true;
            matchType = 'email';
            confidence = 1.0;
          }
        }

        // Match by phone
        if ((matchBy === 'phone' || matchBy === 'all') && !isMatch) {
          const phone1 = (contact1.phone || contact1.mobilePhone || '').replace(/[^0-9]/g, '');
          const phone2 = (contact2.phone || contact2.mobilePhone || '').replace(/[^0-9]/g, '');
          if (phone1.length >= 10 && phone2.length >= 10 && phone1 === phone2) {
            isMatch = true;
            matchType = 'phone';
            confidence = 0.95;
          }
        }

        // Match by name
        if ((matchBy === 'name' || matchBy === 'all') && !isMatch) {
          const name1 = `${contact1.firstName || ''} ${contact1.lastName || ''}`
            .toLowerCase()
            .trim();
          const name2 = `${contact2.firstName || ''} ${contact2.lastName || ''}`
            .toLowerCase()
            .trim();
          if (name1.length > 2 && name2.length > 2 && name1 === name2) {
            isMatch = true;
            matchType = 'name';
            confidence = 0.8;
          }
        }

        if (isMatch && confidence >= threshold) {
          matches.push({
            contact: contact2,
            matchType,
            confidence,
          });
          processed.add(contact2.id);
        }
      }

      if (matches.length > 0) {
        duplicates.push({
          primary: contact1,
          duplicates: matches,
        });
        processed.add(contact1.id);
      }
    }

    return {
      groups: duplicates,
      totalDuplicates: duplicates.reduce((sum, g) => sum + g.duplicates.length, 0),
    };
  }

  async mergeContacts(tenantId, userId, primaryId, duplicateId, fieldSelections = {}) {
    // Get both contacts
    const [primaryContact, duplicateContact] = await Promise.all([
      prisma.contact.findFirst({
        where: { id: primaryId, tenantId },
        include: {
          tags: { include: { tag: true } },
          activities: true,
          deals: true,
        },
      }),
      prisma.contact.findFirst({
        where: { id: duplicateId, tenantId },
        include: {
          tags: { include: { tag: true } },
          activities: true,
          deals: true,
        },
      }),
    ]);

    if (!primaryContact || !duplicateContact) {
      throw new NotFoundError('One or both contacts not found');
    }

    // Merge data based on field selections
    const mergedData = {};
    const fieldsToCopy = [
      'firstName',
      'lastName',
      'displayName',
      'email',
      'phone',
      'mobilePhone',
      'homePhone',
      'fax',
      'salutation',
      'middleName',
      'suffix',
      'preferredName',
      'dateOfBirth',
      'gender',
      'jobTitle',
      'department',
      'companyId',
      'lifecycleStage',
      'leadStatus',
      'leadScore',
      'source',
      'sourceDetails',
      'linkedinUrl',
      'twitterUrl',
      'facebookUrl',
      'instagramUrl',
      'gstin',
      'billingAddress',
      'billingCity',
      'billingState',
      'billingPincode',
      'shippingAddress',
      'shippingCity',
      'shippingState',
      'shippingPincode',
      'marketingConsent',
      'whatsappConsent',
      'emailOptOut',
      'callOptOut',
      'doNotCall',
      'ownerId',
      'rating',
      'priority',
      'expectedRevenue',
    ];

    for (const field of fieldsToCopy) {
      // If field selection specifies 'duplicate', use duplicate's value
      if (fieldSelections[field] === 'duplicate') {
        mergedData[field] = duplicateContact[field];
      } else if (fieldSelections[field] === 'primary') {
        // Keep primary's value (do nothing, it's already there)
      } else {
        // Default: use primary's value if set, otherwise use duplicate's
        if (
          primaryContact[field] === null ||
          primaryContact[field] === undefined ||
          primaryContact[field] === ''
        ) {
          if (
            duplicateContact[field] !== null &&
            duplicateContact[field] !== undefined &&
            duplicateContact[field] !== ''
          ) {
            mergedData[field] = duplicateContact[field];
          }
        }
      }
    }

    // Merge additional emails/phones arrays
    const additionalEmails = new Set([
      ...(primaryContact.additionalEmails || []),
      ...(duplicateContact.additionalEmails || []),
    ]);
    if (duplicateContact.email && duplicateContact.email !== primaryContact.email) {
      additionalEmails.add(duplicateContact.email);
    }
    mergedData.additionalEmails = Array.from(additionalEmails);

    const additionalPhones = new Set([
      ...(primaryContact.additionalPhones || []),
      ...(duplicateContact.additionalPhones || []),
    ]);
    if (duplicateContact.phone && duplicateContact.phone !== primaryContact.phone) {
      additionalPhones.add(duplicateContact.phone);
    }
    mergedData.additionalPhones = Array.from(additionalPhones);

    // Merge custom fields
    mergedData.customFields = {
      ...duplicateContact.customFields,
      ...primaryContact.customFields,
      ...fieldSelections.customFields,
    };

    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Update primary contact with merged data
      const updatedContact = await tx.contact.update({
        where: { id: primaryId },
        data: mergedData,
      });

      // Transfer tags from duplicate to primary
      const duplicateTags = duplicateContact.tags.map((t) => t.tag.id);
      const primaryTags = primaryContact.tags.map((t) => t.tag.id);
      const newTags = duplicateTags.filter((id) => !primaryTags.includes(id));

      for (const tagId of newTags) {
        await tx.contactTag
          .create({
            data: { contactId: primaryId, tagId },
          })
          .catch(() => {}); // Ignore if already exists
      }

      // Transfer activities from duplicate to primary
      await tx.activity.updateMany({
        where: { contactId: duplicateId },
        data: { contactId: primaryId },
      });

      // Transfer deals from duplicate to primary
      await tx.deal.updateMany({
        where: { contactId: duplicateId },
        data: { contactId: primaryId },
      });

      // Transfer conversations
      await tx.conversation.updateMany({
        where: { contactId: duplicateId },
        data: { contactId: primaryId },
      });

      // Delete duplicate contact's tag associations
      await tx.contactTag.deleteMany({
        where: { contactId: duplicateId },
      });

      // Delete duplicate contact
      await tx.contact.delete({
        where: { id: duplicateId },
      });

      return updatedContact;
    });

    // Log merge activity
    await prisma.activity.create({
      data: {
        tenantId,
        contactId: primaryId,
        type: 'NOTE',
        subject: 'Contact Merged',
        description: `Merged with contact: ${duplicateContact.firstName} ${duplicateContact.lastName} (${duplicateContact.email || duplicateContact.phone || 'no email/phone'})`,
        isCompleted: true,
        completedAt: new Date(),
        createdById: userId,
      },
    });

    eventBus.publish(
      createEvent(EventTypes.CONTACTS_MERGED, tenantId, {
        primaryId,
        duplicateId,
        userId,
      })
    );

    return result;
  }

  async getContactTimeline(tenantId, contactId) {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, tenantId },
    });

    if (!contact) {
      throw new NotFoundError('Contact not found');
    }

    const [activities, conversations] = await Promise.all([
      prisma.activity.findMany({
        where: { contactId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.conversation.findMany({
        where: { contactId },
        orderBy: { lastCustomerMessageAt: 'desc' },
        take: 20,
      }),
    ]);

    // Merge and sort by date
    const timeline = [
      ...activities.map((a) => ({ type: 'activity', data: a, date: a.createdAt })),
      ...conversations.map((c) => ({ type: 'conversation', data: c, date: c.createdAt })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    return timeline;
  }

  async getCompanies(tenantId, filters) {
    const where = { tenantId };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { domain: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        select: {
          id: true,
          tenantId: true,
          name: true,
          domain: true,
          industry: true,
          employeeCount: true,
          address: true,
          city: true,
          state: true,
          country: true,
          phone: true,
          email: true,
          websiteUrl: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { contacts: true } },
        },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.company.count({ where }),
    ]);

    return {
      companies: companies.map((c) => ({
        ...c,
        contactCount: c._count.contacts,
        _count: undefined,
      })),
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async createCompany(tenantId, data) {
    const company = await prisma.company.create({
      data: {
        tenantId,
        name: data.name,
        domain: data.domain || null,
        description: data.description || null,
        industry: data.industry || null,
        employeeCount: data.size || data.employeeCount || null,
        companyType: data.companyType || null,
        lifecycleStage: data.lifecycleStage || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || null,
        phone: data.phone || null,
        email: data.email || null,
        linkedinUrl: data.linkedinUrl || null,
        twitterUrl: data.twitterUrl || null,
        websiteUrl: data.websiteUrl || null,
        customFields: data.customFields || null,
      },
    });

    eventBus.publish(createEvent(EventTypes.COMPANY_CREATED, tenantId, { companyId: company.id }));

    return company;
  }

  async getActivities(tenantId, filters) {
    const where = { tenantId };

    if (filters.type) where.type = filters.type;
    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.dealId) where.dealId = filters.dealId;
    if (filters.priority) where.priority = filters.priority;
    if (filters.completed === true) {
      where.completedAt = { not: null };
    } else if (filters.completed === false) {
      where.completedAt = null;
    }
    if (filters.search) {
      where.OR = [
        { subject: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
              email: true,
              company: { select: { id: true, name: true } },
            },
          },
          company: { select: { id: true, name: true, domain: true } },
          deal: { select: { id: true, name: true, amount: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.activity.count({ where }),
    ]);

    // Map subject to title for frontend consistency
    const mappedActivities = activities.map((a) => ({
      ...a,
      title: a.subject,
      dueAt: a.dueDate,
      completed: !!a.completedAt,
    }));

    return {
      activities: mappedActivities,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async createActivity(tenantId, userId, data) {
    const activity = await prisma.activity.create({
      data: {
        tenantId,
        type: data.type,
        subject: data.title || data.subject,
        description: data.description,
        contactId: data.contactId || undefined,
        companyId: data.companyId || undefined,
        dealId: data.dealId || undefined,
        ticketId: data.ticketId || undefined,
        priority: data.priority || undefined,
        callOutcome: data.callOutcome || undefined,
        callDuration: data.callDuration || undefined,
        meetingLocation: data.meetingLocation || undefined,
        meetingUrl: data.meetingUrl || undefined,
        attendees: data.attendees || undefined,
        assignedToId: data.assignedToId || userId,
        createdById: userId,
        dueDate: data.dueAt ? new Date(data.dueAt) : undefined,
        completedAt: data.completed ? new Date() : undefined,
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            company: { select: { id: true, name: true } },
          },
        },
        company: { select: { id: true, name: true } },
        deal: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return {
      ...activity,
      title: activity.subject,
      dueAt: activity.dueDate,
      completed: !!activity.completedAt,
    };
  }

  async getTags(tenantId) {
    const tags = await prisma.tag.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        _count: { select: { contacts: true } },
      },
      orderBy: { name: 'asc' },
    });

    return tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      createdAt: t.createdAt,
      _count: {
        contacts: t._count.contacts,
        companies: 0,
        deals: 0,
      },
    }));
  }

  async getTag(tenantId, tagId) {
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, tenantId },
      include: {
        _count: { select: { contacts: true } },
      },
    });

    if (!tag) {
      throw new NotFoundError('Tag not found');
    }

    return {
      id: tag.id,
      name: tag.name,
      color: tag.color,
      createdAt: tag.createdAt,
      _count: {
        contacts: tag._count.contacts,
        companies: 0,
        deals: 0,
      },
    };
  }

  async createTag(tenantId, data) {
    // Check if tag with same name exists
    const existing = await prisma.tag.findFirst({
      where: { tenantId, name: data.name },
    });

    if (existing) {
      throw new Error('Tag with this name already exists');
    }

    const tag = await prisma.tag.create({
      data: {
        tenantId,
        name: data.name,
        color: data.color || '#6366f1', // Default indigo color
      },
    });

    return tag;
  }

  async updateTag(tenantId, tagId, data) {
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, tenantId },
    });

    if (!tag) {
      throw new NotFoundError('Tag not found');
    }

    // Check if new name conflicts with existing tag
    if (data.name && data.name !== tag.name) {
      const existing = await prisma.tag.findFirst({
        where: { tenantId, name: data.name, NOT: { id: tagId } },
      });

      if (existing) {
        throw new Error('Tag with this name already exists');
      }
    }

    return prisma.tag.update({
      where: { id: tagId },
      data: {
        name: data.name,
        color: data.color,
      },
    });
  }

  async deleteTag(tenantId, tagId) {
    const tag = await prisma.tag.findFirst({
      where: { id: tagId, tenantId },
    });

    if (!tag) {
      throw new NotFoundError('Tag not found');
    }

    // Delete all tag associations first (using onDelete: Cascade will handle this, but explicit is safer)
    await prisma.contactTag.deleteMany({ where: { tagId } });
    await prisma.conversationTag.deleteMany({ where: { tagId } });

    // Delete the tag
    await prisma.tag.delete({ where: { id: tagId } });
  }

  // ============ SEGMENTS ============

  async getSegments(tenantId, filters) {
    const where = { tenantId };

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.type) {
      where.type = filters.type;
    }

    const [segments, total] = await Promise.all([
      prisma.segment.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.segment.count({ where }),
    ]);

    return {
      segments,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async getSegment(tenantId, segmentId) {
    const segment = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!segment) {
      throw new NotFoundError('Segment not found');
    }

    return segment;
  }

  async createSegment(tenantId, userId, data) {
    // Calculate contact count for dynamic segments
    let contactCount = 0;
    if (data.type === 'DYNAMIC' && data.conditions) {
      contactCount = await this.evaluateSegmentConditions(tenantId, data.conditions);
    } else if (data.type === 'STATIC' && data.contactIds) {
      contactCount = data.contactIds.length;
    }

    const segment = await prisma.segment.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        type: data.type || 'STATIC',
        conditions: data.conditions,
        contactIds: data.contactIds || [],
        contactCount,
        createdById: userId,
      },
    });

    eventBus.publish(
      createEvent(EventTypes.SEGMENT_CREATED, tenantId, { segmentId: segment.id }, { userId })
    );

    return segment;
  }

  async updateSegment(tenantId, segmentId, data) {
    const existing = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Segment not found');
    }

    // Recalculate contact count if conditions or contactIds changed
    let contactCount = existing.contactCount;
    if (data.conditions && existing.type === 'DYNAMIC') {
      contactCount = await this.evaluateSegmentConditions(tenantId, data.conditions);
    } else if (data.contactIds && existing.type === 'STATIC') {
      contactCount = data.contactIds.length;
    }

    const segment = await prisma.segment.update({
      where: { id: segmentId },
      data: {
        name: data.name,
        description: data.description,
        conditions: data.conditions,
        contactIds: data.contactIds,
        contactCount,
        isActive: data.isActive,
        updatedAt: new Date(),
      },
    });

    eventBus.publish(createEvent(EventTypes.SEGMENT_UPDATED, tenantId, { segmentId: segment.id }));

    return segment;
  }

  async deleteSegment(tenantId, segmentId) {
    const existing = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Segment not found');
    }

    await prisma.segment.delete({
      where: { id: segmentId },
    });

    eventBus.publish(createEvent(EventTypes.SEGMENT_DELETED, tenantId, { segmentId }));
  }

  async getSegmentContacts(tenantId, segmentId, filters) {
    const segment = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!segment) {
      throw new NotFoundError('Segment not found');
    }

    let where = { tenantId };

    if (segment.type === 'STATIC') {
      where.id = { in: segment.contactIds };
    } else if (segment.type === 'DYNAMIC' && segment.conditions) {
      where = { ...where, ...this.buildContactFilter(segment.conditions) };
    }

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: {
          company: { select: { id: true, name: true } },
          tags: {
            include: {
              tag: { select: { id: true, name: true, color: true } },
            },
          },
        },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contact.count({ where }),
    ]);

    // Transform tags from ContactTag[] to Tag[]
    const transformedContacts = contacts.map((contact) => ({
      ...contact,
      tags: contact.tags.map((ct) => ct.tag),
    }));

    return {
      contacts: transformedContacts,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async syncSegment(tenantId, segmentId) {
    const segment = await prisma.segment.findFirst({
      where: { id: segmentId, tenantId },
    });

    if (!segment) {
      throw new NotFoundError('Segment not found');
    }

    if (segment.type !== 'DYNAMIC') {
      return segment;
    }

    const contactCount = await this.evaluateSegmentConditions(tenantId, segment.conditions);

    const updated = await prisma.segment.update({
      where: { id: segmentId },
      data: {
        contactCount,
        lastSyncAt: new Date(),
      },
    });

    return updated;
  }

  async evaluateSegmentConditions(tenantId, conditions) {
    const where = { tenantId, ...this.buildContactFilter(conditions) };
    return prisma.contact.count({ where });
  }

  buildContactFilter(conditions) {
    if (!conditions || !conditions.filters) {
      return {};
    }

    const where = {};
    const operator = conditions.operator || 'AND';

    const filterConditions = conditions.filters.map((filter) => {
      switch (filter.field) {
        case 'status':
          return { status: filter.value };
        case 'source':
          return { source: { equals: filter.value, mode: 'insensitive' } };
        case 'email':
          if (filter.operator === 'contains') {
            return { email: { contains: filter.value, mode: 'insensitive' } };
          }
          return { email: filter.value };
        case 'phone':
          if (filter.operator === 'contains') {
            return { phone: { contains: filter.value } };
          }
          return { phone: filter.value };
        case 'companyId':
          return { companyId: filter.value };
        case 'createdAt':
          if (filter.operator === 'gte') {
            return { createdAt: { gte: new Date(filter.value) } };
          } else if (filter.operator === 'lte') {
            return { createdAt: { lte: new Date(filter.value) } };
          }
          return {};
        case 'hasTag':
          return {
            tags: {
              some: { tag: { name: { equals: filter.value, mode: 'insensitive' } } },
            },
          };
        default:
          return {};
      }
    });

    if (operator === 'OR') {
      where.OR = filterConditions;
    } else {
      where.AND = filterConditions;
    }

    return where;
  }

  // ============ COMPANIES CRUD ============

  async getCompany(tenantId, companyId) {
    const company = await prisma.company.findFirst({
      where: { id: companyId, tenantId },
      include: {
        contacts: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
        deals: {
          take: 5,
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { contacts: true, deals: true } },
      },
    });

    if (!company) {
      throw new NotFoundError('Company not found');
    }

    return {
      ...company,
      contactCount: company._count.contacts,
      dealCount: company._count.deals,
      _count: undefined,
    };
  }

  async updateCompany(tenantId, companyId, data) {
    const existing = await prisma.company.findFirst({
      where: { id: companyId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Company not found');
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        name: data.name,
        domain: data.domain,
        industry: data.industry,
        employeeCount: data.size || data.employeeCount,
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
        customFields: data.customFields,
        updatedAt: new Date(),
      },
    });

    eventBus.publish(createEvent(EventTypes.COMPANY_UPDATED, tenantId, { companyId: company.id }));

    return company;
  }

  async deleteCompany(tenantId, companyId) {
    const existing = await prisma.company.findFirst({
      where: { id: companyId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Company not found');
    }

    await prisma.company.delete({
      where: { id: companyId },
    });

    eventBus.publish(createEvent(EventTypes.COMPANY_DELETED, tenantId, { companyId }));
  }

  // ============ ACTIVITIES CRUD ============

  async getActivity(tenantId, activityId) {
    const activity = await prisma.activity.findFirst({
      where: { id: activityId, tenantId },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        deal: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!activity) {
      throw new NotFoundError('Activity not found');
    }

    return activity;
  }

  async updateActivity(tenantId, activityId, data) {
    const existing = await prisma.activity.findFirst({
      where: { id: activityId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Activity not found');
    }

    // Handle completed toggle
    let completedAt = existing.completedAt;
    if (data.completed !== undefined) {
      completedAt = data.completed ? existing.completedAt || new Date() : null;
    } else if (data.completedAt !== undefined) {
      completedAt = data.completedAt ? new Date(data.completedAt) : null;
    }

    const activity = await prisma.activity.update({
      where: { id: activityId },
      data: {
        type: data.type !== undefined ? data.type : undefined,
        subject: data.title || data.subject || undefined,
        description: data.description !== undefined ? data.description : undefined,
        dueDate: data.dueAt !== undefined ? (data.dueAt ? new Date(data.dueAt) : null) : undefined,
        completedAt,
        priority: data.priority !== undefined ? data.priority : undefined,
        assignedToId: data.assignedToId !== undefined ? data.assignedToId : undefined,
        contactId: data.contactId !== undefined ? data.contactId : undefined,
        companyId: data.companyId !== undefined ? data.companyId : undefined,
        dealId: data.dealId !== undefined ? data.dealId : undefined,
        callOutcome: data.callOutcome !== undefined ? data.callOutcome : undefined,
        callDuration: data.callDuration !== undefined ? data.callDuration : undefined,
        meetingLocation: data.meetingLocation !== undefined ? data.meetingLocation : undefined,
        meetingUrl: data.meetingUrl !== undefined ? data.meetingUrl : undefined,
      },
      include: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            company: { select: { id: true, name: true } },
          },
        },
        company: { select: { id: true, name: true } },
        deal: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    return {
      ...activity,
      title: activity.subject,
      dueAt: activity.dueDate,
      completed: !!activity.completedAt,
    };
  }

  async deleteActivity(tenantId, activityId) {
    const existing = await prisma.activity.findFirst({
      where: { id: activityId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Activity not found');
    }

    await prisma.activity.delete({
      where: { id: activityId },
    });
  }

  async completeActivity(tenantId, activityId) {
    const existing = await prisma.activity.findFirst({
      where: { id: activityId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Activity not found');
    }

    const activity = await prisma.activity.update({
      where: { id: activityId },
      data: {
        completedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return activity;
  }

  // ============ LEADS ============

  async getLeads(tenantId, filters) {
    const where = { tenantId };

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { company: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search } },
      ];
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.source) {
      where.source = { equals: filters.source, mode: 'insensitive' };
    }

    if (filters.ownerId) {
      where.ownerId = filters.ownerId;
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      leads,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async getLead(tenantId, leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        convertedToContact: { select: { id: true, firstName: true, lastName: true, email: true } },
        convertedToDeal: { select: { id: true, name: true, amount: true } },
      },
    });

    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    return lead;
  }

  async createLead(tenantId, userId, data) {
    const lead = await prisma.lead.create({
      data: {
        tenantId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        company: data.company,
        jobTitle: data.jobTitle,
        source: data.source,
        sourceDetails: data.sourceDetails,
        status: data.status || 'NEW',
        qualificationScore: data.qualificationScore,
        qualificationNotes: data.qualificationNotes,
        ownerId: data.ownerId || userId,
        customFields: data.customFields || {},
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    eventBus.publish(
      createEvent(EventTypes.LEAD_CREATED, tenantId, { leadId: lead.id }, { userId })
    );

    return lead;
  }

  async updateLead(tenantId, leadId, data) {
    const existing = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Lead not found');
    }

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        company: data.company,
        jobTitle: data.jobTitle,
        source: data.source,
        sourceDetails: data.sourceDetails,
        status: data.status,
        qualificationScore: data.qualificationScore,
        qualificationNotes: data.qualificationNotes,
        ownerId: data.ownerId,
        customFields: data.customFields,
        updatedAt: new Date(),
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    eventBus.publish(createEvent(EventTypes.LEAD_UPDATED, tenantId, { leadId: lead.id }));

    return lead;
  }

  async deleteLead(tenantId, leadId) {
    const existing = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Lead not found');
    }

    await prisma.lead.delete({
      where: { id: leadId },
    });

    eventBus.publish(createEvent(EventTypes.LEAD_DELETED, tenantId, { leadId }));
  }

  async qualifyLead(tenantId, leadId, qualificationData) {
    const existing = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Lead not found');
    }

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: qualificationData.qualified ? 'QUALIFIED' : 'UNQUALIFIED',
        qualificationScore: qualificationData.score,
        qualificationNotes: qualificationData.notes,
        updatedAt: new Date(),
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    eventBus.publish(
      createEvent(EventTypes.LEAD_QUALIFIED, tenantId, {
        leadId,
        qualified: qualificationData.qualified,
      })
    );

    return lead;
  }

  async convertLead(tenantId, userId, leadId, conversionData) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    if (lead.status === 'CONVERTED') {
      throw new Error('Lead is already converted');
    }

    // Create contact from lead
    let contact = null;
    if (conversionData.createContact !== false) {
      // Map lead source string to ContactSource enum (default to MANUAL for conversions)
      const contactSource = lead.source?.toUpperCase() === 'WEBSITE' ? 'WEBSITE' : 'MANUAL';

      contact = await prisma.contact.create({
        data: {
          tenantId,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          jobTitle: lead.jobTitle,
          source: contactSource,
          sourceDetails: lead.sourceDetails,
          ownerId: lead.ownerId || userId,
          status: 'ACTIVE',
          customFields: lead.customFields || {},
        },
      });

      eventBus.publish(
        createEvent(EventTypes.CONTACT_CREATED, tenantId, { contactId: contact.id }, { userId })
      );
    }

    // Create deal if requested
    let deal = null;
    if (conversionData.createDeal && conversionData.dealData) {
      // Get default pipeline
      let pipeline = await prisma.pipeline.findFirst({
        where: { tenantId, type: 'DEAL', isDefault: true },
        include: { stages: { orderBy: { order: 'asc' } } },
      });

      if (!pipeline) {
        pipeline = await prisma.pipeline.findFirst({
          where: { tenantId, type: 'DEAL' },
          include: { stages: { orderBy: { order: 'asc' } } },
        });
      }

      if (pipeline && pipeline.stages.length > 0) {
        deal = await prisma.deal.create({
          data: {
            tenantId,
            name: conversionData.dealData.name || `${lead.firstName} ${lead.lastName} - Deal`,
            pipelineId: pipeline.id,
            stageId: pipeline.stages[0].id,
            amount: conversionData.dealData.amount,
            expectedCloseDate: conversionData.dealData.expectedCloseDate,
            contactId: contact?.id,
            ownerId: lead.ownerId || userId,
          },
        });

        eventBus.publish(
          createEvent(EventTypes.DEAL_CREATED, tenantId, { dealId: deal.id }, { userId })
        );
      }
    }

    // Update lead status to CONVERTED
    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: 'CONVERTED',
        convertedAt: new Date(),
        convertedToContactId: contact?.id,
        convertedToDealId: deal?.id,
        updatedAt: new Date(),
      },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true } },
        convertedToContact: { select: { id: true, firstName: true, lastName: true } },
        convertedToDeal: { select: { id: true, name: true } },
      },
    });

    eventBus.publish(
      createEvent(
        EventTypes.LEAD_CONVERTED,
        tenantId,
        {
          leadId,
          contactId: contact?.id,
          dealId: deal?.id,
        },
        { userId }
      )
    );

    return {
      lead: updatedLead,
      contact,
      deal,
    };
  }

  async getLeadStats(tenantId) {
    const [totalLeads, newLeads, qualifiedLeads, convertedLeads, sourceBreakdown] =
      await Promise.all([
        prisma.lead.count({ where: { tenantId } }),
        prisma.lead.count({ where: { tenantId, status: 'NEW' } }),
        prisma.lead.count({ where: { tenantId, status: 'QUALIFIED' } }),
        prisma.lead.count({ where: { tenantId, status: 'CONVERTED' } }),
        prisma.lead.groupBy({
          by: ['source'],
          where: { tenantId },
          _count: { id: true },
        }),
      ]);

    return {
      total: totalLeads,
      byStatus: {
        new: newLeads,
        qualified: qualifiedLeads,
        converted: convertedLeads,
        unqualified: totalLeads - newLeads - qualifiedLeads - convertedLeads,
      },
      bySource: sourceBreakdown.map((s) => ({
        source: s.source || 'Unknown',
        count: s._count.id,
      })),
      conversionRate: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0,
    };
  }
}

export const crmService = new CrmService();
