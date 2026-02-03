/**
 * Pipeline Service Unit Tests
 *
 * Tests for pipeline, lead, deal, and product management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing service
vi.mock('@crm360/database', () => ({
  prisma: {
    pipeline: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    stage: {
      findFirst: vi.fn(),
    },
    lead: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    deal: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    contact: {
      create: vi.fn(),
    },
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    dealProduct: {
      create: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@crm360/shared', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(message) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
}));

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
    LEAD_CREATED: 'LEAD_CREATED',
    LEAD_UPDATED: 'LEAD_UPDATED',
    LEAD_DELETED: 'LEAD_DELETED',
    LEAD_CONVERTED: 'LEAD_CONVERTED',
    DEAL_CREATED: 'DEAL_CREATED',
    DEAL_UPDATED: 'DEAL_UPDATED',
    DEAL_DELETED: 'DEAL_DELETED',
    DEAL_STAGE_CHANGED: 'DEAL_STAGE_CHANGED',
    DEAL_WON: 'DEAL_WON',
    DEAL_LOST: 'DEAL_LOST',
  },
}));

import { pipelineService } from '../modules/pipeline/pipeline.service.js';
import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import { eventBus, createEvent, EventTypes } from '../../common/events/event-bus.js';

describe('PipelineService', () => {
  const tenantId = 'tenant-123';
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ PIPELINE TESTS ============

  describe('getPipelines', () => {
    it('should return all pipelines for a tenant', async () => {
      const mockPipelines = [
        {
          id: 'pipeline-1',
          name: 'Sales Pipeline',
          type: 'DEAL',
          tenantId,
          stages: [
            { id: 'stage-1', name: 'Qualification', order: 1 },
            { id: 'stage-2', name: 'Proposal', order: 2 },
          ],
        },
        {
          id: 'pipeline-2',
          name: 'Lead Pipeline',
          type: 'LEAD',
          tenantId,
          stages: [{ id: 'stage-3', name: 'New', order: 1 }],
        },
      ];

      prisma.pipeline.findMany.mockResolvedValue(mockPipelines);

      const result = await pipelineService.getPipelines(tenantId);

      expect(prisma.pipeline.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: { stages: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(mockPipelines);
    });

    it('should filter pipelines by type', async () => {
      const mockPipelines = [
        {
          id: 'pipeline-1',
          name: 'Sales Pipeline',
          type: 'DEAL',
          tenantId,
          stages: [],
        },
      ];

      prisma.pipeline.findMany.mockResolvedValue(mockPipelines);

      const result = await pipelineService.getPipelines(tenantId, 'DEAL');

      expect(prisma.pipeline.findMany).toHaveBeenCalledWith({
        where: { tenantId, type: 'DEAL' },
        include: { stages: { orderBy: { order: 'asc' } } },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(mockPipelines);
    });

    it('should return empty array when no pipelines exist', async () => {
      prisma.pipeline.findMany.mockResolvedValue([]);

      const result = await pipelineService.getPipelines(tenantId);

      expect(result).toEqual([]);
    });
  });

  // ============ LEAD TESTS ============

  describe('getLeads', () => {
    const filters = { page: 1, limit: 10 };

    it('should return leads with pagination', async () => {
      const mockLeads = [
        { id: 'lead-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        { id: 'lead-2', firstName: 'Jane', lastName: 'Smith', email: 'jane@example.com' },
      ];

      prisma.lead.findMany.mockResolvedValue(mockLeads);
      prisma.lead.count.mockResolvedValue(2);

      const result = await pipelineService.getLeads(tenantId, filters);

      expect(prisma.lead.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.leads).toEqual(mockLeads);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter leads by status', async () => {
      const filtersWithStatus = { ...filters, status: 'NEW' };

      prisma.lead.findMany.mockResolvedValue([]);
      prisma.lead.count.mockResolvedValue(0);

      await pipelineService.getLeads(tenantId, filtersWithStatus);

      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, status: 'NEW' },
        })
      );
    });

    it('should filter leads by assignedTo', async () => {
      const filtersWithOwner = { ...filters, assignedTo: userId };

      prisma.lead.findMany.mockResolvedValue([]);
      prisma.lead.count.mockResolvedValue(0);

      await pipelineService.getLeads(tenantId, filtersWithOwner);

      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, ownerId: userId },
        })
      );
    });

    it('should search leads by name, email, or company', async () => {
      const filtersWithSearch = { ...filters, search: 'john' };

      prisma.lead.findMany.mockResolvedValue([]);
      prisma.lead.count.mockResolvedValue(0);

      await pipelineService.getLeads(tenantId, filtersWithSearch);

      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId,
            OR: [
              { firstName: { contains: 'john', mode: 'insensitive' } },
              { lastName: { contains: 'john', mode: 'insensitive' } },
              { email: { contains: 'john', mode: 'insensitive' } },
              { company: { contains: 'john', mode: 'insensitive' } },
            ],
          },
        })
      );
    });

    it('should calculate pagination correctly', async () => {
      const filtersPage2 = { page: 2, limit: 5 };

      prisma.lead.findMany.mockResolvedValue([]);
      prisma.lead.count.mockResolvedValue(12);

      const result = await pipelineService.getLeads(tenantId, filtersPage2);

      expect(prisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 5,
          take: 5,
        })
      );
      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('getLead', () => {
    it('should return a lead by id', async () => {
      const mockLead = {
        id: 'lead-1',
        firstName: 'John',
        lastName: 'Doe',
        tenantId,
        contact: null,
      };

      prisma.lead.findFirst.mockResolvedValue(mockLead);

      const result = await pipelineService.getLead(tenantId, 'lead-1');

      expect(prisma.lead.findFirst).toHaveBeenCalledWith({
        where: { id: 'lead-1', tenantId },
        include: { contact: true },
      });
      expect(result).toEqual(mockLead);
    });

    it('should throw NotFoundError when lead does not exist', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);

      await expect(pipelineService.getLead(tenantId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createLead', () => {
    it('should create a new lead', async () => {
      const data = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        company: 'Acme Inc',
        jobTitle: 'Manager',
        source: 'WEBSITE',
        score: 75,
        notes: 'Hot lead',
      };

      const mockLead = { id: 'lead-1', ...data, tenantId, status: 'NEW' };

      prisma.lead.create.mockResolvedValue(mockLead);

      const result = await pipelineService.createLead(tenantId, userId, data);

      expect(prisma.lead.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          company: data.company,
          jobTitle: data.jobTitle,
          source: data.source,
          status: 'NEW',
          qualificationScore: data.score,
          qualificationNotes: data.notes,
          ownerId: userId,
        },
      });
      expect(result).toEqual(mockLead);
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(
        EventTypes.LEAD_CREATED,
        tenantId,
        { leadId: 'lead-1' },
        { userId }
      );
    });

    it('should use default score when not provided', async () => {
      const data = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };

      const mockLead = { id: 'lead-1', ...data, tenantId };

      prisma.lead.create.mockResolvedValue(mockLead);

      await pipelineService.createLead(tenantId, userId, data);

      expect(prisma.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            qualificationScore: 0,
          }),
        })
      );
    });
  });

  describe('updateLead', () => {
    it('should update an existing lead', async () => {
      const existingLead = { id: 'lead-1', tenantId };
      const updateData = {
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        status: 'QUALIFIED',
        assignedToId: 'user-456',
      };

      prisma.lead.findFirst.mockResolvedValue(existingLead);
      prisma.lead.update.mockResolvedValue({ ...existingLead, ...updateData });

      const result = await pipelineService.updateLead(tenantId, 'lead-1', updateData);

      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phone: undefined,
          company: undefined,
          source: undefined,
          status: 'QUALIFIED',
          qualificationScore: undefined,
          qualificationNotes: undefined,
          ownerId: 'user-456',
        },
      });
      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('should throw NotFoundError when lead does not exist', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);

      await expect(pipelineService.updateLead(tenantId, 'nonexistent', {})).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('deleteLead', () => {
    it('should delete an existing lead', async () => {
      const existingLead = { id: 'lead-1', tenantId };

      prisma.lead.findFirst.mockResolvedValue(existingLead);
      prisma.lead.delete.mockResolvedValue(existingLead);

      await pipelineService.deleteLead(tenantId, 'lead-1');

      expect(prisma.lead.delete).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
      });
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(EventTypes.LEAD_DELETED, tenantId, {
        leadId: 'lead-1',
      });
    });

    it('should throw NotFoundError when lead does not exist', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);

      await expect(pipelineService.deleteLead(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('convertLead', () => {
    it('should convert lead to contact and deal', async () => {
      const lead = {
        id: 'lead-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        source: 'WEBSITE',
        ownerId: userId,
        tenantId,
      };

      const conversionData = {
        pipelineId: 'pipeline-1',
        stageId: 'stage-1',
        value: 50000,
      };

      const mockContact = { id: 'contact-1', ...lead };
      const mockDeal = {
        id: 'deal-1',
        name: 'John Doe - Deal',
        pipelineId: 'pipeline-1',
        stageId: 'stage-1',
        amount: 50000,
      };

      prisma.lead.findFirst.mockResolvedValue(lead);
      prisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          contact: {
            create: vi.fn().mockResolvedValue(mockContact),
          },
          deal: {
            create: vi.fn().mockResolvedValue(mockDeal),
          },
          lead: {
            update: vi.fn().mockResolvedValue({ ...lead, status: 'CONVERTED' }),
          },
        };
        return await callback(tx);
      });

      const result = await pipelineService.convertLead(tenantId, 'lead-1', conversionData);

      expect(prisma.lead.findFirst).toHaveBeenCalledWith({
        where: { id: 'lead-1', tenantId },
      });
      expect(result).toEqual(mockDeal);
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(EventTypes.LEAD_CONVERTED, tenantId, {
        leadId: 'lead-1',
        dealId: 'deal-1',
      });
    });

    it('should throw NotFoundError when lead does not exist', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);

      await expect(
        pipelineService.convertLead(tenantId, 'nonexistent', {
          pipelineId: 'p1',
          stageId: 's1',
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ============ DEAL TESTS ============

  describe('getDeals', () => {
    const filters = { page: 1, limit: 10 };

    it('should return deals with pagination', async () => {
      const mockDeals = [
        {
          id: 'deal-1',
          name: 'Enterprise Deal',
          amount: 100000,
          contact: { id: 'c1', firstName: 'John', lastName: 'Doe' },
          company: { id: 'comp1', name: 'Acme' },
          stage: { id: 's1', name: 'Proposal', probability: 60 },
          pipeline: { id: 'p1', name: 'Sales' },
        },
      ];

      prisma.deal.findMany.mockResolvedValue(mockDeals);
      prisma.deal.count.mockResolvedValue(1);

      const result = await pipelineService.getDeals(tenantId, filters);

      expect(prisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId },
          include: {
            contact: { select: { id: true, firstName: true, lastName: true } },
            company: { select: { id: true, name: true } },
            stage: { select: { id: true, name: true, probability: true } },
            pipeline: { select: { id: true, name: true } },
          },
        })
      );
      expect(result.deals).toEqual(mockDeals);
      expect(result.meta.total).toBe(1);
    });

    it('should filter deals by pipelineId', async () => {
      const filtersWithPipeline = { ...filters, pipelineId: 'pipeline-1' };

      prisma.deal.findMany.mockResolvedValue([
        { id: 'deal-1', name: 'Deal', pipelineId: 'pipeline-1' },
      ]);
      prisma.deal.count.mockResolvedValue(1);

      await pipelineService.getDeals(tenantId, filtersWithPipeline);

      expect(prisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, pipelineId: 'pipeline-1' },
        })
      );
    });

    it('should filter deals by stageId', async () => {
      const filtersWithStage = { ...filters, stageId: 'stage-1' };

      prisma.deal.findMany.mockResolvedValue([{ id: 'deal-1', name: 'Deal', stageId: 'stage-1' }]);
      prisma.deal.count.mockResolvedValue(1);

      await pipelineService.getDeals(tenantId, filtersWithStage);

      expect(prisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, stageId: 'stage-1' },
        })
      );
    });

    it('should filter deals by contactId and companyId', async () => {
      const filtersWithContact = { ...filters, contactId: 'contact-1', companyId: 'company-1' };

      prisma.deal.findMany.mockResolvedValue([{ id: 'deal-1', name: 'Deal' }]);
      prisma.deal.count.mockResolvedValue(1);

      await pipelineService.getDeals(tenantId, filtersWithContact);

      expect(prisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, contactId: 'contact-1', companyId: 'company-1' },
        })
      );
    });

    it('should search deals by name', async () => {
      const filtersWithSearch = { ...filters, search: 'enterprise' };

      prisma.deal.findMany.mockResolvedValue([{ id: 'deal-1', name: 'Enterprise Deal' }]);
      prisma.deal.count.mockResolvedValue(1);

      await pipelineService.getDeals(tenantId, filtersWithSearch);

      expect(prisma.deal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            tenantId,
            OR: [{ name: { contains: 'enterprise', mode: 'insensitive' } }],
          },
        })
      );
    });

    it('should return mock deals when no valid deals exist', async () => {
      const mockPipelines = [
        {
          id: 'pipeline-1',
          type: 'DEAL',
          stages: [
            { id: 'stage-1', name: 'Qualification', order: 1, probability: 20 },
            { id: 'stage-2', name: 'Proposal', order: 2, probability: 60 },
          ],
        },
      ];

      prisma.deal.findMany.mockResolvedValue([]);
      prisma.deal.count.mockResolvedValue(0);
      prisma.pipeline.findMany.mockResolvedValue(mockPipelines);

      const result = await pipelineService.getDeals(tenantId, filters);

      expect(prisma.pipeline.findMany).toHaveBeenCalledWith({
        where: { tenantId, type: 'DEAL' },
        include: { stages: { orderBy: { order: 'asc' } } },
      });
      expect(result.deals.length).toBeGreaterThan(0);
    });
  });

  describe('getDeal', () => {
    it('should return a deal by id with related data', async () => {
      const mockDeal = {
        id: 'deal-1',
        name: 'Enterprise Deal',
        amount: 100000,
        tenantId,
        contact: { id: 'c1', firstName: 'John', lastName: 'Doe' },
        company: { id: 'comp1', name: 'Acme' },
        pipeline: { id: 'p1', name: 'Sales' },
        stage: { id: 's1', name: 'Proposal', probability: 60 },
        activities: [],
      };

      prisma.deal.findFirst.mockResolvedValue(mockDeal);

      const result = await pipelineService.getDeal(tenantId, 'deal-1');

      expect(prisma.deal.findFirst).toHaveBeenCalledWith({
        where: { id: 'deal-1', tenantId },
        include: {
          contact: true,
          company: true,
          pipeline: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true, probability: true } },
          activities: { orderBy: { createdAt: 'desc' }, take: 10 },
        },
      });
      expect(result).toEqual(mockDeal);
    });

    it('should throw NotFoundError when deal does not exist', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);

      await expect(pipelineService.getDeal(tenantId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createDeal', () => {
    it('should create a new deal', async () => {
      const data = {
        title: 'New Enterprise Deal',
        pipelineId: 'pipeline-1',
        stageId: 'stage-1',
        contactId: 'contact-1',
        companyId: 'company-1',
        value: 150000,
        expectedCloseDate: '2024-06-30',
      };

      const mockStage = { id: 'stage-1', name: 'Qualification', probability: 20 };
      const mockDeal = {
        id: 'deal-1',
        name: data.title,
        amount: data.value,
        tenantId,
        stage: { id: 'stage-1', name: 'Qualification' },
        pipeline: { id: 'pipeline-1', name: 'Sales' },
      };

      prisma.stage.findFirst.mockResolvedValue(mockStage);
      prisma.deal.create.mockResolvedValue(mockDeal);

      const result = await pipelineService.createDeal(tenantId, userId, data);

      expect(prisma.deal.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          name: data.title,
          pipelineId: data.pipelineId,
          stageId: data.stageId,
          contactId: data.contactId,
          companyId: data.companyId,
          amount: data.value,
          expectedCloseDate: new Date(data.expectedCloseDate),
          ownerId: userId,
        },
        include: {
          stage: { select: { id: true, name: true } },
          pipeline: { select: { id: true, name: true } },
        },
      });
      expect(result).toEqual(mockDeal);
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(
        EventTypes.DEAL_CREATED,
        tenantId,
        { dealId: 'deal-1' },
        { userId }
      );
    });

    it('should create deal without expectedCloseDate', async () => {
      const data = {
        title: 'Quick Deal',
        pipelineId: 'pipeline-1',
        stageId: 'stage-1',
        value: 50000,
      };

      prisma.stage.findFirst.mockResolvedValue({ id: 'stage-1' });
      prisma.deal.create.mockResolvedValue({ id: 'deal-1', name: data.title });

      await pipelineService.createDeal(tenantId, userId, data);

      expect(prisma.deal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expectedCloseDate: undefined,
          }),
        })
      );
    });
  });

  describe('updateDeal', () => {
    it('should update an existing deal', async () => {
      const existingDeal = { id: 'deal-1', tenantId, name: 'Old Name' };
      const updateData = {
        title: 'Updated Deal Name',
        value: 200000,
        expectedCloseDate: '2024-08-15',
        notes: 'Updated notes',
        assignedToId: 'user-456',
      };

      prisma.deal.findFirst.mockResolvedValue(existingDeal);
      prisma.deal.update.mockResolvedValue({
        ...existingDeal,
        name: updateData.title,
        amount: updateData.value,
        pipeline: { id: 'p1', name: 'Sales' },
        stage: { id: 's1', name: 'Proposal' },
        contact: { id: 'c1', firstName: 'John', lastName: 'Doe' },
        company: { id: 'comp1', name: 'Acme' },
      });

      const result = await pipelineService.updateDeal(tenantId, 'deal-1', updateData);

      expect(prisma.deal.update).toHaveBeenCalledWith({
        where: { id: 'deal-1' },
        data: {
          name: updateData.title,
          amount: updateData.value,
          expectedCloseDate: new Date(updateData.expectedCloseDate),
          description: updateData.notes,
          ownerId: updateData.assignedToId,
        },
        include: {
          pipeline: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true } },
          contact: { select: { id: true, firstName: true, lastName: true } },
          company: { select: { id: true, name: true } },
        },
      });
      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('should throw NotFoundError when deal does not exist', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);

      await expect(pipelineService.updateDeal(tenantId, 'nonexistent', {})).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('deleteDeal', () => {
    it('should delete an existing deal', async () => {
      const existingDeal = { id: 'deal-1', tenantId };

      prisma.deal.findFirst.mockResolvedValue(existingDeal);
      prisma.deal.delete.mockResolvedValue(existingDeal);

      await pipelineService.deleteDeal(tenantId, 'deal-1');

      expect(prisma.deal.delete).toHaveBeenCalledWith({
        where: { id: 'deal-1' },
      });
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(EventTypes.DEAL_DELETED, tenantId, {
        dealId: 'deal-1',
      });
    });

    it('should throw NotFoundError when deal does not exist', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);

      await expect(pipelineService.deleteDeal(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('moveDeal', () => {
    it('should move a deal to a different stage', async () => {
      const existingDeal = { id: 'deal-1', tenantId, stageId: 'stage-1' };
      const newStage = { id: 'stage-2', name: 'Proposal', probability: 60 };

      prisma.deal.findFirst.mockResolvedValue(existingDeal);
      prisma.stage.findFirst.mockResolvedValue(newStage);
      prisma.deal.update.mockResolvedValue({
        ...existingDeal,
        stageId: 'stage-2',
        probability: 60,
        stage: { id: 'stage-2', name: 'Proposal' },
      });

      const result = await pipelineService.moveDeal(tenantId, 'deal-1', 'stage-2');

      expect(prisma.deal.update).toHaveBeenCalledWith({
        where: { id: 'deal-1' },
        data: {
          stageId: 'stage-2',
          probability: 60,
          updatedAt: expect.any(Date),
        },
        include: { stage: { select: { id: true, name: true } } },
      });
      expect(result.stageId).toBe('stage-2');
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(EventTypes.DEAL_STAGE_CHANGED, tenantId, {
        dealId: 'deal-1',
        fromStageId: 'stage-1',
        toStageId: 'stage-2',
      });
    });

    it('should throw NotFoundError when deal does not exist', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);

      await expect(pipelineService.moveDeal(tenantId, 'nonexistent', 'stage-2')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError when stage does not exist', async () => {
      prisma.deal.findFirst.mockResolvedValue({ id: 'deal-1', tenantId });
      prisma.stage.findFirst.mockResolvedValue(null);

      await expect(pipelineService.moveDeal(tenantId, 'deal-1', 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('winDeal', () => {
    it('should mark a deal as won', async () => {
      const existingDeal = {
        id: 'deal-1',
        tenantId,
        pipelineId: 'pipeline-1',
        amount: 100000,
        pipeline: { id: 'pipeline-1', name: 'Sales' },
      };
      const wonStage = { id: 'won-stage', name: 'Closed Won', isWon: true };

      prisma.deal.findFirst.mockResolvedValue(existingDeal);
      prisma.stage.findFirst.mockResolvedValue(wonStage);
      prisma.deal.update.mockResolvedValue({
        ...existingDeal,
        stageId: 'won-stage',
        closedAt: new Date(),
        probability: 100,
      });

      const result = await pipelineService.winDeal(tenantId, 'deal-1');

      expect(prisma.stage.findFirst).toHaveBeenCalledWith({
        where: { pipelineId: 'pipeline-1', isWon: true },
      });
      expect(prisma.deal.update).toHaveBeenCalledWith({
        where: { id: 'deal-1' },
        data: {
          stageId: 'won-stage',
          closedAt: expect.any(Date),
          probability: 100,
        },
      });
      expect(result.probability).toBe(100);
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(EventTypes.DEAL_WON, tenantId, {
        dealId: 'deal-1',
        value: 100000,
      });
    });

    it('should throw NotFoundError when deal does not exist', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);

      await expect(pipelineService.winDeal(tenantId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when won stage does not exist', async () => {
      prisma.deal.findFirst.mockResolvedValue({
        id: 'deal-1',
        tenantId,
        pipelineId: 'pipeline-1',
        pipeline: {},
      });
      prisma.stage.findFirst.mockResolvedValue(null);

      await expect(pipelineService.winDeal(tenantId, 'deal-1')).rejects.toThrow(NotFoundError);
    });
  });

  describe('loseDeal', () => {
    it('should mark a deal as lost', async () => {
      const existingDeal = {
        id: 'deal-1',
        tenantId,
        pipelineId: 'pipeline-1',
        pipeline: { id: 'pipeline-1', name: 'Sales' },
      };
      const lostStage = { id: 'lost-stage', name: 'Closed Lost', isLost: true };
      const reason = 'Budget constraints';

      prisma.deal.findFirst.mockResolvedValue(existingDeal);
      prisma.stage.findFirst.mockResolvedValue(lostStage);
      prisma.deal.update.mockResolvedValue({
        ...existingDeal,
        stageId: 'lost-stage',
        closedAt: new Date(),
        probability: 0,
        notes: `Lost reason: ${reason}`,
      });

      const result = await pipelineService.loseDeal(tenantId, 'deal-1', reason);

      expect(prisma.stage.findFirst).toHaveBeenCalledWith({
        where: { pipelineId: 'pipeline-1', isLost: true },
      });
      expect(prisma.deal.update).toHaveBeenCalledWith({
        where: { id: 'deal-1' },
        data: {
          stageId: 'lost-stage',
          closedAt: expect.any(Date),
          probability: 0,
          notes: `Lost reason: ${reason}`,
        },
      });
      expect(result.probability).toBe(0);
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(EventTypes.DEAL_LOST, tenantId, {
        dealId: 'deal-1',
        reason,
      });
    });

    it('should mark deal as lost without reason', async () => {
      const existingDeal = {
        id: 'deal-1',
        tenantId,
        pipelineId: 'pipeline-1',
        pipeline: {},
      };
      const lostStage = { id: 'lost-stage', isLost: true };

      prisma.deal.findFirst.mockResolvedValue(existingDeal);
      prisma.stage.findFirst.mockResolvedValue(lostStage);
      prisma.deal.update.mockResolvedValue({
        ...existingDeal,
        stageId: 'lost-stage',
        probability: 0,
      });

      await pipelineService.loseDeal(tenantId, 'deal-1');

      expect(prisma.deal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: undefined,
          }),
        })
      );
    });

    it('should throw NotFoundError when deal does not exist', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);

      await expect(pipelineService.loseDeal(tenantId, 'nonexistent', 'reason')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should throw NotFoundError when lost stage does not exist', async () => {
      prisma.deal.findFirst.mockResolvedValue({
        id: 'deal-1',
        tenantId,
        pipelineId: 'pipeline-1',
        pipeline: {},
      });
      prisma.stage.findFirst.mockResolvedValue(null);

      await expect(pipelineService.loseDeal(tenantId, 'deal-1', 'reason')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('addDealProduct', () => {
    it('should add a product to a deal', async () => {
      const deal = { id: 'deal-1', tenantId };
      const productData = {
        quantity: 5,
        unitPrice: 100,
        discount: 10,
      };
      const mockDealProduct = {
        id: 'dp-1',
        dealId: 'deal-1',
        productId: 'product-1',
        quantity: 5,
        unitPrice: 100,
        discount: 10,
        product: { id: 'product-1', name: 'Widget' },
      };

      prisma.deal.findFirst.mockResolvedValue(deal);
      prisma.dealProduct.create.mockResolvedValue(mockDealProduct);

      const result = await pipelineService.addDealProduct(
        tenantId,
        'deal-1',
        'product-1',
        productData
      );

      expect(prisma.dealProduct.create).toHaveBeenCalledWith({
        data: {
          dealId: 'deal-1',
          productId: 'product-1',
          quantity: 5,
          unitPrice: 100,
          discount: 10,
        },
        include: { product: true },
      });
      expect(result).toEqual(mockDealProduct);
    });

    it('should use default quantity of 1', async () => {
      prisma.deal.findFirst.mockResolvedValue({ id: 'deal-1', tenantId });
      prisma.dealProduct.create.mockResolvedValue({ id: 'dp-1' });

      await pipelineService.addDealProduct(tenantId, 'deal-1', 'product-1', {
        unitPrice: 100,
      });

      expect(prisma.dealProduct.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: 1,
          }),
        })
      );
    });

    it('should throw NotFoundError when deal does not exist', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);

      await expect(
        pipelineService.addDealProduct(tenantId, 'nonexistent', 'product-1', {})
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('removeDealProduct', () => {
    it('should remove a product from a deal', async () => {
      const deal = { id: 'deal-1', tenantId };

      prisma.deal.findFirst.mockResolvedValue(deal);
      prisma.dealProduct.delete.mockResolvedValue({});

      await pipelineService.removeDealProduct(tenantId, 'deal-1', 'product-1');

      expect(prisma.dealProduct.delete).toHaveBeenCalledWith({
        where: {
          dealId_productId: { dealId: 'deal-1', productId: 'product-1' },
        },
      });
    });

    it('should throw NotFoundError when deal does not exist', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);

      await expect(
        pipelineService.removeDealProduct(tenantId, 'nonexistent', 'product-1')
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ============ PRODUCT TESTS ============

  describe('getProducts', () => {
    it('should return all active products for a tenant', async () => {
      const mockProducts = [
        { id: 'product-1', name: 'Widget A', unitPrice: 100, isActive: true },
        { id: 'product-2', name: 'Widget B', unitPrice: 200, isActive: true },
      ];

      prisma.product.findMany.mockResolvedValue(mockProducts);

      const result = await pipelineService.getProducts(tenantId);

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { tenantId, isActive: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(mockProducts);
    });

    it('should return empty array when no products exist', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      const result = await pipelineService.getProducts(tenantId);

      expect(result).toEqual([]);
    });
  });

  describe('getProduct', () => {
    it('should return a product by id', async () => {
      const mockProduct = {
        id: 'product-1',
        name: 'Widget A',
        sku: 'WGT-001',
        unitPrice: 100,
        tenantId,
      };

      prisma.product.findFirst.mockResolvedValue(mockProduct);

      const result = await pipelineService.getProduct(tenantId, 'product-1');

      expect(prisma.product.findFirst).toHaveBeenCalledWith({
        where: { id: 'product-1', tenantId },
      });
      expect(result).toEqual(mockProduct);
    });

    it('should throw NotFoundError when product does not exist', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(pipelineService.getProduct(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('createProduct', () => {
    it('should create a new product', async () => {
      const data = {
        name: 'New Widget',
        sku: 'WGT-NEW',
        description: 'A new widget',
        unitPrice: 150,
        currency: 'INR',
        category: 'Electronics',
      };

      const mockProduct = { id: 'product-1', ...data, tenantId, isActive: true };

      prisma.product.create.mockResolvedValue(mockProduct);

      const result = await pipelineService.createProduct(tenantId, data);

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: {
          tenantId,
          name: data.name,
          sku: data.sku,
          description: data.description,
          unitPrice: data.unitPrice,
          currency: 'INR',
          category: data.category,
          isActive: true,
        },
      });
      expect(result).toEqual(mockProduct);
    });

    it('should use USD as default currency', async () => {
      const data = {
        name: 'Basic Widget',
        unitPrice: 50,
      };

      prisma.product.create.mockResolvedValue({ id: 'product-1', ...data, currency: 'USD' });

      await pipelineService.createProduct(tenantId, data);

      expect(prisma.product.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: 'USD',
          }),
        })
      );
    });
  });

  describe('updateProduct', () => {
    it('should update an existing product', async () => {
      const existingProduct = { id: 'product-1', tenantId, name: 'Old Name' };
      const updateData = {
        name: 'Updated Widget',
        sku: 'WGT-UPD',
        unitPrice: 175,
        isActive: false,
      };

      prisma.product.findFirst.mockResolvedValue(existingProduct);
      prisma.product.update.mockResolvedValue({ ...existingProduct, ...updateData });

      const result = await pipelineService.updateProduct(tenantId, 'product-1', updateData);

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: {
          name: 'Updated Widget',
          sku: 'WGT-UPD',
          description: undefined,
          unitPrice: 175,
          currency: undefined,
          category: undefined,
          isActive: false,
          updatedAt: expect.any(Date),
        },
      });
      expect(result.name).toBe('Updated Widget');
    });

    it('should throw NotFoundError when product does not exist', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(pipelineService.updateProduct(tenantId, 'nonexistent', {})).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('deleteProduct', () => {
    it('should delete an existing product', async () => {
      const existingProduct = { id: 'product-1', tenantId };

      prisma.product.findFirst.mockResolvedValue(existingProduct);
      prisma.product.delete.mockResolvedValue(existingProduct);

      await pipelineService.deleteProduct(tenantId, 'product-1');

      expect(prisma.product.delete).toHaveBeenCalledWith({
        where: { id: 'product-1' },
      });
    });

    it('should throw NotFoundError when product does not exist', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(pipelineService.deleteProduct(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============ TENANT ISOLATION TESTS ============

  describe('Tenant Isolation', () => {
    it('should not return leads from other tenants', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);

      await expect(pipelineService.getLead('different-tenant', 'lead-1')).rejects.toThrow(
        NotFoundError
      );

      expect(prisma.lead.findFirst).toHaveBeenCalledWith({
        where: { id: 'lead-1', tenantId: 'different-tenant' },
        include: { contact: true },
      });
    });

    it('should not return deals from other tenants', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);

      await expect(pipelineService.getDeal('different-tenant', 'deal-1')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should not return products from other tenants', async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(pipelineService.getProduct('different-tenant', 'product-1')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should not allow updating leads from other tenants', async () => {
      prisma.lead.findFirst.mockResolvedValue(null);

      await expect(
        pipelineService.updateLead('different-tenant', 'lead-1', { firstName: 'Test' })
      ).rejects.toThrow(NotFoundError);
    });

    it('should not allow deleting deals from other tenants', async () => {
      prisma.deal.findFirst.mockResolvedValue(null);

      await expect(pipelineService.deleteDeal('different-tenant', 'deal-1')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============ EVENT PUBLISHING TESTS ============

  describe('Event Publishing', () => {
    it('should publish LEAD_CREATED event on lead creation', async () => {
      const data = { firstName: 'John', lastName: 'Doe', email: 'john@example.com' };
      prisma.lead.create.mockResolvedValue({ id: 'lead-1', ...data });

      await pipelineService.createLead(tenantId, userId, data);

      expect(createEvent).toHaveBeenCalledWith(
        EventTypes.LEAD_CREATED,
        tenantId,
        { leadId: 'lead-1' },
        { userId }
      );
      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('should publish DEAL_STAGE_CHANGED event when moving deal', async () => {
      prisma.deal.findFirst.mockResolvedValue({ id: 'deal-1', tenantId, stageId: 'stage-1' });
      prisma.stage.findFirst.mockResolvedValue({ id: 'stage-2', probability: 60 });
      prisma.deal.update.mockResolvedValue({ id: 'deal-1', stageId: 'stage-2' });

      await pipelineService.moveDeal(tenantId, 'deal-1', 'stage-2');

      expect(createEvent).toHaveBeenCalledWith(EventTypes.DEAL_STAGE_CHANGED, tenantId, {
        dealId: 'deal-1',
        fromStageId: 'stage-1',
        toStageId: 'stage-2',
      });
    });

    it('should publish DEAL_WON event with deal value', async () => {
      prisma.deal.findFirst.mockResolvedValue({
        id: 'deal-1',
        tenantId,
        pipelineId: 'p1',
        amount: 250000,
        pipeline: {},
      });
      prisma.stage.findFirst.mockResolvedValue({ id: 'won-stage', isWon: true });
      prisma.deal.update.mockResolvedValue({ id: 'deal-1', probability: 100 });

      await pipelineService.winDeal(tenantId, 'deal-1');

      expect(createEvent).toHaveBeenCalledWith(EventTypes.DEAL_WON, tenantId, {
        dealId: 'deal-1',
        value: 250000,
      });
    });

    it('should publish DEAL_LOST event with reason', async () => {
      const reason = 'Competitor won';
      prisma.deal.findFirst.mockResolvedValue({
        id: 'deal-1',
        tenantId,
        pipelineId: 'p1',
        pipeline: {},
      });
      prisma.stage.findFirst.mockResolvedValue({ id: 'lost-stage', isLost: true });
      prisma.deal.update.mockResolvedValue({ id: 'deal-1', probability: 0 });

      await pipelineService.loseDeal(tenantId, 'deal-1', reason);

      expect(createEvent).toHaveBeenCalledWith(EventTypes.DEAL_LOST, tenantId, {
        dealId: 'deal-1',
        reason,
      });
    });
  });
});
