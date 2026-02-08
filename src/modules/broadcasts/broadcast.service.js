/**
 * Broadcast Service
 * Handles bulk messaging campaigns via WhatsApp, SMS, and Email
 */

import { prisma } from '@crm360/database';
import { logger } from '../../common/logger.js';
import { whatsAppService } from '../../common/providers/whatsapp/whatsapp.service.js';
import * as fast2smsService from '../../services/fast2sms.service.js';

const MSG91_CONTROL_URL = 'https://control.msg91.com/api/v5';

class BroadcastService {
  constructor() {
    this.logger = logger.child({ service: 'BroadcastService' });
  }

  /**
   * List broadcasts for a tenant
   */
  async list({ tenantId, page = 1, limit = 20, status, channel }) {
    // TODO: Broadcasts feature not yet implemented - Broadcast model doesn't exist
    // Return empty data for now with proper structure
    return {
      broadcasts: [],
      pagination: {
        page,
        limit,
        total: 0,
        pages: 0,
      },
    };
  }

  /**
   * Get a single broadcast
   */
  async get({ tenantId, broadcastId }) {
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: broadcastId, tenantId },
      include: {
        _count: {
          select: { recipients: true },
        },
      },
    });

    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    return broadcast;
  }

  /**
   * Get broadcast with recipient details
   */
  async getWithRecipients({ tenantId, broadcastId, page = 1, limit = 50 }) {
    const broadcast = await this.get({ tenantId, broadcastId });

    const [recipients, total] = await Promise.all([
      prisma.broadcastRecipient.findMany({
        where: { broadcastId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, email: true, phone: true },
          },
        },
      }),
      prisma.broadcastRecipient.count({ where: { broadcastId } }),
    ]);

    return {
      ...broadcast,
      recipients,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create a new broadcast
   */
  async create({ tenantId, userId, data }) {
    const {
      name,
      description,
      channel,
      channelAccountId,
      templateId,
      templateName,
      subject,
      content,
      contentHtml,
      audienceType = 'CONTACTS',
      audienceFilter,
      segmentId,
      contactIds,
      scheduledAt,
      timezone = 'UTC',
    } = data;

    // Verify channel account exists and belongs to tenant
    const channelAccount = await prisma.channelAccount.findFirst({
      where: { id: channelAccountId, tenantId },
    });

    if (!channelAccount) {
      throw new Error('Channel account not found');
    }

    // Calculate total recipients based on audience
    let totalRecipients = 0;
    let resolvedContactIds = [];

    if (audienceType === 'ALL_CONTACTS') {
      totalRecipients = await prisma.contact.count({
        where: { tenantId, status: 'ACTIVE' },
      });
    } else if (audienceType === 'SEGMENT' && segmentId) {
      // Get contacts from segment
      const segment = await prisma.segment.findFirst({
        where: { id: segmentId, tenantId },
      });
      if (segment) {
        // Parse segment filters and count matching contacts
        totalRecipients = await this.countSegmentContacts(tenantId, segment.filters);
      }
    } else if (audienceType === 'FILTER' && audienceFilter) {
      totalRecipients = await this.countFilteredContacts(tenantId, audienceFilter);
    } else if (contactIds && contactIds.length > 0) {
      totalRecipients = contactIds.length;
      resolvedContactIds = contactIds;
    }

    // Create the broadcast
    const broadcast = await prisma.broadcast.create({
      data: {
        tenantId,
        name,
        description,
        channel,
        channelAccountId,
        templateId,
        templateName,
        subject,
        content,
        contentHtml,
        audienceType,
        audienceFilter,
        segmentId,
        contactIds: resolvedContactIds.length > 0 ? resolvedContactIds : undefined,
        totalRecipients,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        timezone,
        status: scheduledAt ? 'SCHEDULED' : 'DRAFT',
        createdById: userId,
      },
    });

    this.logger.info({ broadcastId: broadcast.id, tenantId, totalRecipients }, 'Broadcast created');

    return broadcast;
  }

  /**
   * Update a broadcast (only if DRAFT or SCHEDULED)
   */
  async update({ tenantId, broadcastId, data }) {
    const broadcast = await this.get({ tenantId, broadcastId });

    if (!['DRAFT', 'SCHEDULED'].includes(broadcast.status)) {
      throw new Error('Cannot update a broadcast that has already been sent');
    }

    const updated = await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        ...data,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : broadcast.scheduledAt,
        status: data.scheduledAt ? 'SCHEDULED' : broadcast.status,
      },
    });

    return updated;
  }

  /**
   * Delete a broadcast (only if DRAFT)
   */
  async delete({ tenantId, broadcastId }) {
    const broadcast = await this.get({ tenantId, broadcastId });

    if (broadcast.status !== 'DRAFT') {
      throw new Error('Can only delete draft broadcasts');
    }

    // Delete recipients first
    await prisma.broadcastRecipient.deleteMany({
      where: { broadcastId },
    });

    await prisma.broadcast.delete({
      where: { id: broadcastId },
    });

    return { success: true };
  }

  /**
   * Send broadcast immediately or queue for scheduled time
   */
  async send({ tenantId, broadcastId }) {
    const broadcast = await this.get({ tenantId, broadcastId });

    if (!['DRAFT', 'SCHEDULED'].includes(broadcast.status)) {
      throw new Error('Broadcast cannot be sent - invalid status');
    }

    // Update status to SENDING
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'SENDING', startedAt: new Date() },
    });

    // Resolve recipients
    const contacts = await this.resolveRecipients({
      tenantId,
      audienceType: broadcast.audienceType,
      audienceFilter: broadcast.audienceFilter,
      segmentId: broadcast.segmentId,
      contactIds: broadcast.contactIds,
    });

    // Create recipient records
    const recipientRecords = contacts.map((contact) => ({
      broadcastId,
      contactId: contact.id,
      recipientPhone: contact.phone,
      recipientEmail: contact.email,
      recipientName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
      variables: this.buildVariables(contact),
      status: 'PENDING',
    }));

    await prisma.broadcastRecipient.createMany({
      data: recipientRecords,
    });

    // Send based on channel
    if (broadcast.channel === 'WHATSAPP') {
      await this.sendWhatsAppBroadcast(broadcast, contacts);
    } else if (broadcast.channel === 'SMS') {
      await this.sendSmsBroadcast(broadcast, contacts);
    } else if (broadcast.channel === 'EMAIL') {
      await this.sendEmailBroadcast(broadcast, contacts);
    }

    // Update final status
    const stats = await this.calculateBroadcastStats(broadcastId);

    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: {
        status: stats.failedCount === stats.totalRecipients ? 'FAILED' : 'COMPLETED',
        completedAt: new Date(),
        sentCount: stats.sentCount,
        failedCount: stats.failedCount,
      },
    });

    this.logger.info({ broadcastId, stats }, 'Broadcast completed');

    return { success: true, stats };
  }

  /**
   * Send WhatsApp broadcast using MSG91 bulk API
   */
  async sendWhatsAppBroadcast(broadcast, contacts) {
    const channelAccount = await prisma.channelAccount.findUnique({
      where: { id: broadcast.channelAccountId },
    });

    if (!channelAccount) {
      throw new Error('Channel account not found');
    }

    const authKey = await whatsAppService.getAuthKey(broadcast.channelAccountId);
    const integratedNumber =
      channelAccount.providerConfig?.integratedNumber || channelAccount.phoneNumber;

    // Build MSG91 bulk payload with template
    const recipientsWithComponents = contacts.map((contact) => {
      const phone = contact.phone?.startsWith('+') ? contact.phone.slice(1) : contact.phone;

      // Build components with variable substitution
      const variables = this.buildVariables(contact);
      const components = {};

      // Header variables
      if (broadcast.templateName) {
        components.body = Object.values(variables).map((v) => ({ type: 'text', text: v || '' }));
      }

      return {
        to: [phone],
        components,
      };
    });

    const payload = {
      integrated_number: integratedNumber,
      content_type: 'template',
      payload: {
        type: 'template',
        template: {
          name: broadcast.templateName,
          language: {
            code: 'en',
            policy: 'deterministic',
          },
          to_and_components: recipientsWithComponents,
        },
        messaging_product: 'whatsapp',
      },
    };

    try {
      const response = await fetch(
        `${MSG91_CONTROL_URL}/whatsapp/whatsapp-outbound-message/bulk/`,
        {
          method: 'POST',
          headers: {
            authkey: authKey,
            'Content-Type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (response.ok) {
        // Mark all recipients as sent
        await prisma.broadcastRecipient.updateMany({
          where: { broadcastId: broadcast.id },
          data: { status: 'SENT', sentAt: new Date() },
        });

        this.logger.info({ broadcastId: broadcast.id, response: data }, 'WhatsApp broadcast sent');
      } else {
        // Mark all as failed
        await prisma.broadcastRecipient.updateMany({
          where: { broadcastId: broadcast.id },
          data: { status: 'FAILED', errorMessage: data.message || 'Failed to send' },
        });

        this.logger.error({ broadcastId: broadcast.id, error: data }, 'WhatsApp broadcast failed');
      }

      return data;
    } catch (error) {
      this.logger.error({ error }, 'WhatsApp broadcast error');

      await prisma.broadcastRecipient.updateMany({
        where: { broadcastId: broadcast.id },
        data: { status: 'FAILED', errorMessage: error.message },
      });

      throw error;
    }
  }

  /**
   * Send SMS broadcast via Fast2SMS or MSG91
   */
  async sendSmsBroadcast(broadcast, contacts) {
    this.logger.info(
      { broadcastId: broadcast.id, recipientCount: contacts.length },
      'Starting SMS broadcast'
    );

    // Get SMS channel account
    const channelAccount = await prisma.channelAccount.findFirst({
      where: {
        tenantId: broadcast.tenantId,
        type: 'SMS',
        status: 'ACTIVE',
      },
    });

    if (!channelAccount) {
      this.logger.error({ broadcastId: broadcast.id }, 'No active SMS channel found');
      await prisma.broadcastRecipient.updateMany({
        where: { broadcastId: broadcast.id },
        data: { status: 'FAILED', errorMessage: 'No active SMS channel configured' },
      });
      throw new Error('No active SMS channel configured');
    }

    const apiKey = channelAccount.providerConfig?.apiKey;
    if (!apiKey) {
      throw new Error('SMS API key not configured');
    }

    let successCount = 0;
    let failedCount = 0;

    // Process contacts in batches of 50 for bulk sending
    const batchSize = 50;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);

      // Filter contacts with valid phone numbers
      const validContacts = batch.filter(
        (c) => c.phone && fast2smsService.validatePhoneNumber(c.phone)
      );

      if (validContacts.length === 0) {
        continue;
      }

      // For personalized messages, send individually
      if (broadcast.content.includes('{') || broadcast.content.includes('{{')) {
        // Send individually for variable substitution
        for (const contact of validContacts) {
          try {
            const variables = this.buildVariables(contact);
            const personalizedMessage = this.interpolateContent(broadcast.content, variables);

            const result = await fast2smsService.sendQuickSMS({
              phone: contact.phone,
              message: personalizedMessage,
              apiKey,
            });

            if (result.success) {
              successCount++;
              await prisma.broadcastRecipient.updateMany({
                where: {
                  broadcastId: broadcast.id,
                  contactId: contact.id,
                },
                data: {
                  status: 'SENT',
                  sentAt: new Date(),
                  providerMessageId: result.requestId || result.request_id,
                },
              });
            } else {
              failedCount++;
              await prisma.broadcastRecipient.updateMany({
                where: {
                  broadcastId: broadcast.id,
                  contactId: contact.id,
                },
                data: {
                  status: 'FAILED',
                  errorMessage: result.error || 'Failed to send SMS',
                },
              });
            }
          } catch (error) {
            failedCount++;
            this.logger.error(
              { error: error.message, contactId: contact.id },
              'SMS send failed for contact'
            );
            await prisma.broadcastRecipient.updateMany({
              where: {
                broadcastId: broadcast.id,
                contactId: contact.id,
              },
              data: {
                status: 'FAILED',
                errorMessage: error.message,
              },
            });
          }
        }
      } else {
        // Bulk send for non-personalized messages
        try {
          const phones = validContacts.map((c) => c.phone);
          const result = await fast2smsService.sendBulkSMS({
            phones,
            message: broadcast.content,
            apiKey,
          });

          if (result.success) {
            successCount += validContacts.length;
            await prisma.broadcastRecipient.updateMany({
              where: {
                broadcastId: broadcast.id,
                contactId: { in: validContacts.map((c) => c.id) },
              },
              data: {
                status: 'SENT',
                sentAt: new Date(),
                providerMessageId: result.requestId || result.request_id,
              },
            });
          } else {
            failedCount += validContacts.length;
            await prisma.broadcastRecipient.updateMany({
              where: {
                broadcastId: broadcast.id,
                contactId: { in: validContacts.map((c) => c.id) },
              },
              data: {
                status: 'FAILED',
                errorMessage: result.error || 'Bulk SMS failed',
              },
            });
          }
        } catch (error) {
          failedCount += validContacts.length;
          this.logger.error({ error: error.message }, 'Bulk SMS send failed');
          await prisma.broadcastRecipient.updateMany({
            where: {
              broadcastId: broadcast.id,
              contactId: { in: validContacts.map((c) => c.id) },
            },
            data: {
              status: 'FAILED',
              errorMessage: error.message,
            },
          });
        }
      }

      // Add small delay between batches to avoid rate limiting
      if (i + batchSize < contacts.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    this.logger.info(
      { broadcastId: broadcast.id, successCount, failedCount },
      'SMS broadcast completed'
    );

    return { successCount, failedCount };
  }

  /**
   * Interpolate content with contact variables
   */
  interpolateContent(content, variables) {
    let result = content;
    // Handle both {var} and {{var}} formats
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`\\{\\{?${key}\\}?\\}`, 'gi'), value || '');
    });
    return result;
  }

  /**
   * Send Email broadcast (placeholder - implement with email provider)
   */
  async sendEmailBroadcast(broadcast, contacts) {
    // TODO: Implement email sending via nodemailer or email service
    this.logger.info({ broadcastId: broadcast.id }, 'Email broadcast - not implemented yet');

    await prisma.broadcastRecipient.updateMany({
      where: { broadcastId: broadcast.id },
      data: { status: 'FAILED', errorMessage: 'Email broadcast not implemented yet' },
    });
  }

  /**
   * Resolve recipients based on audience settings
   */
  async resolveRecipients({ tenantId, audienceType, audienceFilter, segmentId, contactIds }) {
    let contacts = [];

    if (audienceType === 'ALL_CONTACTS') {
      contacts = await prisma.contact.findMany({
        where: { tenantId, status: 'ACTIVE' },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          company: true,
        },
      });
    } else if (audienceType === 'SEGMENT' && segmentId) {
      const segment = await prisma.segment.findFirst({
        where: { id: segmentId, tenantId },
      });
      if (segment) {
        contacts = await this.getSegmentContacts(tenantId, segment.filters);
      }
    } else if (audienceType === 'FILTER' && audienceFilter) {
      contacts = await this.getFilteredContacts(tenantId, audienceFilter);
    } else if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
      contacts = await prisma.contact.findMany({
        where: { id: { in: contactIds }, tenantId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          company: true,
        },
      });
    }

    return contacts;
  }

  /**
   * Build variables for template substitution
   */
  buildVariables(contact) {
    return {
      1: contact.firstName || '',
      2: contact.lastName || '',
      3: contact.email || '',
      4: contact.phone || '',
      5: contact.company || '',
      name: contact.firstName || '',
      first_name: contact.firstName || '',
      last_name: contact.lastName || '',
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
    };
  }

  /**
   * Count contacts in a segment
   */
  async countSegmentContacts(tenantId, filters) {
    // Simple filter parsing - expand as needed
    const where = { tenantId, status: 'ACTIVE' };
    return prisma.contact.count({ where });
  }

  /**
   * Get contacts in a segment
   */
  async getSegmentContacts(tenantId, filters) {
    const where = { tenantId, status: 'ACTIVE' };
    return prisma.contact.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
      },
    });
  }

  /**
   * Count filtered contacts
   */
  async countFilteredContacts(tenantId, filter) {
    const where = this.buildFilterWhere(tenantId, filter);
    return prisma.contact.count({ where });
  }

  /**
   * Get filtered contacts
   */
  async getFilteredContacts(tenantId, filter) {
    const where = this.buildFilterWhere(tenantId, filter);
    return prisma.contact.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
      },
    });
  }

  /**
   * Build Prisma where clause from filter
   */
  buildFilterWhere(tenantId, filter) {
    const where = { tenantId, status: 'ACTIVE' };

    if (filter.status) where.status = filter.status;
    if (filter.source) where.source = filter.source;
    if (filter.tags && filter.tags.length > 0) {
      where.tags = { hasSome: filter.tags };
    }
    if (filter.hasPhone) where.phone = { not: null };
    if (filter.hasEmail) where.email = { not: null };

    return where;
  }

  /**
   * Calculate broadcast statistics
   */
  async calculateBroadcastStats(broadcastId) {
    const stats = await prisma.broadcastRecipient.groupBy({
      by: ['status'],
      where: { broadcastId },
      _count: true,
    });

    const result = {
      totalRecipients: 0,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
    };

    for (const stat of stats) {
      result.totalRecipients += stat._count;
      switch (stat.status) {
        case 'SENT':
          result.sentCount += stat._count;
          break;
        case 'DELIVERED':
          result.deliveredCount += stat._count;
          break;
        case 'READ':
          result.readCount += stat._count;
          break;
        case 'FAILED':
          result.failedCount += stat._count;
          break;
      }
    }

    return result;
  }

  /**
   * Get broadcast analytics
   */
  async getAnalytics({ tenantId, broadcastId }) {
    const broadcast = await this.get({ tenantId, broadcastId });

    const stats = await this.calculateBroadcastStats(broadcastId);

    // Calculate rates
    const deliveryRate =
      stats.sentCount > 0 ? ((stats.deliveredCount / stats.sentCount) * 100).toFixed(1) : 0;
    const readRate =
      stats.deliveredCount > 0 ? ((stats.readCount / stats.deliveredCount) * 100).toFixed(1) : 0;
    const failureRate =
      stats.totalRecipients > 0
        ? ((stats.failedCount / stats.totalRecipients) * 100).toFixed(1)
        : 0;

    return {
      broadcast: {
        id: broadcast.id,
        name: broadcast.name,
        status: broadcast.status,
        channel: broadcast.channel,
        createdAt: broadcast.createdAt,
        startedAt: broadcast.startedAt,
        completedAt: broadcast.completedAt,
      },
      stats: {
        ...stats,
        deliveryRate: parseFloat(deliveryRate),
        readRate: parseFloat(readRate),
        failureRate: parseFloat(failureRate),
      },
    };
  }

  /**
   * Duplicate a broadcast
   */
  async duplicate({ tenantId, broadcastId, userId }) {
    const original = await this.get({ tenantId, broadcastId });

    const duplicate = await prisma.broadcast.create({
      data: {
        tenantId,
        name: `${original.name} (Copy)`,
        description: original.description,
        channel: original.channel,
        channelAccountId: original.channelAccountId,
        templateId: original.templateId,
        templateName: original.templateName,
        subject: original.subject,
        content: original.content,
        contentHtml: original.contentHtml,
        audienceType: original.audienceType,
        audienceFilter: original.audienceFilter,
        segmentId: original.segmentId,
        contactIds: original.contactIds,
        totalRecipients: original.totalRecipients,
        timezone: original.timezone,
        status: 'DRAFT',
        createdById: userId,
      },
    });

    return duplicate;
  }

  /**
   * Cancel a scheduled broadcast
   */
  async cancel({ tenantId, broadcastId }) {
    const broadcast = await this.get({ tenantId, broadcastId });

    if (broadcast.status !== 'SCHEDULED') {
      throw new Error('Only scheduled broadcasts can be cancelled');
    }

    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'CANCELLED' },
    });

    return { success: true };
  }

  /**
   * Get templates for a channel account
   */
  async getTemplates({ tenantId, channelAccountId }) {
    const channelAccount = await prisma.channelAccount.findFirst({
      where: { id: channelAccountId, tenantId },
    });

    if (!channelAccount) {
      throw new Error('Channel account not found');
    }

    if (channelAccount.type === 'WHATSAPP') {
      const authKey = await whatsAppService.getAuthKey(channelAccountId);
      const phoneNumber =
        channelAccount.providerConfig?.integratedNumber || channelAccount.phoneNumber;
      return whatsAppService.getTemplates(authKey, phoneNumber);
    }

    return { success: true, templates: [] };
  }
}

export const broadcastService = new BroadcastService();
