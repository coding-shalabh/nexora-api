/**
 * Channel Providers Configuration
 * Defines all supported providers for each channel type
 * Focus: Indian market providers first
 */

export const CHANNEL_TYPES = {
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
  VOICE: 'VOICE',
};

/**
 * EMAIL PROVIDERS
 * Supports SMTP/IMAP and OAuth providers
 */
export const EMAIL_PROVIDERS = {
  // Indian Hosting Providers
  HOSTINGER: {
    id: 'hostinger',
    name: 'Hostinger',
    type: 'smtp',
    icon: 'hostinger',
    color: '#673DE6',
    smtp: { host: 'smtp.hostinger.com', port: 465, secure: true },
    imap: { host: 'imap.hostinger.com', port: 993, secure: true },
    domains: ['hostinger.com'],
    requiredFields: ['email', 'password'],
    testable: true,
  },
  GODADDY: {
    id: 'godaddy',
    name: 'GoDaddy',
    type: 'smtp',
    icon: 'godaddy',
    color: '#1BDBDB',
    smtp: { host: 'smtpout.secureserver.net', port: 465, secure: true },
    imap: { host: 'imap.secureserver.net', port: 993, secure: true },
    domains: ['secureserver.net', 'godaddy.com'],
    requiredFields: ['email', 'password'],
    testable: true,
  },
  ZOHO: {
    id: 'zoho',
    name: 'Zoho Mail',
    type: 'smtp',
    icon: 'zoho',
    color: '#C8202B',
    smtp: { host: 'smtp.zoho.in', port: 465, secure: true },
    imap: { host: 'imap.zoho.in', port: 993, secure: true },
    domains: ['zoho.com', 'zoho.in', 'zohomail.in'],
    requiredFields: ['email', 'password'],
    notes: 'Use App Password if 2FA enabled',
    testable: true,
  },
  REDIFFMAIL: {
    id: 'rediffmail',
    name: 'Rediffmail Pro',
    type: 'smtp',
    icon: 'rediff',
    color: '#E53935',
    smtp: { host: 'smtp.rediffmailpro.com', port: 465, secure: true },
    imap: { host: 'imap.rediffmailpro.com', port: 993, secure: true },
    domains: ['rediffmail.com', 'rediff.com'],
    requiredFields: ['email', 'password'],
    testable: true,
  },

  // Global Providers (OAuth)
  GMAIL: {
    id: 'gmail',
    name: 'Gmail / Google Workspace',
    type: 'oauth',
    icon: 'google',
    color: '#EA4335',
    oauth: {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
      ],
    },
    domains: ['gmail.com', 'googlemail.com'],
    requiredFields: [], // OAuth handles this
    testable: true,
  },
  MICROSOFT: {
    id: 'microsoft',
    name: 'Microsoft 365 / Outlook',
    type: 'oauth',
    icon: 'microsoft',
    color: '#0078D4',
    oauth: {
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scopes: ['https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/Mail.Read'],
    },
    domains: ['outlook.com', 'hotmail.com', 'live.com', 'microsoft.com'],
    requiredFields: [],
    testable: true,
  },

  // Custom SMTP (fallback)
  CUSTOM_SMTP: {
    id: 'custom_smtp',
    name: 'Custom SMTP Server',
    type: 'smtp',
    icon: 'mail',
    color: '#6B7280',
    requiredFields: ['email', 'password', 'smtpHost', 'smtpPort', 'imapHost', 'imapPort'],
    testable: true,
  },
};

/**
 * WHATSAPP PROVIDERS
 * Indian market focus: MSG91, Gupshup
 */
