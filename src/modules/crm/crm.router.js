import { Router } from 'express';
import { z } from 'zod';
import { requirePermission } from '../../common/middleware/tenant.js';
import { crmService } from './crm.service.js';
import { leadScoringService } from './lead-scoring.service.js';
import { activityTrackingService } from './activity-tracking.service.js';
import { automationService } from './automation.service.js';
import { customFieldsService } from './custom-fields.service.js';
import { pipelineService } from '../pipeline/pipeline.service.js';
import { oauthService } from '../../services/oauth.service.js';
import { calendarService } from '../../services/calendar.service.js';

const router = Router();

// Helper: transform empty string to undefined for optional fields
const emptyToUndefined = (val) => (val === '' ? undefined : val);

// Helper: optional string that treats empty string as undefined
const optionalString = z.string().optional().transform(emptyToUndefined);

// Helper: optional email that treats empty string as undefined
const optionalEmail = z
  .string()
  .optional()
  .transform((val) => {
    if (!val || val === '') return undefined;
    return val;
  })
  .pipe(z.string().email().optional());

// Helper: optional enum that treats empty string as undefined
const optionalEnum = (values) =>
  z
    .union([z.enum(values), z.literal('')])
    .optional()
    .transform((val) => (val === '' ? undefined : val));

// Contact schemas
const createContactSchema = z.object({
  // Basic
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: optionalEmail,
  phone: optionalString,
  displayName: optionalString,

  // Personal
  salutation: optionalString,
  middleName: optionalString,
  suffix: optionalString,
  preferredName: optionalString,
  dateOfBirth: optionalString,
  gender: optionalString,

  // Additional Contact
  additionalEmails: z.array(z.string()).optional(),
  additionalPhones: z.array(z.string()).optional(),
  mobilePhone: optionalString,
  homePhone: optionalString,
  fax: optionalString,

  // Employment
  companyId: optionalString,
  jobTitle: optionalString,
  department: optionalString,

  // Lead Management
  lifecycleStage: optionalEnum([
    'SUBSCRIBER',
    'LEAD',
    'MQL',
    'SQL',
    'OPPORTUNITY',
    'CUSTOMER',
    'EVANGELIST',
    'OTHER',
  ]),
  leadStatus: optionalEnum([
    'NEW',
    'OPEN',
    'IN_PROGRESS',
    'OPEN_DEAL',
    'UNQUALIFIED',
    'ATTEMPTED_TO_CONTACT',
    'CONNECTED',
    'BAD_TIMING',
  ]),
  leadScore: z.number().int().min(0).max(100).optional(),
  personaType: optionalString,
  buyingRole: optionalString,
  isQualified: z.boolean().optional(),
  qualifiedDate: optionalString,
  disqualificationReason: optionalString,

  // Rating & Priority
  rating: optionalEnum(['HOT', 'WARM', 'COLD']),
  priority: optionalEnum(['HIGH', 'MEDIUM', 'LOW']),
  likelihoodToClose: z.number().int().min(0).max(100).optional(),
  expectedRevenue: z.union([z.number(), z.string()]).optional(),

  // Follow-up & Engagement
  followUpDate: optionalString,
  nextActivityDate: optionalString,
  nextActivityType: optionalString,

  // Attribution & Campaigns
  referredBy: optionalString,
  campaign: optionalString,
  territory: optionalString,
  segment: optionalString,

  // Target Account (ABM)
  isTargetAccount: z.boolean().optional(),

  // Social
  linkedinUrl: optionalString,
  twitterUrl: optionalString,
  facebookUrl: optionalString,
  instagramUrl: optionalString,

  // Consent
  marketingConsent: z.boolean().optional(),
  whatsappConsent: z.boolean().optional(),
  emailOptOut: z.boolean().optional(),
  callOptOut: z.boolean().optional(),
  doNotCall: z.boolean().optional(),

  // Source
  source: optionalString,
  sourceDetails: z
    .union([z.record(z.unknown()), z.string()])
    .optional()
    .transform((val) => {
      // If it's a string that looks like "[object Object]", skip it
      if (typeof val === 'string') {
        if (val === '[object Object]' || val === '') return undefined;
        try {
          return JSON.parse(val);
        } catch {
          return undefined;
        }
      }
      return val;
    }),

  // Ownership
  ownerId: optionalString,

  // Billing/GST
  gstin: optionalString,
  billingAddress: optionalString,
  billingCity: optionalString,
  billingState: optionalString,
  billingStateCode: optionalString,
  billingPincode: optionalString,

  // Shipping
  shippingAddress: optionalString,
  shippingCity: optionalString,
  shippingState: optionalString,
  shippingStateCode: optionalString,
  shippingPincode: optionalString,

  // Tags & Custom
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
});

const updateContactSchema = createContactSchema.partial().extend({
  status: optionalEnum(['ACTIVE', 'INACTIVE', 'UNSUBSCRIBED']),
});

// ============ CONTACTS ============

