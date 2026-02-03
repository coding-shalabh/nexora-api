import { prisma } from '@crm360/database';
import { eventBus, createEvent, EventTypes } from '../../common/events/event-bus.js';
import { leadScoringService } from './lead-scoring.service.js';

/**
 * Activity Types and their categories
 * Maps granular types to Prisma base types (EMAIL, CALL, MEETING, NOTE, TASK)
 */
const ACTIVITY_CATEGORIES = {
  // Email activities -> base type EMAIL
  EMAIL: { category: 'email', updatesContact: true, prismaType: 'EMAIL' },
  EMAIL_SENT: { category: 'email', updatesContact: true, prismaType: 'EMAIL' },
  EMAIL_OPENED: { category: 'email', updatesContact: true, prismaType: 'EMAIL' },
  EMAIL_CLICKED: { category: 'email', updatesContact: true, prismaType: 'EMAIL' },
  EMAIL_REPLIED: { category: 'email', updatesContact: true, prismaType: 'EMAIL' },
  EMAIL_BOUNCED: { category: 'email', updatesContact: true, prismaType: 'EMAIL' },

  // Call activities -> base type CALL
  CALL: { category: 'call', updatesContact: true, prismaType: 'CALL' },
  CALL_STARTED: { category: 'call', updatesContact: true, prismaType: 'CALL' },
  CALL_COMPLETED: { category: 'call', updatesContact: true, prismaType: 'CALL' },

  // Meeting activities -> base type MEETING
  MEETING: { category: 'meeting', updatesContact: true, prismaType: 'MEETING' },
  MEETING_BOOKED: { category: 'meeting', updatesContact: true, prismaType: 'MEETING' },
  MEETING_COMPLETED: { category: 'meeting', updatesContact: true, prismaType: 'MEETING' },

  // Form activities -> base type TASK (forms are tracked as tasks/conversions)
  FORM_SUBMITTED: { category: 'form', updatesContact: true, prismaType: 'TASK' },

  // Page activities -> base type NOTE (logging observations)
  PAGE_VIEWED: { category: 'web', updatesContact: false, prismaType: 'NOTE' },
  PRICING_PAGE_VIEWED: { category: 'web', updatesContact: true, prismaType: 'NOTE' },

  // Other
  NOTE: { category: 'note', updatesContact: false, prismaType: 'NOTE' },
  TASK: { category: 'task', updatesContact: false, prismaType: 'TASK' },
  DEMO_REQUESTED: { category: 'form', updatesContact: true, prismaType: 'TASK' },
  CONTENT_DOWNLOADED: { category: 'content', updatesContact: true, prismaType: 'TASK' },
  CTA_CLICKED: { category: 'web', updatesContact: true, prismaType: 'NOTE' },
  WEBINAR_ATTENDED: { category: 'event', updatesContact: true, prismaType: 'MEETING' },
};

/**
 * Get Prisma-compatible type from granular type
 */
function getPrismaType(granularType) {
  return ACTIVITY_CATEGORIES[granularType]?.prismaType || 'NOTE';
}

