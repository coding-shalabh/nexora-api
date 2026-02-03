import { prisma } from '@crm360/database';
import { nanoid } from 'nanoid';
import { environmentConfig } from '../config/environment.js';
import { logger } from '../common/logger.js';
import bcrypt from 'bcrypt';

/**
 * Demo Data Seeder Service
 * Seeds demo tenant with realistic business data
 */
class DemoSeederService {
  constructor() {
    this.tenantId = environmentConfig.demo.tenantId;
    this.userId = environmentConfig.demo.userId;
    this.counts = environmentConfig.demo.dataCounts;
  }

  /**
   * Main seed method - seeds all demo data
   */
  async seedAll() {
    try {
      logger.info('[Demo Seeder] Starting demo data seeding...');

      // 1. Ensure demo tenant exists
      await this.ensureDemoTenant();

      // 2. Check if already seeded
      const alreadySeeded = await this.checkIfSeeded();
      if (alreadySeeded && !environmentConfig.demo.resetDaily) {
        logger.info('[Demo Seeder] Demo data already exists, skipping seed');
        return;
      }

      // 3. Clear existing demo data if resetting
      if (alreadySeeded && environmentConfig.demo.resetDaily) {
        logger.info('[Demo Seeder] Resetting demo data...');
        await this.clearDemoData();
      }

      // 4. Seed all modules
      await this.seedContacts();
      await this.seedCompanies();
      await this.seedDeals();
      await this.seedLeads();
      await this.seedTasks();
      await this.seedProjects();
      await this.seedTickets();
      await this.seedProducts();
      await this.seedQuotes();
      await this.seedCalendarEvents();
      await this.seedInboxConversations();

      logger.info('[Demo Seeder] Demo data seeded successfully!');
    } catch (error) {
      logger.error('[Demo Seeder] Failed to seed demo data:', error);
      throw error;
    }
  }

  /**
   * Ensure demo tenant exists
   */
  async ensureDemoTenant() {
    let tenant = await prisma.tenant.findUnique({
      where: { id: this.tenantId },
    });

    if (!tenant) {
      logger.info('[Demo Seeder] Creating demo tenant...');
      tenant = await prisma.tenant.create({
        data: {
          id: this.tenantId,
          name: 'Demo Company - Helix Code Pvt Ltd',
          slug: 'demo-helix-code',
          domain: 'demo.helixcode.in',
          email: 'admin@demo.helixcode.in',
          phone: '+91-9876543210',
          address: '123 Tech Park, Bangalore, Karnataka, India',
          industry: 'Software Development',
          size: 'SMALL',
          timezone: 'Asia/Kolkata',
          currency: 'INR',
          logo: null,
          isActive: true,
          billingEmail: 'billing@demo.helixcode.in',
          subscriptionStatus: 'ACTIVE',
          subscriptionPlan: 'ENTERPRISE',
          features: {
            crm: true,
            inbox: true,
            automation: true,
            reporting: true,
          },
        },
      });

      logger.info('[Demo Seeder] Demo tenant created');
    }

    return tenant;
  }

  /**
   * Check if demo data already exists
   */
  async checkIfSeeded() {
    const contactCount = await prisma.contact.count({
      where: { tenantId: this.tenantId },
    });
    return contactCount > 0;
  }

  /**
   * Clear all demo data
   */
  async clearDemoData() {
    await prisma.contact.deleteMany({ where: { tenantId: this.tenantId } });
    await prisma.company.deleteMany({ where: { tenantId: this.tenantId } });
    await prisma.deal.deleteMany({ where: { tenantId: this.tenantId } });
    await prisma.lead.deleteMany({ where: { tenantId: this.tenantId } });
    await prisma.task.deleteMany({ where: { tenantId: this.tenantId } });
    await prisma.project.deleteMany({ where: { tenantId: this.tenantId } });
    await prisma.ticket.deleteMany({ where: { tenantId: this.tenantId } });
    await prisma.product.deleteMany({ where: { tenantId: this.tenantId } });
    await prisma.quote.deleteMany({ where: { tenantId: this.tenantId } });
    await prisma.calendarEvent.deleteMany({ where: { tenantId: this.tenantId } });
    await prisma.conversation.deleteMany({ where: { tenantId: this.tenantId } });
  }