router.get('/contacts', requirePermission('crm:contacts:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        search: z.string().optional(),
        status: z.string().optional(),
        companyId: z.string().optional(), // Accept any string ID (not just UUIDs)
        tags: z.string().optional(),
      })
      .parse(req.query);

    const result = await crmService.getContacts(req.tenantId, params);

    res.json({
      success: true,
      data: result.contacts,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

// Find duplicate contacts (MUST be before /contacts/:id to avoid route conflict)
router.get(
  '/contacts/duplicates',
  requirePermission('crm:contacts:read'),
  async (req, res, next) => {
    try {
      const paramsSchema = z.object({
        matchBy: z.enum(['email', 'phone', 'name', 'all']).default('email'),
        threshold: z.coerce.number().min(0).max(1).default(0.8),
      });

      const params = paramsSchema.parse(req.query);
      const result = await crmService.findDuplicateContacts(req.tenantId, params);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Merge two contacts
router.post('/contacts/merge', requirePermission('crm:contacts:update'), async (req, res, next) => {
  try {
    const mergeSchema = z.object({
      primaryId: z.string().min(1),
      duplicateId: z.string().min(1),
      fieldSelections: z.record(z.string(), z.enum(['primary', 'duplicate'])).optional(),
    });

    const data = mergeSchema.parse(req.body);
    const result = await crmService.mergeContacts(
      req.tenantId,
      req.userId,
      data.primaryId,
      data.duplicateId,
      data.fieldSelections || {}
    );

    res.json({
      success: true,
      data: result,
      message: 'Contacts merged successfully',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/contacts/:id', requirePermission('crm:contacts:read'), async (req, res, next) => {
  try {
    const contact = await crmService.getContact(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/contacts', requirePermission('crm:contacts:create'), async (req, res, next) => {
  try {
    const data = createContactSchema.parse(req.body);
    const contact = await crmService.createContact(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/contacts/:id', requirePermission('crm:contacts:update'), async (req, res, next) => {
  try {
    const data = updateContactSchema.parse(req.body);
    const contact = await crmService.updateContact(req.tenantId, req.params.id, data);

    res.json({
      success: true,
      data: contact,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/contacts/:id', requirePermission('crm:contacts:delete'), async (req, res, next) => {
  try {
    await crmService.deleteContact(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Contact deleted',
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  '/contacts/:id/timeline',
  requirePermission('crm:contacts:read'),
  async (req, res, next) => {
    try {
      const timeline = await crmService.getContactTimeline(req.tenantId, req.params.id);

      res.json({
        success: true,
        data: timeline,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ COMPANIES ============

router.get('/companies', requirePermission('crm:companies:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        search: z.string().optional(),
      })
      .parse(req.query);

    const result = await crmService.getCompanies(req.tenantId, params);

    res.json({
      success: true,
      data: result.companies,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/companies', requirePermission('crm:companies:create'), async (req, res, next) => {
  try {
    const createCompanySchema = z.object({
      name: z.string().min(1),
      domain: z.string().optional(),
      description: z.string().optional(),
      industry: z.string().optional(),
      size: z.string().optional(),
      employeeCount: z.string().optional(),
      companyType: z.string().optional(),
      lifecycleStage: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().optional(),
      linkedinUrl: z.string().optional(),
      twitterUrl: z.string().optional(),
      websiteUrl: z.string().optional(),
      customFields: z.record(z.unknown()).optional(),
    });

    const data = createCompanySchema.parse(req.body);
    const company = await crmService.createCompany(req.tenantId, data);

    res.status(201).json({
      success: true,
      data: company,
    });
  } catch (error) {
    next(error);
  }
});

// ============ ACTIVITIES ============

router.get('/activities', requirePermission('crm:activities:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        type: z.string().optional(),
        contactId: z.string().optional(), // Accept any string ID (cuid2 format)
        companyId: z.string().optional(), // Accept any string ID (not just UUIDs)
      })
      .parse(req.query);

    const result = await crmService.getActivities(req.tenantId, params);

    res.json({
      success: true,
      data: result.activities,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/activities', requirePermission('crm:activities:create'), async (req, res, next) => {
  try {
    const createActivitySchema = z.object({
      type: z.enum(['CALL', 'MEETING', 'TASK', 'NOTE', 'EMAIL']),
      title: z.string().min(1),
      description: z.string().optional(),
      contactId: z.string().optional(), // Accept any string ID (cuid2 format)
      companyId: z.string().optional(), // Accept any string ID (not just UUIDs)
      dealId: z.string().optional(), // Accept any string ID (cuid2 format)
      dueAt: z.string().datetime().optional(),
    });

    const data = createActivitySchema.parse(req.body);
    const activity = await crmService.createActivity(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
});

// ============ TAGS ============

router.get('/tags', requirePermission('crm:contacts:read'), async (req, res, next) => {
  try {
    const tags = await crmService.getTags(req.tenantId);

    res.json({
      success: true,
      data: tags,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/tags/:id', requirePermission('crm:contacts:read'), async (req, res, next) => {
  try {
    const tag = await crmService.getTag(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: tag,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/tags', requirePermission('crm:contacts:update'), async (req, res, next) => {
  try {
    const createTagSchema = z.object({
      name: z.string().min(1).max(50),
      color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
    });

    const data = createTagSchema.parse(req.body);
    const tag = await crmService.createTag(req.tenantId, data);

    res.status(201).json({
      success: true,
      data: tag,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/tags/:id', requirePermission('crm:contacts:update'), async (req, res, next) => {
  try {
    const updateTagSchema = z.object({
      name: z.string().min(1).max(50).optional(),
      color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
    });

    const data = updateTagSchema.parse(req.body);
    const tag = await crmService.updateTag(req.tenantId, req.params.id, data);

    res.json({
      success: true,
      data: tag,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/tags/:id', requirePermission('crm:contacts:delete'), async (req, res, next) => {
  try {
    await crmService.deleteTag(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Tag deleted',
    });
  } catch (error) {
    next(error);
  }
});

// ============ IMPORT ============

router.post(
  '/contacts/import',
  requirePermission('crm:contacts:create'),
  async (req, res, next) => {
    try {
      // Handle CSV import - simplified for now
      res.json({
        success: true,
        message: 'Import initiated',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ SEGMENTS ============

router.get('/segments', requirePermission('crm:segments:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        search: z.string().optional(),
        type: z.enum(['STATIC', 'DYNAMIC']).optional(),
      })
      .parse(req.query);

    const result = await crmService.getSegments(req.tenantId, params);

    res.json({
      success: true,
      data: result.segments,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/segments/:id', requirePermission('crm:segments:read'), async (req, res, next) => {
  try {
    const segment = await crmService.getSegment(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: segment,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/segments', requirePermission('crm:segments:create'), async (req, res, next) => {
  try {
    const createSegmentSchema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      type: z.enum(['STATIC', 'DYNAMIC']).default('STATIC'),
      conditions: z
        .object({
          operator: z.enum(['AND', 'OR']).default('AND'),
          filters: z.array(
            z.object({
              field: z.string(),
              operator: z.string().optional(),
              value: z.unknown(),
            })
          ),
        })
        .optional(),
      contactIds: z.array(z.string().uuid()).optional(),
    });

    const data = createSegmentSchema.parse(req.body);
    const segment = await crmService.createSegment(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: segment,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/segments/:id', requirePermission('crm:segments:update'), async (req, res, next) => {
  try {
    const updateSegmentSchema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      conditions: z
        .object({
          operator: z.enum(['AND', 'OR']).default('AND'),
          filters: z.array(
            z.object({
              field: z.string(),
              operator: z.string().optional(),
              value: z.unknown(),
            })
          ),
        })
        .optional(),
      contactIds: z.array(z.string().uuid()).optional(),
      isActive: z.boolean().optional(),
    });

    const data = updateSegmentSchema.parse(req.body);
    const segment = await crmService.updateSegment(req.tenantId, req.params.id, data);

    res.json({
      success: true,
      data: segment,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/segments/:id', requirePermission('crm:segments:delete'), async (req, res, next) => {
  try {
    await crmService.deleteSegment(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Segment deleted',
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  '/segments/:id/contacts',
  requirePermission('crm:segments:read'),
  async (req, res, next) => {
    try {
      const params = z
        .object({
          page: z.coerce.number().min(1).default(1),
          limit: z.coerce.number().min(1).max(100).default(25),
        })
        .parse(req.query);

      const result = await crmService.getSegmentContacts(req.tenantId, req.params.id, params);

      res.json({
        success: true,
        data: result.contacts,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/segments/:id/sync',
  requirePermission('crm:segments:update'),
  async (req, res, next) => {
    try {
      const segment = await crmService.syncSegment(req.tenantId, req.params.id);

      res.json({
        success: true,
        data: segment,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ COMPANIES (Extended) ============

router.get('/companies/:id', requirePermission('crm:companies:read'), async (req, res, next) => {
  try {
    const company = await crmService.getCompany(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: company,
    });
  } catch (error) {
    next(error);
  }
});

// Get contacts for a specific company
router.get(
  '/companies/:id/contacts',
  requirePermission('crm:contacts:read'),
  async (req, res, next) => {
    try {
      const params = z
        .object({
          page: z.coerce.number().min(1).default(1),
          limit: z.coerce.number().min(1).max(100).default(25),
        })
        .parse(req.query);

      const result = await crmService.getContacts(req.tenantId, {
        ...params,
        companyId: req.params.id,
      });

      res.json({
        success: true,
        data: result.contacts,
        meta: result.meta,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  '/companies/:id',
  requirePermission('crm:companies:update'),
  async (req, res, next) => {
    try {
      const updateCompanySchema = z.object({
        name: z.string().min(1).optional(),
        domain: z.string().optional(),
        description: z.string().optional(),
        industry: z.string().optional(),
        size: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        postalCode: z.string().optional(),
        customFields: z.record(z.unknown()).optional(),
      });

      const data = updateCompanySchema.parse(req.body);
      const company = await crmService.updateCompany(req.tenantId, req.params.id, data);

      res.json({
        success: true,
        data: company,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/companies/:id',
  requirePermission('crm:companies:delete'),
  async (req, res, next) => {
    try {
      await crmService.deleteCompany(req.tenantId, req.params.id);

      res.json({
        success: true,
        message: 'Company deleted',
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ ACTIVITIES (Extended) ============

router.get('/activities/:id', requirePermission('crm:activities:read'), async (req, res, next) => {
  try {
    const activity = await crmService.getActivity(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  '/activities/:id',
  requirePermission('crm:activities:update'),
  async (req, res, next) => {
    try {
      const updateActivitySchema = z.object({
        type: z.enum(['CALL', 'MEETING', 'TASK', 'NOTE', 'EMAIL']).optional(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        dueAt: z.string().datetime().optional(),
        completedAt: z.string().datetime().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        assignedToId: z.string().uuid().optional(),
      });

      const data = updateActivitySchema.parse(req.body);
      const activity = await crmService.updateActivity(req.tenantId, req.params.id, data);

      res.json({
        success: true,
        data: activity,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/activities/:id',
  requirePermission('crm:activities:delete'),
  async (req, res, next) => {
    try {
      await crmService.deleteActivity(req.tenantId, req.params.id);

      res.json({
        success: true,
        message: 'Activity deleted',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/activities/:id/complete',
  requirePermission('crm:activities:update'),
  async (req, res, next) => {
    try {
      const activity = await crmService.completeActivity(req.tenantId, req.params.id);

      res.json({
        success: true,
        data: activity,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ LEADS ============

router.get('/leads', requirePermission('crm:leads:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        search: z.string().optional(),
        status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED']).optional(),
        source: z.string().optional(),
        ownerId: z.string().optional(),
      })
      .parse(req.query);

    const result = await crmService.getLeads(req.tenantId, params);

    res.json({
      success: true,
      data: result.leads,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/leads/stats', requirePermission('crm:leads:read'), async (req, res, next) => {
  try {
    const stats = await crmService.getLeadStats(req.tenantId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/leads/:id', requirePermission('crm:leads:read'), async (req, res, next) => {
  try {
    const lead = await crmService.getLead(req.tenantId, req.params.id);

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/leads', requirePermission('crm:leads:create'), async (req, res, next) => {
  try {
    const createLeadSchema = z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
      source: z.string().optional(),
      sourceDetails: z.record(z.unknown()).optional(),
      status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED']).optional(),
      qualificationScore: z.number().min(0).max(100).optional(),
      qualificationNotes: z.string().optional(),
      ownerId: z.string().optional(),
      customFields: z.record(z.unknown()).optional(),
    });

    const data = createLeadSchema.parse(req.body);
    const lead = await crmService.createLead(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/leads/:id', requirePermission('crm:leads:update'), async (req, res, next) => {
  try {
    const updateLeadSchema = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
      source: z.string().optional(),
      sourceDetails: z.record(z.unknown()).optional(),
      status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED']).optional(),
      qualificationScore: z.number().min(0).max(100).optional(),
      qualificationNotes: z.string().optional(),
      ownerId: z.string().optional(),
      customFields: z.record(z.unknown()).optional(),
    });

    const data = updateLeadSchema.parse(req.body);
    const lead = await crmService.updateLead(req.tenantId, req.params.id, data);

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/leads/:id', requirePermission('crm:leads:delete'), async (req, res, next) => {
  try {
    await crmService.deleteLead(req.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Lead deleted',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/leads/:id/qualify', requirePermission('crm:leads:update'), async (req, res, next) => {
  try {
    const qualifySchema = z.object({
      qualified: z.boolean(),
      score: z.number().min(0).max(100).optional(),
      notes: z.string().optional(),
    });

    const data = qualifySchema.parse(req.body);
    const lead = await crmService.qualifyLead(req.tenantId, req.params.id, data);

    res.json({
      success: true,
      data: lead,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/leads/:id/convert', requirePermission('crm:leads:update'), async (req, res, next) => {
  try {
    const convertSchema = z.object({
      createContact: z.boolean().default(true),
      createDeal: z.boolean().default(false),
      dealData: z
        .object({
          name: z.string().optional(),
          amount: z.number().optional(),
          expectedCloseDate: z.string().datetime().optional(),
        })
        .optional(),
    });

    const data = convertSchema.parse(req.body);
    const result = await crmService.convertLead(req.tenantId, req.userId, req.params.id, data);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// ============ DEALS (Redirect to Pipeline) ============

router.get('/deals', requirePermission('crm:deals:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        search: z.string().optional(),
        stageId: z.string().optional(),
        contactId: z.string().optional(),
        ownerId: z.string().optional(),
      })
      .parse(req.query);

    const result = await pipelineService.getDeals(req.tenantId, params);

    res.json({
      success: true,
      data: result.deals,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

// ============ LEAD SCORING ============

router.get(
  '/contacts/:id/score',
  requirePermission('crm:contacts:read'),
  async (req, res, next) => {
    try {
      const result = await leadScoringService.calculateScore(req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/contacts/:id/recalculate-score',
  requirePermission('crm:contacts:update'),
  async (req, res, next) => {
    try {
      const result = await leadScoringService.calculateScore(req.params.id);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get current scoring configuration (merged with defaults)
router.get('/scoring/config', requirePermission('crm:contacts:read'), async (req, res, next) => {
  try {
    const config = await leadScoringService.getConfig(req.tenantId);
    const defaults = leadScoringService.getDefaultConfig();

    res.json({
      success: true,
      data: {
        config,
        defaults, // Include defaults for reference in UI
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update scoring configuration
router.put('/scoring/config', requirePermission('crm:contacts:update'), async (req, res, next) => {
  try {
    const updateConfigSchema = z.object({
      thresholds: z
        .object({
          MQL: z.number().min(1).max(100).optional(),
          SQL: z.number().min(1).max(100).optional(),
          HOT: z.number().min(1).max(100).optional(),
          WARM_MIN: z.number().min(1).max(100).optional(),
        })
        .optional(),
      engagement: z.record(z.string(), z.number()).optional(),
      fit: z
        .object({
          companySize: z.record(z.string(), z.number()).optional(),
          jobTitle: z.record(z.string(), z.number()).optional(),
          businessEmail: z.number().optional(),
          personalEmail: z.number().optional(),
          hasPhone: z.number().optional(),
        })
        .optional(),
      limits: z
        .object({
          maxEngagement: z.number().min(1).max(1000).optional(),
          maxFit: z.number().min(1).max(1000).optional(),
          maxTotal: z.number().min(1).max(1000).optional(),
        })
        .optional(),
      personalDomains: z.array(z.string()).optional(),
    });

    const data = updateConfigSchema.parse(req.body);
    const updatedConfig = await leadScoringService.updateConfig(req.tenantId, data);

    res.json({
      success: true,
      data: updatedConfig,
      message: 'Scoring configuration updated successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Reset scoring configuration to defaults
router.post(
  '/scoring/config/reset',
  requirePermission('crm:contacts:update'),
  async (req, res, next) => {
    try {
      const config = await leadScoringService.resetConfig(req.tenantId);

      res.json({
        success: true,
        data: config,
        message: 'Scoring configuration reset to defaults',
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/scoring/recalculate-all',
  requirePermission('crm:contacts:update'),
  async (req, res, next) => {
    try {
      const results = await leadScoringService.recalculateAllScores(req.tenantId);

      res.json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ ACTIVITY TRACKING ============

router.post(
  '/track/activity',
  requirePermission('crm:activities:create'),
  async (req, res, next) => {
    try {
      const trackActivitySchema = z.object({
        type: z.string().min(1),
        contactId: z.string().optional(),
        companyId: z.string().optional(),
        dealId: z.string().optional(),
        subject: z.string().optional(),
        description: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
        dueDate: z.string().optional(),
        completedAt: z.string().optional(),
      });

      const data = trackActivitySchema.parse(req.body);
      const activity = await activityTrackingService.logActivity(req.tenantId, req.userId, data);

      res.status(201).json({
        success: true,
        data: activity,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/track/email-event',
  requirePermission('crm:activities:create'),
  async (req, res, next) => {
    try {
      const emailEventSchema = z.object({
        eventType: z.enum(['open', 'click', 'reply', 'bounce']),
        contactId: z.string(),
        emailId: z.string().optional(),
        subject: z.string().optional(),
        linkUrl: z.string().optional(),
      });

      const data = emailEventSchema.parse(req.body);
      const activity = await activityTrackingService.trackEmailEvent(
        req.tenantId,
        req.userId,
        data.eventType,
        data
      );

      res.status(201).json({
        success: true,
        data: activity,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/track/form-submission',
  requirePermission('crm:contacts:create'),
  async (req, res, next) => {
    try {
      const formSchema = z.object({
        contactId: z.string(),
        formName: z.string().optional(),
        formFields: z.record(z.unknown()).optional(),
        source: z.string().optional(),
      });

      const data = formSchema.parse(req.body);
      const activity = await activityTrackingService.trackFormSubmission(
        req.tenantId,
        data.contactId,
        data
      );

      res.status(201).json({
        success: true,
        data: activity,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/track/meeting',
  requirePermission('crm:activities:create'),
  async (req, res, next) => {
    try {
      const meetingSchema = z.object({
        contactId: z.string(),
        title: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        isCompleted: z.boolean().default(false),
        notes: z.string().optional(),
      });

      const data = meetingSchema.parse(req.body);
      const activity = await activityTrackingService.trackMeeting(req.tenantId, req.userId, data);

      res.status(201).json({
        success: true,
        data: activity,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/track/call', requirePermission('crm:activities:create'), async (req, res, next) => {
  try {
    const callSchema = z.object({
      contactId: z.string(),
      duration: z.number().optional(),
      outcome: z.string().optional(),
      notes: z.string().optional(),
      isCompleted: z.boolean().default(false),
    });

    const data = callSchema.parse(req.body);
    const activity = await activityTrackingService.trackCall(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  '/track/page-view',
  requirePermission('crm:contacts:update'),
  async (req, res, next) => {
    try {
      const pageViewSchema = z.object({
        contactId: z.string(),
        pageUrl: z.string(),
        pageTitle: z.string().optional(),
      });

      const data = pageViewSchema.parse(req.body);
      const activity = await activityTrackingService.trackPageView(
        req.tenantId,
        data.contactId,
        data
      );

      res.json({
        success: true,
        data: activity,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/contacts/:id/timeline',
  requirePermission('crm:contacts:read'),
  async (req, res, next) => {
    try {
      const timeline = await activityTrackingService.getContactTimeline(req.params.id);

      res.json({
        success: true,
        data: timeline,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/contacts/:id/engagement',
  requirePermission('crm:contacts:read'),
  async (req, res, next) => {
    try {
      const engagement = await activityTrackingService.getEngagementSummary(req.params.id);

      res.json({
        success: true,
        data: engagement,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ AUTOMATION ============

router.post(
  '/contacts/:id/qualify',
  requirePermission('crm:contacts:update'),
  async (req, res, next) => {
    try {
      const qualifySchema = z.object({
        notes: z.string().optional(),
      });

      const data = qualifySchema.parse(req.body);
      const result = await automationService.qualifyContact(req.params.id, req.userId, data.notes);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/contacts/:id/disqualify',
  requirePermission('crm:contacts:update'),
  async (req, res, next) => {
    try {
      const disqualifySchema = z.object({
        reason: z.string().min(1),
      });

      const data = disqualifySchema.parse(req.body);
      const result = await automationService.disqualifyContact(
        req.params.id,
        req.userId,
        data.reason
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/contacts/:id/set-follow-up',
  requirePermission('crm:contacts:update'),
  async (req, res, next) => {
    try {
      const followUpSchema = z.object({
        followUpDate: z.string(),
        nextActivityType: z.string().optional(),
      });

      const data = followUpSchema.parse(req.body);
      const result = await automationService.setFollowUp(
        req.params.id,
        data.followUpDate,
        data.nextActivityType
      );

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/contacts/:id/valid-statuses',
  requirePermission('crm:contacts:read'),
  async (req, res, next) => {
    try {
      const contact = await crmService.getContact(req.tenantId, req.params.id);
      const validStatuses = automationService.getValidNextStatuses(contact.leadStatus);

      res.json({
        success: true,
        data: {
          currentStatus: contact.leadStatus,
          validNextStatuses: validStatuses,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ BULK OPERATIONS ============

router.delete(
  '/contacts/bulk',
  requirePermission('crm:contacts:delete'),
  async (req, res, next) => {
    try {
      const bulkDeleteSchema = z.object({
        contactIds: z.array(z.string()).optional(),
        deleteAll: z.boolean().optional(),
      });

      const data = bulkDeleteSchema.parse(req.body);

      let deletedCount = 0;

      if (data.deleteAll) {
        const result = await crmService.deleteAllContacts(req.tenantId);
        deletedCount = result.count;
      } else if (data.contactIds && data.contactIds.length > 0) {
        const result = await crmService.bulkDeleteContacts(req.tenantId, data.contactIds);
        deletedCount = result.deletedCount;
      }

      res.json({
        success: true,
        data: { deletedCount },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Bulk add tags to contacts
router.post(
  '/contacts/bulk/tags',
  requirePermission('crm:contacts:update'),
  async (req, res, next) => {
    try {
      const bulkTagsSchema = z.object({
        contactIds: z.array(z.string()).min(1),
        tags: z.array(z.string()).min(1),
        action: z.enum(['add', 'remove']).default('add'),
      });

      const data = bulkTagsSchema.parse(req.body);

      let result;
      if (data.action === 'remove') {
        result = await crmService.bulkRemoveTags(req.tenantId, data.contactIds, data.tags);
      } else {
        result = await crmService.bulkAddTags(req.tenantId, data.contactIds, data.tags);
      }

      res.json({
        success: true,
        data: result,
        message: `Tags ${data.action === 'remove' ? 'removed from' : 'added to'} ${result.updated} contacts`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Bulk update owner for contacts
router.patch(
  '/contacts/bulk/owner',
  requirePermission('crm:contacts:update'),
  async (req, res, next) => {
    try {
      const bulkOwnerSchema = z.object({
        contactIds: z.array(z.string()).min(1),
        ownerId: z.string().nullable(),
      });

      const data = bulkOwnerSchema.parse(req.body);
      const result = await crmService.bulkUpdateOwner(req.tenantId, data.contactIds, data.ownerId);

      res.json({
        success: true,
        data: result,
        message: `Owner updated for ${result.updated} contacts`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Bulk update status/lifecycle for contacts
router.patch(
  '/contacts/bulk/status',
  requirePermission('crm:contacts:update'),
  async (req, res, next) => {
    try {
      const bulkStatusSchema = z.object({
        contactIds: z.array(z.string()).min(1),
        status: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED']).optional(),
        lifecycleStage: z
          .enum([
            'SUBSCRIBER',
            'LEAD',
            'MQL',
            'SQL',
            'OPPORTUNITY',
            'CUSTOMER',
            'EVANGELIST',
            'OTHER',
          ])
          .optional(),
        leadStatus: z
          .enum([
            'NEW',
            'OPEN',
            'IN_PROGRESS',
            'OPEN_DEAL',
            'UNQUALIFIED',
            'ATTEMPTED_TO_CONTACT',
            'CONNECTED',
            'BAD_TIMING',
          ])
          .optional(),
      });

      const data = bulkStatusSchema.parse(req.body);
      const { contactIds, ...updateData } = data;

      const result = await crmService.bulkUpdateStatus(req.tenantId, contactIds, updateData);

      res.json({
        success: true,
        data: result,
        message: `Status updated for ${result.updated} contacts`,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ============ CUSTOM FIELDS ============

// Get all custom fields for an entity type
router.get('/custom-fields', requirePermission('crm:contacts:read'), async (req, res, next) => {
  try {
    const paramsSchema = z.object({
      entityType: z.enum(['CONTACT', 'COMPANY', 'DEAL']).optional(),
    });

    const { entityType } = paramsSchema.parse(req.query);
    const fields = await customFieldsService.getFields(req.tenantId, entityType);

    res.json({
      success: true,
      data: fields,
    });
  } catch (error) {
    next(error);
  }
});

// Get a specific custom field
router.get('/custom-fields/:id', requirePermission('crm:contacts:read'), async (req, res, next) => {
  try {
    const field = await customFieldsService.getField(req.tenantId, req.params.id);

    if (!field) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Custom field not found' },
      });
    }

    res.json({
      success: true,
      data: field,
    });
  } catch (error) {
    next(error);
  }
});

// Create a custom field
router.post('/custom-fields', requirePermission('crm:contacts:update'), async (req, res, next) => {
  try {
    const createFieldSchema = z.object({
      entityType: z.enum(['CONTACT', 'COMPANY', 'DEAL']),
      name: z.string().min(1).max(100),
      apiName: z
        .string()
        .min(1)
        .max(50)
        .regex(/^[a-z][a-z0-9_]*$/)
        .optional(),
      fieldType: z.enum([
        'TEXT',
        'TEXTAREA',
        'NUMBER',
        'DATE',
        'DATETIME',
        'BOOLEAN',
        'SELECT',
        'MULTISELECT',
        'EMAIL',
        'PHONE',
        'URL',
        'CURRENCY',
      ]),
      description: z.string().max(500).optional(),
      isRequired: z.boolean().optional(),
      options: z.array(z.string()).optional(),
      defaultValue: z.string().optional(),
      placeholder: z.string().optional(),
    });

    const data = createFieldSchema.parse(req.body);
    const field = await customFieldsService.createField(req.tenantId, req.userId, data);

    res.status(201).json({
      success: true,
      data: field,
    });
  } catch (error) {
    next(error);
  }
});

// Update a custom field
router.patch(
  '/custom-fields/:id',
  requirePermission('crm:contacts:update'),
  async (req, res, next) => {
    try {
      const updateFieldSchema = z.object({
        name: z.string().min(1).max(100).optional(),
        apiName: z
          .string()
          .min(1)
          .max(50)
          .regex(/^[a-z][a-z0-9_]*$/)
          .optional(),
        fieldType: z
          .enum([
            'TEXT',
            'TEXTAREA',
            'NUMBER',
            'DATE',
            'DATETIME',
            'BOOLEAN',
            'SELECT',
            'MULTISELECT',
            'EMAIL',
            'PHONE',
            'URL',
            'CURRENCY',
          ])
          .optional(),
        description: z.string().max(500).optional(),
        isRequired: z.boolean().optional(),
        options: z.array(z.string()).optional(),
        defaultValue: z.string().optional(),
        placeholder: z.string().optional(),
        sortOrder: z.number().int().optional(),
      });

      const data = updateFieldSchema.parse(req.body);
      const field = await customFieldsService.updateField(req.tenantId, req.params.id, data);

      res.json({
        success: true,
        data: field,
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete a custom field
router.delete(
  '/custom-fields/:id',
  requirePermission('crm:contacts:update'),
  async (req, res, next) => {
    try {
      await customFieldsService.deleteField(req.tenantId, req.params.id);

      res.json({
        success: true,
        message: 'Custom field deleted',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Reorder custom fields
router.post(
  '/custom-fields/reorder',
  requirePermission('crm:contacts:update'),
  async (req, res, next) => {
    try {
      const reorderSchema = z.object({
        entityType: z.enum(['CONTACT', 'COMPANY', 'DEAL']),
        fieldIds: z.array(z.string()),
      });

      const { entityType, fieldIds } = reorderSchema.parse(req.body);
      const fields = await customFieldsService.reorderFields(req.tenantId, entityType, fieldIds);

      res.json({
        success: true,
        data: fields,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ================= MEETINGS =================

/**
 * Create a meeting with automatic calendar integration
 * If user has connected Google/Microsoft/Zoom, creates real calendar event with meeting link
 */
router.post('/meetings', requirePermission('crm:activities:create'), async (req, res, next) => {
  try {
    const createMeetingSchema = z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      startTime: z.string().datetime(), // ISO 8601 format
      endTime: z.string().datetime(), // ISO 8601 format
      type: z.enum(['IN_PERSON', 'VIDEO_CALL', 'PHONE_CALL']).default('IN_PERSON'),
      location: z.string().optional(),
      attendees: z.array(z.string().email()).optional(),
      contactId: z.string().optional(),
      companyId: z.string().optional(),
      dealId: z.string().optional(),
      platform: z.enum(['google', 'microsoft', 'zoom']).optional(), // Only for VIDEO_CALL
      timezone: z.string().default('UTC'),
    });

    const data = createMeetingSchema.parse(req.body);
    const { id: userId } = req.user;

    let meetingLink = data.location;
    let calendarEventId = null;
    let calendarPlatform = null;

    // If it's a video call and user selected a platform, create calendar event
    if (data.type === 'VIDEO_CALL' && data.platform) {
      try {
        // Get user's OAuth access token
        const accessToken = await oauthService.getAccessToken(userId, data.platform);

        // Create calendar event with meeting link
        let calendarResult;
        if (data.platform === 'google') {
          calendarResult = await calendarService.createGoogleMeetEvent({
            accessToken,
            title: data.title,
            description: data.description,
            startTime: data.startTime,
            endTime: data.endTime,
            attendees: data.attendees,
            timezone: data.timezone,
          });
        } else if (data.platform === 'microsoft') {
          calendarResult = await calendarService.createTeamsMeeting({
            accessToken,
            title: data.title,
            description: data.description,
            startTime: data.startTime,
            endTime: data.endTime,
            attendees: data.attendees,
            timezone: data.timezone,
          });
        } else if (data.platform === 'zoom') {
          calendarResult = await calendarService.createZoomMeeting({
            accessToken,
            title: data.title,
            description: data.description,
            startTime: data.startTime,
            endTime: data.endTime,
            attendees: data.attendees,
            timezone: data.timezone,
          });
        }

        meetingLink = calendarResult.meetingLink;
        calendarEventId = calendarResult.eventId;
        calendarPlatform = calendarResult.platform;
      } catch (error) {
        console.error('Calendar integration error:', error.message);
        // Continue without calendar link if OAuth fails
        // This allows fallback to manual link entry
      }
    }

    // Store meeting in database as Activity
    const activity = await crmService.createActivity(req.tenantId, userId, {
      type: 'MEETING',
      title: data.title,
      description: data.description,
      contactId: data.contactId,
      companyId: data.companyId,
      dealId: data.dealId,
      dueAt: data.startTime,
      metadata: {
        meetingType: data.type,
        location: meetingLink || data.location,
        startTime: data.startTime,
        endTime: data.endTime,
        attendees: data.attendees,
        calendarEventId,
        calendarPlatform,
        timezone: data.timezone,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        ...activity,
        meetingLink,
        calendarEventId,
        calendarPlatform,
      },
      message: meetingLink
        ? `Meeting scheduled with ${calendarPlatform} link`
        : 'Meeting scheduled',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all meetings
 */
router.get('/meetings', requirePermission('crm:activities:read'), async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        contactId: z.string().optional(),
        companyId: z.string().optional(),
        dealId: z.string().optional(),
      })
      .parse(req.query);

    const result = await crmService.getActivities(req.tenantId, {
      ...params,
      type: 'MEETING',
    });

    res.json({
      success: true,
      data: result.activities,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

// ================= NOTES =================
// Notes are stored as Activity records with type='NOTE'
// These endpoints provide a convenient alias for note-specific operations

/**
 * Get notes for CRM entities
 * Notes are Activities with type='NOTE' - this proxies to activities endpoint
 */
router.get('/notes', requirePermission('crm:contacts:read'), async (req, res, next) => {
  try {
    const { contactId, companyId, dealId, limit = 25, page = 1 } = req.query;

    // Notes are Activities with type='NOTE'
    const params = {
      type: 'NOTE',
      page: parseInt(page),
      limit: parseInt(limit),
    };

    if (contactId) params.contactId = contactId;
    if (companyId) params.companyId = companyId;
    if (dealId) params.dealId = dealId;

    const result = await crmService.getActivities(req.tenantId, params);

    res.json({
      success: true,
      data: result.activities,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Create a note for CRM entity
 * Creates an Activity record with type='NOTE'
 */
router.post('/notes', requirePermission('crm:contacts:create'), async (req, res, next) => {
  try {
    const { contactId, companyId, dealId, content, title } = req.body;

    // Create an activity with type='NOTE'
    const activity = await crmService.createActivity(req.tenantId, req.userId, {
      type: 'NOTE',
      title: title || 'Note',
      description: content,
      contactId,
      companyId,
      dealId,
    });

    res.status(201).json({
      success: true,
      data: activity,
      message: 'Note created successfully',
    });
  } catch (error) {
    next(error);
  }
});

export { router as crmRouter };
