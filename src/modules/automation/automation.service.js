import { prisma } from '@crm360/database';
import { NotFoundError, ValidationError } from '@crm360/shared';
import { eventBus, createEvent, EventTypes } from '../../common/events/event-bus.js';
import { channelsService } from '../channels/channels.service.js';
import { sequencesService } from '../sequences/sequences.service.js';
import { logger } from '../../common/logger.js';

// Supported trigger types
const TRIGGER_TYPES = {
  // Contact triggers
  CONTACT_CREATED: 'contact.created',
  CONTACT_UPDATED: 'contact.updated',
  CONTACT_TAG_ADDED: 'contact.tag_added',
  CONTACT_TAG_REMOVED: 'contact.tag_removed',

  // Lead triggers
  LEAD_CREATED: 'lead.created',
  LEAD_STATUS_CHANGED: 'lead.status_changed',
  LEAD_SCORE_CHANGED: 'lead.score_changed',

  // Deal triggers
  DEAL_CREATED: 'deal.created',
  DEAL_STAGE_CHANGED: 'deal.stage_changed',
  DEAL_WON: 'deal.won',
  DEAL_LOST: 'deal.lost',

  // Message triggers
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_OPENED: 'message.opened',
  MESSAGE_CLICKED: 'message.clicked',
  MESSAGE_REPLIED: 'message.replied',

  // Form triggers
  FORM_SUBMITTED: 'form.submitted',

  // Schedule triggers
  SCHEDULED: 'scheduled',
  RECURRING: 'recurring',
};

// Supported action types
const ACTION_TYPES = {
  // Channel actions
  SEND_WHATSAPP: 'send_whatsapp',
  SEND_SMS: 'send_sms',
  SEND_EMAIL: 'send_email',
  INITIATE_CALL: 'initiate_call',

  // Sequence actions
  ENROLL_SEQUENCE: 'enroll_sequence',
  EXIT_SEQUENCE: 'exit_sequence',

  // CRM actions
  CREATE_TASK: 'create_task',
  UPDATE_CONTACT: 'update_contact',
  UPDATE_LEAD: 'update_lead',
  UPDATE_DEAL: 'update_deal',
  ADD_TAG: 'add_tag',
  REMOVE_TAG: 'remove_tag',
  ASSIGN_OWNER: 'assign_owner',
  MOVE_PIPELINE_STAGE: 'move_pipeline_stage',

  // Flow control
  WAIT: 'wait',
  CONDITION: 'condition',
  SPLIT: 'split',
  WEBHOOK: 'webhook',
};

class AutomationService {
  constructor() {
    this.logger = logger.child({ service: 'AutomationService' });
  }

  // Get available triggers and actions for the builder
  getAvailableComponents() {
    return {
      triggers: Object.entries(TRIGGER_TYPES).map(([key, value]) => ({
        type: value,
        label: key.replace(/_/g, ' ').toLowerCase(),
        category: value.split('.')[0],
      })),
      actions: Object.entries(ACTION_TYPES).map(([key, value]) => ({
        type: value,
        label: key.replace(/_/g, ' ').toLowerCase(),
        category: this.getActionCategory(value),
      })),
    };
  }

  getActionCategory(actionType) {
    if (['send_whatsapp', 'send_sms', 'send_email', 'initiate_call'].includes(actionType)) {
      return 'messaging';
    }
    if (['enroll_sequence', 'exit_sequence'].includes(actionType)) {
      return 'sequence';
    }
    if (['wait', 'condition', 'split', 'webhook'].includes(actionType)) {
      return 'flow';
    }
    return 'crm';
  }
  async getWorkflows(tenantId, filters) {
    // Mock data - workflow schema not yet implemented
    return [];
  }

  async getWorkflow(tenantId, workflowId) {
    // Mock data - workflow schema not yet implemented
    throw new NotFoundError('Workflow not found');
  }

