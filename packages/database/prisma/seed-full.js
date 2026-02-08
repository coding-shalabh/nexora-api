import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * FULL SEED - Complete Relational Data
 * Creates realistic data with proper relationships
 */
async function main() {
  console.log('Starting full database seed...\n');

  // Get existing tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'helix-code' },
  });

  if (!tenant) {
    console.error('Tenant not found. Run seed-minimal.js first.');
    process.exit(1);
  }

  console.log('Using tenant:', tenant.name, '\n');

  // Get existing admin user
  const adminUser = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'arpit.sharma@helixcode.in' },
  });

  // ==================== 1. ADDITIONAL USERS ====================
  console.log('Creating users...');
  const passwordHash = await bcrypt.hash('demo123456', 12);

  const salesUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'priya.verma@helixcode.in' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'priya.verma@helixcode.in',
      firstName: 'Priya',
      lastName: 'Verma',
      displayName: 'Priya Verma',
      phone: '+91 9876543211',
      passwordHash,
      emailVerified: true,
      status: 'ACTIVE',
    },
  });

  const supportUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'rahul.kumar@helixcode.in' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'rahul.kumar@helixcode.in',
      firstName: 'Rahul',
      lastName: 'Kumar',
      displayName: 'Rahul Kumar',
      phone: '+91 9876543212',
      passwordHash,
      emailVerified: true,
      status: 'ACTIVE',
    },
  });

  const marketingUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'neha.sharma@helixcode.in' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'neha.sharma@helixcode.in',
      firstName: 'Neha',
      lastName: 'Sharma',
      displayName: 'Neha Sharma',
      phone: '+91 9876543213',
      passwordHash,
      emailVerified: true,
      status: 'ACTIVE',
    },
  });

  console.log('  Created 3 additional users');

  // Link new users to workspace
  const workspace = await prisma.workspace.findFirst({ where: { tenantId: tenant.id } });
  for (const user of [salesUser, supportUser, marketingUser]) {
    await prisma.userWorkspace.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      update: {},
      create: { userId: user.id, workspaceId: workspace.id },
    });
  }

  // Create roles and assign
  const salesRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Sales Representative' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Sales Representative',
      description: 'Sales team member',
      level: 6,
    },
  });

  const supportRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Support Agent' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Support Agent',
      description: 'Customer support team',
      level: 5,
    },
  });

  const marketingRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Marketing Manager' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Marketing Manager',
      description: 'Marketing team lead',
      level: 7,
    },
  });

  // Assign roles
  for (const [user, role] of [
    [salesUser, salesRole],
    [supportUser, supportRole],
    [marketingUser, marketingRole],
  ]) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });
  }

  // ==================== 2. COMPANIES ====================
  console.log('Creating companies...');
  const companies = await Promise.all([
    prisma.company.upsert({
      where: { id: `company-techvision-${tenant.id}` },
      update: {},
      create: {
        id: `company-techvision-${tenant.id}`,
        tenantId: tenant.id,
        name: 'TechVision Solutions Pvt Ltd',
        domain: 'techvision.io',
        industry: 'Information Technology',
        employeeCount: '51-200',
        annualRevenue: '₹5-10 Crores',
        address: '42, Electronic City Phase 1',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        postalCode: '560100',
        phone: '+91 80 4567 8901',
        email: 'contact@techvision.io',
        companyType: 'PROSPECT',
        lifecycleStage: 'OPPORTUNITY',
        websiteUrl: 'https://techvision.io',
        linkedinUrl: 'https://linkedin.com/company/techvision',
        gstin: '29AABCT1234A1Z5',
      },
    }),
    prisma.company.upsert({
      where: { id: `company-innovate-${tenant.id}` },
      update: {},
      create: {
        id: `company-innovate-${tenant.id}`,
        tenantId: tenant.id,
        name: 'Innovate Digital Agency',
        domain: 'innovatedigital.in',
        industry: 'Marketing & Advertising',
        employeeCount: '11-50',
        annualRevenue: '₹1-5 Crores',
        address: '123, MG Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        country: 'India',
        postalCode: '400001',
        phone: '+91 22 2345 6789',
        email: 'hello@innovatedigital.in',
        companyType: 'CUSTOMER',
        lifecycleStage: 'CUSTOMER',
        websiteUrl: 'https://innovatedigital.in',
      },
    }),
    prisma.company.upsert({
      where: { id: `company-startup-${tenant.id}` },
      update: {},
      create: {
        id: `company-startup-${tenant.id}`,
        tenantId: tenant.id,
        name: 'StartupHub Ventures',
        domain: 'startuphub.vc',
        industry: 'Financial Services',
        employeeCount: '1-10',
        annualRevenue: '₹50 Lakhs - 1 Crore',
        address: '15, Koramangala',
        city: 'Bangalore',
        state: 'Karnataka',
        country: 'India',
        postalCode: '560095',
        phone: '+91 80 9876 5432',
        email: 'invest@startuphub.vc',
        companyType: 'PROSPECT',
        lifecycleStage: 'LEAD',
      },
    }),
    prisma.company.upsert({
      where: { id: `company-healthcare-${tenant.id}` },
      update: {},
      create: {
        id: `company-healthcare-${tenant.id}`,
        tenantId: tenant.id,
        name: 'HealthFirst Clinics',
        domain: 'healthfirst.co.in',
        industry: 'Healthcare',
        employeeCount: '201-500',
        annualRevenue: '₹10-50 Crores',
        address: '789, Sector 15',
        city: 'Gurugram',
        state: 'Haryana',
        country: 'India',
        postalCode: '122001',
        phone: '+91 124 456 7890',
        email: 'admin@healthfirst.co.in',
        companyType: 'CUSTOMER',
        lifecycleStage: 'CUSTOMER',
      },
    }),
  ]);
  console.log(`  Created ${companies.length} companies`);

  // ==================== 3. TAGS ====================
  console.log('Creating tags...');
  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'VIP' } },
      update: {},
      create: { tenantId: tenant.id, name: 'VIP', color: '#f59e0b' },
    }),
    prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Hot Lead' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Hot Lead', color: '#ef4444' },
    }),
    prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Decision Maker' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Decision Maker', color: '#8b5cf6' },
    }),
    prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Enterprise' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Enterprise', color: '#3b82f6' },
    }),
    prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'SMB' } },
      update: {},
      create: { tenantId: tenant.id, name: 'SMB', color: '#22c55e' },
    }),
    prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Needs Follow-up' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Needs Follow-up', color: '#f97316' },
    }),
    prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Renewal Due' } },
      update: {},
      create: { tenantId: tenant.id, name: 'Renewal Due', color: '#ec4899' },
    }),
  ]);
  console.log(`  Created ${tags.length} tags`);

  // ==================== 4. CONTACTS ====================
  console.log('Creating contacts...');
  const contacts = await Promise.all([
    // TechVision contacts
    prisma.contact.upsert({
      where: { id: `contact-1-${tenant.id}` },
      update: {},
      create: {
        id: `contact-1-${tenant.id}`,
        tenantId: tenant.id,
        firstName: 'Rajesh',
        lastName: 'Sharma',
        displayName: 'Rajesh Sharma',
        email: 'rajesh.sharma@techvision.io',
        phone: '+91 9876543001',
        companyId: companies[0].id,
        jobTitle: 'Chief Technology Officer',
        department: 'Technology',
        source: 'WEBSITE',
        status: 'ACTIVE',
        lifecycleStage: 'CUSTOMER',
        leadStatus: 'OPEN_DEAL',
        leadScore: 95,
        rating: 'HOT',
        priority: 'HIGH',
        ownerId: salesUser.id,
        marketingConsent: true,
        whatsappConsent: true,
        emailConsent: true,
      },
    }),
    prisma.contact.upsert({
      where: { id: `contact-2-${tenant.id}` },
      update: {},
      create: {
        id: `contact-2-${tenant.id}`,
        tenantId: tenant.id,
        firstName: 'Sneha',
        lastName: 'Patel',
        displayName: 'Sneha Patel',
        email: 'sneha.patel@techvision.io',
        phone: '+91 9876543002',
        companyId: companies[0].id,
        jobTitle: 'HR Manager',
        department: 'Human Resources',
        source: 'REFERRAL',
        status: 'ACTIVE',
        lifecycleStage: 'OPPORTUNITY',
        leadScore: 75,
        rating: 'WARM',
        priority: 'MEDIUM',
        ownerId: salesUser.id,
      },
    }),
    // Innovate Digital contacts
    prisma.contact.upsert({
      where: { id: `contact-3-${tenant.id}` },
      update: {},
      create: {
        id: `contact-3-${tenant.id}`,
        tenantId: tenant.id,
        firstName: 'Amit',
        lastName: 'Gupta',
        displayName: 'Amit Gupta',
        email: 'amit@innovatedigital.in',
        phone: '+91 9876543003',
        companyId: companies[1].id,
        jobTitle: 'Founder & CEO',
        department: 'Executive',
        source: 'SOCIAL',
        status: 'ACTIVE',
        lifecycleStage: 'CUSTOMER',
        leadScore: 100,
        rating: 'HOT',
        priority: 'HIGH',
        ownerId: adminUser.id,
        marketingConsent: true,
      },
    }),
    // StartupHub contacts
    prisma.contact.upsert({
      where: { id: `contact-4-${tenant.id}` },
      update: {},
      create: {
        id: `contact-4-${tenant.id}`,
        tenantId: tenant.id,
        firstName: 'Vikram',
        lastName: 'Singh',
        displayName: 'Vikram Singh',
        email: 'vikram@startuphub.vc',
        phone: '+91 9876543004',
        companyId: companies[2].id,
        jobTitle: 'Managing Partner',
        department: 'Investment',
        source: 'EVENT',
        status: 'ACTIVE',
        lifecycleStage: 'LEAD',
        leadStatus: 'NEW',
        leadScore: 60,
        rating: 'WARM',
        priority: 'MEDIUM',
        ownerId: salesUser.id,
      },
    }),
    // HealthFirst contacts
    prisma.contact.upsert({
      where: { id: `contact-5-${tenant.id}` },
      update: {},
      create: {
        id: `contact-5-${tenant.id}`,
        tenantId: tenant.id,
        firstName: 'Dr. Meera',
        lastName: 'Reddy',
        displayName: 'Dr. Meera Reddy',
        email: 'meera.reddy@healthfirst.co.in',
        phone: '+91 9876543005',
        companyId: companies[3].id,
        jobTitle: 'Chief Medical Officer',
        department: 'Medical',
        source: 'PHONE_CALL',
        status: 'ACTIVE',
        lifecycleStage: 'CUSTOMER',
        leadScore: 85,
        rating: 'HOT',
        priority: 'HIGH',
        ownerId: adminUser.id,
        marketingConsent: true,
        whatsappConsent: true,
      },
    }),
    // Standalone contacts
    prisma.contact.upsert({
      where: { id: `contact-6-${tenant.id}` },
      update: {},
      create: {
        id: `contact-6-${tenant.id}`,
        tenantId: tenant.id,
        firstName: 'Ananya',
        lastName: 'Krishnan',
        displayName: 'Ananya Krishnan',
        email: 'ananya.k@gmail.com',
        phone: '+91 9876543006',
        source: 'WEBSITE',
        status: 'ACTIVE',
        lifecycleStage: 'SUBSCRIBER',
        leadScore: 30,
        rating: 'COLD',
        priority: 'LOW',
        ownerId: marketingUser.id,
        emailConsent: true,
      },
    }),
    prisma.contact.upsert({
      where: { id: `contact-7-${tenant.id}` },
      update: {},
      create: {
        id: `contact-7-${tenant.id}`,
        tenantId: tenant.id,
        firstName: 'Karthik',
        lastName: 'Iyer',
        displayName: 'Karthik Iyer',
        email: 'karthik.iyer@outlook.com',
        phone: '+91 9876543007',
        source: 'SOCIAL',
        status: 'ACTIVE',
        lifecycleStage: 'LEAD',
        leadStatus: 'CONNECTED',
        leadScore: 55,
        rating: 'WARM',
        priority: 'MEDIUM',
        ownerId: salesUser.id,
      },
    }),
    prisma.contact.upsert({
      where: { id: `contact-8-${tenant.id}` },
      update: {},
      create: {
        id: `contact-8-${tenant.id}`,
        tenantId: tenant.id,
        firstName: 'Pooja',
        lastName: 'Mehta',
        displayName: 'Pooja Mehta',
        email: 'pooja.mehta@yahoo.com',
        phone: '+91 9876543008',
        source: 'ADVERTISEMENT',
        status: 'ACTIVE',
        lifecycleStage: 'MQL',
        leadStatus: 'IN_PROGRESS',
        leadScore: 70,
        rating: 'WARM',
        priority: 'MEDIUM',
        ownerId: salesUser.id,
        marketingConsent: true,
      },
    }),
  ]);
  console.log(`  Created ${contacts.length} contacts`);

  // Add tags to contacts
  const vipTag = tags.find((t) => t.name === 'VIP');
  const hotLeadTag = tags.find((t) => t.name === 'Hot Lead');
  const decisionMakerTag = tags.find((t) => t.name === 'Decision Maker');
  const enterpriseTag = tags.find((t) => t.name === 'Enterprise');

  await prisma.contactTag.createMany({
    data: [
      { contactId: contacts[0].id, tagId: vipTag.id },
      { contactId: contacts[0].id, tagId: decisionMakerTag.id },
      { contactId: contacts[2].id, tagId: vipTag.id },
      { contactId: contacts[2].id, tagId: enterpriseTag.id },
      { contactId: contacts[3].id, tagId: hotLeadTag.id },
      { contactId: contacts[4].id, tagId: decisionMakerTag.id },
      { contactId: contacts[4].id, tagId: enterpriseTag.id },
    ],
    skipDuplicates: true,
  });
  console.log('  Added tags to contacts');

  // ==================== 5. PRODUCTS ====================
  console.log('Creating products...');
  const products = await Promise.all([
    prisma.product.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: 'NXR-CRM-ENT' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Nexora CRM Enterprise',
        description: 'Full-featured CRM with unlimited users, automation, and integrations',
        sku: 'NXR-CRM-ENT',
        unitPrice: 49999.0,
        currency: 'INR',
        taxRate: 18.0,
        gstRate: 18.0,
        productType: 'SERVICES',
        hsnCode: '998314',
        unit: 'License/Year',
        isActive: true,
      },
    }),
    prisma.product.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: 'NXR-CRM-PRO' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Nexora CRM Professional',
        description: 'CRM for growing teams with up to 25 users',
        sku: 'NXR-CRM-PRO',
        unitPrice: 24999.0,
        currency: 'INR',
        taxRate: 18.0,
        gstRate: 18.0,
        productType: 'SERVICES',
        hsnCode: '998314',
        unit: 'License/Year',
        isActive: true,
      },
    }),
    prisma.product.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: 'NXR-CRM-STR' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Nexora CRM Starter',
        description: 'Essential CRM features for small teams up to 5 users',
        sku: 'NXR-CRM-STR',
        unitPrice: 9999.0,
        currency: 'INR',
        taxRate: 18.0,
        gstRate: 18.0,
        productType: 'SERVICES',
        hsnCode: '998314',
        unit: 'License/Year',
        isActive: true,
      },
    }),
    prisma.product.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: 'NXR-INBOX' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Unified Inbox Add-on',
        description: 'WhatsApp, Email, SMS integration for any plan',
        sku: 'NXR-INBOX',
        unitPrice: 4999.0,
        currency: 'INR',
        taxRate: 18.0,
        gstRate: 18.0,
        productType: 'SERVICES',
        hsnCode: '998314',
        unit: 'Add-on/Year',
        isActive: true,
      },
    }),
    prisma.product.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: 'NXR-AUTO' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Automation Pack',
        description: '500 additional automation workflows per month',
        sku: 'NXR-AUTO',
        unitPrice: 2999.0,
        currency: 'INR',
        taxRate: 18.0,
        gstRate: 18.0,
        productType: 'SERVICES',
        hsnCode: '998314',
        unit: 'Pack/Month',
        isActive: true,
      },
    }),
    prisma.product.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: 'NXR-IMPL' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Implementation Service',
        description: 'Professional setup, data migration, and training',
        sku: 'NXR-IMPL',
        unitPrice: 19999.0,
        currency: 'INR',
        taxRate: 18.0,
        gstRate: 18.0,
        productType: 'SERVICES',
        hsnCode: '998314',
        unit: 'One-time',
        isActive: true,
      },
    }),
  ]);
  console.log(`  Created ${products.length} products`);

  // ==================== 6. PIPELINES & STAGES ====================
  console.log('Creating pipelines and stages...');

  // Sales Pipeline
  const salesPipeline = await prisma.pipeline.upsert({
    where: { tenantId_name_type: { tenantId: tenant.id, name: 'Sales Pipeline', type: 'DEAL' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Sales Pipeline',
      description: 'Main sales process',
      type: 'DEAL',
      isDefault: true,
    },
  });

  const salesStages = await Promise.all([
    prisma.stage.upsert({
      where: { pipelineId_name: { pipelineId: salesPipeline.id, name: 'Qualification' } },
      update: {},
      create: {
        tenantId: tenant.id,
        pipelineId: salesPipeline.id,
        name: 'Qualification',
        order: 1,
        probability: 10,
        color: '#6366f1',
      },
    }),
    prisma.stage.upsert({
      where: { pipelineId_name: { pipelineId: salesPipeline.id, name: 'Discovery' } },
      update: {},
      create: {
        tenantId: tenant.id,
        pipelineId: salesPipeline.id,
        name: 'Discovery',
        order: 2,
        probability: 25,
        color: '#8b5cf6',
      },
    }),
    prisma.stage.upsert({
      where: { pipelineId_name: { pipelineId: salesPipeline.id, name: 'Proposal' } },
      update: {},
      create: {
        tenantId: tenant.id,
        pipelineId: salesPipeline.id,
        name: 'Proposal',
        order: 3,
        probability: 50,
        color: '#ec4899',
      },
    }),
    prisma.stage.upsert({
      where: { pipelineId_name: { pipelineId: salesPipeline.id, name: 'Negotiation' } },
      update: {},
      create: {
        tenantId: tenant.id,
        pipelineId: salesPipeline.id,
        name: 'Negotiation',
        order: 4,
        probability: 75,
        color: '#f59e0b',
      },
    }),
    prisma.stage.upsert({
      where: { pipelineId_name: { pipelineId: salesPipeline.id, name: 'Closed Won' } },
      update: {},
      create: {
        tenantId: tenant.id,
        pipelineId: salesPipeline.id,
        name: 'Closed Won',
        order: 5,
        probability: 100,
        color: '#22c55e',
        isWon: true,
        isClosed: true,
      },
    }),
    prisma.stage.upsert({
      where: { pipelineId_name: { pipelineId: salesPipeline.id, name: 'Closed Lost' } },
      update: {},
      create: {
        tenantId: tenant.id,
        pipelineId: salesPipeline.id,
        name: 'Closed Lost',
        order: 6,
        probability: 0,
        color: '#ef4444',
        isLost: true,
        isClosed: true,
      },
    }),
  ]);

  // Support Pipeline
  const supportPipeline = await prisma.pipeline.upsert({
    where: {
      tenantId_name_type: { tenantId: tenant.id, name: 'Support Pipeline', type: 'TICKET' },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Support Pipeline',
      description: 'Customer support tickets',
      type: 'TICKET',
      isDefault: true,
    },
  });

  const supportStages = await Promise.all([
    prisma.stage.upsert({
      where: { pipelineId_name: { pipelineId: supportPipeline.id, name: 'New' } },
      update: {},
      create: {
        tenantId: tenant.id,
        pipelineId: supportPipeline.id,
        name: 'New',
        order: 1,
        color: '#6366f1',
      },
    }),
    prisma.stage.upsert({
      where: { pipelineId_name: { pipelineId: supportPipeline.id, name: 'In Progress' } },
      update: {},
      create: {
        tenantId: tenant.id,
        pipelineId: supportPipeline.id,
        name: 'In Progress',
        order: 2,
        color: '#f59e0b',
      },
    }),
    prisma.stage.upsert({
      where: { pipelineId_name: { pipelineId: supportPipeline.id, name: 'Waiting on Customer' } },
      update: {},
      create: {
        tenantId: tenant.id,
        pipelineId: supportPipeline.id,
        name: 'Waiting on Customer',
        order: 3,
        color: '#8b5cf6',
      },
    }),
    prisma.stage.upsert({
      where: { pipelineId_name: { pipelineId: supportPipeline.id, name: 'Resolved' } },
      update: {},
      create: {
        tenantId: tenant.id,
        pipelineId: supportPipeline.id,
        name: 'Resolved',
        order: 4,
        color: '#22c55e',
        isClosed: true,
      },
    }),
    prisma.stage.upsert({
      where: { pipelineId_name: { pipelineId: supportPipeline.id, name: 'Closed' } },
      update: {},
      create: {
        tenantId: tenant.id,
        pipelineId: supportPipeline.id,
        name: 'Closed',
        order: 5,
        color: '#6b7280',
        isClosed: true,
      },
    }),
  ]);
  console.log('  Created 2 pipelines with stages');

  // ==================== 7. DEALS ====================
  console.log('Creating deals...');
  const deals = await Promise.all([
    prisma.deal.upsert({
      where: { id: `deal-1-${tenant.id}` },
      update: {},
      create: {
        id: `deal-1-${tenant.id}`,
        tenantId: tenant.id,
        name: 'TechVision CRM Enterprise',
        description: 'Enterprise CRM implementation for TechVision',
        pipelineId: salesPipeline.id,
        stageId: salesStages[3].id, // Negotiation
        amount: 149997.0,
        currency: 'INR',
        expectedCloseDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
        contactId: contacts[0].id,
        companyId: companies[0].id,
        ownerId: salesUser.id,
      },
    }),
    prisma.deal.upsert({
      where: { id: `deal-2-${tenant.id}` },
      update: {},
      create: {
        id: `deal-2-${tenant.id}`,
        tenantId: tenant.id,
        name: 'Innovate Digital Pro License',
        description: 'Annual professional license renewal',
        pipelineId: salesPipeline.id,
        stageId: salesStages[4].id, // Closed Won
        amount: 29998.0,
        currency: 'INR',
        expectedCloseDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Closed last week
        closedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        wonReason: 'Great product fit and competitive pricing',
        contactId: contacts[2].id,
        companyId: companies[1].id,
        ownerId: adminUser.id,
      },
    }),
    prisma.deal.upsert({
      where: { id: `deal-3-${tenant.id}` },
      update: {},
      create: {
        id: `deal-3-${tenant.id}`,
        tenantId: tenant.id,
        name: 'StartupHub CRM Starter',
        description: 'Initial CRM setup for StartupHub',
        pipelineId: salesPipeline.id,
        stageId: salesStages[1].id, // Discovery
        amount: 14998.0,
        currency: 'INR',
        expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 1 month
        contactId: contacts[3].id,
        companyId: companies[2].id,
        ownerId: salesUser.id,
      },
    }),
    prisma.deal.upsert({
      where: { id: `deal-4-${tenant.id}` },
      update: {},
      create: {
        id: `deal-4-${tenant.id}`,
        tenantId: tenant.id,
        name: 'HealthFirst Enterprise + Implementation',
        description: 'Enterprise license with full implementation',
        pipelineId: salesPipeline.id,
        stageId: salesStages[2].id, // Proposal
        amount: 69998.0,
        currency: 'INR',
        expectedCloseDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 3 weeks
        contactId: contacts[4].id,
        companyId: companies[3].id,
        ownerId: adminUser.id,
      },
    }),
    prisma.deal.upsert({
      where: { id: `deal-5-${tenant.id}` },
      update: {},
      create: {
        id: `deal-5-${tenant.id}`,
        tenantId: tenant.id,
        name: 'Lost Deal - Budget Issues',
        description: 'Prospect went with cheaper alternative',
        pipelineId: salesPipeline.id,
        stageId: salesStages[5].id, // Closed Lost
        amount: 24999.0,
        currency: 'INR',
        expectedCloseDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        closedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        lostReason: 'Budget constraints - went with cheaper alternative',
        competitor: 'Zoho CRM',
        contactId: contacts[6].id,
        ownerId: salesUser.id,
      },
    }),
  ]);
  console.log(`  Created ${deals.length} deals`);

  // Link products to deals
  await prisma.dealProduct.createMany({
    data: [
      {
        dealId: deals[0].id,
        productId: products[0].id,
        quantity: 1,
        unitPrice: products[0].unitPrice,
        discount: 0,
      },
      {
        dealId: deals[0].id,
        productId: products[3].id,
        quantity: 2,
        unitPrice: products[3].unitPrice,
        discount: 0,
      },
      {
        dealId: deals[1].id,
        productId: products[1].id,
        quantity: 1,
        unitPrice: products[1].unitPrice,
        discount: 0,
      },
      {
        dealId: deals[1].id,
        productId: products[3].id,
        quantity: 1,
        unitPrice: products[3].unitPrice,
        discount: 0,
      },
      {
        dealId: deals[2].id,
        productId: products[2].id,
        quantity: 1,
        unitPrice: products[2].unitPrice,
        discount: 0,
      },
      {
        dealId: deals[2].id,
        productId: products[4].id,
        quantity: 1,
        unitPrice: products[4].unitPrice,
        discount: 500,
      },
      {
        dealId: deals[3].id,
        productId: products[0].id,
        quantity: 1,
        unitPrice: products[0].unitPrice,
        discount: 0,
      },
      {
        dealId: deals[3].id,
        productId: products[5].id,
        quantity: 1,
        unitPrice: products[5].unitPrice,
        discount: 0,
      },
    ],
    skipDuplicates: true,
  });
  console.log('  Linked products to deals');

  // ==================== 8. TICKETS ====================
  console.log('Creating support tickets...');
  const tickets = await Promise.all([
    prisma.ticket.upsert({
      where: { id: `ticket-1-${tenant.id}` },
      update: {},
      create: {
        id: `ticket-1-${tenant.id}`,
        tenantId: tenant.id,
        subject: 'Unable to sync WhatsApp messages',
        description:
          'WhatsApp integration shows connected but messages are not syncing to inbox. Tried reconnecting but issue persists.',
        pipelineId: supportPipeline.id,
        stageId: supportStages[1].id, // In Progress
        priority: 'HIGH',
        category: 'Integration',
        subcategory: 'WhatsApp',
        contactId: contacts[0].id,
        assignedToId: supportUser.id,
      },
    }),
    prisma.ticket.upsert({
      where: { id: `ticket-2-${tenant.id}` },
      update: {},
      create: {
        id: `ticket-2-${tenant.id}`,
        tenantId: tenant.id,
        subject: 'How to set up email templates?',
        description:
          'Need help understanding how to create and use email templates for marketing campaigns.',
        pipelineId: supportPipeline.id,
        stageId: supportStages[0].id, // New
        priority: 'LOW',
        category: 'How-to',
        subcategory: 'Email',
        contactId: contacts[2].id,
        assignedToId: supportUser.id,
      },
    }),
    prisma.ticket.upsert({
      where: { id: `ticket-3-${tenant.id}` },
      update: {},
      create: {
        id: `ticket-3-${tenant.id}`,
        tenantId: tenant.id,
        subject: 'Pipeline report not loading',
        description:
          'Dashboard pipeline reports showing loading spinner for over 5 minutes. Other pages work fine.',
        pipelineId: supportPipeline.id,
        stageId: supportStages[2].id, // Waiting on Customer
        priority: 'MEDIUM',
        category: 'Bug',
        subcategory: 'Reports',
        contactId: contacts[4].id,
        assignedToId: supportUser.id,
      },
    }),
    prisma.ticket.upsert({
      where: { id: `ticket-4-${tenant.id}` },
      update: {},
      create: {
        id: `ticket-4-${tenant.id}`,
        tenantId: tenant.id,
        subject: 'Request for custom field type',
        description:
          'We need a dropdown field type that allows multiple selections. Current dropdown only allows single selection.',
        pipelineId: supportPipeline.id,
        stageId: supportStages[3].id, // Resolved
        priority: 'LOW',
        category: 'Feature Request',
        contactId: contacts[0].id,
        assignedToId: supportUser.id,
        resolvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      },
    }),
    prisma.ticket.upsert({
      where: { id: `ticket-5-${tenant.id}` },
      update: {},
      create: {
        id: `ticket-5-${tenant.id}`,
        tenantId: tenant.id,
        subject: 'Billing invoice not received',
        description: 'Invoice for December 2025 was not received via email. Please resend.',
        pipelineId: supportPipeline.id,
        stageId: supportStages[4].id, // Closed
        priority: 'MEDIUM',
        category: 'Billing',
        contactId: contacts[2].id,
        assignedToId: supportUser.id,
        closedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        closeReason: 'Invoice resent successfully',
      },
    }),
  ]);
  console.log(`  Created ${tickets.length} tickets`);

  // ==================== 9. ACTIVITIES ====================
  console.log('Creating activities...');
  const activities = await Promise.all([
    // Recent calls
    prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: 'CALL',
        subject: 'Discovery call with Rajesh',
        description:
          'Discussed CRM requirements and current pain points. Interested in enterprise features.',
        contactId: contacts[0].id,
        companyId: companies[0].id,
        dealId: deals[0].id,
        callDuration: 45,
        callOutcome: 'CONNECTED',
        priority: 'HIGH',
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        assignedToId: salesUser.id,
        createdById: salesUser.id,
      },
    }),
    prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: 'CALL',
        subject: 'Follow-up call - Pricing discussion',
        description: 'Went through pricing options. Will send formal proposal by EOD.',
        contactId: contacts[0].id,
        companyId: companies[0].id,
        dealId: deals[0].id,
        callDuration: 30,
        callOutcome: 'CONNECTED',
        priority: 'HIGH',
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        assignedToId: salesUser.id,
        createdById: salesUser.id,
      },
    }),
    // Meetings
    prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: 'MEETING',
        subject: 'Product demo for HealthFirst team',
        description:
          'Full product demonstration for the IT and medical teams. Focus on HIPAA compliance features.',
        contactId: contacts[4].id,
        companyId: companies[3].id,
        dealId: deals[3].id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        meetingUrl: 'https://meet.google.com/abc-defg-hij',
        meetingLocation: 'Virtual',
        attendees: JSON.stringify([
          'meera.reddy@healthfirst.co.in',
          'arpit.sharma@helixcode.in',
          'priya.verma@helixcode.in',
        ]),
        priority: 'HIGH',
        assignedToId: adminUser.id,
        createdById: adminUser.id,
      },
    }),
    prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: 'MEETING',
        subject: 'Quarterly review with Innovate Digital',
        description: 'Discuss usage, gather feedback, and plan for next quarter.',
        contactId: contacts[2].id,
        companyId: companies[1].id,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        meetingLocation: 'Innovate Digital Office, Mumbai',
        priority: 'MEDIUM',
        assignedToId: adminUser.id,
        createdById: adminUser.id,
      },
    }),
    // Emails
    prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: 'EMAIL',
        subject: 'Proposal sent: TechVision Enterprise CRM',
        description:
          'Sent detailed proposal with pricing, implementation timeline, and case studies.',
        contactId: contacts[0].id,
        companyId: companies[0].id,
        dealId: deals[0].id,
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        assignedToId: salesUser.id,
        createdById: salesUser.id,
      },
    }),
    prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: 'EMAIL',
        subject: 'Welcome email to Vikram',
        description: 'Initial outreach with product overview and link to schedule a demo.',
        contactId: contacts[3].id,
        companyId: companies[2].id,
        dealId: deals[2].id,
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        assignedToId: salesUser.id,
        createdById: salesUser.id,
      },
    }),
    // Tasks
    prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: 'TASK',
        subject: 'Prepare contract for TechVision',
        description: 'Draft enterprise contract with custom SLA terms as discussed.',
        contactId: contacts[0].id,
        companyId: companies[0].id,
        dealId: deals[0].id,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        priority: 'HIGH',
        assignedToId: salesUser.id,
        createdById: adminUser.id,
      },
    }),
    prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: 'TASK',
        subject: 'Send case study to StartupHub',
        description: 'Share fintech case study showing how similar companies use our CRM.',
        contactId: contacts[3].id,
        dealId: deals[2].id,
        dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        priority: 'MEDIUM',
        assignedToId: salesUser.id,
        createdById: salesUser.id,
      },
    }),
    // Notes
    prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: 'NOTE',
        subject: 'Key decision criteria',
        description:
          'TechVision priorities: 1) WhatsApp integration, 2) Custom reporting, 3) API access. Budget approved up to 2L annually.',
        contactId: contacts[0].id,
        companyId: companies[0].id,
        dealId: deals[0].id,
        completedAt: new Date(),
        createdById: salesUser.id,
      },
    }),
    prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: 'NOTE',
        subject: 'Competitor research',
        description:
          'StartupHub currently using spreadsheets. Evaluated Zoho (too complex) and Freshsales (lacks automation).',
        contactId: contacts[3].id,
        companyId: companies[2].id,
        completedAt: new Date(),
        createdById: salesUser.id,
      },
    }),
    // Ticket-related activities
    prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: 'CALL',
        subject: 'Support call - WhatsApp sync issue',
        description: 'Walked customer through reconnection steps. Issue may be on MSG91 side.',
        contactId: contacts[0].id,
        ticketId: tickets[0].id,
        callDuration: 20,
        callOutcome: 'CONNECTED',
        completedAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        assignedToId: supportUser.id,
        createdById: supportUser.id,
      },
    }),
    prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: 'NOTE',
        subject: 'Escalated to engineering',
        description: 'Created internal ticket #ENG-456 for MSG91 webhook investigation.',
        contactId: contacts[0].id,
        ticketId: tickets[0].id,
        completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        createdById: supportUser.id,
      },
    }),
  ]);
  console.log(`  Created ${activities.length} activities`);

  // ==================== 10. LEADS ====================
  console.log('Creating leads...');
  const leads = await Promise.all([
    prisma.lead.upsert({
      where: { id: `lead-1-${tenant.id}` },
      update: {},
      create: {
        id: `lead-1-${tenant.id}`,
        tenantId: tenant.id,
        firstName: 'Suresh',
        lastName: 'Nair',
        email: 'suresh.nair@futuretech.io',
        phone: '+91 9876543101',
        company: 'FutureTech Solutions',
        jobTitle: 'VP of Sales',
        industry: 'Technology',
        source: 'Website Form',
        status: 'NEW',
        rating: 'WARM',
        priority: 'MEDIUM',
        annualRevenue: 50000000,
        numberOfEmployees: 150,
        owner: { connect: { id: salesUser.id } },
      },
    }),
    prisma.lead.upsert({
      where: { id: `lead-2-${tenant.id}` },
      update: {},
      create: {
        id: `lead-2-${tenant.id}`,
        tenantId: tenant.id,
        firstName: 'Deepa',
        lastName: 'Menon',
        email: 'deepa@retailplus.com',
        phone: '+91 9876543102',
        company: 'RetailPlus India',
        jobTitle: 'Head of Operations',
        industry: 'Retail',
        source: 'Trade Show',
        status: 'CONTACTED',
        rating: 'HOT',
        priority: 'HIGH',
        annualRevenue: 100000000,
        numberOfEmployees: 500,
        owner: { connect: { id: salesUser.id } },
      },
    }),
    prisma.lead.upsert({
      where: { id: `lead-3-${tenant.id}` },
      update: {},
      create: {
        id: `lead-3-${tenant.id}`,
        tenantId: tenant.id,
        firstName: 'Arun',
        lastName: 'Pillai',
        email: 'arun.pillai@financeworld.in',
        phone: '+91 9876543103',
        company: 'FinanceWorld Advisors',
        jobTitle: 'CEO',
        industry: 'Financial Services',
        source: 'LinkedIn',
        status: 'QUALIFIED',
        rating: 'HOT',
        priority: 'HIGH',
        annualRevenue: 25000000,
        numberOfEmployees: 50,
        owner: { connect: { id: salesUser.id } },
        convertedToContact: { connect: { id: contacts[7].id } },
      },
    }),
  ]);
  console.log(`  Created ${leads.length} leads`);

  // ==================== 11. TEAMS ====================
  console.log('Creating teams...');
  const salesTeam = await prisma.team.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Sales Team' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Sales Team',
      description: 'Primary sales team handling all inbound and outbound leads',
    },
  });

  const supportTeam = await prisma.team.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Customer Support' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Customer Support',
      description: 'Technical support and customer success team',
    },
  });

  // Add team members
  await prisma.teamMember.createMany({
    data: [
      { teamId: salesTeam.id, userId: adminUser.id, role: 'LEADER' },
      { teamId: salesTeam.id, userId: salesUser.id, role: 'MEMBER' },
      { teamId: supportTeam.id, userId: supportUser.id, role: 'LEADER' },
      { teamId: supportTeam.id, userId: adminUser.id, role: 'MEMBER' },
    ],
    skipDuplicates: true,
  });
  console.log('  Created 2 teams with members');

  // ==================== 12. CALENDAR EVENTS ====================
  console.log('Creating calendar events...');
  await Promise.all([
    prisma.calendarEvent.create({
      data: {
        tenantId: tenant.id,
        organizerId: adminUser.id,
        title: 'Weekly Sales Standup',
        description: 'Review pipeline, discuss blockers, plan for the week',
        type: 'MEETING',
        startTime: getNextWeekday(1, 10, 0), // Next Monday 10 AM
        endTime: getNextWeekday(1, 10, 30),
        timezone: 'Asia/Kolkata',
        isRecurring: true,
        recurrence: JSON.stringify({ frequency: 'WEEKLY', interval: 1, byDay: ['MO'] }),
        status: 'SCHEDULED',
        attendees: ['priya.verma@helixcode.in', 'arpit.sharma@helixcode.in'],
      },
    }),
    prisma.calendarEvent.create({
      data: {
        tenantId: tenant.id,
        organizerId: salesUser.id,
        title: 'Demo: TechVision Solutions',
        description: 'Product demo for CTO and team',
        type: 'MEETING',
        startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000), // 3 days, 11 AM
        endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000),
        timezone: 'Asia/Kolkata',
        meetingUrl: 'https://meet.google.com/xyz-demo-123',
        status: 'SCHEDULED',
        attendees: ['rajesh.sharma@techvision.io'],
      },
    }),
    prisma.calendarEvent.create({
      data: {
        tenantId: tenant.id,
        organizerId: supportUser.id,
        title: 'Support Team Training',
        description: 'New feature training for the support team',
        type: 'MEETING',
        startTime: getNextWeekday(3, 14, 0), // Next Wednesday 2 PM
        endTime: getNextWeekday(3, 15, 0),
        timezone: 'Asia/Kolkata',
        status: 'SCHEDULED',
        attendees: ['rahul.kumar@helixcode.in', 'arpit.sharma@helixcode.in'],
      },
    }),
  ]);
  console.log('  Created 3 calendar events');

  // ==================== 13. CANNED RESPONSES ====================
  console.log('Creating canned responses...');
  const supportCategory = await prisma.cannedResponseCategory.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Support' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Support', icon: '🎧', color: 'blue' },
  });

  const salesCategory = await prisma.cannedResponseCategory.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Sales' } },
    update: {},
    create: { tenantId: tenant.id, name: 'Sales', icon: '💼', color: 'green' },
  });

  await prisma.cannedResponse.createMany({
    data: [
      {
        tenantId: tenant.id,
        categoryId: supportCategory.id,
        title: 'Greeting',
        shortcut: '/greet',
        content: 'Hi {{contact.firstName}}! Thank you for reaching out. How can I help you today?',
        visibility: 'TEAM',
        createdById: supportUser.id,
      },
      {
        tenantId: tenant.id,
        categoryId: supportCategory.id,
        title: 'Ticket Received',
        shortcut: '/received',
        content:
          "Thank you for your message. I've created a support ticket for this issue. Our team will review it and get back to you within 24 hours.",
        visibility: 'TEAM',
        createdById: supportUser.id,
      },
      {
        tenantId: tenant.id,
        categoryId: salesCategory.id,
        title: 'Demo Request',
        shortcut: '/demo',
        content:
          "Thanks for your interest in Nexora! I'd love to show you how our platform can help your business. Would you have 30 minutes this week for a quick demo?",
        visibility: 'TEAM',
        createdById: salesUser.id,
      },
      {
        tenantId: tenant.id,
        categoryId: salesCategory.id,
        title: 'Pricing Info',
        shortcut: '/pricing',
        content:
          'Great question! Our pricing starts at ₹9,999/year for small teams and goes up to ₹49,999/year for enterprise. I can send you a detailed comparison - would that help?',
        visibility: 'TEAM',
        createdById: salesUser.id,
      },
    ],
    skipDuplicates: true,
  });
  console.log('  Created canned responses');

  console.log('\n========================================');
  console.log('FULL SEED COMPLETE');
  console.log('========================================');
  console.log('');
  console.log('Data Created:');
  console.log('  • 4 Users (Admin, Sales, Support, Marketing)');
  console.log('  • 4 Companies');
  console.log('  • 8 Contacts (with tags and relationships)');
  console.log('  • 6 Products');
  console.log('  • 2 Pipelines (Sales + Support) with stages');
  console.log('  • 5 Deals (various stages, with products)');
  console.log('  • 5 Tickets');
  console.log('  • 12 Activities (calls, meetings, emails, tasks, notes)');
  console.log('  • 3 Leads');
  console.log('  • 2 Teams with members');
  console.log('  • 3 Calendar events');
  console.log('  • 4 Canned responses');
  console.log('');
  console.log('Login: arpit.sharma@helixcode.in / demo123456');
  console.log('========================================\n');
}

// Helper function to get next weekday
function getNextWeekday(dayOfWeek, hour, minute) {
  const now = new Date();
  const result = new Date(now);
  result.setHours(hour, minute, 0, 0);

  const currentDay = now.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) daysUntil += 7;

  result.setDate(result.getDate() + daysUntil);
  return result;
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
