/**
 * Subscription Plan Limits Configuration
 *
 * Defines all usage limits and restrictions for each subscription tier
 */

export const PLAN_LIMITS = {
  free: {
    // Storage & Files
    storageGb: 1,
    maxFileUploadSizeMb: 5, // 5MB per file
    maxFilesPerUpload: 1,

    // Users & Access
    maxUsers: 1,
    maxConcurrentSessions: 1,

    // CRM Limits
    maxContacts: 100,
    maxCompanies: 20,
    maxDeals: 10,
    maxPipelines: 1,

    // Communication Limits (per day)
    maxEmailsPerDay: 50,
    maxSmsPerDay: 0, // Not included
    maxWhatsAppPerDay: 0, // Not included
    maxVoiceMinutesPerDay: 0, // Not included

    // Automation & Workflows
    maxAutomations: 0, // Not included
    maxSequences: 0, // Not included
    maxCampaigns: 1,

    // API & Rate Limiting
    apiRateLimit: {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
    },

    // Export Limits
    maxExportRowsPerRequest: 100,
    maxExportsPerDay: 5,

    // Feature Access
    features: {
      customFields: false,
      automation: false,
      whatsapp: false,
      voice: false,
      analytics: 'basic',
      support: 'community',
      customBranding: false,
      apiAccess: 'limited',
      webhooks: false,
      sso: false,
    },

    // Module Access
    modules: {
      crm: true,
      inbox: true,
      marketing: false,
      sales: false,
      automation: false,
      analytics: false,
      hr: false,
      finance: false,
      projects: false,
    },
  },

  starter: {
    // Storage & Files
    storageGb: 10,
    maxFileUploadSizeMb: 25, // 25MB per file
    maxFilesPerUpload: 5,

    // Users & Access
    maxUsers: 5,
    maxConcurrentSessions: 10, // 2 sessions per user

    // CRM Limits
    maxContacts: 1000,
    maxCompanies: 200,
    maxDeals: 100,
    maxPipelines: 3,

    // Communication Limits (per day)
    maxEmailsPerDay: 500,
    maxSmsPerDay: 100,
    maxWhatsAppPerDay: 100,
    maxVoiceMinutesPerDay: 60,

    // Automation & Workflows
    maxAutomations: 5,
    maxSequences: 3,
    maxCampaigns: 5,

    // API & Rate Limiting
    apiRateLimit: {
      requestsPerMinute: 300,
      requestsPerHour: 10000,
      requestsPerDay: 100000,
    },

    // Export Limits
    maxExportRowsPerRequest: 1000,
    maxExportsPerDay: 20,

    // Feature Access
    features: {
      customFields: true,
      automation: true,
      whatsapp: true,
      voice: false,
      analytics: 'standard',
      support: 'email',
      customBranding: false,
      apiAccess: 'standard',
      webhooks: true,
      sso: false,
    },

    // Module Access
    modules: {
      crm: true,
      inbox: true,
      marketing: true,
      sales: true,
      automation: true,
      analytics: false,
      hr: false,
      finance: false,
      projects: false,
    },
  },

  professional: {
    // Storage & Files
    storageGb: 50,
    maxFileUploadSizeMb: 100, // 100MB per file
    maxFilesPerUpload: 20,

    // Users & Access
    maxUsers: 20,
    maxConcurrentSessions: 50, // 2-3 sessions per user

    // CRM Limits
    maxContacts: 10000,
    maxCompanies: 2000,
    maxDeals: 1000,
    maxPipelines: 10,

    // Communication Limits (per day)
    maxEmailsPerDay: 5000,
    maxSmsPerDay: 1000,
    maxWhatsAppPerDay: 1000,
    maxVoiceMinutesPerDay: 500,

    // Automation & Workflows
    maxAutomations: 20,
    maxSequences: 10,
    maxCampaigns: 20,

    // API & Rate Limiting
    apiRateLimit: {
      requestsPerMinute: 1000,
      requestsPerHour: 50000,
      requestsPerDay: 500000,
    },

    // Export Limits
    maxExportRowsPerRequest: 10000,
    maxExportsPerDay: 100,

    // Feature Access
    features: {
      customFields: true,
      automation: true,
      whatsapp: true,
      voice: true,
      analytics: 'advanced',
      support: 'priority',
      customBranding: true,
      apiAccess: 'full',
      webhooks: true,
      sso: false,
    },

    // Module Access
    modules: {
      crm: true,
      inbox: true,
      marketing: true,
      sales: true,
      automation: true,
      analytics: true,
      hr: false,
      finance: false,
      projects: true,
    },
  },

  enterprise: {
    // Storage & Files
    storageGb: 250,
    maxFileUploadSizeMb: 500, // 500MB per file
    maxFilesPerUpload: 100,

    // Users & Access
    maxUsers: 50,
    maxConcurrentSessions: 200, // 4 sessions per user

    // CRM Limits
    maxContacts: null, // Unlimited
    maxCompanies: null, // Unlimited
    maxDeals: null, // Unlimited
    maxPipelines: null, // Unlimited

    // Communication Limits (per day)
    maxEmailsPerDay: 50000,
    maxSmsPerDay: 10000,
    maxWhatsAppPerDay: 10000,
    maxVoiceMinutesPerDay: 5000,

    // Automation & Workflows
    maxAutomations: null, // Unlimited
    maxSequences: null, // Unlimited
    maxCampaigns: null, // Unlimited

    // API & Rate Limiting
    apiRateLimit: {
      requestsPerMinute: 5000,
      requestsPerHour: 200000,
      requestsPerDay: null, // Unlimited
    },

    // Export Limits
    maxExportRowsPerRequest: 100000,
    maxExportsPerDay: null, // Unlimited

    // Feature Access
    features: {
      customFields: true,
      automation: true,
      whatsapp: true,
      voice: true,
      analytics: 'enterprise',
      support: '24/7',
      customBranding: true,
      apiAccess: 'full',
      webhooks: true,
      sso: true,
    },

    // Module Access
    modules: {
      crm: true,
      inbox: true,
      marketing: true,
      sales: true,
      automation: true,
      analytics: true,
      hr: true,
      finance: true,
      projects: true,
    },
  },
};

/**
 * Get limits for a specific plan
 */
export function getPlanLimits(planName) {
  const plan = planName?.toLowerCase() || 'free';
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}

/**
 * Check if a limit has been reached
 */
export function isLimitReached(currentValue, maxValue) {
  if (maxValue === null) return false; // Unlimited
  return currentValue >= maxValue;
}

/**
 * Get remaining quota
 */
export function getRemainingQuota(currentValue, maxValue) {
  if (maxValue === null) return null; // Unlimited
  return Math.max(0, maxValue - currentValue);
}

/**
 * Calculate usage percentage
 */
export function getUsagePercentage(currentValue, maxValue) {
  if (maxValue === null) return 0; // Unlimited
  if (maxValue === 0) return 100;
  return Math.min(100, (currentValue / maxValue) * 100);
}

export default {
  PLAN_LIMITS,
  getPlanLimits,
  isLimitReached,
  getRemainingQuota,
  getUsagePercentage,
};
