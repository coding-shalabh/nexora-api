import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock data
const mockContact = {
  id: 'contact_123',
  tenantId: 'tenant_123',
  firstName: 'John',
  lastName: 'Doe',
  displayName: 'John Doe',
  email: 'john@example.com',
  phone: '+1234567890',
  status: 'ACTIVE',
  lifecycleStage: 'LEAD',
  leadStatus: 'NEW',
  companyId: 'company_123',
  createdAt: new Date(),
  updatedAt: new Date(),
  company: {
    id: 'company_123',
    name: 'Acme Corp',
  },
  tags: [
    {
      tag: {
        id: 'tag_123',
        name: 'VIP',
        color: '#FF0000',
      },
    },
  ],
  activities: [],
  deals: [],
};

const mockCompany = {
  id: 'company_123',
  tenantId: 'tenant_123',
  name: 'Acme Corp',
  domain: 'acme.com',
  industry: 'Technology',
  size: '10-50',
  status: 'ACTIVE',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockTag = {
  id: 'tag_123',
  tenantId: 'tenant_123',
  name: 'VIP',
  color: '#FF0000',
};

// Mock Prisma
const mockPrisma = {
  contact: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  company: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  tag: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    upsert: vi.fn(),
  },
  contactTag: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  activity: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('@crm360/database', () => ({
  prisma: mockPrisma,
}));

// Mock shared errors
vi.mock('@crm360/shared', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(message) {
      super(message);
      this.name = 'NotFoundError';
      this.statusCode = 404;
    }
  },
  BadRequestError: class BadRequestError extends Error {
    constructor(message) {
      super(message);
      this.name = 'BadRequestError';
      this.statusCode = 400;
    }
  },
}));

// Mock event bus
vi.mock('../../common/events/event-bus.js', () => ({
  eventBus: {
    publish: vi.fn(),
  },
  createEvent: vi.fn((type, tenantId, data, meta) => ({
    type,
    tenantId,
    data,
    meta,
  })),
  EventTypes: {
    CONTACT_CREATED: 'contact.created',
    CONTACT_UPDATED: 'contact.updated',
    CONTACT_DELETED: 'contact.deleted',
    COMPANY_CREATED: 'company.created',
    COMPANY_UPDATED: 'company.updated',
  },
}));

