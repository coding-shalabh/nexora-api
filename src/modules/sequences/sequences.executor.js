/**
 * Sequence Executor
 * Background job processor for sequence step execution
 */

import { prisma } from '@crm360/database';
import { logger } from '../../common/logger.js';
import { channelsService } from '../channels/channels.service.js';
import { eventBus, createEvent } from '../../common/events/event-bus.js';

class SequenceExecutor {
  constructor() {
    this.logger = logger.child({ service: 'SequenceExecutor' });
    this.isRunning = false;
    this.intervalId = null;
  }

  /**
   * Start the sequence executor
   */
  start(intervalMs = 60000) {
    if (this.isRunning) {
      this.logger.warn('Executor already running');
      return;
    }

    this.isRunning = true;
    this.logger.info('Sequence executor started');

    // Run immediately, then at interval
    this.processScheduledSteps();
    this.intervalId = setInterval(() => this.processScheduledSteps(), intervalMs);
  }

  /**
   * Stop the sequence executor
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.logger.info('Sequence executor stopped');
  }

  /**
   * Process all scheduled steps that are due
   */
  async processScheduledSteps() {
    try {
      const now = new Date();

      // Find all scheduled step runs that are due
      const dueSteps = await prisma.sequenceStepRun.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: now },
        },
        include: {
          enrollment: {
            include: {
              sequence: true,
            },
          },
          step: true,
        },
        take: 100, // Process in batches
      });

      if (dueSteps.length === 0) {
        return;
      }

      this.logger.info({ count: dueSteps.length }, 'Processing scheduled steps');

      for (const stepRun of dueSteps) {
        await this.executeStep(stepRun);
      }
    } catch (error) {
      this.logger.error({ error }, 'Error processing scheduled steps');
    }
  }

  /**
   * Execute a single step
   */
  async executeStep(stepRun) {
    const { id, enrollment, step } = stepRun;

    try {
      // Mark as running
      await prisma.sequenceStepRun.update({
        where: { id },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      // Check if enrollment is still active
      if (enrollment.status !== 'ACTIVE') {
        await this.skipStep(id, 'Enrollment not active');
        return;
      }

      // Execute based on step type
      let result;
      switch (step.stepType) {
        case 'WHATSAPP':
          result = await this.executeWhatsAppStep(enrollment, step);
          break;
        case 'SMS':
          result = await this.executeSMSStep(enrollment, step);
          break;
        case 'EMAIL':
          result = await this.executeEmailStep(enrollment, step);
          break;
        case 'CALL':
          result = await this.executeCallStep(enrollment, step);
          break;
        case 'TASK':
          result = await this.executeTaskStep(enrollment, step);
          break;
        case 'WAIT':
          result = { success: true };
          break;
        case 'CONDITION':
          result = await this.evaluateCondition(enrollment, step);
          break;
        default:
          throw new Error(`Unknown step type: ${step.stepType}`);
      }

      // Mark as completed
      await prisma.sequenceStepRun.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          result,
        },
      });

      // Move to next step
      await this.advanceToNextStep(enrollment);

    } catch (error) {
      this.logger.error({ error, stepRunId: id }, 'Error executing step');

      // Retry logic
      if (stepRun.retryCount < 3) {
        const nextRetry = new Date(Date.now() + 5 * 60 * 1000); // Retry in 5 minutes
        await prisma.sequenceStepRun.update({
          where: { id },
          data: {
            status: 'SCHEDULED',
            retryCount: stepRun.retryCount + 1,
            nextRetryAt: nextRetry,
            scheduledAt: nextRetry,
            error: error.message,
          },
        });
      } else {
        // Mark as failed after max retries
        await prisma.sequenceStepRun.update({
          where: { id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            error: error.message,
          },
        });

        // Exit enrollment on failure
        await this.exitEnrollmentOnFailure(enrollment, step, error);
      }
    }
  }

  /**
   * Execute WhatsApp step
   */
  async executeWhatsAppStep(enrollment, step) {
    const contact = await this.getEnrollmentContact(enrollment);
    if (!contact?.phone) {
      throw new Error('Contact has no phone number');
    }

    // Get default WhatsApp channel account
    const channelAccount = await prisma.channelAccount.findFirst({
      where: {
        tenantId: enrollment.tenantId,
        channelType: 'WHATSAPP',
        isEnabled: true,
      },
    });

    if (!channelAccount) {
      throw new Error('No active WhatsApp channel configured');
    }

    // Send template message
    if (step.templateId) {
      const result = await channelsService.sendTemplate({
        channelAccountId: channelAccount.id,
        to: contact.phone,
        templateId: step.templateId,
        variables: this.buildTemplateVariables(contact, enrollment),
      });
      return { messageId: result.messageId };
    }

    // Send regular message
    const result = await channelsService.sendMessage({
      channelAccountId: channelAccount.id,
      to: contact.phone,
      content: this.interpolateContent(step.content, contact, enrollment),
      contentType: 'text',
    });

    return { messageId: result.messageId };
  }

  /**
   * Execute SMS step
   */
  async executeSMSStep(enrollment, step) {
    const contact = await this.getEnrollmentContact(enrollment);
    if (!contact?.phone) {
      throw new Error('Contact has no phone number');
    }

    const channelAccount = await prisma.channelAccount.findFirst({
      where: {
        tenantId: enrollment.tenantId,
        channelType: 'SMS',
        isEnabled: true,
      },
    });

    if (!channelAccount) {
      throw new Error('No active SMS channel configured');
    }

    const result = await channelsService.sendTemplate({
      channelAccountId: channelAccount.id,
      to: contact.phone,
      templateId: step.templateId,
      variables: this.buildTemplateVariables(contact, enrollment),
    });

    return { messageId: result.messageId };
  }

  /**
   * Execute Email step
   */
  async executeEmailStep(enrollment, step) {
    const contact = await this.getEnrollmentContact(enrollment);
    if (!contact?.email) {
      throw new Error('Contact has no email address');
    }

    const channelAccount = await prisma.channelAccount.findFirst({
      where: {
        tenantId: enrollment.tenantId,
        channelType: 'EMAIL',
        isEnabled: true,
      },
    });

    if (!channelAccount) {
      throw new Error('No active Email channel configured');
    }

    // For A/B testing, select a variant
    let subject = step.subject;
    let content = step.content;

    if (step.isABTest && step.variants?.length > 0) {
      const variant = this.selectVariant(step.variants);
      subject = variant.subject || subject;
      content = variant.content || content;
    }

    const result = await channelsService.sendMessage({
      channelAccountId: channelAccount.id,
      to: contact.email,
      subject: this.interpolateContent(subject, contact, enrollment),
      content: this.interpolateContent(content, contact, enrollment),
      contentType: 'html',
    });

    return { messageId: result.messageId };
  }

  /**
   * Execute Call step (create task for agent)
   */
  async executeCallStep(enrollment, step) {
    const contact = await this.getEnrollmentContact(enrollment);

    // Create a task for the agent to make the call
    const task = await prisma.task.create({
      data: {
        tenantId: enrollment.tenantId,
        title: step.taskTitle || `Call ${contact.name || contact.phone}`,
        description: step.taskNotes || `Sequence call task for ${enrollment.sequence.name}`,
        type: 'CALL',
        status: 'PENDING',
        dueAt: new Date(),
        contactId: enrollment.contactId,
        leadId: enrollment.leadId,
        dealId: enrollment.dealId,
        metadata: {
          sequenceId: enrollment.sequenceId,
          enrollmentId: enrollment.id,
          stepId: step.id,
        },
      },
    });

    return { taskId: task.id };
  }

  /**
   * Execute Task step
   */
  async executeTaskStep(enrollment, step) {
    const contact = await this.getEnrollmentContact(enrollment);

    const task = await prisma.task.create({
      data: {
        tenantId: enrollment.tenantId,
        title: step.taskTitle || `Follow-up with ${contact.name || 'contact'}`,
        description: step.taskNotes,
        type: 'FOLLOW_UP',
        status: 'PENDING',
        dueAt: new Date(),
        contactId: enrollment.contactId,
        leadId: enrollment.leadId,
        dealId: enrollment.dealId,
        metadata: {
          sequenceId: enrollment.sequenceId,
          enrollmentId: enrollment.id,
          stepId: step.id,
        },
      },
    });

    return { taskId: task.id };
  }

  /**
   * Evaluate condition step
   */
  async evaluateCondition(enrollment, step) {
    // TODO: Implement condition evaluation logic
    // For now, always continue
    return { passed: true };
  }

  /**
   * Skip a step
   */
  async skipStep(stepRunId, reason) {
    await prisma.sequenceStepRun.update({
      where: { id: stepRunId },
      data: {
        status: 'SKIPPED',
        completedAt: new Date(),
        error: reason,
      },
    });
  }

  /**
   * Advance enrollment to next step
   */
  async advanceToNextStep(enrollment) {
    const sequence = await prisma.sequence.findUnique({
      where: { id: enrollment.sequenceId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    const currentStepIndex = sequence.steps.findIndex(
      (s) => s.order === enrollment.currentStep
    );
    const nextStep = sequence.steps[currentStepIndex + 1];

    if (!nextStep) {
      // Sequence completed
      await prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          stepsCompleted: enrollment.currentStep,
        },
      });

      this.logger.info({ enrollmentId: enrollment.id }, 'Sequence completed');
      return;
    }

    // Calculate next step timing
    const nextStepAt = this.calculateNextStepTime(nextStep, new Date(), sequence);

    // Update enrollment
    await prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: {
        currentStep: nextStep.order,
        lastStepAt: new Date(),
        nextStepAt,
        stepsCompleted: enrollment.currentStep,
      },
    });

    // Create next step run
    await prisma.sequenceStepRun.create({
      data: {
        tenantId: enrollment.tenantId,
        enrollmentId: enrollment.id,
        stepId: nextStep.id,
        status: 'SCHEDULED',
        scheduledAt: nextStepAt,
      },
    });
  }

  /**
   * Exit enrollment on failure
   */
  async exitEnrollmentOnFailure(enrollment, step, error) {
    await prisma.sequenceEnrollment.update({
      where: { id: enrollment.id },
      data: {
        status: 'EXITED',
        exitedAt: new Date(),
        exitReason: `Step ${step.order} failed: ${error.message}`,
      },
    });
  }

  /**
   * Get contact/lead/deal for enrollment
   */
  async getEnrollmentContact(enrollment) {
    if (enrollment.contactId) {
      return prisma.contact.findUnique({ where: { id: enrollment.contactId } });
    }
    if (enrollment.leadId) {
      return prisma.lead.findUnique({ where: { id: enrollment.leadId } });
    }
    if (enrollment.dealId) {
      const deal = await prisma.deal.findUnique({
        where: { id: enrollment.dealId },
        include: { contact: true },
      });
      return deal?.contact;
    }
    return null;
  }

  /**
   * Build template variables from contact data
   */
  buildTemplateVariables(contact, enrollment) {
    return {
      name: contact.name || contact.firstName || '',
      firstName: contact.firstName || contact.name?.split(' ')[0] || '',
      lastName: contact.lastName || '',
      email: contact.email || '',
      phone: contact.phone || '',
      company: contact.company || '',
    };
  }

  /**
   * Interpolate content with contact/enrollment data
   */
  interpolateContent(content, contact, enrollment) {
    if (!content) return content;

    const variables = this.buildTemplateVariables(contact, enrollment);

    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  /**
   * Select A/B test variant based on weights
   */
  selectVariant(variants) {
    const totalWeight = variants.reduce((sum, v) => sum + (v.weight || 1), 0);
    let random = Math.random() * totalWeight;

    for (const variant of variants) {
      random -= variant.weight || 1;
      if (random <= 0) {
        return variant;
      }
    }

    return variants[0];
  }

  /**
   * Calculate next step time
   */
  calculateNextStepTime(step, fromTime, sequence) {
    const delayMs =
      (step.delayDays * 24 * 60 * 60 +
        step.delayHours * 60 * 60 +
        step.delayMinutes * 60) *
      1000;

    let nextTime = new Date(fromTime.getTime() + delayMs);

    if (sequence.businessHoursOnly && sequence.workingHours) {
      nextTime = this.adjustToBusinessHours(nextTime, sequence.workingHours);
    }

    return nextTime;
  }

  /**
   * Adjust time to business hours
   */
  adjustToBusinessHours(date, workingHours) {
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayName = dayNames[date.getDay()];
    const hours = workingHours[dayName];

    if (!hours) {
      date.setDate(date.getDate() + 1);
      date.setHours(9, 0, 0, 0);
      return this.adjustToBusinessHours(date, workingHours);
    }

    const [startHour, startMin] = hours.start.split(':').map(Number);
    const [endHour, endMin] = hours.end.split(':').map(Number);

    const currentMinutes = date.getHours() * 60 + date.getMinutes();
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (currentMinutes < startMinutes) {
      date.setHours(startHour, startMin, 0, 0);
    } else if (currentMinutes >= endMinutes) {
      date.setDate(date.getDate() + 1);
      date.setHours(startHour, startMin, 0, 0);
      return this.adjustToBusinessHours(date, workingHours);
    }

    return date;
  }

  /**
   * Handle reply - pause enrollment if configured
   */
  async handleReply(tenantId, contactId, channelType) {
    // Find active enrollments for this contact that have pauseOnReply enabled
    const enrollments = await prisma.sequenceEnrollment.findMany({
      where: {
        tenantId,
        contactId,
        status: 'ACTIVE',
        sequence: { pauseOnReply: true },
      },
      include: { sequence: true },
    });

    for (const enrollment of enrollments) {
      this.logger.info(
        { enrollmentId: enrollment.id },
        'Pausing enrollment due to reply'
      );

      await prisma.sequenceEnrollment.update({
        where: { id: enrollment.id },
        data: {
          status: 'PAUSED',
          pausedAt: new Date(),
        },
      });

      // Cancel pending step runs
      await prisma.sequenceStepRun.updateMany({
        where: { enrollmentId: enrollment.id, status: { in: ['PENDING', 'SCHEDULED'] } },
        data: { status: 'CANCELLED' },
      });
    }

    return enrollments.length;
  }
}

export const sequenceExecutor = new SequenceExecutor();
