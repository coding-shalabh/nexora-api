/**
 * Environment Configuration
 * Controls application mode, demo mode, and channel integration behavior
 */

export const environmentConfig = {
  // Core application mode
  mode: process.env.NODE_ENV || 'development', // 'development' | 'staging' | 'production'

  // API Configuration
  api: {
    port: process.env.PORT || 4000,
    baseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  },

  // Demo tenant settings
  demo: {
    enabled: process.env.DEMO_MODE === 'true',
    tenantId: process.env.DEMO_TENANT_ID || 'demo-tenant-nexora',
    userId: process.env.DEMO_USER_ID || 'demo-user-nexora',
    autoSeed: process.env.AUTO_SEED_DEMO === 'true',
    resetDaily: process.env.RESET_DEMO_DAILY === 'true',

    // Demo data counts
    dataCounts: {
      contacts: parseInt(process.env.DEMO_CONTACTS || '100'),
      companies: parseInt(process.env.DEMO_COMPANIES || '50'),
      deals: parseInt(process.env.DEMO_DEALS || '75'),
      leads: parseInt(process.env.DEMO_LEADS || '60'),
      tasks: parseInt(process.env.DEMO_TASKS || '200'),
      projects: parseInt(process.env.DEMO_PROJECTS || '20'),
      tickets: parseInt(process.env.DEMO_TICKETS || '80'),
      products: parseInt(process.env.DEMO_PRODUCTS || '30'),
      quotes: parseInt(process.env.DEMO_QUOTES || '40'),
      conversations: parseInt(process.env.DEMO_CONVERSATIONS || '100'),
      calendarEvents: parseInt(process.env.DEMO_CALENDAR_EVENTS || '50'),
    },
  },

  // Channel integration settings
  channels: {
    mode: process.env.CHANNELS_MODE || 'development', // Independent from core mode

    whatsapp: {
      enabled: process.env.WHATSAPP_ENABLED !== 'false',
      bypassMSG91: process.env.BYPASS_WHATSAPP === 'true',
      logOnly: process.env.WHATSAPP_LOG_ONLY === 'true',
      saveToInbox: process.env.WHATSAPP_SAVE_TO_INBOX !== 'false', // Always save to inbox
    },

    email: {
      enabled: process.env.EMAIL_ENABLED !== 'false',
      bypassResend: process.env.BYPASS_EMAIL === 'true',
      bypassMSG91: process.env.BYPASS_EMAIL_MSG91 === 'true',
      logOnly: process.env.EMAIL_LOG_ONLY === 'true',
      saveToInbox: process.env.EMAIL_SAVE_TO_INBOX !== 'false',
    },

    sms: {
      enabled: process.env.SMS_ENABLED !== 'false',
      bypassFast2SMS: process.env.BYPASS_SMS_FAST2SMS === 'true',
      bypassInfobip: process.env.BYPASS_SMS_INFOBIP === 'true',
      bypassMSG91: process.env.BYPASS_SMS_MSG91 === 'true',
      logOnly: process.env.SMS_LOG_ONLY === 'true',
      saveToInbox: process.env.SMS_SAVE_TO_INBOX !== 'false',
    },

    voice: {
      enabled: process.env.VOICE_ENABLED !== 'false',
      bypassTeleCMI: process.env.BYPASS_VOICE === 'true',
      logOnly: process.env.VOICE_LOG_ONLY === 'true',
      saveToInbox: process.env.VOICE_SAVE_TO_INBOX !== 'false',
    },
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    prettyPrint: process.env.NODE_ENV === 'development',
    logChannelMocks: process.env.LOG_CHANNEL_MOCKS !== 'false',
  },

  // Helper methods
  isDevelopment() {
    return this.mode === 'development';
  },

  isStaging() {
    return this.mode === 'staging';
  },

  isProduction() {
    return this.mode === 'production';
  },

  isDemoMode() {
    return this.demo.enabled;
  },

  areChannelsMocked() {
    return this.channels.mode !== 'production';
  },
};
