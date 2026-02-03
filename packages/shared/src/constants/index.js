// ==================== HTTP Status Codes ====================

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// ==================== Pagination ====================

export const PAGINATION = {
  DEFAULT_LIMIT: 25,
  MAX_LIMIT: 100,
};

// ==================== Rate Limits ====================

export const RATE_LIMITS = {
  AUTH: { limit: 10, window: 60 * 1000 },
  READ: { limit: 1000, window: 60 * 1000 },
  WRITE: { limit: 100, window: 60 * 1000 },
  BULK: { limit: 10, window: 60 * 1000 },
  UPLOAD: { limit: 20, window: 60 * 1000 },
};

// ==================== Permissions ====================

export const PERMISSIONS = {
  ADMIN_VIEW: 'admin.view',
  ADMIN_MANAGE: 'admin.manage',
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  CRM_CONTACTS_VIEW: 'crm.contacts.view',
  CRM_CONTACTS_MANAGE: 'crm.contacts.manage',
  CRM_COMPANIES_VIEW: 'crm.companies.view',
  CRM_COMPANIES_MANAGE: 'crm.companies.manage',
  INBOX_VIEW: 'inbox.view',
  INBOX_MANAGE: 'inbox.manage',
  INBOX_ASSIGN: 'inbox.assign',
  PIPELINE_LEADS_VIEW: 'pipeline.leads.view',
  PIPELINE_LEADS_MANAGE: 'pipeline.leads.manage',
  PIPELINE_DEALS_VIEW: 'pipeline.deals.view',
  PIPELINE_DEALS_MANAGE: 'pipeline.deals.manage',
  PIPELINE_SETTINGS: 'pipeline.settings',
  TICKETS_VIEW: 'tickets.view',
  TICKETS_MANAGE: 'tickets.manage',
  TICKETS_ASSIGN: 'tickets.assign',
  TICKETS_SETTINGS: 'tickets.settings',
  BILLING_QUOTES_VIEW: 'billing.quotes.view',
  BILLING_QUOTES_MANAGE: 'billing.quotes.manage',
  BILLING_INVOICES_VIEW: 'billing.invoices.view',
  BILLING_INVOICES_MANAGE: 'billing.invoices.manage',
  AUTOMATION_VIEW: 'automation.view',
  AUTOMATION_MANAGE: 'automation.manage',
  ANALYTICS_VIEW: 'analytics.view',
  WALLET_VIEW: 'wallet.view',
  WALLET_MANAGE: 'wallet.manage',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
};

// ==================== System Roles ====================

export const SYSTEM_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  MANAGER: 'manager',
  AGENT: 'agent',
  FINANCE: 'finance',
  READ_ONLY: 'read_only',
};

// ==================== Default Values ====================

export const DEFAULTS = {
  TIMEZONE: 'UTC',
  CURRENCY: 'USD',
  LOCALE: 'en',
  TAG_COLOR: '#6366f1',
  STAGE_COLOR: '#6366f1',
};

// ==================== WhatsApp ====================

export const WHATSAPP = {
  MESSAGE_WINDOW_HOURS: 24,
  TEMPLATE_CATEGORIES: ['UTILITY', 'MARKETING', 'AUTHENTICATION'],
  MAX_MESSAGE_LENGTH: 4096,
  MAX_TEMPLATE_VARIABLES: 10,
};

// ==================== File Upload ====================

export const FILE_UPLOAD = {
  MAX_SIZE_MB: 16,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_VIDEO_TYPES: ['video/mp4', 'video/3gpp'],
  ALLOWED_DOCUMENT_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  ALLOWED_AUDIO_TYPES: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'],
};

// ==================== Webhook ====================

export const WEBHOOK = {
  MAX_RETRIES: 5,
  RETRY_DELAYS: [0, 60, 300, 1800, 7200],
  TIMEOUT_MS: 30000,
  SIGNATURE_ALGORITHM: 'sha256',
};

// ==================== SLA ====================

export const SLA_DEFAULTS = {
  FIRST_RESPONSE: {
    LOW: 480,
    MEDIUM: 240,
    HIGH: 60,
    URGENT: 15,
  },
  RESOLUTION: {
    LOW: 2880,
    MEDIUM: 1440,
    HIGH: 480,
    URGENT: 120,
  },
};

// ==================== Wallet ====================

export const WALLET = {
  MIN_TOPUP_AMOUNT: 10,
  MAX_TOPUP_AMOUNT: 10000,
  DEFAULT_LOW_BALANCE_THRESHOLD: 50,
};

// ==================== Import ====================

export const IMPORT = {
  MAX_ROWS: 10000,
  BATCH_SIZE: 100,
};

// ==================== Event Types ====================

export const EVENT_TYPES = [
  'contact.created',
  'contact.updated',
  'contact.deleted',
  'contact.merged',
  'company.created',
  'company.updated',
  'conversation.created',
  'conversation.assigned',
  'conversation.closed',
  'message.received',
  'message.sent',
  'message.delivered',
  'message.read',
  'message.failed',
  'lead.created',
  'lead.qualified',
  'lead.converted',
  'deal.created',
  'deal.stage_changed',
  'deal.won',
  'deal.lost',
  'ticket.created',
  'ticket.assigned',
  'ticket.resolved',
  'ticket.sla_breached',
  'quote.created',
  'quote.accepted',
  'invoice.created',
  'invoice.paid',
  'wallet.low_balance',
];
