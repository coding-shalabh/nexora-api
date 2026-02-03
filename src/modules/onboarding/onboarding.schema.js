/**
 * Onboarding API Schemas
 * Zod validation schemas for onboarding endpoints
 */

import { z } from 'zod';

// Enums
export const Industry = z.enum([
  'technology',
  'healthcare',
  'finance',
  'retail',
  'manufacturing',
  'education',
  'real_estate',
  'hospitality',
  'media',
  'consulting',
  'logistics',
  'food_beverage',
  'automotive',
  'telecom',
  'other'
]);

export const CompanySize = z.enum([
  '1',
  '2-10',
  '11-50',
  '51-200',
  '201-500',
  '500+'
]);

export const CompanyType = z.enum([
  'private',
  'public',
  'startup',
  'agency',
  'freelancer',
  'nonprofit',
  'government'
]);

export const UserRole = z.enum([
  'admin',
  'sales_rep',
  'support_agent',
  'marketing',
  'viewer'
]);

export const EmailProvider = z.enum([
  'smtp',
  'gmail',
  'outlook',
  'ses',
  'sendgrid'
]);

export const BillingCycle = z.enum([
  'monthly',
  'yearly'
]);

// ================================
// 1. Initialize Onboarding
// ================================

export const initializeOnboardingSchema = z.object({
  // From payment/purchase system
  orderId: z.string().min(1, 'Order ID is required'),
  planId: z.string().min(1, 'Plan ID is required'),
  billingCycle: BillingCycle,

  // Initial user from signup
  email: z.string().email('Valid email is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

// ================================
// 2. Company Information
// ================================

export const companySchema = z.object({
  // Basic Info
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
  displayName: z.string().optional(),
  domain: z.string().optional(),
  industry: Industry,
  companySize: CompanySize,
  companyType: CompanyType.optional(),
  website: z.string().url().optional().or(z.literal('')),
  phone: z.string().min(10, 'Valid phone number required'),

  // Address (optional during onboarding)
  address: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  country: z.string().optional().default('India'),
  postalCode: z.string().optional().default(''),

  // Tax/GST (India specific)
  isGstRegistered: z.boolean().optional().default(false),
  gstin: z.string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format')
    .optional()
    .or(z.literal('')),
  pan: z.string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format')
    .optional()
    .or(z.literal('')),
  legalName: z.string().optional(),
  stateCode: z.string().max(2).optional(),
}).refine((data) => {
  // If GST registered, GSTIN is required
  if (data.isGstRegistered && !data.gstin) {
    return false;
  }
  return true;
}, {
  message: 'GSTIN is required when GST registered',
  path: ['gstin']
});

// ================================
// 3. Admin Account
// ================================

// Base schema without refinement (for .omit() usage)
export const adminAccountBaseSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(10, 'Valid phone number required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  jobTitle: z.string().optional(),
  timezone: z.string().default('Asia/Kolkata'),
  language: z.string().default('en'),
});

// Full schema with password confirmation validation
export const adminAccountSchema = adminAccountBaseSchema.refine(
  (data) => data.password === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  }
);

// ================================
// 4. Team Setup
// ================================

const inviteUserSchema = z.object({
  email: z.string().email('Valid email required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: UserRole,
});

const customRoleSchema = z.object({
  name: z.string().min(2, 'Role name required'),
  description: z.string().optional(),
  permissions: z.array(z.string()).min(1, 'At least one permission required'),
});

export const teamSetupSchema = z.object({
  useDefaultRoles: z.boolean().default(true),
  inviteUsers: z.array(inviteUserSchema).optional().default([]),
  customRoles: z.array(customRoleSchema).optional(),
  skipTeamSetup: z.boolean().optional().default(false),
});

// ================================
// 5. Email Configuration
// ================================

const smtpConfigSchema = z.object({
  host: z.string().min(1, 'SMTP host required'),
  port: z.number().int().min(1).max(65535),
  user: z.string().min(1, 'SMTP user required'),
  password: z.string().min(1, 'SMTP password required'),
  secure: z.boolean().default(true),
});

export const emailConfigSchema = z.object({
  // Primary sending email
  primaryEmail: z.string().email('Valid email required'),
  emailDisplayName: z.string().min(2, 'Display name required'),
  replyToEmail: z.string().email().optional().or(z.literal('')),

  // Provider
  emailProvider: EmailProvider,

  // SMTP settings (conditional)
  smtp: smtpConfigSchema.optional(),

  // Email types enabled
  enableTransactional: z.boolean().default(true),
  enableMarketing: z.boolean().default(false),
  enableTicketing: z.boolean().default(false),

  // Skip email setup (configure later)
  skipEmailSetup: z.boolean().optional().default(false),
}).refine((data) => {
  // If SMTP provider, smtp config is required
  if (data.emailProvider === 'smtp' && !data.skipEmailSetup && !data.smtp) {
    return false;
  }
  return true;
}, {
  message: 'SMTP configuration required for SMTP provider',
  path: ['smtp']
});

// ================================
// 6. CRM Configuration
// ================================

const pipelineStageSchema = z.object({
  name: z.string().min(1, 'Stage name required'),
  order: z.number().int().min(0),
  probability: z.number().int().min(0).max(100),
  color: z.string().optional(),
  isWonStage: z.boolean().optional().default(false),
  isLostStage: z.boolean().optional().default(false),
});

export const crmConfigSchema = z.object({
  // Sales Pipeline
  useDefaultPipeline: z.boolean().default(true),
  pipelineName: z.string().optional().default('Sales Pipeline'),
  customStages: z.array(pipelineStageSchema).optional(),

  // Lead Sources
  leadSources: z.array(z.string()).optional().default([
    'Website',
    'Referral',
    'Cold Call',
    'Social Media',
    'Trade Show',
    'Advertisement',
    'Other'
  ]),

  // Contact Lifecycle
  useDefaultLifecycle: z.boolean().default(true),

  // Settings
  defaultCurrency: z.string().default('INR'),
  fiscalYearStart: z.enum(['january', 'april']).optional().default('april'),
});

// ================================
// 7. Ticketing Configuration
// ================================

const ticketStageSchema = z.object({
  name: z.string().min(1, 'Stage name required'),
  order: z.number().int().min(0),
  color: z.string().optional(),
  isClosedStage: z.boolean().optional().default(false),
});

export const ticketingConfigSchema = z.object({
  enableTicketing: z.boolean(),

  // Ticket Pipeline
  useDefaultTicketPipeline: z.boolean().default(true),
  customStages: z.array(ticketStageSchema).optional(),

  // Categories
  categories: z.array(z.string()).optional().default([
    'Technical Support',
    'Billing',
    'Sales Inquiry',
    'Feature Request',
    'General'
  ]),

  // SLA
  enableSLA: z.boolean().default(false),
  defaultResponseTime: z.number().int().positive().optional(), // hours
  defaultResolutionTime: z.number().int().positive().optional(), // hours
});

// ================================
// 8. Marketing Configuration
// ================================

export const marketingConfigSchema = z.object({
  enableMarketing: z.boolean(),

  // Templates
  createDefaultTemplates: z.boolean().default(true),

  // Compliance
  unsubscribePageUrl: z.string().url().optional().or(z.literal('')),
  physicalAddress: z.string().min(10, 'Physical address required for email compliance'),
});

// ================================
// 9. Complete Onboarding
// ================================

export const completeOnboardingSchema = z.object({
  // Optional future integrations
  enableWhatsApp: z.boolean().optional().default(false),
  enableSMS: z.boolean().optional().default(false),
  enableVoice: z.boolean().optional().default(false),

  // Confirmation
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions'
  }),
});

