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
  async getWorkflows(tenantId, filters = {}) {
    const where = { tenantId };

    // Map API status to isActive boolean
    if (filters.status === 'ACTIVE') {
      where.isActive = true;
    } else if (filters.status === 'PAUSED' || filters.status === 'DRAFT') {
      where.isActive = false;
    }

    const workflows = await prisma.workflows.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        workflow_triggers: true,
        workflow_actions: { orderBy: { order: 'asc' } },
        workflow_conditions: { orderBy: { order: 'asc' } },
        _count: {
          select: { workflow_executions: true },
        },
      },
    });

    // Transform to API format
    return workflows.map((wf) => this.transformWorkflowToApi(wf));
  }

  async getWorkflow(tenantId, workflowId) {
    const workflow = await prisma.workflows.findFirst({
      where: { id: workflowId, tenantId },
      include: {
        workflow_triggers: true,
        workflow_actions: { orderBy: { order: 'asc' } },
        workflow_conditions: { orderBy: { order: 'asc' } },
        workflow_executions: {
          take: 10,
          orderBy: { startedAt: 'desc' },
          select: {
            id: true,
            status: true,
            startedAt: true,
            completedAt: true,
            error: true,
          },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundError('Workflow not found');
    }

    return this.transformWorkflowToApi(workflow);
  }

  async createWorkflow(tenantId, userId, data) {
    // Create workflow with triggers, conditions, actions in transaction
    const workflow = await prisma.$transaction(async (tx) => {
      // Create main workflow
      const wf = await tx.workflows.create({
        data: {
          tenantId,
          name: data.name,
          description: data.description || null,
          isActive: false,
          createdById: userId,
        },
      });

      // Create trigger
      if (data.trigger) {
        await tx.workflow_triggers.create({
          data: {
            workflowId: wf.id,
            type: data.trigger.type,
            config: data.trigger.config || {},
          },
        });
      }

      // Create conditions
      if (data.conditions?.length > 0) {
        await tx.workflow_conditions.createMany({
          data: data.conditions.map((c, index) => ({
            workflowId: wf.id,
            field: c.field,
            operator: c.operator,
            value: c.value,
            order: index,
          })),
        });
      }

      // Create actions
      if (data.actions?.length > 0) {
        await tx.workflow_actions.createMany({
          data: data.actions.map((a, index) => ({
            workflowId: wf.id,
            type: a.type,
            config: a.config || {},
            order: index,
          })),
        });
      }

      return wf;
    });

    this.logger.info({ workflowId: workflow.id, name: workflow.name }, 'Workflow created');

    // Fetch complete workflow with relations
    return this.getWorkflow(tenantId, workflow.id);
  }

  async updateWorkflow(tenantId, workflowId, data) {
    const existing = await prisma.workflows.findFirst({
      where: { id: workflowId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Workflow not found');
    }

    // Don't allow editing active workflows without pausing first
    if (existing.isActive && (data.trigger || data.actions || data.conditions)) {
      throw new ValidationError(
        'Cannot modify trigger/actions/conditions of an active workflow. Pause it first.'
      );
    }

    // Update in transaction
    await prisma.$transaction(async (tx) => {
      // Update main workflow
      const updateData = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;

      if (Object.keys(updateData).length > 0) {
        await tx.workflows.update({
          where: { id: workflowId },
          data: updateData,
        });
      }

      // Update trigger
      if (data.trigger !== undefined) {
        await tx.workflow_triggers.deleteMany({ where: { workflowId } });
        if (data.trigger) {
          await tx.workflow_triggers.create({
            data: {
              workflowId,
              type: data.trigger.type,
              config: data.trigger.config || {},
            },
          });
        }
      }

      // Update conditions
      if (data.conditions !== undefined) {
        await tx.workflow_conditions.deleteMany({ where: { workflowId } });
        if (data.conditions?.length > 0) {
          await tx.workflow_conditions.createMany({
            data: data.conditions.map((c, index) => ({
              workflowId,
              field: c.field,
              operator: c.operator,
              value: c.value,
              order: index,
            })),
          });
        }
      }

      // Update actions
      if (data.actions !== undefined) {
        await tx.workflow_actions.deleteMany({ where: { workflowId } });
        if (data.actions?.length > 0) {
          await tx.workflow_actions.createMany({
            data: data.actions.map((a, index) => ({
              workflowId,
              type: a.type,
              config: a.config || {},
              order: index,
            })),
          });
        }
      }
    });

    this.logger.info({ workflowId, updates: Object.keys(data) }, 'Workflow updated');

    return this.getWorkflow(tenantId, workflowId);
  }

  async activateWorkflow(tenantId, workflowId) {
    const existing = await prisma.workflows.findFirst({
      where: { id: workflowId, tenantId },
      include: {
        workflow_triggers: true,
        workflow_actions: true,
      },
    });

    if (!existing) {
      throw new NotFoundError('Workflow not found');
    }

    // Validate workflow has required fields
    if (existing.workflow_triggers.length === 0 || existing.workflow_actions.length === 0) {
      throw new ValidationError(
        'Workflow must have a trigger and at least one action to be activated'
      );
    }

    await prisma.workflows.update({
      where: { id: workflowId },
      data: { isActive: true },
    });

    this.logger.info(
      { workflowId, trigger: existing.workflow_triggers[0]?.type },
      'Workflow activated'
    );

    // Register trigger listener if needed
    const workflow = await this.getWorkflow(tenantId, workflowId);
    this.registerWorkflowTrigger(workflow);

    return workflow;
  }

  async pauseWorkflow(tenantId, workflowId) {
    const existing = await prisma.workflows.findFirst({
      where: { id: workflowId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Workflow not found');
    }

    await prisma.workflows.update({
      where: { id: workflowId },
      data: { isActive: false },
    });

    this.logger.info({ workflowId }, 'Workflow paused');

    // Unregister trigger listener
    this.unregisterWorkflowTrigger(workflowId);

    return this.getWorkflow(tenantId, workflowId);
  }

  async getExecutions(tenantId, workflowId, filters = {}) {
    const existing = await prisma.workflows.findFirst({
      where: { id: workflowId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Workflow not found');
    }

    const page = filters.page || 1;
    const limit = filters.limit || 25;
    const skip = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      prisma.workflow_executions.findMany({
        where: { workflowId, tenantId },
        orderBy: { startedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.workflow_executions.count({
        where: { workflowId, tenantId },
      }),
    ]);

    return {
      executions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async deleteWorkflow(tenantId, workflowId) {
    const existing = await prisma.workflows.findFirst({
      where: { id: workflowId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Workflow not found');
    }

    // Unregister trigger if active
    if (existing.isActive) {
      this.unregisterWorkflowTrigger(workflowId);
    }

    await prisma.workflows.delete({
      where: { id: workflowId },
    });

    this.logger.info({ workflowId }, 'Workflow deleted');
  }

  // Transform database workflow to API format
  transformWorkflowToApi(wf) {
    const trigger =
      wf.workflow_triggers?.length > 0
        ? {
            type: wf.workflow_triggers[0].type,
            config: wf.workflow_triggers[0].config,
          }
        : null;

    const conditions = (wf.workflow_conditions || []).map((c) => ({
      field: c.field,
      operator: c.operator,
      value: c.value,
    }));

    const actions = (wf.workflow_actions || []).map((a) => ({
      type: a.type,
      config: a.config,
    }));

    return {
      id: wf.id,
      tenantId: wf.tenantId,
      name: wf.name,
      description: wf.description,
      status: wf.isActive ? 'ACTIVE' : 'DRAFT',
      trigger,
      conditions,
      actions,
      version: wf.version,
      createdById: wf.createdById,
      createdAt: wf.createdAt,
      updatedAt: wf.updatedAt,
      executionCount: wf._count?.workflow_executions || 0,
      executions: wf.workflow_executions,
    };
  }

  // Register a workflow's trigger to listen for events
  registerWorkflowTrigger(workflow) {
    const triggerType = workflow.trigger?.type;
    if (!triggerType) return;

    // Map trigger types to event bus events
    const eventType = this.mapTriggerToEvent(triggerType);
    if (eventType) {
      this.logger.info(
        { workflowId: workflow.id, triggerType, eventType },
        'Registering workflow trigger'
      );
      // Event subscription would be registered here
      // eventBus.on(eventType, (data) => this.handleTriggerEvent(workflow.id, data));
    }
  }

  // Unregister workflow trigger
  unregisterWorkflowTrigger(workflowId) {
    this.logger.info({ workflowId }, 'Unregistering workflow trigger');
    // Would remove event listener here
  }

  // Map trigger type to event bus event
  mapTriggerToEvent(triggerType) {
    const mapping = {
      'contact.created': EventTypes.CONTACT_CREATED,
      'contact.updated': EventTypes.CONTACT_UPDATED,
      'lead.created': EventTypes.LEAD_CREATED,
      'deal.created': EventTypes.DEAL_CREATED,
      'deal.stage_changed': EventTypes.DEAL_STAGE_CHANGED,
      'message.received': EventTypes.MESSAGE_RECEIVED,
      'form.submitted': EventTypes.FORM_SUBMITTED,
    };
    return mapping[triggerType];
  }

  // Execute a workflow (called by the event listener)
  async executeWorkflow(workflowId, triggerData, context = {}) {
    const workflow = await prisma.workflows.findUnique({
      where: { id: workflowId },
      include: {
        workflow_actions: { orderBy: { order: 'asc' } },
        workflow_conditions: { orderBy: { order: 'asc' } },
      },
    });

    if (!workflow || !workflow.isActive) {
      this.logger.warn({ workflowId }, 'Workflow not found or not active');
      return null;
    }

    // Create execution record
    const execution = await prisma.workflow_executions.create({
      data: {
        workflowId,
        tenantId: workflow.tenantId,
        triggerEvent: triggerData.event || 'manual',
        triggerData: triggerData,
        status: 'RUNNING',
      },
    });

    const conditionResults = [];
    const actionResults = [];

    try {
      // Check conditions
      for (const condition of workflow.workflow_conditions) {
        const passed = this.evaluateCondition(
          {
            config: {
              field: condition.field,
              operator: condition.operator,
              value: condition.value,
            },
          },
          { ...context, ...triggerData }
        );
        conditionResults.push({ conditionId: condition.id, passed });
        if (!passed) {
          await prisma.workflow_executions.update({
            where: { id: execution.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date(),
              conditionResults,
              actionResults,
            },
          });
          return execution;
        }
      }

      // Execute actions sequentially
      for (const action of workflow.workflow_actions) {
        try {
          await this.executeAction(
            workflow.tenantId,
            { type: action.type, config: action.config },
            { ...context, ...triggerData, workflowId }
          );
          actionResults.push({ actionId: action.id, status: 'completed' });
        } catch (actionError) {
          actionResults.push({
            actionId: action.id,
            status: 'failed',
            error: actionError.message,
          });
          throw actionError;
        }
      }

      // Mark as completed
      await prisma.workflow_executions.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          conditionResults,
          actionResults,
        },
      });

      this.logger.info({ workflowId, executionId: execution.id }, 'Workflow executed successfully');

      return execution;
    } catch (error) {
      // Mark as failed
      await prisma.workflow_executions.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: error.message,
          conditionResults,
          actionResults,
        },
      });

      this.logger.error(
        { workflowId, executionId: execution.id, error: error.message },
        'Workflow execution failed'
      );

      return execution;
    }
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