describe('CrmService', () => {
  let crmService;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import fresh module
    const module = await import('../modules/crm/crm.service.js');
    crmService = module.crmService;
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // GET CONTACTS TESTS
  // ============================================

  describe('getContacts', () => {
    const defaultFilters = {
      page: 1,
      limit: 20,
    };

    it('should return paginated contacts', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([mockContact]);
      mockPrisma.contact.count.mockResolvedValue(1);

      const result = await crmService.getContacts('tenant_123', defaultFilters);

      expect(result.contacts).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('should filter contacts by search term', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([mockContact]);
      mockPrisma.contact.count.mockResolvedValue(1);

      await crmService.getContacts('tenant_123', {
        ...defaultFilters,
        search: 'John',
      });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant_123',
            OR: expect.arrayContaining([{ firstName: { contains: 'John', mode: 'insensitive' } }]),
          }),
        })
      );
    });

    it('should filter contacts by status', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([mockContact]);
      mockPrisma.contact.count.mockResolvedValue(1);

      await crmService.getContacts('tenant_123', {
        ...defaultFilters,
        status: 'ACTIVE',
      });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant_123',
            status: 'ACTIVE',
          }),
        })
      );
    });

    it('should filter contacts by companyId', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([mockContact]);
      mockPrisma.contact.count.mockResolvedValue(1);

      await crmService.getContacts('tenant_123', {
        ...defaultFilters,
        companyId: 'company_123',
      });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant_123',
            companyId: 'company_123',
          }),
        })
      );
    });

    it('should filter contacts by lifecycleStage', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([mockContact]);
      mockPrisma.contact.count.mockResolvedValue(1);

      await crmService.getContacts('tenant_123', {
        ...defaultFilters,
        lifecycleStage: 'LEAD',
      });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            lifecycleStage: 'LEAD',
          }),
        })
      );
    });

    it('should filter contacts by tags', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([mockContact]);
      mockPrisma.contact.count.mockResolvedValue(1);

      await crmService.getContacts('tenant_123', {
        ...defaultFilters,
        tags: 'VIP,Important',
      });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tags: {
              some: {
                tag: {
                  name: { in: ['VIP', 'Important'] },
                },
              },
            },
          }),
        })
      );
    });

    it('should handle pagination correctly', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([]);
      mockPrisma.contact.count.mockResolvedValue(100);

      const result = await crmService.getContacts('tenant_123', {
        page: 3,
        limit: 10,
      });

      expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        })
      );
      expect(result.meta.totalPages).toBe(10);
    });

    it('should transform tags correctly', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([mockContact]);
      mockPrisma.contact.count.mockResolvedValue(1);

      const result = await crmService.getContacts('tenant_123', defaultFilters);

      expect(result.contacts[0].tags).toEqual([{ id: 'tag_123', name: 'VIP', color: '#FF0000' }]);
    });
  });

  // ============================================
  // GET CONTACT TESTS
  // ============================================

  describe('getContact', () => {
    it('should return contact by id', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(mockContact);

      const result = await crmService.getContact('tenant_123', 'contact_123');

      expect(result.id).toBe('contact_123');
      expect(result.firstName).toBe('John');
    });

    it('should throw NotFoundError if contact not found', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);

      await expect(crmService.getContact('tenant_123', 'nonexistent')).rejects.toThrow(
        'Contact not found'
      );
    });

    it('should include company, tags, activities, and deals', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(mockContact);

      const result = await crmService.getContact('tenant_123', 'contact_123');

      expect(result.company).toBeDefined();
      expect(result.tags).toBeDefined();
      expect(result.activities).toBeDefined();
      expect(result.deals).toBeDefined();
    });

    it('should enforce tenant isolation', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);

      await expect(crmService.getContact('tenant_456', 'contact_123')).rejects.toThrow(
        'Contact not found'
      );

      expect(mockPrisma.contact.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'contact_123', tenantId: 'tenant_456' },
        })
      );
    });
  });

  // ============================================
  // CREATE CONTACT TESTS
  // ============================================

  describe('createContact', () => {
    const validInput = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane@example.com',
      phone: '+9876543210',
    };

    it('should create a new contact', async () => {
      const createdContact = { ...mockContact, ...validInput, id: 'new_contact' };
      mockPrisma.contact.create.mockResolvedValue({
        ...createdContact,
        tags: [],
      });

      const result = await crmService.createContact('tenant_123', 'user_123', validInput);

      expect(result.firstName).toBe('Jane');
      expect(mockPrisma.contact.create).toHaveBeenCalled();
    });

    it('should create contact with tags', async () => {
      mockPrisma.tag.upsert.mockResolvedValue(mockTag);
      mockPrisma.contact.create.mockResolvedValue({
        ...mockContact,
        tags: [{ tag: mockTag }],
      });

      const result = await crmService.createContact('tenant_123', 'user_123', {
        ...validInput,
        tags: ['VIP'],
      });

      expect(mockPrisma.tag.upsert).toHaveBeenCalled();
      expect(result.tags).toHaveLength(1);
    });

    it('should set displayName from firstName and lastName', async () => {
      mockPrisma.contact.create.mockResolvedValue({
        ...mockContact,
        displayName: 'Jane Smith',
        tags: [],
      });

      await crmService.createContact('tenant_123', 'user_123', validInput);

      expect(mockPrisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            displayName: 'Jane Smith',
          }),
        })
      );
    });

    it('should connect company if companyId provided', async () => {
      mockPrisma.contact.create.mockResolvedValue({
        ...mockContact,
        tags: [],
      });

      await crmService.createContact('tenant_123', 'user_123', {
        ...validInput,
        companyId: 'company_123',
      });

      expect(mockPrisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            company: { connect: { id: 'company_123' } },
          }),
        })
      );
    });

    it('should emit CONTACT_CREATED event', async () => {
      const { eventBus } = await import('../../common/events/event-bus.js');
      mockPrisma.contact.create.mockResolvedValue({
        ...mockContact,
        id: 'new_contact',
        tags: [],
      });

      await crmService.createContact('tenant_123', 'user_123', validInput);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'contact.created',
          tenantId: 'tenant_123',
          data: { contactId: 'new_contact' },
        })
      );
    });

    it('should default status to ACTIVE', async () => {
      mockPrisma.contact.create.mockResolvedValue({
        ...mockContact,
        tags: [],
      });

      await crmService.createContact('tenant_123', 'user_123', validInput);

      expect(mockPrisma.contact.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'ACTIVE',
          }),
        })
      );
    });
  });

  // ============================================
  // UPDATE CONTACT TESTS
  // ============================================

  describe('updateContact', () => {
    const updateData = {
      firstName: 'Updated',
      lastName: 'Name',
    };

    it('should update an existing contact', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(mockContact);
      mockPrisma.contact.update.mockResolvedValue({
        ...mockContact,
        ...updateData,
        tags: [],
      });

      const result = await crmService.updateContact('tenant_123', 'contact_123', updateData);

      expect(result.firstName).toBe('Updated');
    });

    it('should throw NotFoundError if contact not found', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        crmService.updateContact('tenant_123', 'nonexistent', updateData)
      ).rejects.toThrow('Contact not found');
    });

    it('should enforce tenant isolation', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        crmService.updateContact('tenant_456', 'contact_123', updateData)
      ).rejects.toThrow('Contact not found');
    });
  });

  // ============================================
  // DELETE CONTACT TESTS
  // ============================================

  describe('deleteContact', () => {
    it('should delete an existing contact', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(mockContact);
      mockPrisma.contact.delete.mockResolvedValue(mockContact);

      await expect(crmService.deleteContact('tenant_123', 'contact_123')).resolves.not.toThrow();

      expect(mockPrisma.contact.delete).toHaveBeenCalledWith({
        where: { id: 'contact_123' },
      });
    });

    it('should throw NotFoundError if contact not found', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);

      await expect(crmService.deleteContact('tenant_123', 'nonexistent')).rejects.toThrow(
        'Contact not found'
      );
    });
  });
});