  /**
   * Seed contacts
   */
  async seedContacts() {
    logger.info(`[Demo Seeder] Seeding ${this.counts.contacts} contacts...`);

    const contacts = [];
    const firstNames = [
      'Rahul',
      'Priya',
      'Amit',
      'Sneha',
      'Vikram',
      'Anjali',
      'Rohan',
      'Kavya',
      'Arjun',
      'Neha',
      'Karan',
      'Pooja',
      'Aditya',
      'Divya',
      'Ravi',
      'Simran',
      'Nikhil',
      'Isha',
      'Harsh',
      'Megha',
    ];
    const lastNames = [
      'Sharma',
      'Verma',
      'Patel',
      'Singh',
      'Kumar',
      'Reddy',
      'Iyer',
      'Gupta',
      'Mehta',
      'Joshi',
      'Nair',
      'Desai',
      'Rao',
      'Kapoor',
      'Malhotra',
    ];

    for (let i = 0; i < this.counts.contacts; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@example.com`;

      contacts.push({
        id: nanoid(),
        tenantId: this.tenantId,
        firstName,
        lastName,
        email,
        phone: `+91-${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        lifecycleStage: this.randomChoice(['LEAD', 'MQL', 'SQL', 'OPPORTUNITY', 'CUSTOMER']),
        leadSource: this.randomChoice(['WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA', 'ADVERTISEMENT']),
        status: this.randomChoice(['ACTIVE', 'INACTIVE']),
        createdAt: this.randomDate(90),
        updatedAt: new Date(),
      });
    }

