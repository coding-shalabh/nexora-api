import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting comprehensive seed...');

  // Get the demo tenant and user
  const demoTenant = await prisma.tenant.findFirst({
    where: { slug: '72orionx' },
  });

  if (!demoTenant) {
    console.log('❌ Demo tenant not found. Run main seed first.');
    return;
  }

  const demoUser = await prisma.user.findFirst({
    where: { tenantId: demoTenant.id, email: 'admin@helixcode.in' },
  });

  if (!demoUser) {
    console.log('❌ Demo user not found. Run main seed first.');
    return;
  }

  console.log('✅ Using tenant:', demoTenant.name);
  console.log('✅ Using user:', demoUser.email);

  // Get some contacts for linking
  const contacts = await prisma.contact.findMany({
    where: { tenantId: demoTenant.id },
    take: 10,
  });

  console.log(`✅ Found ${contacts.length} contacts for linking`);

  // ==================== 1. MEETINGS ====================
  console.log('\n📅 Creating Meetings...');

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
    startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 30) - 15); // Random date ±15 days
    startDate.setHours(9 + Math.floor(Math.random() * 8)); // 9 AM to 5 PM
    startDate.setMinutes([0, 15, 30, 45][Math.floor(Math.random() * 4)]);

    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + [30, 45, 60, 90][Math.floor(Math.random() * 4)]);

    await prisma.meeting.create({
      data: {
        tenantId: demoTenant.id,
        title: `${meetingTypes[Math.floor(Math.random() * meetingTypes.length)]} #${i + 1}`,
        description: `Discussion about project milestones, deliverables, and next steps. Agenda includes budget review and timeline adjustments.`,
        startTime: startDate,
        endTime: endDate,
        location: meetingLocations[Math.floor(Math.random() * meetingLocations.length)],
        meetingLink:
          Math.random() > 0.5
            ? `https://meet.google.com/${Math.random().toString(36).substring(7)}`
            : null,
        status: meetingStatuses[Math.floor(Math.random() * meetingStatuses.length)],
        organizerId: demoUser.id,
        attendees: {
          create: contacts.slice(0, Math.floor(Math.random() * 5) + 1).map((contact) => ({
            contactId: contact.id,
            userId: null,
            responseStatus: ['ACCEPTED', 'TENTATIVE', 'DECLINED', 'PENDING'][
              Math.floor(Math.random() * 4)
            ],
          })),
        },
      },
    });
  }

  console.log('✅ Created 20 meetings');

  // ==================== 2. TASKS ====================
  console.log('\n✅ Creating Tasks...');

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
    'Conduct User Interviews',
    'Analyze Competitor Pricing',
    'Organize Team Building Event',
  ];

  const taskPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const taskStatuses = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

  for (let i = 0; i < 25; i++) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 60) - 10); // Random due date

    await prisma.task.create({
      data: {
        tenantId: demoTenant.id,
        title: taskTitles[Math.floor(Math.random() * taskTitles.length)],
        description: `Complete this task by the due date. Ensure all stakeholders are informed and documentation is updated.`,
        priority: taskPriorities[Math.floor(Math.random() * taskPriorities.length)],
        status: taskStatuses[Math.floor(Math.random() * taskStatuses.length)],
        dueDate: Math.random() > 0.2 ? dueDate : null,
        assignedToId: demoUser.id,
        createdById: demoUser.id,
        estimatedHours: Math.floor(Math.random() * 20) + 1,
        actualHours: Math.random() > 0.5 ? Math.floor(Math.random() * 15) + 1 : null,
      },
    });
  }

  console.log('✅ Created 25 tasks');

  // ==================== 3. PROJECTS ====================
  console.log('\n📁 Creating Projects...');

  const projectNames = [
    'Website Redesign 2024',
    'Mobile App Development',
    'CRM Implementation',
    'Marketing Campaign Q1',
    'Product Launch - Phase 2',
    'Infrastructure Upgrade',
    'Customer Portal',
    'Sales Automation System',
  ];

  const projectStatuses = ['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED'];

  for (let i = 0; i < projectNames.length; i++) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Math.floor(Math.random() * 90));

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 180) + 30);

    const budget = [50000, 100000, 150000, 200000, 300000][Math.floor(Math.random() * 5)];
    const spent = Math.floor(budget * (Math.random() * 0.7));

    await prisma.project.create({
      data: {
        tenantId: demoTenant.id,
        name: projectNames[i],
        description: `${projectNames[i]} - Complete project with defined milestones, budget, and timeline. Key stakeholders involved.`,
        status: projectStatuses[Math.floor(Math.random() * projectStatuses.length)],
        startDate: startDate,
        endDate: endDate,
        budget: budget,
        spent: spent,
        progress: Math.floor(Math.random() * 100),
        ownerId: demoUser.id,
        clientId:
          contacts.length > 0 ? contacts[Math.floor(Math.random() * contacts.length)].id : null,
        priority: taskPriorities[Math.floor(Math.random() * taskPriorities.length)],
        tags: ['development', 'client-work', 'internal'][Math.floor(Math.random() * 3)],
      },
    });
  }

  console.log(`✅ Created ${projectNames.length} projects`);

  // ==================== 4. E-COMMERCE PRODUCTS ====================
  console.log('\n🛒 Creating E-Commerce Products...');

  const products = [
    {
      name: 'Premium Business CRM License',
      description:
        'Complete CRM solution with all features unlocked. Includes unlimited contacts, deals, and automation workflows.',
      price: 9999,
      category: 'Software',
      sku: 'CRM-PREM-001',
    },
    {
      name: 'Starter Plan Subscription',
      description:
        'Entry-level CRM plan perfect for small teams. Up to 5 users and basic features.',
      price: 2999,
      category: 'Software',
      sku: 'CRM-START-001',
    },
    {
      name: 'Enterprise Plan Annual',
      description:
        'Full-featured enterprise plan with unlimited users, advanced analytics, and priority support.',
      price: 99999,
      category: 'Software',
      sku: 'CRM-ENT-YEAR-001',
    },
    {
      name: 'WhatsApp Business API Credits',
      description: '1000 WhatsApp message credits for business communication. Valid for 12 months.',
      price: 4999,
      category: 'Add-ons',
      sku: 'WA-CREDITS-1000',
    },
    {
      name: 'SMS Credits Pack',
      description: '5000 SMS credits for bulk messaging campaigns. DLT compliant.',
      price: 2499,
      category: 'Add-ons',
      sku: 'SMS-CREDITS-5000',
    },
    {
      name: 'Email Marketing Suite',
      description:
        'Advanced email marketing with automation, templates, and analytics. 50,000 emails/month.',
      price: 7999,
      category: 'Add-ons',
      sku: 'EMAIL-SUITE-001',
    },
    {
      name: 'Custom Integration Development',
      description:
        'Professional services for custom API integrations and workflows. Per integration.',
      price: 49999,
      category: 'Services',
      sku: 'SVC-INTEG-001',
    },
    {
      name: 'Onboarding & Training Package',
      description:
        'Complete onboarding with 8 hours of live training for your team. Includes documentation.',
      price: 29999,
      category: 'Services',
      sku: 'SVC-TRAIN-001',
    },
    {
      name: 'Priority Support (Annual)',
      description: '24/7 priority support with dedicated account manager and SLA guarantee.',
      price: 59999,
      category: 'Support',
      sku: 'SUP-PRIO-YEAR',
    },
    {
      name: 'Data Migration Service',
      description:
        'Professional data migration from your existing CRM to Nexora. Includes validation and testing.',
      price: 39999,
      category: 'Services',
      sku: 'SVC-MIGRATE-001',
    },
  ];

  for (const product of products) {
    await prisma.product.create({
      data: {
        tenantId: demoTenant.id,
        name: product.name,
        description: product.description,
        price: product.price,
        currency: 'INR',
        category: product.category,
        sku: product.sku,
        stockQuantity:
          product.category === 'Software' || product.category === 'Services'
            ? null
            : Math.floor(Math.random() * 1000) + 100,
        isActive: true,
        tags: ['nexora', product.category.toLowerCase(), 'subscription'],
      },
    });
  }

  console.log(`✅ Created ${products.length} products`);

  // ==================== 5. INVOICES & BILLING ====================
  console.log('\n💰 Creating Invoices...');

  const invoiceStatuses = ['DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED'];

  for (let i = 0; i < 15; i++) {
    const invoiceDate = new Date();
    invoiceDate.setDate(invoiceDate.getDate() - Math.floor(Math.random() * 120));

    const dueDate = new Date(invoiceDate);
    dueDate.setDate(dueDate.getDate() + 30);

    const status = invoiceStatuses[Math.floor(Math.random() * invoiceStatuses.length)];
    const subtotal = [9999, 29999, 49999, 99999][Math.floor(Math.random() * 4)];
    const taxRate = 18; // GST 18%
    const tax = Math.floor(subtotal * (taxRate / 100));
    const total = subtotal + tax;

    await prisma.invoice.create({
      data: {
        tenantId: demoTenant.id,
        invoiceNumber: `INV-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
        customerId:
          contacts.length > 0 ? contacts[Math.floor(Math.random() * contacts.length)].id : null,
        issueDate: invoiceDate,
        dueDate: dueDate,
        status: status,
        subtotal: subtotal,
        tax: tax,
        total: total,
        currency: 'INR',
        notes: 'Payment terms: Net 30 days. Please include invoice number in payment reference.',
        items: {
          create: [
            {
              description: products[Math.floor(Math.random() * products.length)].name,
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
                    tenantId: demoTenant.id,
                    amount: total,
                    paymentDate: new Date(
                      invoiceDate.getTime() + Math.random() * 30 * 24 * 60 * 60 * 1000
                    ),
                    paymentMethod: ['CARD', 'UPI', 'BANK_TRANSFER', 'CASH'][
                      Math.floor(Math.random() * 4)
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

  console.log('✅ Created 15 invoices with payments');

  // ==================== 6. QUOTES ====================
  console.log('\n📝 Creating Quotes...');

  const quoteStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];

  for (let i = 0; i < 12; i++) {
    const quoteDate = new Date();
    quoteDate.setDate(quoteDate.getDate() - Math.floor(Math.random() * 90));

    const validUntil = new Date(quoteDate);
    validUntil.setDate(validUntil.getDate() + 30);

    const subtotal = [49999, 99999, 149999, 199999][Math.floor(Math.random() * 4)];
    const discount = Math.floor(subtotal * (Math.random() * 0.15)); // 0-15% discount
    const tax = Math.floor((subtotal - discount) * 0.18); // 18% GST
    const total = subtotal - discount + tax;

    await prisma.quote.create({
      data: {
        tenantId: demoTenant.id,
        quoteNumber: `QT-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
        customerId:
          contacts.length > 0 ? contacts[Math.floor(Math.random() * contacts.length)].id : null,
        issueDate: quoteDate,
        validUntil: validUntil,
        status: quoteStatuses[Math.floor(Math.random() * quoteStatuses.length)],
        subtotal: subtotal,
        discount: discount,
        tax: tax,
        total: total,
        currency: 'INR',
        notes:
          'This quote is valid for 30 days from issue date. Prices are subject to change after expiry.',
        terms: 'Payment terms: 50% advance, 50% on delivery. Prices include GST.',
        items: {
          create: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, idx) => {
            const product = products[Math.floor(Math.random() * products.length)];
            const qty = Math.floor(Math.random() * 5) + 1;
            const itemTotal = product.price * qty;
            return {
              description: product.name,
              quantity: qty,
              unitPrice: product.price,
              total: itemTotal,
            };
          }),
        },
      },
    });
  }

  console.log('✅ Created 12 quotes');

  // ==================== SUMMARY ====================
  console.log('\n✨ Seed Summary:');
  console.log('  📅 Meetings: 20');
  console.log('  ✅ Tasks: 25');
  console.log('  📁 Projects: 8');
  console.log('  🛒 Products: 10');
  console.log('  💰 Invoices: 15 (with payments)');
  console.log('  📝 Quotes: 12');
  console.log('\n🎉 Comprehensive seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
