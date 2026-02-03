import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import { eventBus, createEvent, EventTypes } from '../../common/events/event-bus.js';

// Helix Code Pvt Ltd Mock Data - Software Development Company Deals
const MOCK_CONTACTS = [
  { id: 'contact-1', firstName: 'Amit', lastName: 'Sharma', email: 'amit@techcorp.in' },
  { id: 'contact-2', firstName: 'Priya', lastName: 'Mehta', email: 'priya@startupx.io' },
  { id: 'contact-3', firstName: 'Rajesh', lastName: 'Kumar', email: 'rajesh@retailchain.com' },
  { id: 'contact-4', firstName: 'Sunita', lastName: 'Patel', email: 'sunita@finserv.in' },
  { id: 'contact-5', firstName: 'Vikram', lastName: 'Joshi', email: 'vikram@healthtech.co' },
  { id: 'contact-6', firstName: 'Neha', lastName: 'Reddy', email: 'neha@edulearn.com' },
];

const MOCK_COMPANIES = [
  { id: 'company-1', name: 'TechCorp India' },
  { id: 'company-2', name: 'StartupX Innovations' },
  { id: 'company-3', name: 'RetailChain Ltd' },
  { id: 'company-4', name: 'FinServ Solutions' },
  { id: 'company-5', name: 'HealthTech Systems' },
  { id: 'company-6', name: 'EduLearn Platform' },
];

// Mock deals for each pipeline stage (Sales Pipeline)
const generateMockDeals = (stages) => {
  const now = new Date();
  const stageDeals = {
    // Qualification stage deals
    Qualification: [
      {
        id: 'deal-1',
        name: 'CRM Implementation - TechCorp',
        amount: 250000,
        probability: 20,
        expectedCloseDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        contact: MOCK_CONTACTS[0],
        company: MOCK_COMPANIES[0],
        createdAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'deal-2',
        name: 'Mobile App Development - StartupX',
        amount: 180000,
        probability: 25,
        expectedCloseDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000),
        contact: MOCK_CONTACTS[1],
        company: MOCK_COMPANIES[1],
        createdAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      },
    ],
    // Needs Analysis stage deals
    'Needs Analysis': [
      {
        id: 'deal-3',
        name: 'E-Commerce Platform - RetailChain',
        amount: 450000,
        probability: 40,
        expectedCloseDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
        contact: MOCK_CONTACTS[2],
        company: MOCK_COMPANIES[2],
        createdAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
    ],
    // Proposal stage deals
    Proposal: [
      {
        id: 'deal-4',
        name: 'Banking Software - FinServ',
        amount: 850000,
        probability: 60,
        expectedCloseDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
        contact: MOCK_CONTACTS[3],
        company: MOCK_COMPANIES[3],
        createdAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'deal-5',
        name: 'Patient Portal - HealthTech',
        amount: 320000,
        probability: 55,
        expectedCloseDate: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000),
        contact: MOCK_CONTACTS[4],
        company: MOCK_COMPANIES[4],
        createdAt: new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000),
      },
    ],
    // Negotiation stage deals
    Negotiation: [
      {
        id: 'deal-6',
        name: 'LMS Development - EduLearn',
        amount: 520000,
        probability: 75,
        expectedCloseDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
        contact: MOCK_CONTACTS[5],
        company: MOCK_COMPANIES[5],
        createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      },
    ],
    // Closed Won stage deals
    'Closed Won': [
      {
        id: 'deal-7',
        name: 'API Integration - TechCorp Phase 1',
        amount: 150000,
        probability: 100,
        expectedCloseDate: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        closedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
        contact: MOCK_CONTACTS[0],
        company: MOCK_COMPANIES[0],
        createdAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      },
    ],
    // Closed Lost stage deals
    'Closed Lost': [],
  };

  // Map deals to actual stage IDs
  const deals = [];
  stages.forEach((stage) => {
    const stageName = stage.name;
    const stageDealsData = stageDeals[stageName] || [];
    stageDealsData.forEach((deal) => {
      deals.push({
        ...deal,
        stageId: stage.id,
        pipelineId: stage.pipelineId,
        stage: { id: stage.id, name: stage.name, probability: stage.probability },
        pipeline: { id: stage.pipelineId, name: 'Sales Pipeline' },
      });
    });
  });

  return deals;
};