export const WHATSAPP_PROVIDERS = {
  MSG91: {
    id: 'msg91',
    name: 'MSG91',
    icon: 'msg91',
    color: '#00C853',
    baseUrl: 'https://api.msg91.com/api/v5',
    webhookSupport: true,
    requiredFields: ['authKey', 'integratedNumber'],
    optionalFields: ['senderId'],
    features: ['text', 'media', 'template', 'interactive'],
    documentation: 'https://docs.msg91.com/collection/whatsapp-api',
    testable: true,
  },
  GUPSHUP: {
    id: 'gupshup',
    name: 'Gupshup',
    icon: 'gupshup',
    color: '#00BFA5',
    baseUrl: 'https://api.gupshup.io/sm/api/v1',
    webhookSupport: true,
    requiredFields: ['apiKey', 'appName', 'sourceNumber'],
    features: ['text', 'media', 'template', 'interactive', 'list'],
    documentation: 'https://docs.gupshup.io/docs/whatsapp-overview',
    testable: true,
  },
  INTERAKT: {
    id: 'interakt',
    name: 'Interakt',
    icon: 'interakt',
    color: '#7C3AED',
    baseUrl: 'https://api.interakt.ai/v1',
    webhookSupport: true,
    requiredFields: ['apiKey', 'phoneNumber'],
    features: ['text', 'media', 'template'],
    documentation: 'https://developer.interakt.ai/',
    testable: true,
  },
  WATI: {
    id: 'wati',
    name: 'WATI',
    icon: 'wati',
    color: '#25D366',
    baseUrl: 'https://live-server-{region}.wati.io/api/v1',
    webhookSupport: true,
    requiredFields: ['apiKey', 'phoneNumber', 'region'],
    features: ['text', 'media', 'template', 'interactive'],
    documentation: 'https://docs.wati.io/',
    testable: true,
  },
  META_CLOUD: {
    id: 'meta_cloud',
    name: 'Meta Cloud API (Direct)',
    icon: 'meta',
    color: '#0866FF',
    baseUrl: 'https://graph.facebook.com/v18.0',
    webhookSupport: true,
    requiredFields: ['accessToken', 'phoneNumberId', 'businessAccountId'],
    features: ['text', 'media', 'template', 'interactive', 'flows'],
    documentation: 'https://developers.facebook.com/docs/whatsapp/cloud-api',
    testable: true,
  },
  TWILIO: {
    id: 'twilio',
    name: 'Twilio',
    icon: 'twilio',
    color: '#F22F46',
    baseUrl: 'https://api.twilio.com/2010-04-01',
    webhookSupport: true,
    requiredFields: ['accountSid', 'authToken', 'phoneNumber'],
    features: ['text', 'media', 'template'],
    documentation: 'https://www.twilio.com/docs/whatsapp',
    testable: true,
  },
};

/**
 * SMS PROVIDERS
 * Indian market focus: Fast2SMS, MSG91, TextLocal
 */