class ActivityTrackingService {
  /**
   * Log an activity and update related contact metrics
   */
  async logActivity(tenantId, userId, data) {
    const {
      type,
      contactId,
      companyId,
      dealId,
      subject,
      description,
      metadata = {},
      dueDate,
      completedAt,
    } = data;

    // Get Prisma-compatible type (EMAIL, CALL, MEETING, NOTE, TASK)
    const prismaType = getPrismaType(type);

    // Store the granular type in metadata for later filtering/reporting
    const enrichedMetadata = {
      ...metadata,
      activitySubtype: type, // Store the granular type (e.g., EMAIL_OPENED, MEETING_BOOKED)
    };

    // Create the activity record
    const activity = await prisma.activity.create({
      data: {
        tenantId,
        type: prismaType,
        subject: subject || this.generateSubject(type, metadata),
        description,
        contactId,
        companyId,
        dealId,
        assignedToId: userId,
        createdById: userId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        completedAt: completedAt ? new Date(completedAt) : undefined,
        metadata: enrichedMetadata,
      },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Update contact metrics if applicable
    if (contactId) {
      await this.updateContactMetrics(contactId, type);

      // Recalculate lead score
      const scoreResult = await leadScoringService.calculateScore(contactId);

      // Emit activity logged event
      eventBus.publish(
        createEvent(EventTypes.ACTIVITY_LOGGED, tenantId, {
          activityId: activity.id,
          contactId,
          type,
          scoreChange: scoreResult?.totalScore,
        }, { userId })
      );
    }

    return activity;
  }

  /**
   * Update contact metrics based on activity type
   */
  async updateContactMetrics(contactId, activityType) {
    const activityConfig = ACTIVITY_CATEGORIES[activityType];
    if (!activityConfig?.updatesContact) return;

    const updates = {
      lastActivityAt: new Date(),
    };

    // Category-specific updates
    switch (activityConfig.category) {
      case 'email':
        if (activityType === 'EMAIL_SENT') {
          updates.emailCount = { increment: 1 };
          updates.outreachCount = { increment: 1 };
          updates.lastContactedDate = new Date();
        } else if (['EMAIL_OPENED', 'EMAIL_CLICKED', 'EMAIL_REPLIED'].includes(activityType)) {
          updates.lastEngagementDate = new Date();
          updates.lastEngagementType = activityType;
        }
        break;

      case 'call':
        updates.callCount = { increment: 1 };
        updates.outreachCount = { increment: 1 };
        updates.lastContactedDate = new Date();
        if (activityType === 'CALL_COMPLETED') {
          updates.lastEngagementDate = new Date();
          updates.lastEngagementType = 'CALL';
        }
        break;

      case 'meeting':
        updates.meetingCount = { increment: 1 };
        if (activityType === 'MEETING_BOOKED') {
          updates.lastEngagementDate = new Date();
          updates.lastEngagementType = 'MEETING_BOOKED';
        } else if (activityType === 'MEETING_COMPLETED') {
          updates.lastEngagementDate = new Date();
          updates.lastEngagementType = 'MEETING';
          updates.lastContactedDate = new Date();
        }
        break;

      case 'form':
        updates.lastEngagementDate = new Date();
        updates.lastEngagementType = activityType;
        updates.numberOfConversions = { increment: 1 };
        if (!updates.firstConversionDate) {
          // Check if this is first conversion
          const contact = await prisma.contact.findUnique({
            where: { id: contactId },
            select: { firstConversionDate: true },
          });
          if (!contact?.firstConversionDate) {
            updates.firstConversionDate = new Date();
          }
        }
        updates.lastConversionDate = new Date();
        break;

      case 'web':
        updates.pageViews = { increment: 1 };
        // lastPageSeen is set in trackPageView with the URL, not here
        if (activityType === 'PRICING_PAGE_VIEWED') {
          updates.lastEngagementDate = new Date();
          updates.lastEngagementType = 'PRICING_VIEW';
        }
        break;

      case 'content':
      case 'event':
        updates.lastEngagementDate = new Date();
        updates.lastEngagementType = activityType;
        break;
    }

    // Set first outreach date if applicable
    if (['email', 'call'].includes(activityConfig.category)) {
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: { firstOutreachDate: true },
      });
      if (!contact?.firstOutreachDate) {
        updates.firstOutreachDate = new Date();
      }
    }

    // Mark as not unworked if any engagement
    if (activityConfig.category !== 'note' && activityConfig.category !== 'task') {
      updates.contactUnworked = false;
    }

    await prisma.contact.update({
      where: { id: contactId },
      data: updates,
    });
  }

  /**
   * Track email events (open, click, reply)
   */
  async trackEmailEvent(tenantId, userId, eventType, emailData) {
    const { contactId, emailId, subject, linkUrl } = emailData;

    const activityType = {
      open: 'EMAIL_OPENED',
      click: 'EMAIL_CLICKED',
      reply: 'EMAIL_REPLIED',
      bounce: 'EMAIL_BOUNCED',
    }[eventType];

    if (!activityType) return null;

    return this.logActivity(tenantId, userId, {
      type: activityType,
      contactId,
      subject: `Email ${eventType}: ${subject || 'No subject'}`,
      metadata: { emailId, linkUrl },
    });
  }

  /**
   * Log a form submission
   */
  async trackFormSubmission(tenantId, contactId, formData) {
    const { formName, formFields, source } = formData;

    // Check if this is a demo request
    const isDemoRequest = formName?.toLowerCase().includes('demo') ||
      formFields?.interest?.toLowerCase().includes('demo');

    const activityType = isDemoRequest ? 'DEMO_REQUESTED' : 'FORM_SUBMITTED';

    return this.logActivity(tenantId, null, {
      type: activityType,
      contactId,
      subject: `Form submitted: ${formName || 'Contact Form'}`,
      description: JSON.stringify(formFields, null, 2),
      metadata: { formName, source },
    });
  }