class PipelineService {
  async getPipelines(tenantId, type) {
    const where = { tenantId };
    if (type) where.type = type;

    const pipelines = await prisma.pipeline.findMany({
      where,
      include: {
        stages: { orderBy: { order: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return pipelines;
  }

  async getLeads(tenantId, filters) {
    const where = { tenantId };

    if (filters.status) where.status = filters.status;
    if (filters.assignedTo) where.ownerId = filters.assignedTo;

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { company: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.lead.count({ where }),
    ]);

    return {
      leads,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async createLead(tenantId, userId, data) {
    const lead = await prisma.lead.create({
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
        qualificationScore: data.score || 0,
        qualificationNotes: data.notes,
        ownerId: userId,
      },
    });

    eventBus.publish(
      createEvent(EventTypes.LEAD_CREATED, tenantId, { leadId: lead.id }, { userId })
    );

    return lead;
  }

  async convertLead(tenantId, leadId, data) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    // Create contact and deal, update lead in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create contact from lead
      const contact = await tx.contact.create({
        data: {
          tenantId,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          source: lead.source,
          status: 'ACTIVE',
        },
      });

      // Create deal
      const deal = await tx.deal.create({
        data: {
          tenantId,
          name: `${lead.firstName || ''} ${lead.lastName || ''} - Deal`.trim(),
          pipelineId: data.pipelineId,
          stageId: data.stageId,
          contactId: contact.id,
          amount: data.value,
          ownerId: lead.ownerId,
        },
      });

      // Update lead with conversion info
      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: 'CONVERTED',
          convertedAt: new Date(),
          convertedToContactId: contact.id,
          convertedToDealId: deal.id,
        },
      });

      return deal;
    });

    eventBus.publish(
      createEvent(EventTypes.LEAD_CONVERTED, tenantId, { leadId, dealId: result.id })
    );