export const SMS_PROVIDERS = {
  FAST2SMS: {
    id: 'fast2sms',
    name: 'Fast2SMS',
    icon: 'fast2sms',
    color: '#FF5722',
    baseUrl: 'https://www.fast2sms.com/dev/bulkV2',
    country: 'IN',
    requiredFields: ['apiKey'],
    optionalFields: ['senderId', 'dltEntityId'],
    routes: {
      quick: 'Quick SMS (Promotional)',
      otp: 'OTP Route',
      dlt: 'DLT Template Route',
    },
    dltRequired: true, // For commercial use
    features: ['quick', 'otp', 'bulk', 'dlt'],
    documentation: 'https://docs.fast2sms.com/',
    testable: true,
  },
  MSG91_SMS: {
    id: 'msg91_sms',
    name: 'MSG91 SMS',
    icon: 'msg91',
    color: '#00C853',
    baseUrl: 'https://api.msg91.com/api/v5',
    country: 'IN',
    requiredFields: ['authKey', 'senderId'],
    optionalFields: ['dltEntityId'],
    dltRequired: true,
    features: ['transactional', 'promotional', 'otp', 'bulk'],
    documentation: 'https://docs.msg91.com/collection/msg91-api',
    testable: true,
  },
  TEXTLOCAL: {
    id: 'textlocal',
    name: 'TextLocal',
    icon: 'textlocal',
    color: '#1976D2',
    baseUrl: 'https://api.textlocal.in',
    country: 'IN',
    requiredFields: ['apiKey', 'sender'],
    optionalFields: ['dltEntityId', 'dltTemplateId'],
    dltRequired: true,
    features: ['transactional', 'promotional', 'bulk', 'unicode'],
    documentation: 'https://api.textlocal.in/docs/',
    testable: true,
  },
  TWOFACTOR: {
    id: '2factor',
    name: '2Factor',
    icon: '2factor',
    color: '#4CAF50',
    baseUrl: 'https://2factor.in/API/V1',
    country: 'IN',
    requiredFields: ['apiKey'],
    optionalFields: ['senderId'],
    features: ['otp', 'transactional', 'voice_otp'],
    documentation: 'https://2factor.in/api-docs',
    testable: true,
  },
  KALEYRA: {
    id: 'kaleyra',
    name: 'Kaleyra',
    icon: 'kaleyra',
    color: '#E91E63',
    baseUrl: 'https://api.kaleyra.io/v1',
    country: 'IN',
    requiredFields: ['apiKey', 'sid', 'senderId'],
    dltRequired: true,
    features: ['transactional', 'promotional', 'otp', 'bulk'],
    documentation: 'https://developers.kaleyra.io/',
    testable: true,
  },
  TWILIO_SMS: {
    id: 'twilio_sms',
    name: 'Twilio SMS',
    icon: 'twilio',
    color: '#F22F46',
    baseUrl: 'https://api.twilio.com/2010-04-01',
    country: 'GLOBAL',
    requiredFields: ['accountSid', 'authToken', 'phoneNumber'],
    features: ['transactional', 'otp', 'bulk', 'mms'],
    documentation: 'https://www.twilio.com/docs/sms',
    testable: true,
  },
};

/**
 * VOICE PROVIDERS
 * Indian market focus: Exotel, TeleCMI, Knowlarity
 */
export const VOICE_PROVIDERS = {
  EXOTEL: {
    id: 'exotel',
    name: 'Exotel',
    icon: 'exotel',
    color: '#2196F3',
    baseUrl: 'https://api.exotel.com/v1',
    country: 'IN',
    requiredFields: ['apiKey', 'apiToken', 'sid', 'virtualNumber'],
    features: ['outbound', 'inbound', 'ivr', 'recording', 'conferencing'],
    webhookEvents: ['call.initiated', 'call.ringing', 'call.answered', 'call.completed'],
    documentation: 'https://developer.exotel.com/',
    testable: true,
  },
  TELECMI: {
    id: 'telecmi',
    name: 'TeleCMI',
    icon: 'telecmi',
    color: '#FF9800',
    baseUrl: 'https://rest.telecmi.com/v2',
    country: 'IN',
    requiredFields: ['apiKey', 'apiSecret', 'virtualNumber'],
    features: ['outbound', 'inbound', 'ivr', 'recording', 'click2call'],
    webhookEvents: ['call_status', 'call_record'],
    documentation: 'https://doc.telecmi.com/',
    testable: true,
  },
  KNOWLARITY: {
    id: 'knowlarity',
    name: 'Knowlarity',
    icon: 'knowlarity',
    color: '#673AB7',
    baseUrl: 'https://kpi.knowlarity.com',
    country: 'IN',
    requiredFields: ['apiKey', 'srNumber', 'callerId'],
    features: ['outbound', 'inbound', 'ivr', 'recording', 'missed_call'],
    webhookEvents: ['call_status'],
    documentation: 'https://www.knowlarity.com/developers/',
    testable: true,
  },
  MYOPERATOR: {
    id: 'myoperator',
    name: 'MyOperator',
    icon: 'myoperator',
    color: '#009688',
    baseUrl: 'https://api.myoperator.co',
    country: 'IN',
    requiredFields: ['apiToken', 'companyId', 'virtualNumber'],
    features: ['outbound', 'inbound', 'ivr', 'recording', 'analytics'],
    documentation: 'https://myoperator.com/api-docs',
    testable: true,
  },
  TWILIO_VOICE: {
    id: 'twilio_voice',
    name: 'Twilio Voice',
    icon: 'twilio',
    color: '#F22F46',
    baseUrl: 'https://api.twilio.com/2010-04-01',
    country: 'GLOBAL',
    requiredFields: ['accountSid', 'authToken', 'phoneNumber'],
    features: ['outbound', 'inbound', 'ivr', 'recording', 'conferencing', 'transcription'],
    documentation: 'https://www.twilio.com/docs/voice',
    testable: true,
  },
};