// ============================================
// COMPANY TESTS
// ============================================

describe('CrmService - Companies', () => {
  let crmService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('../modules/crm/crm.service.js');
    crmService = module.crmService;
  });

  describe('getCompanies', () => {
    it('should return paginated companies', async () => {
      mockPrisma.company.findMany.mockResolvedValue([mockCompany]);
      mockPrisma.company.count.mockResolvedValue(1);

      const result = await crmService.getCompanies('tenant_123', {
        page: 1,
        limit: 20,
      });

      expect(result.companies).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should filter companies by search term', async () => {
      mockPrisma.company.findMany.mockResolvedValue([mockCompany]);
      mockPrisma.company.count.mockResolvedValue(1);

      await crmService.getCompanies('tenant_123', {
        page: 1,
        limit: 20,
        search: 'Acme',
      });

      expect(mockPrisma.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ name: { contains: 'Acme', mode: 'insensitive' } }]),
          }),
        })
      );
    });
  });

  describe('getCompany', () => {
    it('should return company by id', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);

      const result = await crmService.getCompany('tenant_123', 'company_123');

      expect(result.id).toBe('company_123');
      expect(result.name).toBe('Acme Corp');
    });

    it('should throw NotFoundError if company not found', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);

      await expect(crmService.getCompany('tenant_123', 'nonexistent')).rejects.toThrow(
        'Company not found'
      );
    });
  });

  describe('createCompany', () => {
    const validInput = {
      name: 'New Corp',
      domain: 'newcorp.com',
      industry: 'Finance',
    };

    it('should create a new company', async () => {
      mockPrisma.company.create.mockResolvedValue({
        ...mockCompany,
        ...validInput,
        id: 'new_company',
      });

      const result = await crmService.createCompany('tenant_123', 'user_123', validInput);

      expect(result.name).toBe('New Corp');
      expect(mockPrisma.company.create).toHaveBeenCalled();
    });
  });

  describe('updateCompany', () => {
    it('should update an existing company', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.company.update.mockResolvedValue({
        ...mockCompany,
        name: 'Updated Corp',
      });

      const result = await crmService.updateCompany('tenant_123', 'company_123', {
        name: 'Updated Corp',
      });

      expect(result.name).toBe('Updated Corp');
    });

    it('should throw NotFoundError if company not found', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);

      await expect(
        crmService.updateCompany('tenant_123', 'nonexistent', { name: 'Test' })
      ).rejects.toThrow('Company not found');
    });
  });

  describe('deleteCompany', () => {
    it('should delete an existing company', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(mockCompany);
      mockPrisma.company.delete.mockResolvedValue(mockCompany);

      await expect(crmService.deleteCompany('tenant_123', 'company_123')).resolves.not.toThrow();
    });

    it('should throw NotFoundError if company not found', async () => {
      mockPrisma.company.findFirst.mockResolvedValue(null);

      await expect(crmService.deleteCompany('tenant_123', 'nonexistent')).rejects.toThrow(
        'Company not found'
      );
    });
  });
});

