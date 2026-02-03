import { prisma } from '@crm360/database';
import { eventBus, createEvent, EventTypes } from '../../common/events/event-bus.js';

/**
 * Lifecycle Stage Order (for forward-only progression)
 */
const LIFECYCLE_ORDER = [
  'SUBSCRIBER',
  'LEAD',
  'MQL',
  'SQL',
  'OPPORTUNITY',
  'CUSTOMER',
  'EVANGELIST',
];

/**
 * Lead Status Transitions
 */
const VALID_STATUS_TRANSITIONS = {
  NEW: ['OPEN', 'UNQUALIFIED'],
  OPEN: ['IN_PROGRESS', 'ATTEMPTED_TO_CONTACT', 'UNQUALIFIED'],
  IN_PROGRESS: ['CONNECTED', 'ATTEMPTED_TO_CONTACT', 'BAD_TIMING', 'UNQUALIFIED'],
  ATTEMPTED_TO_CONTACT: ['CONNECTED', 'IN_PROGRESS', 'BAD_TIMING', 'UNQUALIFIED'],
  CONNECTED: ['OPEN_DEAL', 'BAD_TIMING', 'UNQUALIFIED'],
  BAD_TIMING: ['OPEN', 'IN_PROGRESS', 'UNQUALIFIED'],
  OPEN_DEAL: ['UNQUALIFIED'], // Usually stays until deal closes
  UNQUALIFIED: ['OPEN'], // Can be re-opened
};