  /**
   * Log a meeting
   */
  async trackMeeting(tenantId, userId, meetingData) {
    const { contactId, title, startTime, endTime, isCompleted, notes } = meetingData;

    const activityType = isCompleted ? 'MEETING_COMPLETED' : 'MEETING_BOOKED';

    return this.logActivity(tenantId, userId, {
      type: activityType,
      contactId,
      subject: title || 'Meeting',
      description: notes,
      metadata: { startTime, endTime },
      completedAt: isCompleted ? new Date() : undefined,
    });
  }

  /**
   * Log a call
   */
  async trackCall(tenantId, userId, callData) {
    const { contactId, duration, outcome, notes, isCompleted } = callData;

    const activityType = isCompleted ? 'CALL_COMPLETED' : 'CALL_STARTED';

    return this.logActivity(tenantId, userId, {
      type: activityType,
      contactId,
      subject: `Call - ${outcome || 'In Progress'}`,
      description: notes,
      metadata: { duration, outcome },
      completedAt: isCompleted ? new Date() : undefined,
    });
  }

  /**
   * Track page view
   */
  async trackPageView(tenantId, contactId, pageData) {
    const { pageUrl, pageTitle } = pageData;

    const isPricingPage = pageUrl?.toLowerCase().includes('pricing') ||
      pageTitle?.toLowerCase().includes('pricing');

    const activityType = isPricingPage ? 'PRICING_PAGE_VIEWED' : 'PAGE_VIEWED';

    // Only log significant page views
    if (activityType === 'PRICING_PAGE_VIEWED') {
      // Update lastPageSeen with the URL before logging
      await prisma.contact.update({
        where: { id: contactId },
        data: { lastPageSeen: pageUrl || pageTitle },
      });

      return this.logActivity(tenantId, null, {
        type: activityType,
        contactId,
        subject: `Viewed: ${pageTitle || pageUrl}`,
        metadata: { pageUrl, pageTitle },
      });
    }

    // For regular page views, just update metrics without creating activity
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        pageViews: { increment: 1 },
        lastPageSeen: pageUrl,
        lastActivityAt: new Date(),
      },
    });

    return null;
  }

  /**
   * Generate activity subject based on type
   */
  generateSubject(type, metadata = {}) {
    const subjects = {
      EMAIL_SENT: 'Email sent',
      EMAIL_OPENED: 'Email opened',
      EMAIL_CLICKED: 'Email link clicked',
      EMAIL_REPLIED: 'Email reply received',
      EMAIL_BOUNCED: 'Email bounced',
      CALL: 'Call logged',
      CALL_STARTED: 'Call started',
      CALL_COMPLETED: 'Call completed',
      MEETING: 'Meeting',
      MEETING_BOOKED: 'Meeting scheduled',
      MEETING_COMPLETED: 'Meeting completed',
      FORM_SUBMITTED: 'Form submission',
      DEMO_REQUESTED: 'Demo requested',
      PRICING_PAGE_VIEWED: 'Viewed pricing page',
      CONTENT_DOWNLOADED: 'Content downloaded',
      CTA_CLICKED: 'CTA clicked',
      WEBINAR_ATTENDED: 'Attended webinar',
      NOTE: 'Note added',
      TASK: 'Task created',
    };

    return subjects[type] || type;
  }

  /**
   * Get activity timeline for a contact
   */
  async getContactTimeline(contactId, limit = 50) {
    const activities = await prisma.activity.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        assignedTo: { select: { firstName: true, lastName: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    return activities;
  }

  /**
   * Get engagement summary for a contact
   */
  async getEngagementSummary(contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        emailCount: true,
        callCount: true,
        meetingCount: true,
        outreachCount: true,
        pageViews: true,
        numberOfConversions: true,
        lastContactedDate: true,
        lastEngagementDate: true,
        lastEngagementType: true,
        firstOutreachDate: true,
        leadScore: true,
        rating: true,
      },
    });

    const recentActivities = await prisma.activity.groupBy({
      by: ['type'],
      where: {
        contactId,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
      _count: true,
    });

    return {
      totals: contact,
      last30Days: recentActivities.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {}),
    };
  }
}

export const activityTrackingService = new ActivityTrackingService();