    await prisma.contact.createMany({ data: contacts });
    logger.info(`[Demo Seeder] Created ${contacts.length} contacts`);
  }

  /**
   * Seed companies
   */
  async seedCompanies() {
    logger.info(`[Demo Seeder] Seeding ${this.counts.companies} companies...`);

    const companies = [];
    const companyNames = [
      'Tech Innovators Pvt Ltd',
      'Digital Solutions Inc',
      'Cloud Services Corp',
      'Data Analytics Ltd',
      'Software Systems Pvt Ltd',
      'AI Research Labs',
      'Mobile Apps India',
      'Web Development Co',
      'Cyber Security Solutions',
      'Enterprise Software Ltd',
    ];

    const industries = ['IT', 'Finance', 'Healthcare', 'Retail', 'Manufacturing', 'Education'];

    for (let i = 0; i < this.counts.companies; i++) {
      const name =
        i < companyNames.length
          ? companyNames[i]
          : `Company ${i + 1} ${this.randomChoice(industries)}`;

      companies.push({
        id: nanoid(),
        tenantId: this.tenantId,
        name,
        website: `https://${name.toLowerCase().replace(/ /g, '')}.com`,
        industry: this.randomChoice(industries),
        size: this.randomChoice(['SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE']),
        phone: `+91-${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        email: `contact@${name.toLowerCase().replace(/ /g, '')}.com`,
        description: `Leading ${this.randomChoice(industries)} company providing innovative solutions`,
        createdAt: this.randomDate(180),
        updatedAt: new Date(),
      });
    }

    await prisma.company.createMany({ data: companies });
    logger.info(`[Demo Seeder] Created ${companies.length} companies`);
  }

  /**
   * Seed deals
   */
  async seedDeals() {
    logger.info(`[Demo Seeder] Seeding ${this.counts.deals} deals...`);

    // Get some contacts and companies
    const contacts = await prisma.contact.findMany({
      where: { tenantId: this.tenantId },
      take: 50,
    });

    const companies = await prisma.company.findMany({
      where: { tenantId: this.tenantId },
      take: 30,
    });

    const deals = [];
    const dealNames = [
      'Enterprise License Agreement',
      'Annual Subscription',
      'Platform Upgrade',
      'Custom Development Project',
      'Support Contract Renewal',
    ];

    for (let i = 0; i < this.counts.deals; i++) {
      deals.push({
        id: nanoid(),
        tenantId: this.tenantId,
        title: `${dealNames[i % dealNames.length]} - ${i + 1}`,
        value: Math.floor(Math.random() * 100000) + 10000,
        currency: 'INR',
        status: this.randomChoice(['OPEN', 'WON', 'LOST', 'STALLED']),
        stage: this.randomChoice(['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED']),
        probability: Math.floor(Math.random() * 100),
        expectedCloseDate: this.randomFutureDate(90),
        contactId: contacts[Math.floor(Math.random() * contacts.length)]?.id,
        companyId: companies[Math.floor(Math.random() * companies.length)]?.id,
        createdAt: this.randomDate(120),
        updatedAt: new Date(),
      });
    }

    await prisma.deal.createMany({ data: deals });
    logger.info(`[Demo Seeder] Created ${deals.length} deals`);
  }

  /**
   * Seed leads
   */
  async seedLeads() {
    logger.info(`[Demo Seeder] Seeding ${this.counts.leads} leads...`);

    const leads = [];

    for (let i = 0; i < this.counts.leads; i++) {
      leads.push({
        id: nanoid(),
        tenantId: this.tenantId,
        firstName: `Lead${i}`,
        lastName: `User${i}`,
        email: `lead${i}@example.com`,
        phone: `+91-${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
        status: this.randomChoice(['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED']),
        source: this.randomChoice(['WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA', 'ADVERTISEMENT']),
        score: Math.floor(Math.random() * 100),
        createdAt: this.randomDate(60),
        updatedAt: new Date(),
      });
    }

    await prisma.lead.createMany({ data: leads });
    logger.info(`[Demo Seeder] Created ${leads.length} leads`);
  }

  /**
   * Seed tasks
   */
  async seedTasks() {
    logger.info(`[Demo Seeder] Seeding ${this.counts.tasks} tasks...`);

    const tasks = [];
    const taskTitles = [
      'Follow up with client',
      'Prepare proposal',
      'Review contract',
      'Schedule demo',
      'Send invoice',
      'Update documentation',
      'Test new feature',
      'Fix bug',
    ];

    for (let i = 0; i < this.counts.tasks; i++) {
      tasks.push({
        id: nanoid(),
        tenantId: this.tenantId,
        title: `${taskTitles[i % taskTitles.length]} - ${i + 1}`,
        description: `Task description for ${taskTitles[i % taskTitles.length]}`,
        status: this.randomChoice(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED']),
        priority: this.randomChoice(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
        dueDate: this.randomFutureDate(30),
        createdById: this.userId,
        createdAt: this.randomDate(30),
        updatedAt: new Date(),
      });
    }

    await prisma.task.createMany({ data: tasks });
    logger.info(`[Demo Seeder] Created ${tasks.length} tasks`);
  }

  /**
   * Seed projects
   */
  async seedProjects() {
    logger.info(`[Demo Seeder] Seeding ${this.counts.projects} projects...`);

    const projects = [];

    for (let i = 0; i < this.counts.projects; i++) {
      projects.push({
        id: nanoid(),
        tenantId: this.tenantId,
        name: `Project ${i + 1}`,
        description: `Description for project ${i + 1}`,
        status: this.randomChoice(['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED']),
        priority: this.randomChoice(['LOW', 'MEDIUM', 'HIGH']),
        startDate: this.randomDate(60),
        endDate: this.randomFutureDate(90),
        createdAt: this.randomDate(90),
        updatedAt: new Date(),
      });
    }

    await prisma.project.createMany({ data: projects });
    logger.info(`[Demo Seeder] Created ${projects.length} projects`);
  }

  /**
   * Seed tickets
   */
  async seedTickets() {
    logger.info(`[Demo Seeder] Seeding ${this.counts.tickets} tickets...`);

    const tickets = [];

    for (let i = 0; i < this.counts.tickets; i++) {
      tickets.push({
        id: nanoid(),
        tenantId: this.tenantId,
        subject: `Ticket ${i + 1} - Support Request`,
        description: `Description for support ticket ${i + 1}`,
        status: this.randomChoice(['OPEN', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED']),
        priority: this.randomChoice(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
        category: this.randomChoice(['TECHNICAL', 'BILLING', 'GENERAL', 'FEEDBACK']),
        createdAt: this.randomDate(30),
        updatedAt: new Date(),
      });
    }

    await prisma.ticket.createMany({ data: tickets });
    logger.info(`[Demo Seeder] Created ${tickets.length} tickets`);
  }

  /**
   * Seed products
   */
  async seedProducts() {
    logger.info(`[Demo Seeder] Seeding ${this.counts.products} products...`);

    const products = [];

    for (let i = 0; i < this.counts.products; i++) {
      products.push({
        id: nanoid(),
        tenantId: this.tenantId,
        name: `Product ${i + 1}`,
        description: `Description for product ${i + 1}`,
        sku: `SKU-${i + 1}`,
        unitPrice: Math.floor(Math.random() * 5000) + 100,
        currency: 'INR',
        productType: this.randomChoice(['GOODS', 'SERVICES']),
        isActive: Math.random() > 0.2,
        createdAt: this.randomDate(180),
        updatedAt: new Date(),
      });
    }

    await prisma.product.createMany({ data: products });
    logger.info(`[Demo Seeder] Created ${products.length} products`);
  }

  /**
   * Seed quotes
   */
  async seedQuotes() {
    logger.info(`[Demo Seeder] Seeding ${this.counts.quotes} quotes...`);

    const contacts = await prisma.contact.findMany({
      where: { tenantId: this.tenantId },
      take: 20,
    });

    const quotes = [];

    for (let i = 0; i < this.counts.quotes; i++) {
      quotes.push({
        id: nanoid(),
        tenantId: this.tenantId,
        quoteNumber: `QT-2026-${String(i + 1).padStart(3, '0')}`,
        status: this.randomChoice(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']),
        issueDate: this.randomDate(60),
        expiryDate: this.randomFutureDate(30),
        subtotal: Math.floor(Math.random() * 100000) + 5000,
        taxAmount: 0,
        totalAmount: Math.floor(Math.random() * 100000) + 5000,
        currency: 'INR',
        contactId: contacts[Math.floor(Math.random() * contacts.length)]?.id,
        createdById: this.userId,
        createdAt: this.randomDate(60),
        updatedAt: new Date(),
      });
    }

    await prisma.quote.createMany({ data: quotes });
    logger.info(`[Demo Seeder] Created ${quotes.length} quotes`);
  }

  /**
   * Seed calendar events
   */
  async seedCalendarEvents() {
    logger.info(`[Demo Seeder] Seeding ${this.counts.calendarEvents} calendar events...`);

    const events = [];

    for (let i = 0; i < this.counts.calendarEvents; i++) {
      const start = this.randomFutureDate(30);
      const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour later

      events.push({
        id: nanoid(),
        tenantId: this.tenantId,
        title: `Meeting ${i + 1}`,
        description: `Calendar event ${i + 1}`,
        startTime: start,
        endTime: end,
        allDay: false,
        createdById: this.userId,
        createdAt: this.randomDate(30),
        updatedAt: new Date(),
      });
    }

    await prisma.calendarEvent.createMany({ data: events });
    logger.info(`[Demo Seeder] Created ${events.length} calendar events`);
  }

  /**
   * Seed inbox conversations
   */
  async seedInboxConversations() {
    logger.info(`[Demo Seeder] Seeding ${this.counts.conversations} conversations...`);

    const contacts = await prisma.contact.findMany({
      where: { tenantId: this.tenantId },
      take: 50,
    });

    const conversations = [];

    for (let i = 0; i < Math.min(this.counts.conversations, contacts.length); i++) {
      conversations.push({
        id: nanoid(),
        tenantId: this.tenantId,
        contactId: contacts[i].id,
        channel: this.randomChoice(['WHATSAPP', 'EMAIL', 'SMS']),
        status: this.randomChoice(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']),
        lastMessageAt: this.randomDate(7),
        createdAt: this.randomDate(30),
        updatedAt: new Date(),
      });
    }

    await prisma.conversation.createMany({ data: conversations });
    logger.info(`[Demo Seeder] Created ${conversations.length} conversations`);
  }

  // Helper methods
  randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
  }

  randomDate(daysAgo) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * daysAgo));
    return date;
  }

  randomFutureDate(daysAhead) {
    const date = new Date();
    date.setDate(date.getDate() + Math.floor(Math.random() * daysAhead));
    return date;
  }
}

export const demoSeederService = new DemoSeederService();
