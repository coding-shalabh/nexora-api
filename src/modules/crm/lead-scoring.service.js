import { prisma } from '@crm360/database';
import { eventBus, createEvent, EventTypes } from '../../common/events/event-bus.js';

/**
 * Default Lead Scoring Configuration
 * Based on HubSpot/Salesforce best practices
 * Users can customize these values per tenant
 */
const DEFAULT_SCORING_CONFIG = {
  // Engagement Scores (Activity-based)
  engagement: {
    EMAIL_SENT: 0,
    EMAIL_OPENED: 2,
    EMAIL_CLICKED: 5,
    EMAIL_REPLIED: 10,
    FORM_SUBMITTED: 15,
    MEETING_BOOKED: 10,
    MEETING_COMPLETED: 20,
    CALL_STARTED: 15,
    CALL_COMPLETED: 20,
    DEMO_REQUESTED: 25,
    PRICING_PAGE_VIEWED: 10,
    WEBINAR_ATTENDED: 15,
    CONTENT_DOWNLOADED: 8,
    CTA_CLICKED: 6,
    NOTE_ADDED: 0,
    TASK_CREATED: 0,
  },

  // Fit Scores (Demographic/Firmographic)
  fit: {
    // Company size scoring
    companySize: {
      '1-10': -10,
      '11-50': 5,
      '51-200': 15,
      '201-1000': 20,
      '1001+': 25,
    },
    // Job title scoring
    jobTitle: {
      ceo: 25,
      cto: 25,
      cfo: 25,
      coo: 25,
      vp: 20,
      director: 18,
      manager: 12,
      lead: 10,
      senior: 8,
      default: 5,
    },
    // Has email (not personal domain)
    businessEmail: 10,
    personalEmail: -15,
    // Has phone
    hasPhone: 5,
  },

  // Thresholds - CONFIGURABLE BY USER
  thresholds: {
    MQL: 50,      // Marketing Qualified Lead - auto-upgrade threshold
    SQL: 75,      // Sales Qualified Lead (manual qualification)
    HOT: 75,      // Hot rating threshold
    WARM_MIN: 25, // Warm rating minimum
  },

  // Score limits
  limits: {
    maxEngagement: 100,
    maxFit: 50,
    maxTotal: 100,
  },

  // Decay settings (points to subtract per day after X days)
  decay: {
    EMAIL_OPENED: { afterDays: 30, perDay: 0.1 },
    EMAIL_CLICKED: { afterDays: 30, perDay: 0.15 },
    FORM_SUBMITTED: { afterDays: 60, perDay: 0.2 },
    MEETING_BOOKED: { afterDays: 90, perDay: 0.15 },
    MEETING_COMPLETED: { afterDays: 90, perDay: 0.2 },
    CALL_COMPLETED: { afterDays: 90, perDay: 0.2 },
    PRICING_PAGE_VIEWED: { afterDays: 14, perDay: 0.5 },
  },

  // Personal email domains to penalize
  personalDomains: ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'mail.com'],
};

class LeadScoringService {
  /**
   * Get scoring configuration for a tenant
   * Merges tenant-specific config with defaults
   */
  async getConfig(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const tenantConfig = tenant?.settings?.leadScoring || {};

    // Deep merge tenant config with defaults
    return this.mergeConfig(DEFAULT_SCORING_CONFIG, tenantConfig);
  }

  /**
   * Update scoring configuration for a tenant
   */
  async updateConfig(tenantId, configUpdates) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const currentSettings = tenant?.settings || {};
    const currentLeadScoring = currentSettings.leadScoring || {};

    // Merge the updates with current config
    const updatedLeadScoring = this.mergeConfig(currentLeadScoring, configUpdates);

