import { z } from 'zod';

// ==================== Common Schemas ====================

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

// ==================== Auth Schemas ====================

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  companyName: z.string().min(2).max(100),
  phone: z.string().optional(),
});

// ==================== Contact Schemas ====================

export const createContactSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  companyId: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const updateContactSchema = createContactSchema.partial();

// ==================== Company Schemas ====================

export const createCompanySchema = z.object({
  name: z.string().min(1).max(200),
  website: z.string().url().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export const updateCompanySchema = createCompanySchema.partial();

// ==================== Lead Schemas ====================

export const createLeadSchema = z.object({
  title: z.string().min(1).max(200),
  contactId: z.string().optional(),
  value: z.number().min(0).optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

export const updateLeadSchema = createLeadSchema.partial();

// ==================== Deal Schemas ====================

export const createDealSchema = z.object({
  title: z.string().min(1).max(200),
  contactId: z.string(),
  pipelineId: z.string(),
  stageId: z.string().optional(),
  value: z.number().min(0).default(0),
  expectedCloseDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const updateDealSchema = createDealSchema.partial();

// ==================== Ticket Schemas ====================

export const createTicketSchema = z.object({
  subject: z.string().min(1).max(300),
  description: z.string().optional(),
  contactId: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  category: z.string().optional(),
});

export const updateTicketSchema = createTicketSchema.partial();

// ==================== Message Schemas ====================

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(4096),
  type: z.enum(['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'AUDIO', 'TEMPLATE']).default('TEXT'),
  templateId: z.string().optional(),
  templateParams: z.record(z.string()).optional(),
  mediaUrl: z.string().url().optional(),
});

// ==================== Workflow Schemas ====================

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  trigger: z.object({
    type: z.string(),
    config: z.record(z.unknown()).optional(),
  }),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.string(),
    value: z.unknown(),
  })).optional(),
  actions: z.array(z.object({
    type: z.string(),
    config: z.record(z.unknown()),
  })),
});

// ==================== Quote Schemas ====================

export const createQuoteSchema = z.object({
  contactId: z.string(),
  validUntil: z.string().datetime().optional(),
  items: z.array(z.object({
    productId: z.string().optional(),
    description: z.string(),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
    discount: z.number().min(0).max(100).default(0),
  })),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

// ==================== Invoice Schemas ====================

export const createInvoiceSchema = z.object({
  contactId: z.string(),
  quoteId: z.string().optional(),
  dueDate: z.string().datetime(),
  items: z.array(z.object({
    description: z.string(),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
    discount: z.number().min(0).max(100).default(0),
  })),
  notes: z.string().optional(),
  terms: z.string().optional(),
});

// ==================== Wallet Schemas ====================

export const topupWalletSchema = z.object({
  amount: z.number().min(10).max(10000),
  paymentMethod: z.string(),
});

export const updateSpendLimitSchema = z.object({
  dailyLimit: z.number().min(0).optional(),
  monthlyLimit: z.number().min(0).optional(),
  perTransactionLimit: z.number().min(0).optional(),
});