// ================================
// Combined Full Onboarding Schema
// ================================

export const fullOnboardingSchema = z.object({
  company: companySchema,
  admin: adminAccountBaseSchema.omit({ confirmPassword: true }),
  team: teamSetupSchema.optional(),
  email: emailConfigSchema.optional(),
  crm: crmConfigSchema.optional(),
  ticketing: ticketingConfigSchema.optional(),
  marketing: marketingConfigSchema.optional(),
});

// ================================
// Default Values
// ================================

export const DEFAULT_PIPELINE_STAGES = [
  { name: 'Lead', order: 0, probability: 10, color: '#94a3b8' },
  { name: 'Qualified', order: 1, probability: 25, color: '#60a5fa' },
  { name: 'Proposal', order: 2, probability: 50, color: '#a78bfa' },
  { name: 'Negotiation', order: 3, probability: 75, color: '#fbbf24' },
  { name: 'Closed Won', order: 4, probability: 100, color: '#22c55e', isWonStage: true },
  { name: 'Closed Lost', order: 5, probability: 0, color: '#ef4444', isLostStage: true },
];

export const DEFAULT_TICKET_STAGES = [
  { name: 'New', order: 0, color: '#60a5fa' },
  { name: 'Open', order: 1, color: '#fbbf24' },
  { name: 'Pending', order: 2, color: '#f97316' },
  { name: 'On Hold', order: 3, color: '#94a3b8' },
  { name: 'Resolved', order: 4, color: '#22c55e' },
  { name: 'Closed', order: 5, color: '#6b7280', isClosedStage: true },
];