    // Update tenant settings
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: {
          ...currentSettings,
          leadScoring: updatedLeadScoring,
        },
      },
    });

    return this.mergeConfig(DEFAULT_SCORING_CONFIG, updatedLeadScoring);
  }

  /**
   * Reset scoring configuration to defaults for a tenant
   */
  async resetConfig(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const currentSettings = tenant?.settings || {};
    delete currentSettings.leadScoring;

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: currentSettings },
    });

    return DEFAULT_SCORING_CONFIG;
  }

  /**
   * Deep merge two config objects
   */
  mergeConfig(base, override) {
    const result = JSON.parse(JSON.stringify(base));

    for (const key in override) {
      if (override[key] !== null && typeof override[key] === 'object' && !Array.isArray(override[key])) {
        result[key] = this.mergeConfig(result[key] || {}, override[key]);
      } else {
        result[key] = override[key];
      }
    }

    return result;
  }

  /**
   * Calculate complete lead score for a contact
   */
  async calculateScore(contactId) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
        company: true,
      },
    });

    if (!contact) {
      throw new Error('Contact not found');
    }

    // Get tenant-specific config
    const config = await this.getConfig(contact.tenantId);

    // Calculate engagement score from activities
    const engagementScore = this.calculateEngagementScore(contact.activities, config);

    // Calculate fit score from contact properties
    const fitScore = this.calculateFitScore(contact, config);

    // Combined score (capped at max)
    const totalScore = Math.min(
      engagementScore + fitScore,
      config.limits.maxTotal
    );

    // Determine rating based on score
    const rating = this.determineRating(totalScore, config);

    // Update contact with new score
    const updatedContact = await prisma.contact.update({
      where: { id: contactId },
      data: {
        leadScore: totalScore,
        leadScoreUpdatedAt: new Date(),
        rating: rating,
      },
    });

    // Check if lifecycle stage should change
    await this.checkLifecycleTransition(updatedContact, config);

    return {
      contactId,
      engagementScore,
      fitScore,
      totalScore,
      rating,
      breakdown: {
        engagement: this.getEngagementBreakdown(contact.activities, config),
        fit: this.getFitBreakdown(contact, config),
      },
    };
  }

  /**
   * Calculate engagement score from activities
   * Uses activitySubtype from metadata if available (granular types like EMAIL_OPENED)
   */
  calculateEngagementScore(activities, config) {
    let score = 0;
    const now = new Date();

    for (const activity of activities) {
      // Use granular subtype from metadata if available, otherwise fall back to base type
      const activityType = activity.metadata?.activitySubtype || activity.type;
      const baseScore = config.engagement[activityType] || 0;

      if (baseScore > 0) {
        // Apply decay if applicable
        const decayConfig = config.decay[activityType];
        let activityScore = baseScore;

        if (decayConfig) {
          const daysSinceActivity = Math.floor(
            (now - new Date(activity.createdAt)) / (1000 * 60 * 60 * 24)
          );

          if (daysSinceActivity > decayConfig.afterDays) {
            const decayDays = daysSinceActivity - decayConfig.afterDays;
            const decayAmount = decayDays * decayConfig.perDay;
            activityScore = Math.max(0, baseScore - decayAmount);
          }
        }

        score += activityScore;
      }
    }

    return Math.min(score, config.limits.maxEngagement);
  }

  /**
   * Calculate fit score from contact properties
   */
  calculateFitScore(contact, config) {
    let score = 0;
    const personalDomains = config.personalDomains || DEFAULT_SCORING_CONFIG.personalDomains;

    // Email scoring
    if (contact.email) {
      const domain = contact.email.split('@')[1]?.toLowerCase();
      if (personalDomains.includes(domain)) {
        score += config.fit.personalEmail;
      } else {
        score += config.fit.businessEmail;
      }
    }

    // Phone scoring
    if (contact.phone || contact.mobilePhone) {
      score += config.fit.hasPhone;
    }

    // Job title scoring
    if (contact.jobTitle) {
      const title = contact.jobTitle.toLowerCase();
      let titleScore = config.fit.jobTitle.default;

      for (const [key, value] of Object.entries(config.fit.jobTitle)) {
        if (key !== 'default' && title.includes(key)) {
          titleScore = Math.max(titleScore, value);
        }
      }
      score += titleScore;
    }

    // Company size scoring (if company associated)
    if (contact.company?.employeeCount) {
      const size = contact.company.employeeCount;
      if (size <= 10) score += config.fit.companySize['1-10'];
      else if (size <= 50) score += config.fit.companySize['11-50'];
      else if (size <= 200) score += config.fit.companySize['51-200'];
      else if (size <= 1000) score += config.fit.companySize['201-1000'];
      else score += config.fit.companySize['1001+'];
    }

    return Math.min(Math.max(score, 0), config.limits.maxFit);
  }

  /**
   * Determine rating based on score
   */
  determineRating(score, config) {
    if (score >= config.thresholds.HOT) return 'HOT';
    if (score >= config.thresholds.WARM_MIN) return 'WARM';
    return 'COLD';
  }

  /**
   * Check and update lifecycle stage based on score
   */
  async checkLifecycleTransition(contact, config) {
    const score = contact.leadScore || 0;
    const currentStage = contact.lifecycleStage;

    // Define stage order for forward-only progression
    const stageOrder = ['SUBSCRIBER', 'LEAD', 'MQL', 'SQL', 'OPPORTUNITY', 'CUSTOMER', 'EVANGELIST'];
    const currentIndex = stageOrder.indexOf(currentStage) || 0;

    let newStage = null;
    let updates = {};

    // Check if should become MQL (using configurable threshold)
    if (score >= config.thresholds.MQL && currentIndex < stageOrder.indexOf('MQL')) {
      newStage = 'MQL';
      updates.becameMqlAt = new Date();
    }

    // Auto-set to LEAD if score > 0 and currently less than LEAD
    if (score > 0 && (!currentStage || currentIndex < stageOrder.indexOf('LEAD'))) {
      newStage = newStage || 'LEAD';
      if (!contact.becameLeadAt) {
        updates.becameLeadAt = new Date();
      }
    }

    if (newStage && newStage !== currentStage) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          lifecycleStage: newStage,
          ...updates,
        },
      });

      // Emit event
      eventBus.publish(
        createEvent(EventTypes.CONTACT_LIFECYCLE_CHANGED, contact.tenantId, {
          contactId: contact.id,
          previousStage: currentStage,
          newStage: newStage,
          triggerType: 'LEAD_SCORE',
          leadScore: score,
          mqlThreshold: config.thresholds.MQL,
        })
      );

      return { changed: true, from: currentStage, to: newStage };
    }

    return { changed: false };
  }

  /**
   * Get engagement score breakdown
   * Uses activitySubtype from metadata if available
   */
  getEngagementBreakdown(activities, config) {
    const breakdown = {};
    for (const activity of activities) {
      // Use granular subtype from metadata if available
      const type = activity.metadata?.activitySubtype || activity.type;
      if (!breakdown[type]) {
        breakdown[type] = { count: 0, score: config.engagement[type] || 0 };
      }
      breakdown[type].count++;
    }
    return breakdown;
  }

  /**
   * Get fit score breakdown
   */
  getFitBreakdown(contact, config) {
    const personalDomains = config.personalDomains || DEFAULT_SCORING_CONFIG.personalDomains;
    return {
      email: contact.email ? (personalDomains.includes(contact.email.split('@')[1]?.toLowerCase()) ? 'personal' : 'business') : 'none',
      hasPhone: !!(contact.phone || contact.mobilePhone),
      jobTitle: contact.jobTitle || 'none',
      companySize: contact.company?.employeeCount || 'unknown',
    };
  }

  /**
   * Add score for a specific activity (called when activity is logged)
   */
  async addActivityScore(contactId, activityType) {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: { tenantId: true },
    });

    if (!contact) return null;

    const config = await this.getConfig(contact.tenantId);
    const scoreToAdd = config.engagement[activityType] || 0;

    if (scoreToAdd > 0) {
      // Recalculate full score to ensure accuracy
      return this.calculateScore(contactId);
    }

    return null;
  }

  /**
   * Batch recalculate scores for multiple contacts
   */
  async recalculateAllScores(tenantId) {
    const contacts = await prisma.contact.findMany({
      where: { tenantId },
      select: { id: true },
    });

    const results = [];
    for (const contact of contacts) {
      try {
        const result = await this.calculateScore(contact.id);
        results.push({ contactId: contact.id, success: true, score: result.totalScore });
      } catch (error) {
        results.push({ contactId: contact.id, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get default scoring configuration (for reference)
   */
  getDefaultConfig() {
    return DEFAULT_SCORING_CONFIG;
  }
}

export const leadScoringService = new LeadScoringService();
