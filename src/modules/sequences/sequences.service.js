/**
 * Sequences Service
 * Business logic for sequence/cadence management and execution
 */

import { prisma } from '@crm360/database';
import { NotFoundError, ValidationError } from '@crm360/shared';
import { logger } from '../../common/logger.js';
import { eventBus, createEvent } from '../../common/events/event-bus.js';

class SequencesService {
  constructor() {
    this.logger = logger.child({ service: 'SequencesService' });
  }

  // =====================
  // Sequence CRUD
  // =====================

  async getSequences(tenantId, filters = {}) {
    const { isActive, targetType, search, page = 1, limit = 20 } = filters;

    const where = { tenantId };
    if (typeof isActive === 'boolean') where.isActive = isActive;
    if (targetType) where.targetType = targetType;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [sequences, total] = await Promise.all([
      prisma.sequence.findMany({
        where,
        include: {
          steps: {
            orderBy: { order: 'asc' },
            select: { id: true, order: true, stepType: true, channel: true },
          },
          _count: {
            select: {
              enrollments: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sequence.count({ where }),
    ]);

    // Get enrollment stats for each sequence
    const sequencesWithStats = await Promise.all(
      sequences.map(async (seq) => {
        const stats = await this.getSequenceStats(tenantId, seq.id);
        return {
          ...seq,
          enrollmentCount: seq._count.enrollments,
          stats,
        };
      })
    );

    return {
      sequences: sequencesWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getSequence(tenantId, id) {
    const sequence = await prisma.sequence.findFirst({
      where: { id, tenantId },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
        enrollments: {
          take: 10,
          orderBy: { enrolledAt: 'desc' },
          include: {
            stepRuns: {
              orderBy: { scheduledAt: 'desc' },
              take: 5,
            },
          },
        },
        _count: {
          select: {
            enrollments: true,
          },
        },
      },
    });

    if (!sequence) {
      throw new NotFoundError('Sequence not found');
    }

    const stats = await this.getSequenceStats(tenantId, id);
    return { ...sequence, stats };
  }

  async createSequence(tenantId, userId, data) {
    const {
      name,
      description,
      targetType = 'CONTACT',
      timezone = 'UTC',
      businessHoursOnly = true,
      workingHours,
      pauseOnReply = true,
      dailyCap,
      throttlePerHour,
      steps = [],
    } = data;

    // Validate unique name
    const existing = await prisma.sequence.findFirst({
      where: { tenantId, name },
    });

    if (existing) {
      throw new ValidationError('A sequence with this name already exists');
    }

    // Create sequence with steps
    const sequence = await prisma.sequence.create({
      data: {
        tenantId,
        name,
        description,
        targetType,
        timezone,
        businessHoursOnly,
        workingHours,
        pauseOnReply,
        dailyCap,
        throttlePerHour,
        createdById: userId,
        isActive: false,
        steps: {
          create: steps.map((step, index) => ({
            order: index + 1,
            stepType: step.stepType,
            channel: step.channel,
            delayDays: step.delayDays || 0,
            delayHours: step.delayHours || 0,
            delayMinutes: step.delayMinutes || 0,
            templateId: step.templateId,
            subject: step.subject,
            content: step.content,
            taskTitle: step.taskTitle,
            taskNotes: step.taskNotes,
            isABTest: step.isABTest || false,
            variants: step.variants,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    this.logger.info({ sequenceId: sequence.id }, 'Sequence created');
    return sequence;
  }

  async updateSequence(tenantId, id, data) {
    const sequence = await prisma.sequence.findFirst({
      where: { id, tenantId },
    });

    if (!sequence) {
      throw new NotFoundError('Sequence not found');
    }

    // If updating name, check uniqueness
    if (data.name && data.name !== sequence.name) {
      const existing = await prisma.sequence.findFirst({
        where: { tenantId, name: data.name, NOT: { id } },
      });
      if (existing) {
        throw new ValidationError('A sequence with this name already exists');
      }
    }

    const updated = await prisma.sequence.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        targetType: data.targetType,
        timezone: data.timezone,
        businessHoursOnly: data.businessHoursOnly,
        workingHours: data.workingHours,
        pauseOnReply: data.pauseOnReply,
        dailyCap: data.dailyCap,
        throttlePerHour: data.throttlePerHour,
      },
      include: {
        steps: {
          orderBy: { order: 'asc' },
        },
      },
    });

    return updated;
  }

  async deleteSequence(tenantId, id) {
    const sequence = await prisma.sequence.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!sequence) {
      throw new NotFoundError('Sequence not found');
    }

    // Check for active enrollments
    const activeEnrollments = await prisma.sequenceEnrollment.count({
      where: { sequenceId: id, status: 'ACTIVE' },
    });

    if (activeEnrollments > 0) {
      throw new ValidationError(
        `Cannot delete sequence with ${activeEnrollments} active enrollments. Pause or exit them first.`
      );
    }

    await prisma.sequence.delete({ where: { id } });
    this.logger.info({ sequenceId: id }, 'Sequence deleted');
  }

  async activateSequence(tenantId, id) {
    const sequence = await prisma.sequence.findFirst({
      where: { id, tenantId },
      include: { steps: true },
    });

    if (!sequence) {
      throw new NotFoundError('Sequence not found');
    }

    if (sequence.steps.length === 0) {
      throw new ValidationError('Cannot activate a sequence with no steps');
    }

    const updated = await prisma.sequence.update({
      where: { id },
      data: { isActive: true },
    });

    this.logger.info({ sequenceId: id }, 'Sequence activated');
    return updated;
  }

  async deactivateSequence(tenantId, id) {
    const sequence = await prisma.sequence.findFirst({
      where: { id, tenantId },
    });

    if (!sequence) {
      throw new NotFoundError('Sequence not found');
    }

    const updated = await prisma.sequence.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.info({ sequenceId: id }, 'Sequence deactivated');
    return updated;
  }

  // =====================
  // Step Management
  // =====================

  async addStep(tenantId, sequenceId, stepData) {
    const sequence = await prisma.sequence.findFirst({
      where: { id: sequenceId, tenantId },
      include: { steps: { orderBy: { order: 'desc' }, take: 1 } },
    });

    if (!sequence) {
      throw new NotFoundError('Sequence not found');
    }

    const maxOrder = sequence.steps[0]?.order || 0;

    const step = await prisma.sequenceStep.create({
      data: {
        sequenceId,
        order: maxOrder + 1,
        stepType: stepData.stepType,
        channel: stepData.channel,
        delayDays: stepData.delayDays || 0,
        delayHours: stepData.delayHours || 0,
        delayMinutes: stepData.delayMinutes || 0,
        templateId: stepData.templateId,
        subject: stepData.subject,
        content: stepData.content,
        taskTitle: stepData.taskTitle,
        taskNotes: stepData.taskNotes,
        isABTest: stepData.isABTest || false,
        variants: stepData.variants,
      },
    });

    return step;
  }

  async updateStep(tenantId, sequenceId, stepId, stepData) {
    const sequence = await prisma.sequence.findFirst({
      where: { id: sequenceId, tenantId },
    });

    if (!sequence) {
      throw new NotFoundError('Sequence not found');
    }

    const step = await prisma.sequenceStep.findFirst({
      where: { id: stepId, sequenceId },
    });

    if (!step) {
      throw new NotFoundError('Step not found');
    }

    const updated = await prisma.sequenceStep.update({
      where: { id: stepId },
      data: {
        stepType: stepData.stepType,
        channel: stepData.channel,
        delayDays: stepData.delayDays,
        delayHours: stepData.delayHours,
        delayMinutes: stepData.delayMinutes,
        templateId: stepData.templateId,
        subject: stepData.subject,
        content: stepData.content,
        taskTitle: stepData.taskTitle,
        taskNotes: stepData.taskNotes,
        isABTest: stepData.isABTest,
        variants: stepData.variants,
      },
    });

    return updated;
  }

  async deleteStep(tenantId, sequenceId, stepId) {
    const sequence = await prisma.sequence.findFirst({
      where: { id: sequenceId, tenantId },
    });

    if (!sequence) {
      throw new NotFoundError('Sequence not found');
    }

    const step = await prisma.sequenceStep.findFirst({
      where: { id: stepId, sequenceId },
    });

    if (!step) {
      throw new NotFoundError('Step not found');
    }

    await prisma.sequenceStep.delete({ where: { id: stepId } });

    // Reorder remaining steps
    const remainingSteps = await prisma.sequenceStep.findMany({
      where: { sequenceId },
      orderBy: { order: 'asc' },
    });

    await Promise.all(
      remainingSteps.map((s, index) =>
        prisma.sequenceStep.update({
          where: { id: s.id },
          data: { order: index + 1 },
        })
      )
    );
  }

  async reorderSteps(tenantId, sequenceId, stepOrder) {
    const sequence = await prisma.sequence.findFirst({
      where: { id: sequenceId, tenantId },
    });

    if (!sequence) {
      throw new NotFoundError('Sequence not found');
    }

    // stepOrder is an array of step IDs in the new order
    await Promise.all(
      stepOrder.map((stepId, index) =>
        prisma.sequenceStep.update({
          where: { id: stepId },
          data: { order: index + 1 },
        })
      )
    );

    return prisma.sequenceStep.findMany({
      where: { sequenceId },
      orderBy: { order: 'asc' },
    });
  }

  // =====================
  // Enrollment Management
  // =====================

  async enrollContact(tenantId, sequenceId, { contactId, leadId, dealId, source = 'manual', enrolledById }) {
    const sequence = await prisma.sequence.findFirst({
      where: { id: sequenceId, tenantId, isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    if (!sequence) {
      throw new NotFoundError('Sequence not found or not active');
    }

    if (sequence.steps.length === 0) {
      throw new ValidationError('Sequence has no steps');
    }

    // Check for existing enrollment
    const existingWhere = { sequenceId };
    if (contactId) existingWhere.contactId = contactId;
    if (leadId) existingWhere.leadId = leadId;
    if (dealId) existingWhere.dealId = dealId;

    const existing = await prisma.sequenceEnrollment.findFirst({
      where: { ...existingWhere, status: { in: ['ACTIVE', 'PAUSED'] } },
    });

    if (existing) {
      throw new ValidationError('Contact is already enrolled in this sequence');
    }

    // Check daily cap
    if (sequence.dailyCap) {
      const todayEnrollments = await prisma.sequenceEnrollment.count({
        where: {
          sequenceId,
          enrolledAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      });

      if (todayEnrollments >= sequence.dailyCap) {
        throw new ValidationError('Daily enrollment cap reached for this sequence');
      }
    }

    // Calculate first step timing
    const firstStep = sequence.steps[0];
    const nextStepAt = this.calculateNextStepTime(firstStep, new Date(), sequence);

    const enrollment = await prisma.sequenceEnrollment.create({
      data: {
        tenantId,
        sequenceId,
        contactId,
        leadId,
        dealId,
        status: 'ACTIVE',
        currentStep: 1,
        source,
        enrolledById,
        nextStepAt,
      },
    });

    // Create first step run
    await prisma.sequenceStepRun.create({
      data: {
        tenantId,
        enrollmentId: enrollment.id,
        stepId: firstStep.id,
        status: 'SCHEDULED',
        scheduledAt: nextStepAt,
      },
    });

    this.logger.info(
      { enrollmentId: enrollment.id, sequenceId, contactId },
      'Contact enrolled in sequence'
    );

    return enrollment;
  }

  async bulkEnroll(tenantId, sequenceId, { contactIds = [], leadIds = [], dealIds = [], source = 'bulk', enrolledById }) {
    const results = { enrolled: [], failed: [] };

    for (const contactId of contactIds) {
      try {
        const enrollment = await this.enrollContact(tenantId, sequenceId, {
          contactId,
          source,
          enrolledById,
        });
        results.enrolled.push({ contactId, enrollmentId: enrollment.id });
      } catch (error) {
        results.failed.push({ contactId, error: error.message });
      }
    }

    for (const leadId of leadIds) {
      try {
        const enrollment = await this.enrollContact(tenantId, sequenceId, {
          leadId,
          source,
          enrolledById,
        });
        results.enrolled.push({ leadId, enrollmentId: enrollment.id });
      } catch (error) {
        results.failed.push({ leadId, error: error.message });
      }
    }

    for (const dealId of dealIds) {
      try {
        const enrollment = await this.enrollContact(tenantId, sequenceId, {
          dealId,
          source,
          enrolledById,
        });
        results.enrolled.push({ dealId, enrollmentId: enrollment.id });
      } catch (error) {
        results.failed.push({ dealId, error: error.message });
      }
    }

    return results;
  }

  async pauseEnrollment(tenantId, enrollmentId) {
    const enrollment = await prisma.sequenceEnrollment.findFirst({
      where: { id: enrollmentId, tenantId, status: 'ACTIVE' },
    });

    if (!enrollment) {
      throw new NotFoundError('Active enrollment not found');
    }

    const updated = await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'PAUSED',
        pausedAt: new Date(),
      },
    });

    // Cancel pending step runs
    await prisma.sequenceStepRun.updateMany({
      where: { enrollmentId, status: { in: ['PENDING', 'SCHEDULED'] } },
      data: { status: 'CANCELLED' },
    });

    return updated;
  }

  async resumeEnrollment(tenantId, enrollmentId) {
    const enrollment = await prisma.sequenceEnrollment.findFirst({
      where: { id: enrollmentId, tenantId, status: 'PAUSED' },
      include: {
        sequence: {
          include: { steps: { orderBy: { order: 'asc' } } },
        },
      },
    });

    if (!enrollment) {
      throw new NotFoundError('Paused enrollment not found');
    }

    const currentStep = enrollment.sequence.steps.find(
      (s) => s.order === enrollment.currentStep
    );

    if (!currentStep) {
      throw new ValidationError('Current step not found');
    }

    const nextStepAt = this.calculateNextStepTime(
      currentStep,
      new Date(),
      enrollment.sequence
    );

    const updated = await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'ACTIVE',
        pausedAt: null,
        nextStepAt,
      },
    });

    // Reschedule the current step
    await prisma.sequenceStepRun.create({
      data: {
        tenantId,
        enrollmentId,
        stepId: currentStep.id,
        status: 'SCHEDULED',
        scheduledAt: nextStepAt,
      },
    });

    return updated;
  }

  async exitEnrollment(tenantId, enrollmentId, reason = 'manual') {
    const enrollment = await prisma.sequenceEnrollment.findFirst({
      where: { id: enrollmentId, tenantId, status: { in: ['ACTIVE', 'PAUSED'] } },
    });

    if (!enrollment) {
      throw new NotFoundError('Enrollment not found');
    }

    const updated = await prisma.sequenceEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'EXITED',
        exitedAt: new Date(),
        exitReason: reason,
      },
    });

    // Cancel pending step runs
    await prisma.sequenceStepRun.updateMany({
      where: { enrollmentId, status: { in: ['PENDING', 'SCHEDULED'] } },
      data: { status: 'CANCELLED' },
    });

    return updated;
  }

  async getEnrollments(tenantId, sequenceId, filters = {}) {
    const { status, page = 1, limit = 20 } = filters;

    const where = { tenantId, sequenceId };
    if (status) where.status = status;

    const [enrollments, total] = await Promise.all([
      prisma.sequenceEnrollment.findMany({
        where,
        include: {
          stepRuns: {
            orderBy: { scheduledAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { enrolledAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sequenceEnrollment.count({ where }),
    ]);

    return {
      enrollments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // =====================
  // Stats & Analytics
  // =====================

  async getSequenceStats(tenantId, sequenceId) {
    const [statusCounts, stepStats] = await Promise.all([
      prisma.sequenceEnrollment.groupBy({
        by: ['status'],
        where: { tenantId, sequenceId },
        _count: true,
      }),
      prisma.sequenceStepRun.groupBy({
        by: ['status'],
        where: { tenantId, enrollment: { sequenceId } },
        _count: true,
      }),
    ]);

    const enrollmentStats = {
      active: 0,
      paused: 0,
      completed: 0,
      exited: 0,
      bounced: 0,
      total: 0,
    };

    statusCounts.forEach((s) => {
      enrollmentStats[s.status.toLowerCase()] = s._count;
      enrollmentStats.total += s._count;
    });

    const stepRunStats = {
      pending: 0,
      scheduled: 0,
      running: 0,
      completed: 0,
      failed: 0,
      skipped: 0,
    };

    stepStats.forEach((s) => {
      stepRunStats[s.status.toLowerCase()] = s._count;
    });

    // Calculate conversion rate (completed / total enrollments)
    const conversionRate =
      enrollmentStats.total > 0
        ? ((enrollmentStats.completed / enrollmentStats.total) * 100).toFixed(1)
        : 0;

    return {
      enrollments: enrollmentStats,
      stepRuns: stepRunStats,
      conversionRate: parseFloat(conversionRate),
    };
  }

  // =====================
  // Helper Methods
  // =====================

  calculateNextStepTime(step, fromTime, sequence) {
    const delayMs =
      (step.delayDays * 24 * 60 * 60 +
        step.delayHours * 60 * 60 +
        step.delayMinutes * 60) *
      1000;

    let nextTime = new Date(fromTime.getTime() + delayMs);

    // Apply business hours if enabled
    if (sequence.businessHoursOnly && sequence.workingHours) {
      nextTime = this.adjustToBusinessHours(nextTime, sequence.workingHours, sequence.timezone);
    }

    return nextTime;
  }

  adjustToBusinessHours(date, workingHours, timezone) {
    // This is a simplified implementation
    // In production, use a proper timezone library like luxon
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayName = dayNames[date.getDay()];
    const hours = workingHours[dayName];

    if (!hours) {
      // Day not in working hours, move to next day
      date.setDate(date.getDate() + 1);
      date.setHours(9, 0, 0, 0);
      return this.adjustToBusinessHours(date, workingHours, timezone);
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
      return this.adjustToBusinessHours(date, workingHours, timezone);
    }

    return date;
  }
}

export const sequencesService = new SequencesService();