// ============================================
// ACTIVITY TESTS
// ============================================

describe('CrmService - Activities', () => {
  let crmService;

  const mockActivity = {
    id: 'activity_123',
    tenantId: 'tenant_123',
    contactId: 'contact_123',
    type: 'NOTE',
    subject: 'Test activity',
    description: 'Activity description',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('../modules/crm/crm.service.js');
    crmService = module.crmService;
  });

  describe('getActivities', () => {
    it('should return paginated activities for a contact', async () => {
      mockPrisma.activity.findMany.mockResolvedValue([mockActivity]);
      mockPrisma.activity.count.mockResolvedValue(1);

      const result = await crmService.getActivities('tenant_123', 'contact_123', {
        page: 1,
        limit: 20,
      });

      expect(result.activities).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('createActivity', () => {
    const validInput = {
      contactId: 'contact_123',
      type: 'NOTE',
      subject: 'New note',
      description: 'Note description',
    };

    it('should create a new activity', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(mockContact);
      mockPrisma.activity.create.mockResolvedValue({
        ...mockActivity,
        ...validInput,
      });

      const result = await crmService.createActivity('tenant_123', 'user_123', validInput);

      expect(result.type).toBe('NOTE');
      expect(result.subject).toBe('New note');
    });
  });
});

// ============================================
// DUPLICATE DETECTION TESTS
// ============================================

describe('CrmService - Duplicate Detection', () => {
  let crmService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('../modules/crm/crm.service.js');
    crmService = module.crmService;
  });

  describe('findDuplicates', () => {
    it('should find contacts with matching email', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([
        { ...mockContact, id: 'contact_1', email: 'test@example.com' },
        { ...mockContact, id: 'contact_2', email: 'test@example.com' },
      ]);

      const result = await crmService.findDuplicates('tenant_123', {
        page: 1,
        limit: 20,
      });

      expect(result.duplicates).toBeDefined();
    });
  });
});

// ============================================
// TENANT ISOLATION TESTS
// ============================================

describe('CrmService - Tenant Isolation', () => {
  let crmService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('../modules/crm/crm.service.js');
    crmService = module.crmService;
  });

  it('should always include tenantId in queries', async () => {
    mockPrisma.contact.findMany.mockResolvedValue([]);
    mockPrisma.contact.count.mockResolvedValue(0);

    await crmService.getContacts('tenant_123', { page: 1, limit: 20 });

    expect(mockPrisma.contact.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant_123',
        }),
      })
    );
  });

  it('should not return data from other tenants', async () => {
    // Simulate contact belonging to different tenant
    mockPrisma.contact.findFirst.mockResolvedValue(null);

    await expect(crmService.getContact('tenant_456', 'contact_123')).rejects.toThrow(
      'Contact not found'
    );
  });
});