/**
 * Auto-detect email provider from domain
 */
export function detectEmailProvider(email) {
  if (!email || !email.includes('@')) return null;

  const domain = email.split('@')[1].toLowerCase();

  // Check Gmail
  if (EMAIL_PROVIDERS.GMAIL.domains.includes(domain)) {
    return EMAIL_PROVIDERS.GMAIL;
  }

  // Check Microsoft
  if (EMAIL_PROVIDERS.MICROSOFT.domains.includes(domain)) {
    return EMAIL_PROVIDERS.MICROSOFT;
  }

  // Check Zoho
  if (EMAIL_PROVIDERS.ZOHO.domains.some((d) => domain.includes(d))) {
    return EMAIL_PROVIDERS.ZOHO;
  }

  // Check Hostinger (common Indian hosting domains)
  // Hostinger users typically use custom domains, so we check MX records
  // For now, return null for custom domains
  if (domain.includes('hostinger')) {
    return EMAIL_PROVIDERS.HOSTINGER;
  }

  // Check GoDaddy
  if (EMAIL_PROVIDERS.GODADDY.domains.some((d) => domain.includes(d))) {
    return EMAIL_PROVIDERS.GODADDY;
  }

  // Check Rediffmail
  if (EMAIL_PROVIDERS.REDIFFMAIL.domains.some((d) => domain.includes(d))) {
    return EMAIL_PROVIDERS.REDIFFMAIL;
  }

  // Default to custom SMTP for unknown domains
  return null;
}

/**
 * Get all providers for a channel type
 */
export function getProvidersForChannel(channelType) {
  switch (channelType) {
    case CHANNEL_TYPES.EMAIL:
      return Object.values(EMAIL_PROVIDERS);
    case CHANNEL_TYPES.WHATSAPP:
      return Object.values(WHATSAPP_PROVIDERS);
    case CHANNEL_TYPES.SMS:
      return Object.values(SMS_PROVIDERS);
    case CHANNEL_TYPES.VOICE:
      return Object.values(VOICE_PROVIDERS);
    default:
      return [];
  }
}

/**
 * Get provider by ID
 */
export function getProviderById(channelType, providerId) {
  const providers = {
    [CHANNEL_TYPES.EMAIL]: EMAIL_PROVIDERS,
    [CHANNEL_TYPES.WHATSAPP]: WHATSAPP_PROVIDERS,
    [CHANNEL_TYPES.SMS]: SMS_PROVIDERS,
    [CHANNEL_TYPES.VOICE]: VOICE_PROVIDERS,
  };

  const channelProviders = providers[channelType];
  if (!channelProviders) return null;

  return Object.values(channelProviders).find((p) => p.id === providerId) || null;
}

/**
 * Validate required fields for a provider
 */
export function validateProviderCredentials(provider, credentials) {
  const errors = [];

  for (const field of provider.requiredFields) {
    if (!credentials[field]) {
      errors.push(`${field} is required`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export default {
  CHANNEL_TYPES,
  EMAIL_PROVIDERS,
  WHATSAPP_PROVIDERS,
  SMS_PROVIDERS,
  VOICE_PROVIDERS,
  detectEmailProvider,
  getProvidersForChannel,
  getProviderById,
  validateProviderCredentials,
};