class AutomationService {
  /**
   * Handle contact creation - set initial lifecycle and status
   */
  async onContactCreated(contact, source = 'MANUAL') {
    const updates = {};

    // Set initial lifecycle stage based on source
    if (!contact.lifecycleStage) {
      switch (source) {
        case 'FORM_SUBMISSION':
        case 'DEMO_REQUEST':
          updates.lifecycleStage = 'LEAD';
          updates.becameLeadAt = new Date();
          break;
        case 'NEWSLETTER':
        case 'BLOG_SUBSCRIPTION':
          updates.lifecycleStage = 'SUBSCRIBER';
          break;
        case 'IMPORT':
        case 'MANUAL':
        default:
          updates.lifecycleStage = 'SUBSCRIBER';
          break;
      }
    }

    // Set initial lead status
    if (!contact.leadStatus) {
      updates.leadStatus = 'NEW';
    }

    if (Object.keys(updates).length > 0) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: updates,
      });
    }

    return updates;
  }

  /**
   * Handle owner assignment - update lead status to OPEN
   */
  async onOwnerAssigned(contactId, ownerId) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { leadStatus: true, tenantId: true },
    });

    if (contact?.leadStatus === 'NEW') {
      await prisma.contact.update({
        where: { id: contactId },
        data: { leadStatus: 'OPEN' },
      });

      eventBus.publish(
        createEvent(EventTypes.LEAD_STATUS_CHANGED, contact.tenantId, {
          contactId,
          previousStatus: 'NEW',
          newStatus: 'OPEN',
          trigger: 'OWNER_ASSIGNED',
        })
      );

      return { statusChanged: true, from: 'NEW', to: 'OPEN' };
    }

    return { statusChanged: false };
  }

  /**
   * Handle first outreach - update lead status to IN_PROGRESS
   */
  async onFirstOutreach(contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { leadStatus: true, firstOutreachDate: true, tenantId: true },
    });

    if (contact && ['NEW', 'OPEN'].includes(contact.leadStatus)) {
      const updates = {
        leadStatus: 'IN_PROGRESS',
      };

      if (!contact.firstOutreachDate) {
        updates.firstOutreachDate = new Date();
      }

      await prisma.contact.update({
        where: { id: contactId },
        data: updates,
      });

      eventBus.publish(
        createEvent(EventTypes.LEAD_STATUS_CHANGED, contact.tenantId, {
          contactId,
          previousStatus: contact.leadStatus,
          newStatus: 'IN_PROGRESS',
          trigger: 'FIRST_OUTREACH',
        })
      );

      return { statusChanged: true, from: contact.leadStatus, to: 'IN_PROGRESS' };
    }

    return { statusChanged: false };
  }

  /**
   * Handle contact reply/response - update to CONNECTED
   */
  async onContactResponded(contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { leadStatus: true, tenantId: true },
    });

    if (contact && ['IN_PROGRESS', 'ATTEMPTED_TO_CONTACT'].includes(contact.leadStatus)) {
      await prisma.contact.update({
        where: { id: contactId },
        data: { leadStatus: 'CONNECTED' },
      });

      eventBus.publish(
        createEvent(EventTypes.LEAD_STATUS_CHANGED, contact.tenantId, {
          contactId,
          previousStatus: contact.leadStatus,
          newStatus: 'CONNECTED',
          trigger: 'CONTACT_RESPONDED',
        })
      );

      return { statusChanged: true, from: contact.leadStatus, to: 'CONNECTED' };
    }

    return { statusChanged: false };
  }

  /**
   * Handle deal creation - update lifecycle to OPPORTUNITY and status to OPEN_DEAL
   */
  async onDealCreated(contactId, dealId) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { lifecycleStage: true, leadStatus: true, tenantId: true, becameOpportunityAt: true },
    });

    if (!contact) return { lifecycleChanged: false, statusChanged: false };

    const updates = {};
    const events = [];

    // Update lifecycle to OPPORTUNITY (forward only)
    const currentIndex = LIFECYCLE_ORDER.indexOf(contact.lifecycleStage);
    const opportunityIndex = LIFECYCLE_ORDER.indexOf('OPPORTUNITY');

    if (currentIndex < opportunityIndex) {
      updates.lifecycleStage = 'OPPORTUNITY';
      if (!contact.becameOpportunityAt) {
        updates.becameOpportunityAt = new Date();
      }

      events.push(
        createEvent(EventTypes.CONTACT_LIFECYCLE_CHANGED, contact.tenantId, {
          contactId,
          previousStage: contact.lifecycleStage,
          newStage: 'OPPORTUNITY',
          trigger: 'DEAL_CREATED',
          dealId,
        })
      );
    }

    // Update lead status to OPEN_DEAL
    if (contact.leadStatus !== 'OPEN_DEAL') {
      updates.leadStatus = 'OPEN_DEAL';

      events.push(
        createEvent(EventTypes.LEAD_STATUS_CHANGED, contact.tenantId, {
          contactId,
          previousStatus: contact.leadStatus,
          newStatus: 'OPEN_DEAL',
          trigger: 'DEAL_CREATED',
          dealId,
        })
      );
    }

    if (Object.keys(updates).length > 0) {
      await prisma.contact.update({
        where: { id: contactId },
        data: updates,
      });

      events.forEach(event => eventBus.publish(event));
    }

    return {
      lifecycleChanged: updates.lifecycleStage !== undefined,
      statusChanged: updates.leadStatus !== undefined,
    };
  }

  /**
   * Handle deal won - update lifecycle to CUSTOMER
   */
  async onDealWon(contactId, dealId) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { lifecycleStage: true, tenantId: true, becameCustomerAt: true },
    });

    if (!contact) return { changed: false };

    const currentIndex = LIFECYCLE_ORDER.indexOf(contact.lifecycleStage);
    const customerIndex = LIFECYCLE_ORDER.indexOf('CUSTOMER');

    if (currentIndex < customerIndex) {
      const updates = {
        lifecycleStage: 'CUSTOMER',
        isQualified: true,
        qualifiedDate: new Date(),
      };

      if (!contact.becameCustomerAt) {
        updates.becameCustomerAt = new Date();
      }

      await prisma.contact.update({
        where: { id: contactId },
        data: updates,
      });

      eventBus.publish(
        createEvent(EventTypes.CONTACT_LIFECYCLE_CHANGED, contact.tenantId, {
          contactId,
          previousStage: contact.lifecycleStage,
          newStage: 'CUSTOMER',
          trigger: 'DEAL_WON',
          dealId,
        })
      );

      return { changed: true, from: contact.lifecycleStage, to: 'CUSTOMER' };
    }

    return { changed: false };
  }

  /**
   * Handle multiple failed contact attempts
   */
  async onContactAttemptFailed(contactId, attemptCount) {
    if (attemptCount < 3) return { statusChanged: false };

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { leadStatus: true, tenantId: true },
    });

    if (contact?.leadStatus === 'IN_PROGRESS') {
      await prisma.contact.update({
        where: { id: contactId },
        data: { leadStatus: 'ATTEMPTED_TO_CONTACT' },
      });

      eventBus.publish(
        createEvent(EventTypes.LEAD_STATUS_CHANGED, contact.tenantId, {
          contactId,
          previousStatus: 'IN_PROGRESS',
          newStatus: 'ATTEMPTED_TO_CONTACT',
          trigger: 'MULTIPLE_FAILED_ATTEMPTS',
          attemptCount,
        })
      );

      return { statusChanged: true, from: 'IN_PROGRESS', to: 'ATTEMPTED_TO_CONTACT' };
    }

    return { statusChanged: false };
  }

  /**
   * Mark contact as qualified (manual SQL)
   */
  async qualifyContact(contactId, userId, notes) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { lifecycleStage: true, tenantId: true, becameSqlAt: true },
    });

    if (!contact) throw new Error('Contact not found');

    const currentIndex = LIFECYCLE_ORDER.indexOf(contact.lifecycleStage);
    const sqlIndex = LIFECYCLE_ORDER.indexOf('SQL');

    // Can only qualify if currently at MQL or lower
    if (currentIndex > sqlIndex) {
      return { changed: false, reason: 'Already past SQL stage' };
    }

    const updates = {
      lifecycleStage: 'SQL',
      isQualified: true,
      qualifiedDate: new Date(),
    };

    if (!contact.becameSqlAt) {
      updates.becameSqlAt = new Date();
    }

    await prisma.contact.update({
      where: { id: contactId },
      data: updates,
    });

    eventBus.publish(
      createEvent(EventTypes.CONTACT_LIFECYCLE_CHANGED, contact.tenantId, {
        contactId,
        previousStage: contact.lifecycleStage,
        newStage: 'SQL',
        trigger: 'MANUAL_QUALIFICATION',
        qualifiedBy: userId,
        notes,
      })
    );

    return { changed: true, from: contact.lifecycleStage, to: 'SQL' };
  }

  /**
   * Disqualify contact
   */
  async disqualifyContact(contactId, userId, reason) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { leadStatus: true, tenantId: true },
    });

    if (!contact) throw new Error('Contact not found');

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        leadStatus: 'UNQUALIFIED',
        isQualified: false,
        disqualificationReason: reason,
      },
    });

    eventBus.publish(
      createEvent(EventTypes.LEAD_STATUS_CHANGED, contact.tenantId, {
        contactId,
        previousStatus: contact.leadStatus,
        newStatus: 'UNQUALIFIED',
        trigger: 'MANUAL_DISQUALIFICATION',
        disqualifiedBy: userId,
        reason,
      })
    );

    return { changed: true, from: contact.leadStatus, to: 'UNQUALIFIED' };
  }

  /**
   * Set follow-up reminder
   */
  async setFollowUp(contactId, followUpDate, nextActivityType) {
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        followUpDate: new Date(followUpDate),
        nextActivityType,
        nextActivityDate: new Date(followUpDate),
      },
    });

    return { success: true };
  }

  /**
   * Check if lifecycle can move forward
   */
  canProgressLifecycle(currentStage, targetStage) {
    const currentIndex = LIFECYCLE_ORDER.indexOf(currentStage);
    const targetIndex = LIFECYCLE_ORDER.indexOf(targetStage);

    return targetIndex > currentIndex;
  }

  /**
   * Check if lead status transition is valid
   */
  isValidStatusTransition(currentStatus, targetStatus) {
    const validTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    return validTransitions.includes(targetStatus);
  }

  /**
   * Get next valid statuses for current status
   */
  getValidNextStatuses(currentStatus) {
    return VALID_STATUS_TRANSITIONS[currentStatus] || [];
  }
}

export const automationService = new AutomationService();