  async createWorkflow(tenantId, userId, data) {
    // Mock data - workflow schema not yet implemented
    return {
      id: 'wf_' + Date.now(),
      tenantId,
      name: data.name,
      description: data.description,
      trigger: data.trigger,
      conditions: data.conditions || [],
      actions: data.actions,
      status: 'DRAFT',
      createdById: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async updateWorkflow(tenantId, workflowId, data) {
    // Mock data - workflow schema not yet implemented
    throw new NotFoundError('Workflow not found');
  }

  async activateWorkflow(tenantId, workflowId) {
    // Mock data - workflow schema not yet implemented
    throw new NotFoundError('Workflow not found');
  }

  async pauseWorkflow(tenantId, workflowId) {
    // Mock data - workflow schema not yet implemented
    throw new NotFoundError('Workflow not found');
  }

  async getExecutions(tenantId, workflowId, filters) {
    // Mock data - workflow schema not yet implemented
    throw new NotFoundError('Workflow not found');
  }

  async deleteWorkflow(tenantId, workflowId) {
    // Mock data - workflow schema not yet implemented
    throw new NotFoundError('Workflow not found');
  }

  // Execute a workflow (called by the event listener)
  async executeWorkflow(workflowId, triggerData) {
    // Mock data - workflow schema not yet implemented
    // This method would be called by event bus when workflows are active
    return;
  }

  async executeAction(tenantId, action, context) {
    this.logger.info({ action: action.type, context }, 'Executing workflow action');

    switch (action.type) {
      case 'send_whatsapp':
        return this.executeSendWhatsApp(tenantId, action, context);
      case 'send_sms':
        return this.executeSendSMS(tenantId, action, context);
      case 'send_email':
        return this.executeSendEmail(tenantId, action, context);
      case 'initiate_call':
        return this.executeInitiateCall(tenantId, action, context);
      case 'enroll_sequence':
        return this.executeEnrollSequence(tenantId, action, context);
      case 'exit_sequence':
        return this.executeExitSequence(tenantId, action, context);
      case 'create_task':
        return this.executeCreateTask(tenantId, action, context);
      case 'add_tag':
        return this.executeAddTag(tenantId, action, context);
      case 'remove_tag':
        return this.executeRemoveTag(tenantId, action, context);
      case 'update_contact':
        return this.executeUpdateContact(tenantId, action, context);
      case 'update_lead':
        return this.executeUpdateLead(tenantId, action, context);
      case 'update_deal':
        return this.executeUpdateDeal(tenantId, action, context);
      case 'assign_owner':
        return this.executeAssignOwner(tenantId, action, context);
      case 'move_pipeline_stage':
        return this.executeMovePipelineStage(tenantId, action, context);
      case 'webhook':
        return this.executeWebhook(tenantId, action, context);
      case 'wait':
        // Delays are handled by the scheduler
        return { delayed: true, delayMs: action.delayMs || 0 };
      case 'condition':
        return this.evaluateCondition(action, context);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  // =====================
  // Channel Actions
  // =====================

  async executeSendWhatsApp(tenantId, action, context) {
    const { channelAccountId, templateId, content, to } = action.config;
    const contact = await this.resolveContact(tenantId, context);

    if (!contact?.phone) {
      throw new Error('Contact has no phone number');
    }

    const channelAccount = channelAccountId || (await this.getDefaultChannel(tenantId, 'WHATSAPP'));

    if (templateId) {
      return channelsService.sendTemplate({
        channelAccountId: channelAccount,
        to: contact.phone,
        templateId,
        variables: this.interpolateVariables(action.config.variables, contact, context),
      });
    }

    return channelsService.sendMessage({
      channelAccountId: channelAccount,
      to: contact.phone,
      content: this.interpolateContent(content, contact, context),
      contentType: 'text',
    });
  }

  async executeSendSMS(tenantId, action, context) {
    const { channelAccountId, templateId } = action.config;
    const contact = await this.resolveContact(tenantId, context);

    if (!contact?.phone) {
      throw new Error('Contact has no phone number');
    }

    const channelAccount = channelAccountId || (await this.getDefaultChannel(tenantId, 'SMS'));

    return channelsService.sendTemplate({
      channelAccountId: channelAccount,
      to: contact.phone,
      templateId,
      variables: this.interpolateVariables(action.config.variables, contact, context),
    });
  }

  async executeSendEmail(tenantId, action, context) {
    const { channelAccountId, subject, content } = action.config;
    const contact = await this.resolveContact(tenantId, context);

    if (!contact?.email) {
      throw new Error('Contact has no email address');
    }

    const channelAccount = channelAccountId || (await this.getDefaultChannel(tenantId, 'EMAIL'));

    return channelsService.sendMessage({
      channelAccountId: channelAccount,
      to: contact.email,
      subject: this.interpolateContent(subject, contact, context),
      content: this.interpolateContent(content, contact, context),
      contentType: 'html',
    });
  }

  async executeInitiateCall(tenantId, action, context) {
    const contact = await this.resolveContact(tenantId, context);

    if (!contact?.phone) {
      throw new Error('Contact has no phone number');
    }

    // Create a task for the agent to call
    return prisma.task.create({
      data: {
        tenantId,
        title: `Call ${contact.name || contact.phone}`,
        description: action.config.callNotes || 'Automated call task',
        type: 'CALL',
        status: 'PENDING',
        dueAt: new Date(),
        contactId: contact.id,
        assignedToId: action.config.assignedToId,
        metadata: {
          automationGenerated: true,
          workflowId: context.workflowId,
        },
      },
    });
  }

  // =====================
  // Sequence Actions
  // =====================

  async executeEnrollSequence(tenantId, action, context) {
    const contact = await this.resolveContact(tenantId, context);
    const { sequenceId } = action.config;

    return sequencesService.enrollContact(tenantId, sequenceId, {
      contactId: contact.id,
      source: 'automation',
    });
  }

  async executeExitSequence(tenantId, action, context) {
    const contact = await this.resolveContact(tenantId, context);
    const { sequenceId } = action.config;

    const enrollment = await prisma.sequenceEnrollment.findFirst({
      where: {
        sequenceId,
        contactId: contact.id,
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
    });

    if (enrollment) {
      return sequencesService.exitEnrollment(tenantId, enrollment.id, 'automation');
    }
  }

  // =====================
  // CRM Actions
  // =====================

  async executeCreateTask(tenantId, action, context) {
    const contact = await this.resolveContact(tenantId, context);
    const { title, description, type, dueInDays, assignedToId } = action.config;

    const dueAt = new Date();
    if (dueInDays) {
      dueAt.setDate(dueAt.getDate() + dueInDays);
    }

    return prisma.task.create({
      data: {
        tenantId,
        title: this.interpolateContent(title, contact, context),
        description: this.interpolateContent(description, contact, context),
        type: type || 'FOLLOW_UP',
        status: 'PENDING',
        dueAt,
        contactId: contact?.id,
        leadId: context.leadId,
        dealId: context.dealId,
        assignedToId,
        metadata: {
          automationGenerated: true,
          workflowId: context.workflowId,
        },
      },
    });
  }

  async executeAddTag(tenantId, action, context) {
    const contact = await this.resolveContact(tenantId, context);
    const { tagId, tagName } = action.config;

    // Find or create tag
    let tag = tagId
      ? await prisma.tag.findUnique({ where: { id: tagId } })
      : await prisma.tag.findFirst({ where: { tenantId, name: tagName } });

    if (!tag && tagName) {
      tag = await prisma.tag.create({
        data: { tenantId, name: tagName, color: '#6366f1' },
      });
    }

    if (tag && contact) {
      await prisma.contactTag.upsert({
        where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
        create: { contactId: contact.id, tagId: tag.id },
        update: {},
      });
    }
  }

  async executeRemoveTag(tenantId, action, context) {
    const contact = await this.resolveContact(tenantId, context);
    const { tagId } = action.config;

    if (contact && tagId) {
      await prisma.contactTag.deleteMany({
        where: { contactId: contact.id, tagId },
      });
    }
  }

  async executeUpdateContact(tenantId, action, context) {
    const contact = await this.resolveContact(tenantId, context);
    const { updates } = action.config;

    if (contact) {
      return prisma.contact.update({
        where: { id: contact.id },
        data: updates,
      });
    }
  }

  async executeUpdateLead(tenantId, action, context) {
    const { updates } = action.config;
    const leadId = context.leadId;

    if (leadId) {
      return prisma.lead.update({
        where: { id: leadId },
        data: updates,
      });
    }
  }

  async executeUpdateDeal(tenantId, action, context) {
    const { updates } = action.config;
    const dealId = context.dealId;

    if (dealId) {
      return prisma.deal.update({
        where: { id: dealId },
        data: updates,
      });
    }
  }

  async executeAssignOwner(tenantId, action, context) {
    const { ownerId, entityType } = action.config;

    switch (entityType) {
      case 'contact':
        const contact = await this.resolveContact(tenantId, context);
        if (contact) {
          return prisma.contact.update({
            where: { id: contact.id },
            data: { ownerId },
          });
        }
        break;
      case 'lead':
        if (context.leadId) {
          return prisma.lead.update({
            where: { id: context.leadId },
            data: { ownerId },
          });
        }
        break;
      case 'deal':
        if (context.dealId) {
          return prisma.deal.update({
            where: { id: context.dealId },
            data: { ownerId },
          });
        }
        break;
    }
  }

  async executeMovePipelineStage(tenantId, action, context) {
    const { stageId } = action.config;
    const dealId = context.dealId;

    if (dealId) {
      return prisma.deal.update({
        where: { id: dealId },
        data: { stageId },
      });
    }
  }

  async executeWebhook(tenantId, action, context) {
    const { url, method, headers, body } = action.config;

    const response = await fetch(url, {
      method: method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(this.interpolateObject(body, context)),
    });

    return {
      status: response.status,
      body: await response.json().catch(() => null),
    };
  }

  evaluateCondition(action, context) {
    const { field, operator, value } = action.config;
    const fieldValue = this.getNestedValue(context, field);

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'contains':
        return String(fieldValue).includes(value);
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'is_set':
        return fieldValue !== null && fieldValue !== undefined;
      case 'is_not_set':
        return fieldValue === null || fieldValue === undefined;
      default:
        return false;
    }
  }

  // =====================
  // Helper Methods
  // =====================

  async resolveContact(tenantId, context) {
    if (context.contactId) {
      return prisma.contact.findUnique({ where: { id: context.contactId } });
    }
    if (context.leadId) {
      const lead = await prisma.lead.findUnique({
        where: { id: context.leadId },
        include: { contact: true },
      });
      return lead?.contact;
    }
    if (context.dealId) {
      const deal = await prisma.deal.findUnique({
        where: { id: context.dealId },
        include: { contact: true },
      });
      return deal?.contact;
    }
    return context.contact;
  }

  async getDefaultChannel(tenantId, channelType) {
    const channel = await prisma.channelAccount.findFirst({
      where: { tenantId, channelType, isEnabled: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!channel) {
      throw new Error(`No ${channelType} channel configured`);
    }
    return channel.id;
  }

  interpolateContent(content, contact, context) {
    if (!content) return content;

    const variables = {
      ...contact,
      firstName: contact?.firstName || contact?.name?.split(' ')[0] || '',
      lastName: contact?.lastName || '',
    };

    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || context[key] || match;
    });
  }

  interpolateVariables(variables, contact, context) {
    if (!variables) return {};

    const result = {};
    for (const [key, value] of Object.entries(variables)) {
      result[key] = this.interpolateContent(value, contact, context);
    }
    return result;
  }

  interpolateObject(obj, context) {
    if (!obj) return obj;
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = value.replace(/\{\{(\w+)\}\}/g, (match, k) => {
          return this.getNestedValue(context, k) || match;
        });
      } else if (typeof value === 'object') {
        result[key] = this.interpolateObject(value, context);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }
}

export const automationService = new AutomationService();