    return result;
  }

  async getDeals(tenantId, filters) {
    const where = { tenantId };

    if (filters.pipelineId) where.pipelineId = filters.pipelineId;
    if (filters.stageId) where.stageId = filters.stageId;
    if (filters.status) where.status = filters.status;
    if (filters.assignedTo) where.ownerId = filters.assignedTo;
    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.companyId) where.companyId = filters.companyId;

    if (filters.search) {
      where.OR = [{ name: { contains: filters.search, mode: 'insensitive' } }];
    }

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          company: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true, probability: true } },
          pipeline: { select: { id: true, name: true } },
        },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.deal.count({ where }),
    ]);

    // Check if deals are empty or all have null/empty names - use mock data
    const hasValidDeals = deals.length > 0 && deals.some((d) => d.name && d.name.trim() !== '');
    if (!hasValidDeals) {
      // Get pipeline stages for mock data
      const pipelines = await prisma.pipeline.findMany({
        where: { tenantId, type: 'DEAL' },
        include: { stages: { orderBy: { order: 'asc' } } },
      });

      if (pipelines.length > 0) {
        const allStages = pipelines.flatMap((p) =>
          p.stages.map((s) => ({ ...s, pipelineId: p.id }))
        );
        const mockDeals = generateMockDeals(allStages);

        // Filter mock deals based on filters
        let filteredMockDeals = mockDeals;
        if (filters.pipelineId) {
          filteredMockDeals = filteredMockDeals.filter((d) => d.pipelineId === filters.pipelineId);
        }
        if (filters.stageId) {
          filteredMockDeals = filteredMockDeals.filter((d) => d.stageId === filters.stageId);
        }

        return {
          deals: filteredMockDeals,
          meta: {
            total: filteredMockDeals.length,
            page: 1,
            limit: filters.limit,
            totalPages: 1,
          },
        };
      }
    }

    return {
      deals,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async createDeal(tenantId, userId, data) {
    const stage = await prisma.stage.findFirst({
      where: { id: data.stageId },
    });

    const deal = await prisma.deal.create({
      data: {
        tenantId,
        name: data.title,
        pipelineId: data.pipelineId,
        stageId: data.stageId,
        contactId: data.contactId,
        companyId: data.companyId,
        amount: data.value,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
        ownerId: userId,
      },
      include: {
        stage: { select: { id: true, name: true } },
        pipeline: { select: { id: true, name: true } },
      },
    });

    eventBus.publish(
      createEvent(EventTypes.DEAL_CREATED, tenantId, { dealId: deal.id }, { userId })
    );

    return deal;
  }

  async moveDeal(tenantId, dealId, stageId) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, tenantId },
    });

    if (!deal) {
      throw new NotFoundError('Deal not found');
    }

    const stage = await prisma.stage.findFirst({
      where: { id: stageId },
    });

    if (!stage) {
      throw new NotFoundError('Stage not found');
    }

    const updated = await prisma.deal.update({
      where: { id: dealId },
      data: {
        stageId,
        probability: stage.probability,
        updatedAt: new Date(),
      },
      include: {
        stage: { select: { id: true, name: true } },
      },
    });

    eventBus.publish(
      createEvent(EventTypes.DEAL_STAGE_CHANGED, tenantId, {
        dealId,
        fromStageId: deal.stageId,
        toStageId: stageId,
      })
    );

    return updated;
  }

  async winDeal(tenantId, dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, tenantId },
      include: { pipeline: true },
    });

    if (!deal) {
      throw new NotFoundError('Deal not found');
    }

    // Find the "Closed Won" stage for this pipeline
    const wonStage = await prisma.stage.findFirst({
      where: {
        pipelineId: deal.pipelineId,
        isWon: true,
      },
    });

    if (!wonStage) {
      throw new NotFoundError('Closed Won stage not found for this pipeline');
    }

    const updated = await prisma.deal.update({
      where: { id: dealId },
      data: {
        stageId: wonStage.id,
        closedAt: new Date(),
        probability: 100,
      },
    });

    eventBus.publish(createEvent(EventTypes.DEAL_WON, tenantId, { dealId, value: deal.amount }));

    return updated;
  }

  async loseDeal(tenantId, dealId, reason) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, tenantId },
      include: { pipeline: true },
    });

    if (!deal) {
      throw new NotFoundError('Deal not found');
    }

    // Find the "Closed Lost" stage for this pipeline
    const lostStage = await prisma.stage.findFirst({
      where: {
        pipelineId: deal.pipelineId,
        isLost: true,
      },
    });

    if (!lostStage) {
      throw new NotFoundError('Closed Lost stage not found for this pipeline');
    }

    const updated = await prisma.deal.update({
      where: { id: dealId },
      data: {
        stageId: lostStage.id,
        closedAt: new Date(),
        probability: 0,
        notes: reason ? `Lost reason: ${reason}` : undefined,
      },
    });

    eventBus.publish(createEvent(EventTypes.DEAL_LOST, tenantId, { dealId, reason }));

    return updated;
  }

  async getProducts(tenantId) {
    const products = await prisma.product.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: 'asc' },
    });

    return products;
  }

  async createProduct(tenantId, data) {
    const product = await prisma.product.create({
      data: {
        tenantId,
        name: data.name,
        sku: data.sku,
        description: data.description,
        unitPrice: data.unitPrice,
        currency: data.currency || 'USD',
        category: data.category,
        isActive: true,
      },
    });

    return product;
  }

  // ============ LEAD CRUD ============

  async getLead(tenantId, leadId) {
    const lead = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
      include: {
        contact: true,
      },
    });

    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    return lead;
  }

  async updateLead(tenantId, leadId, data) {
    const existing = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Lead not found');
    }

    const lead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        company: data.company,
        source: data.source,
        status: data.status,
        qualificationScore: data.score,
        qualificationNotes: data.notes,
        ownerId: data.assignedToId,
      },
    });

    eventBus.publish(createEvent(EventTypes.LEAD_UPDATED, tenantId, { leadId: lead.id }));

    return lead;
  }

  async deleteLead(tenantId, leadId) {
    const existing = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Lead not found');
    }

    await prisma.lead.delete({
      where: { id: leadId },
    });

    eventBus.publish(createEvent(EventTypes.LEAD_DELETED, tenantId, { leadId }));
  }

  // ============ DEAL CRUD ============

  async getDeal(tenantId, dealId) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, tenantId },
      include: {
        contact: true,
        company: true,
        pipeline: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true, probability: true } },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!deal) {
      throw new NotFoundError('Deal not found');
    }

    return deal;
  }

  async updateDeal(tenantId, dealId, data) {
    const existing = await prisma.deal.findFirst({
      where: { id: dealId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Deal not found');
    }

    const deal = await prisma.deal.update({
      where: { id: dealId },
      data: {
        name: data.title,
        amount: data.value,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : undefined,
        description: data.notes,
        ownerId: data.assignedToId,
      },
      include: {
        pipeline: { select: { id: true, name: true } },
        stage: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true } },
      },
    });

    eventBus.publish(createEvent(EventTypes.DEAL_UPDATED, tenantId, { dealId: deal.id }));

    return deal;
  }

  async deleteDeal(tenantId, dealId) {
    const existing = await prisma.deal.findFirst({
      where: { id: dealId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Deal not found');
    }

    await prisma.deal.delete({
      where: { id: dealId },
    });

    eventBus.publish(createEvent(EventTypes.DEAL_DELETED, tenantId, { dealId }));
  }

  async addDealProduct(tenantId, dealId, productId, data) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, tenantId },
    });

    if (!deal) {
      throw new NotFoundError('Deal not found');
    }

    const dealProduct = await prisma.dealProduct.create({
      data: {
        dealId,
        productId,
        quantity: data.quantity || 1,
        unitPrice: data.unitPrice,
        discount: data.discount,
      },
      include: {
        product: true,
      },
    });

    return dealProduct;
  }

  async removeDealProduct(tenantId, dealId, productId) {
    const deal = await prisma.deal.findFirst({
      where: { id: dealId, tenantId },
    });

    if (!deal) {
      throw new NotFoundError('Deal not found');
    }

    await prisma.dealProduct.delete({
      where: {
        dealId_productId: { dealId, productId },
      },
    });
  }

  // ============ PRODUCT CRUD ============

  async getProduct(tenantId, productId) {
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return product;
  }

  async updateProduct(tenantId, productId, data) {
    const existing = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        name: data.name,
        sku: data.sku,
        description: data.description,
        unitPrice: data.unitPrice,
        currency: data.currency,
        category: data.category,
        isActive: data.isActive,
        updatedAt: new Date(),
      },
    });

    return product;
  }

  async deleteProduct(tenantId, productId) {
    const existing = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    await prisma.product.delete({
      where: { id: productId },
    });
  }

  // =====================
  // Pipeline Stages
  // =====================

  async getStages(tenantId, pipelineId) {
    const where = { tenantId };
    if (pipelineId) {
      where.pipelineId = pipelineId;
    }

    const stages = await prisma.stage.findMany({
      where,
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { deals: true },
        },
      },
    });

    return stages.map((stage) => ({
      id: stage.id,
      pipelineId: stage.pipelineId,
      name: stage.name,
      description: stage.description,
      color: stage.color,
      order: stage.order,
      probability: stage.probability,
      isWon: stage.isWon,
      isLost: stage.isLost,
      isClosed: stage.isClosed,
      dealsCount: stage._count.deals,
      createdAt: stage.createdAt,
      updatedAt: stage.updatedAt,
    }));
  }

  async getStage(tenantId, stageId) {
    const stage = await prisma.stage.findFirst({
      where: { id: stageId, tenantId },
      include: {
        _count: {
          select: { deals: true },
        },
      },
    });

    if (!stage) {
      throw new NotFoundError('Stage not found');
    }

    return {
      id: stage.id,
      pipelineId: stage.pipelineId,
      name: stage.name,
      description: stage.description,
      color: stage.color,
      order: stage.order,
      probability: stage.probability,
      isWon: stage.isWon,
      isLost: stage.isLost,
      isClosed: stage.isClosed,
      dealsCount: stage._count.deals,
      createdAt: stage.createdAt,
      updatedAt: stage.updatedAt,
    };
  }

  async createStage(tenantId, data) {
    // Verify pipeline exists and belongs to tenant
    const pipeline = await prisma.pipeline.findFirst({
      where: { id: data.pipelineId, tenantId },
    });

    if (!pipeline) {
      throw new NotFoundError('Pipeline not found');
    }

    // Get the max order for this pipeline
    const maxStage = await prisma.stage.findFirst({
      where: { tenantId, pipelineId: data.pipelineId },
      orderBy: { order: 'desc' },
    });

    const order = data.order ?? (maxStage ? maxStage.order + 1 : 0);

    const stage = await prisma.stage.create({
      data: {
        tenantId,
        pipelineId: data.pipelineId,
        name: data.name,
        description: data.description,
        color: data.color || '#6366f1',
        order,
        probability: data.probability,
        isWon: data.isWon || false,
        isLost: data.isLost || false,
        isClosed: data.isClosed || false,
      },
    });

    eventBus.publish(
      createEvent(EventTypes.STAGE_CREATED, tenantId, {
        stageId: stage.id,
        pipelineId: stage.pipelineId,
        stageName: stage.name,
      })
    );

    return stage;
  }

  async updateStage(tenantId, stageId, data) {
    const existing = await prisma.stage.findFirst({
      where: { id: stageId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Stage not found');
    }

    const stage = await prisma.stage.update({
      where: { id: stageId },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        order: data.order,
        probability: data.probability,
        isWon: data.isWon,
        isLost: data.isLost,
        isClosed: data.isClosed,
        updatedAt: new Date(),
      },
    });

    eventBus.publish(
      createEvent(EventTypes.STAGE_UPDATED, tenantId, {
        stageId: stage.id,
        pipelineId: stage.pipelineId,
        stageName: stage.name,
      })
    );

    return stage;
  }

  async deleteStage(tenantId, stageId) {
    const existing = await prisma.stage.findFirst({
      where: { id: stageId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Stage not found');
    }

    // Check if stage has deals
    const dealsCount = await prisma.deal.count({
      where: { stageId },
    });

    if (dealsCount > 0) {
      throw new Error(`Cannot delete stage with ${dealsCount} active deals`);
    }

    await prisma.stage.delete({
      where: { id: stageId },
    });

    eventBus.publish(
      createEvent(EventTypes.STAGE_DELETED, tenantId, {
        stageId: stageId,
        pipelineId: existing.pipelineId,
      })
    );
  }
}

export const pipelineService = new PipelineService();
