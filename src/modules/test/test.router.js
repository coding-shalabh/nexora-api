/**
 * Test Utilities Router
 * API endpoints for testing and debugging
 */

import { Router } from 'express';
import { authenticate } from '../../common/middleware/authenticate.js';
import { PrismaClient } from '@prisma/client';
// import mockAccountsRouter from './mock-accounts.router.js'; // Temporarily disabled - file doesn't exist

const router = Router();
const prisma = new PrismaClient();

// Mount mock accounts router
// router.use('/mock-accounts', mockAccountsRouter); // Temporarily disabled

/**
 * Get test utilities status
 * GET /api/v1/test
 */
router.get('/', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        available: true,
        message: 'Test utilities API is available',
        endpoints: {
          msg91: '/msg91',
          health: '/health',
          mockAccounts: '/mock-accounts',
          seedData: '/seed-data',
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
});

/**
 * Populate dummy data
 * POST /api/v1/test/seed-data
 */
router.post('/seed-data', authenticate, async (req, res) => {
  try {
    // Get tenant info from authenticated user
    const tenantId = req.user?.tenantId || req.tenant?.tenantId;
    const userId = req.user?.id || req.tenant?.userId;

    console.log('🌱 Starting comprehensive seed for tenant:', tenantId);

    // Get some contacts for linking
    const contacts = await prisma.contact.findMany({
      where: { tenantId },
      take: 10,
    });

    console.log(`✅ Found ${contacts.length} contacts for linking`);

    // ==================== 1. MEETINGS ====================
    const meetingTypes = [
      'Client Meeting',
      'Team Standup',
      'Sales Call',
      'Product Demo',
      'Planning Session',
    ];
    const meetingStatuses = ['SCHEDULED', 'COMPLETED', 'CANCELLED'];
    const meetingLocations = [
      'Office - Conference Room A',
      'Zoom Meeting',
      'Google Meet',
      'Client Office',
      'Coffee Shop',
    ];

    for (let i = 0; i < 20; i++) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30) - 15);
      startDate.setHours(9 + Math.floor(Math.random() * 8));
      startDate.setMinutes([0, 15, 30, 45][Math.floor(Math.random() * 4)]);

      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + [30, 45, 60, 90][Math.floor(Math.random() * 4)]);

      await prisma.meeting.create({
        data: {
          tenantId,
          title: `${meetingTypes[Math.floor(Math.random() * meetingTypes.length)]} #${i + 1}`,
          description: 'Discussion about project milestones, deliverables, and next steps.',
          startTime: startDate,
          endTime: endDate,
          location: meetingLocations[Math.floor(Math.random() * meetingLocations.length)],
          meetingLink:
            Math.random() > 0.5
              ? `https://meet.google.com/${Math.random().toString(36).substring(7)}`
              : null,
          status: meetingStatuses[Math.floor(Math.random() * meetingStatuses.length)],
          organizerId: userId,
          attendees:
            contacts.length > 0
              ? {
                  create: contacts.slice(0, Math.floor(Math.random() * 5) + 1).map((contact) => ({
                    contactId: contact.id,
                    responseStatus: ['ACCEPTED', 'TENTATIVE', 'DECLINED', 'PENDING'][
                      Math.floor(Math.random() * 4)
                    ],
                  })),
                }
              : undefined,
        },
      });
    }

    // ==================== 2. TASKS ====================
    const taskTitles = [
      'Review Q1 Sales Report',
      'Update CRM Database',
      'Prepare Marketing Presentation',
      'Follow up with Client A',
      'Design New Landing Page',
      'Schedule Team Meeting',
      'Fix Bug in Checkout Process',
      'Write Blog Post',
      'Update Product Documentation',
      'Create Social Media Content',
      'Send Proposal to Client B',
      'Review Contract Terms',
    ];

    const taskPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    const taskStatuses = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

    for (let i = 0; i < 25; i++) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 60) - 10);

      await prisma.task.create({
        data: {
          tenantId,
          title: taskTitles[Math.floor(Math.random() * taskTitles.length)],
          description: 'Complete this task by the due date. Ensure all stakeholders are informed.',
          priority: taskPriorities[Math.floor(Math.random() * taskPriorities.length)],
          status: taskStatuses[Math.floor(Math.random() * taskStatuses.length)],
          dueDate: Math.random() > 0.2 ? dueDate : null,
          assignedToId: userId,
          createdById: userId,
          estimatedHours: Math.floor(Math.random() * 20) + 1,
        },
      });
    }

    // ==================== 3. PROJECTS ====================
    const projectNames = [
      'Website Redesign 2024',
      'Mobile App Development',
      'CRM Implementation',
      'Marketing Campaign Q1',
      'Product Launch - Phase 2',
      'Infrastructure Upgrade',
    ];

    for (let i = 0; i < projectNames.length; i++) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 90));

      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 180) + 30);

      const budget = [50000, 100000, 150000, 200000][Math.floor(Math.random() * 4)];

      await prisma.project.create({
        data: {
          tenantId,
          name: projectNames[i],
          description: `${projectNames[i]} - Complete project with defined milestones and timeline.`,
          status: ['PLANNING', 'IN_PROGRESS', 'COMPLETED'][Math.floor(Math.random() * 3)],
          startDate,
          endDate,
          budget,
          spent: Math.floor(budget * (Math.random() * 0.7)),
          progress: Math.floor(Math.random() * 100),
          ownerId: userId,
          clientId:
            contacts.length > 0 ? contacts[Math.floor(Math.random() * contacts.length)].id : null,
          priority: taskPriorities[Math.floor(Math.random() * taskPriorities.length)],
        },
      });
    }

    // ==================== 4. E-COMMERCE PRODUCTS ====================
    const products = [
      { name: 'Premium CRM License', price: 9999, category: 'Software', sku: 'CRM-PREM-001' },
      { name: 'Starter Plan', price: 2999, category: 'Software', sku: 'CRM-START-001' },
      { name: 'Enterprise Plan', price: 99999, category: 'Software', sku: 'CRM-ENT-001' },
      { name: 'WhatsApp Credits', price: 4999, category: 'Add-ons', sku: 'WA-1000' },
      { name: 'SMS Credits', price: 2499, category: 'Add-ons', sku: 'SMS-5000' },
      { name: 'Email Suite', price: 7999, category: 'Add-ons', sku: 'EMAIL-001' },
      { name: 'Custom Integration', price: 49999, category: 'Services', sku: 'SVC-INT-001' },
      { name: 'Training Package', price: 29999, category: 'Services', sku: 'SVC-TRAIN-001' },
    ];

    const createdProducts = [];
    for (const product of products) {
      const created = await prisma.product.create({
        data: {
          tenantId,
          name: product.name,
          description: `${product.name} - Professional solution for your business needs.`,
          price: product.price,
          currency: 'INR',
          category: product.category,
          sku: product.sku,
          stockQuantity:
            product.category === 'Software' ? null : Math.floor(Math.random() * 500) + 100,
          isActive: true,
          tags: ['nexora', product.category.toLowerCase()],
        },
      });
      createdProducts.push(created);
    }

    // ==================== 5. INVOICES ====================
    for (let i = 0; i < 15; i++) {
      const invoiceDate = new Date();
      invoiceDate.setDate(invoiceDate.getDate() - Math.floor(Math.random() * 120));

      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + 30);

      const status = ['DRAFT', 'SENT', 'PAID', 'OVERDUE'][Math.floor(Math.random() * 4)];
      const subtotal = [9999, 29999, 49999][Math.floor(Math.random() * 3)];
      const tax = Math.floor(subtotal * 0.18);
      const total = subtotal + tax;

      await prisma.invoice.create({
        data: {
          tenantId,
          invoiceNumber: `INV-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
          customerId:
            contacts.length > 0 ? contacts[Math.floor(Math.random() * contacts.length)].id : null,
          issueDate: invoiceDate,
          dueDate,
          status,
          subtotal,
          tax,
          total,
          currency: 'INR',
          notes: 'Payment terms: Net 30 days.',
          items: {
            create: [
              {
                description:
                  createdProducts[Math.floor(Math.random() * createdProducts.length)].name,
                quantity: 1,
                unitPrice: subtotal,
                total: subtotal,
              },
            ],
          },
          payments:
            status === 'PAID'
              ? {
                  create: [
                    {
                      tenantId,
                      amount: total,
                      paymentDate: new Date(
                        invoiceDate.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000
                      ),
                      paymentMethod: ['CARD', 'UPI', 'BANK_TRANSFER'][
                        Math.floor(Math.random() * 3)
                      ],
                      transactionId: `TXN${Date.now()}${Math.random().toString(36).substring(7).toUpperCase()}`,
                      status: 'COMPLETED',
                    },
                  ],
                }
              : undefined,
        },
      });
    }

    // ==================== 6. QUOTES ====================
    for (let i = 0; i < 12; i++) {
      const quoteDate = new Date();
      quoteDate.setDate(quoteDate.getDate() - Math.floor(Math.random() * 90));

      const validUntil = new Date(quoteDate);
      validUntil.setDate(validUntil.getDate() + 30);

      const subtotal = [49999, 99999, 149999][Math.floor(Math.random() * 3)];
      const discount = Math.floor(subtotal * 0.1);
      const tax = Math.floor((subtotal - discount) * 0.18);
      const total = subtotal - discount + tax;

      await prisma.quote.create({
        data: {
          tenantId,
          quoteNumber: `QT-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
          customerId:
            contacts.length > 0 ? contacts[Math.floor(Math.random() * contacts.length)].id : null,
          issueDate: quoteDate,
          validUntil,
          status: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'][Math.floor(Math.random() * 4)],
          subtotal,
          discount,
          tax,
          total,
          currency: 'INR',
          notes: 'Quote valid for 30 days.',
          terms: 'Payment: 50% advance, 50% on delivery.',
          items: {
            create: [
              {
                description:
                  createdProducts[Math.floor(Math.random() * createdProducts.length)].name,
                quantity: 1,
                unitPrice: subtotal,
                total: subtotal,
              },
            ],
          },
        },
      });
    }

    res.json({
      success: true,
      message: 'Dummy data created successfully',
      data: {
        meetings: 20,
        tasks: 25,
        projects: projectNames.length,
        products: products.length,
        invoices: 15,
        quotes: 12,
      },
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
});

/**
 * Health check endpoint
 * GET /api/v1/test/health
 */
router.get('/health', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { message: error.message },
    });
  }
});

export default router;