export const DEFAULT_LIFECYCLE_STAGES = [
  'SUBSCRIBER',
  'LEAD',
  'MQL',
  'SQL',
  'OPPORTUNITY',
  'CUSTOMER',
  'EVANGELIST'
];

/**
 * Role Hierarchy Levels:
 * 10 = Super Admin (platform owner, can manage billing)
 * 9  = Admin (full tenant access, cannot manage billing)
 * 8  = Manager (team management, reports, settings)
 * 7  = Marketing (campaigns, analytics, contacts)
 * 6  = Sales Representative (CRM, deals, pipeline)
 * 5  = Support Agent (tickets, inbox, contacts)
 * 4  = Team Lead (limited management)
 * 3  = Senior Staff (extended access)
 * 2  = Staff (standard access)
 * 1  = Read-only (view only)
 */
export const DEFAULT_ROLES = [
  {
    name: 'Super Admin',
    level: 10,
    description: 'Platform owner with billing and full tenant access',
    permissions: ['*', 'billing:*', 'tenant:*'],
  },
  {
    name: 'Admin',
    level: 9,
    description: 'Full system access except billing',
    permissions: ['*'],
  },
  {
    name: 'Manager',
    level: 8,
    description: 'Team management, reports, and settings access',
    permissions: [
      'crm:*',
      'pipeline:*',
      'reports:*',
      'settings:read',
      'team:manage',
    ],
  },
  {
    name: 'Marketing',
    level: 7,
    description: 'Campaigns and analytics access',
    permissions: [
      'marketing:*',
      'analytics:read',
      'crm:contacts:read',
      'crm:tags:*',
    ],
  },
  {
    name: 'Sales Representative',
    level: 6,
    description: 'CRM and pipeline access',
    permissions: [
      'crm:contacts:*',
      'crm:companies:*',
      'crm:deals:*',
      'crm:activities:*',
      'crm:tags:read',
      'pipeline:*',
    ],
  },
  {
    name: 'Support Agent',
    level: 5,
    description: 'Ticketing and inbox access',
    permissions: [
      'tickets:*',
      'inbox:*',
      'crm:contacts:read',
      'crm:contacts:update',
      'crm:activities:create',
    ],
  },
  {
    name: 'Team Lead',
    level: 4,
    description: 'Limited team management',
    permissions: [
      'crm:contacts:*',
      'crm:deals:*',
      'crm:activities:*',
      'team:read',
    ],
  },
  {
    name: 'Staff',
    level: 2,
    description: 'Standard CRM access',
    permissions: [
      'crm:contacts:read',
      'crm:contacts:create',
      'crm:contacts:update',
      'crm:deals:read',
      'crm:activities:read',
      'crm:activities:create',
    ],
  },
  {
    name: 'Read-only',
    level: 1,
    description: 'View-only access',
    permissions: [
      'crm:contacts:read',
      'crm:companies:read',
      'crm:deals:read',
      'crm:activities:read',
    ],
  },
];
