/**
 * DEMO TENANT SEEDER
 * Creates 4 realistic industry tenants with full cross-module data for super admin panel testing.
 *
 * Run: node packages/database/prisma/seed-demo-tenants.js
 *
 * Tenants:
 *  1. ZenShop India       - E-commerce (fashion/lifestyle)  - Growth plan
 *  2. Vortex SaaS         - B2B SaaS (software sales)       - Professional plan
 *  3. MedCore Health      - Healthcare clinic/services       - Starter plan
 *  4. BuildPro Construction - Construction/manufacturing     - Growth plan
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ==================== HELPERS ====================

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ==================== TENANT CONFIGS ====================

const TENANT_CONFIGS = [
  {
    name: 'ZenShop India',
    slug: 'zenshop-india',
    domain: 'zenshopindia.com',
    email: 'admin@zenshopindia.com',
    industry: 'E-Commerce',
    phone: '+91 9811223344',
    timezone: 'Asia/Kolkata',
    plan: 'growth',
    walletBalance: '28500.00',
    primaryColor: '#f59e0b',
    teamDomain: 'zenshopindia.com',
    companies: [
      { name: 'Myntra Logistics', industry: 'Retail', employeeCount: 5000, domain: 'myntra.com' },
      {
        name: 'Nykaa Fashion',
        industry: 'Beauty & Fashion',
        employeeCount: 3000,
        domain: 'nykaa.com',
      },
      {
        name: 'Mamaearth Wholesale',
        industry: 'Personal Care',
        employeeCount: 800,
        domain: 'mamaearth.in',
      },
      { name: 'Bewakoof Brands', industry: 'Fashion', employeeCount: 200, domain: 'bewakoof.com' },
      {
        name: 'FabIndia Retail',
        industry: 'Lifestyle',
        employeeCount: 1500,
        domain: 'fabindia.com',
      },
      {
        name: 'The Souled Store',
        industry: 'Fashion',
        employeeCount: 150,
        domain: 'thesouledstore.com',
      },
    ],
    products: [
      {
        name: 'Premium Cotton T-Shirt Bundle (50 units)',
        unitPrice: '4500.00',
        gstRate: '12.00',
        hsnCode: '6109',
      },
      {
        name: 'Designer Ethnic Kurta Set (30 units)',
        unitPrice: '9800.00',
        gstRate: '12.00',
        hsnCode: '6211',
      },
      {
        name: 'Sports Shoes Inventory (100 pairs)',
        unitPrice: '18500.00',
        gstRate: '18.00',
        hsnCode: '6404',
      },
      {
        name: 'Handbag Collection (25 pieces)',
        unitPrice: '12000.00',
        gstRate: '18.00',
        hsnCode: '4202',
      },
      {
        name: 'Ethnic Jewellery Set (50 pieces)',
        unitPrice: '7500.00',
        gstRate: '3.00',
        hsnCode: '7113',
      },
      {
        name: 'Skincare Gift Bundle (200 sets)',
        unitPrice: '3200.00',
        gstRate: '18.00',
        hsnCode: '3304',
      },
    ],
    pipelineName: 'Retail Sales Pipeline',
    stages: ['New Inquiry', 'Catalogued', 'Sample Sent', 'PO Raised', 'Fulfilled', 'Repeat Order'],
    dealNames: [
      { name: 'Myntra Q1 Bulk Order', amount: '285000' },
      { name: 'Nykaa Fashion Week Collection', amount: '192000' },
      { name: 'FabIndia Annual Contract', amount: '450000' },
      { name: 'Bewakoof Summer Drop', amount: '125000' },
      { name: 'Mamaearth Skincare Bundle Deal', amount: '78000' },
      { name: 'Souled Store T-Shirt Reorder', amount: '42000' },
      { name: 'Ethnic Jewellery Festive Deal', amount: '95000' },
      { name: 'Sports Shoes Diwali Stock', amount: '320000' },
    ],
    hrDepts: ['Operations', 'Logistics', 'Sales', 'Marketing', 'Finance'],
    projectNames: ['Festive Season Campaign 2025', 'Warehouse Expansion Phase 2', 'D2C App Launch'],
  },
  {
    name: 'Vortex SaaS',
    slug: 'vortex-saas',
    domain: 'vortexsaas.io',
    email: 'hello@vortexsaas.io',
    industry: 'Technology',
    phone: '+91 9922334455',
    timezone: 'Asia/Kolkata',
    plan: 'professional',
    walletBalance: '92000.00',
    primaryColor: '#6366f1',
    teamDomain: 'vortexsaas.io',
    companies: [
      { name: 'Infosys BPM', industry: 'IT Services', employeeCount: 50000, domain: 'infosys.com' },
      { name: 'Zoho Corp', industry: 'SaaS', employeeCount: 12000, domain: 'zoho.com' },
      { name: 'Freshworks India', industry: 'SaaS', employeeCount: 5000, domain: 'freshworks.com' },
      {
        name: 'Chargebee Technologies',
        industry: 'FinTech SaaS',
        employeeCount: 1200,
        domain: 'chargebee.com',
      },
      {
        name: 'Razorpay Software',
        industry: 'Payments',
        employeeCount: 3000,
        domain: 'razorpay.com',
      },
      { name: 'GreytHR Solutions', industry: 'HR SaaS', employeeCount: 400, domain: 'greythr.com' },
      {
        name: 'Leadsquared CRM',
        industry: 'CRM SaaS',
        employeeCount: 800,
        domain: 'leadsquared.com',
      },
    ],
    products: [
      {
        name: 'Vortex Core - Starter License (Annual)',
        unitPrice: '18000.00',
        gstRate: '18.00',
        hsnCode: '998315',
      },
      {
        name: 'Vortex Core - Growth License (Annual)',
        unitPrice: '48000.00',
        gstRate: '18.00',
        hsnCode: '998315',
      },
      {
        name: 'Vortex Enterprise License (Annual)',
        unitPrice: '180000.00',
        gstRate: '18.00',
        hsnCode: '998315',
      },
      {
        name: 'Onboarding & Implementation Service',
        unitPrice: '25000.00',
        gstRate: '18.00',
        hsnCode: '998316',
      },
      {
        name: 'API Addon Pack (10M calls/month)',
        unitPrice: '9600.00',
        gstRate: '18.00',
        hsnCode: '998314',
      },
      {
        name: 'Dedicated Success Manager (Annual)',
        unitPrice: '60000.00',
        gstRate: '18.00',
        hsnCode: '998316',
      },
    ],
    pipelineName: 'SaaS Sales Pipeline',
    stages: ['Lead In', 'Demo Scheduled', 'Proposal Sent', 'Legal Review', 'Closed Won', 'Churned'],
    dealNames: [
      { name: 'Infosys BPM Enterprise Deal', amount: '1800000' },
      { name: 'Freshworks Integration Partnership', amount: '480000' },
      { name: 'Chargebee Growth Plan Upsell', amount: '96000' },
      { name: 'GreytHR API Pack Q2', amount: '57600' },
      { name: 'Leadsquared Migration Project', amount: '225000' },
      { name: 'Zoho Corp Annual Renewal', amount: '360000' },
      { name: 'Razorpay Success Manager', amount: '120000' },
      { name: 'New Enterprise Onboarding', amount: '540000' },
      { name: 'Mid-market Starter Bundle', amount: '72000' },
    ],
    hrDepts: ['Engineering', 'Product', 'Sales', 'Customer Success', 'Marketing', 'Finance'],
    projectNames: ['Q2 Product Roadmap', 'Enterprise Integration v3', 'Customer Portal Redesign'],
  },
  {
    name: 'MedCore Health',
    slug: 'medcore-health',
    domain: 'medcorehealth.in',
    email: 'admin@medcorehealth.in',
    industry: 'Healthcare',
    phone: '+91 9733445566',
    timezone: 'Asia/Kolkata',
    plan: 'starter',
    walletBalance: '8500.00',
    primaryColor: '#10b981',
    teamDomain: 'medcorehealth.in',
    companies: [
      {
        name: 'Apollo Hospitals Group',
        industry: 'Healthcare',
        employeeCount: 75000,
        domain: 'apollohospitals.com',
      },
      {
        name: 'Fortis Healthcare',
        industry: 'Healthcare',
        employeeCount: 28000,
        domain: 'fortishealthcare.com',
      },
      {
        name: 'MedPlus Pharmacies',
        industry: 'Pharmacy Retail',
        employeeCount: 12000,
        domain: 'medplusmart.com',
      },
      {
        name: 'Practo Technologies',
        industry: 'HealthTech',
        employeeCount: 2500,
        domain: 'practo.com',
      },
    ],
    products: [
      {
        name: 'General Physician Consultation',
        unitPrice: '500.00',
        gstRate: '0.00',
        hsnCode: '999312',
      },
      {
        name: 'Specialist Consultation Package',
        unitPrice: '1500.00',
        gstRate: '0.00',
        hsnCode: '999312',
      },
      {
        name: 'Annual Health Checkup Package',
        unitPrice: '3500.00',
        gstRate: '0.00',
        hsnCode: '999312',
      },
      {
        name: 'Physiotherapy Session (10 sessions)',
        unitPrice: '4800.00',
        gstRate: '0.00',
        hsnCode: '999312',
      },
      { name: 'Lab Test Bundle (Basic)', unitPrice: '1200.00', gstRate: '0.00', hsnCode: '999315' },
    ],
    pipelineName: 'Patient Acquisition Pipeline',
    stages: [
      'Enquiry',
      'Consultation Booked',
      'Under Treatment',
      'Follow-up',
      'Converted',
      'Discharged',
    ],
    dealNames: [
      { name: 'Apollo Corporate Health Packages', amount: '1200000' },
      { name: 'Fortis Annual Wellness Contract', amount: '850000' },
      { name: 'MedPlus Diagnostics Partnership', amount: '320000' },
      { name: 'Practo Corporate Tie-up', amount: '180000' },
      { name: 'Employee Wellness Q3', amount: '95000' },
    ],
    hrDepts: ['Medical', 'Nursing', 'Administration', 'Lab', 'Reception'],
    projectNames: ['Patient App Development', 'Clinic Expansion Phase 1'],
  },
  {
    name: 'BuildPro Construction',
    slug: 'buildpro-construction',
    domain: 'buildproconstruction.co.in',
    email: 'info@buildproconstruction.co.in',
    industry: 'Construction',
    phone: '+91 9644556677',
    timezone: 'Asia/Kolkata',
    plan: 'growth',
    walletBalance: '42000.00',
    primaryColor: '#f97316',
    teamDomain: 'buildpro.co.in',
    companies: [
      {
        name: 'L&T Construction',
        industry: 'Construction',
        employeeCount: 150000,
        domain: 'larsentoubro.com',
      },
      {
        name: 'Shapoorji Pallonji Group',
        industry: 'Real Estate',
        employeeCount: 70000,
        domain: 'shapoorjipallonji.com',
      },
      { name: 'DLF Limited', industry: 'Real Estate', employeeCount: 15000, domain: 'dlf.in' },
      {
        name: 'Prestige Estates',
        industry: 'Real Estate',
        employeeCount: 5000,
        domain: 'prestigeconstructions.com',
      },
      {
        name: 'Godrej Properties',
        industry: 'Real Estate',
        employeeCount: 3500,
        domain: 'godrejproperties.com',
      },
    ],
    products: [
      {
        name: 'Structural Steel Supply (per MT)',
        unitPrice: '65000.00',
        gstRate: '18.00',
        hsnCode: '7308',
      },
      {
        name: 'Ready Mix Concrete (per m³)',
        unitPrice: '5500.00',
        gstRate: '28.00',
        hsnCode: '3824',
      },
      {
        name: 'Project Management Consulting (Monthly)',
        unitPrice: '150000.00',
        gstRate: '18.00',
        hsnCode: '998311',
      },
      { name: 'Safety Equipment Bundle', unitPrice: '28000.00', gstRate: '18.00', hsnCode: '9506' },
      {
        name: 'MEP Engineering Services (Fixed)',
        unitPrice: '350000.00',
        gstRate: '18.00',
        hsnCode: '998314',
      },
      {
        name: 'Construction Machinery Rental (Monthly)',
        unitPrice: '85000.00',
        gstRate: '18.00',
        hsnCode: '998730',
      },
    ],
    pipelineName: 'Project Sales Pipeline',
    stages: [
      'Site Visit',
      'Estimation',
      'Proposal Submitted',
      'Negotiation',
      'Contract Signed',
      'In Progress',
    ],
    dealNames: [
      { name: 'L&T Commercial Tower Phase 2', amount: '45000000' },
      { name: 'DLF Residential Complex Steel Supply', amount: '8500000' },
      { name: 'Prestige Concrete Supply Annual', amount: '3200000' },
      { name: 'Godrej MEP Engineering Contract', amount: '1750000' },
      { name: 'Shapoorji Safety Equipment Q2', amount: '560000' },
      { name: 'PMC Contract - Residential Project', amount: '3600000' },
      { name: 'Machinery Rental - 12 month deal', amount: '1020000' },
    ],
    hrDepts: ['Engineering', 'Site Operations', 'Procurement', 'Finance', 'Safety & Compliance'],
    projectNames: [
      'L&T Tower Phase 2 Execution',
      'DLF Complex Delivery',
      'Internal ERP Implementation',
    ],
  },
];

// ==================== USERS PER INDUSTRY ====================

function getUsersForTenant(config) {
  const d = config.teamDomain;
  const slug = config.slug.replace(/-/g, '');
  return [
    {
      email: `admin@${d}`,
      firstName: 'Rajesh',
      lastName: 'Kumar',
      role: 'Admin',
      jobTitle: 'CEO & Founder',
    },
    {
      email: `sales1@${d}`,
      firstName: 'Priya',
      lastName: 'Sharma',
      role: 'Sales Representative',
      jobTitle: 'Senior Sales Manager',
    },
    {
      email: `sales2@${d}`,
      firstName: 'Arjun',
      lastName: 'Mehta',
      role: 'Sales Representative',
      jobTitle: 'Account Executive',
    },
    {
      email: `support@${d}`,
      firstName: 'Sneha',
      lastName: 'Patel',
      role: 'Support Agent',
      jobTitle: 'Customer Success Manager',
    },
    {
      email: `marketing@${d}`,
      firstName: 'Vikram',
      lastName: 'Singh',
      role: 'Marketing Manager',
      jobTitle: 'Head of Marketing',
    },
    {
      email: `hr@${d}`,
      firstName: 'Anita',
      lastName: 'Joshi',
      role: 'Admin',
      jobTitle: 'HR Manager',
    },
    {
      email: `finance@${d}`,
      firstName: 'Sanjay',
      lastName: 'Gupta',
      role: 'Admin',
      jobTitle: 'Finance Controller',
    },
  ];
}

// ==================== MAIN SEED FUNCTIONS ====================

async function getPlans() {
  const plans = await prisma.plan.findMany({
    where: { name: { in: ['starter', 'growth', 'professional'] } },
  });

  const planMap = {};
  for (const p of plans) planMap[p.name] = p;

  if (!planMap.starter || !planMap.growth || !planMap.professional) {
    console.warn('\n⚠️  WARNING: Subscription plans not found in DB.');
    console.warn('   Run: node packages/database/prisma/seed-plans.js first');
    console.warn('   Continuing without subscriptions...\n');
  }

  return planMap;
}

async function seedTenant(config, plans) {
  console.log(`\n🏢 Seeding: ${config.name} (${config.plan})`);
  console.log('─'.repeat(50));

  // ── Tenant ──
  const tenant = await prisma.tenant.upsert({
    where: { slug: config.slug },
    update: {},
    create: {
      name: config.name,
      slug: config.slug,
      domain: config.domain,
      email: config.email,
      phone: config.phone,
      timezone: config.timezone,
      currency: 'INR',
      industry: config.industry,
      status: 'ACTIVE',
      settings: {
        branding: { primaryColor: config.primaryColor },
        features: { whatsapp: true, email: true, sms: true },
      },
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name}`);

  // ── Workspace ──
  let workspace = await prisma.workspace.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
  });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        tenantId: tenant.id,
        name: `${config.name} HQ`,
        isDefault: true,
        status: 'ACTIVE',
      },
    });
  }
  console.log(`  ✓ Workspace: ${workspace.name}`);

  // ── Wallet ──
  const existingWallet = await prisma.wallets.findUnique({ where: { tenantId: tenant.id } });
  if (!existingWallet) {
    await prisma.wallets.create({
      data: {
        tenantId: tenant.id,
        balance: config.walletBalance,
        currency: 'INR',
      },
    });
  }
  console.log(`  ✓ Wallet: ₹${config.walletBalance}`);

  // ── Subscription ──
  const plan = plans[config.plan];
  if (plan) {
    const existingSub = await prisma.subscription.findFirst({ where: { tenantId: tenant.id } });
    if (!existingSub) {
      await prisma.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: plan.id,
          status: 'ACTIVE',
          billingCycle: 'YEARLY',
          startDate: daysAgo(90),
          seats: getUsersForTenant(config).length,
        },
      });
    }
    console.log(`  ✓ Subscription: ${plan.displayName} (ACTIVE)`);
  }

  // ── Email Credit Balance ──
  const existingCredits = await prisma.emailCreditBalance.findUnique({
    where: { tenantId: tenant.id },
  });
  if (!existingCredits) {
    await prisma.emailCreditBalance.create({
      data: {
        tenantId: tenant.id,
        totalCredits:
          plan?.name === 'professional' ? 50000 : plan?.name === 'growth' ? 20000 : 5000,
        usedCredits: randInt(100, 3000),
        freeQuota: 500,
        freeUsedThisMonth: randInt(50, 500),
      },
    });
  }
  console.log(`  ✓ Email credits`);

  // ── Users & Roles ──
  const passwordHash = await bcrypt.hash('Demo@2025', 10);
  const userDefs = getUsersForTenant(config);
  const userMap = {};

  for (const def of userDefs) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: def.email } },
      update: {},
      create: {
        tenantId: tenant.id,
        email: def.email,
        firstName: def.firstName,
        lastName: def.lastName,
        displayName: `${def.firstName} ${def.lastName}`,
        passwordHash,
        emailVerified: true,
        status: 'ACTIVE',
      },
    });

    await prisma.userWorkspace.upsert({
      where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
      update: {},
      create: { userId: user.id, workspaceId: workspace.id },
    });

    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: def.role } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: def.role,
        description: `${def.role} role`,
        isSystem: def.role === 'Admin',
      },
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    userMap[def.role] = userMap[def.role] || user;
    userMap[def.email] = user;
  }

  const adminUser = userMap['Admin'];
  const salesUser = userMap['Sales Representative'];
  console.log(`  ✓ Users: ${userDefs.length} created with roles`);

  // ── Tags ──
  const tagNames = ['VIP', 'Hot Lead', 'Enterprise', 'Renewal', 'High Value'];
  const tagMap = {};
  for (const tagName of tagNames) {
    const tag = await prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: tagName } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: tagName,
        color: pick(['#ef4444', '#f59e0b', '#10b981', '#6366f1', '#3b82f6']),
      },
    });
    tagMap[tagName] = tag;
  }

  // ── Companies ──
  const companyMap = {};
  for (const co of config.companies) {
    let company = await prisma.company.findFirst({
      where: { tenantId: tenant.id, name: co.name },
    });
    if (!company) {
      company = await prisma.company.create({
        data: {
          tenantId: tenant.id,
          name: co.name,
          domain: co.domain,
          industry: co.industry,
          employeeCount: String(co.employeeCount),
          lifecycleStage: pick(['CUSTOMER', 'OPPORTUNITY', 'LEAD', 'QUALIFIED']),
          companyType: pick(['CUSTOMER', 'PROSPECT', 'PARTNER']),
          ownerId: adminUser.id,
          websiteUrl: `https://www.${co.domain}`,
        },
      });
    }
    companyMap[co.name] = company;
  }
  console.log(`  ✓ Companies: ${config.companies.length}`);

  // ── Contacts (3 per company) ──
  const FIRST_NAMES = [
    'Amit',
    'Priya',
    'Rahul',
    'Sunita',
    'Vikram',
    'Deepa',
    'Rohit',
    'Kavita',
    'Manoj',
    'Rekha',
    'Arun',
    'Meena',
  ];
  const LAST_NAMES = [
    'Sharma',
    'Patel',
    'Gupta',
    'Singh',
    'Kumar',
    'Verma',
    'Agarwal',
    'Joshi',
    'Mehta',
    'Shah',
    'Nair',
    'Reddy',
  ];
  const TITLES = [
    'Director',
    'VP of Sales',
    'Procurement Head',
    'CFO',
    'CTO',
    'Operations Manager',
    'Founder',
    'MD',
    'GM',
  ];

  const allContacts = [];
  let contactIdx = 0;
  for (const co of config.companies) {
    const company = companyMap[co.name];
    const count = co === config.companies[0] ? 4 : 2; // 4 for first company, 2 for rest
    for (let i = 0; i < count; i++) {
      const fn = FIRST_NAMES[(contactIdx * 3 + i) % FIRST_NAMES.length];
      const ln = LAST_NAMES[(contactIdx + i) % LAST_NAMES.length];
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}@${co.domain}`;

      try {
        let contact = await prisma.contact.findFirst({
          where: { tenantId: tenant.id, email },
        });
        if (!contact) {
          contact = await prisma.contact.create({
            data: {
              tenantId: tenant.id,
              firstName: fn,
              lastName: ln,
              displayName: `${fn} ${ln}`,
              email,
              phone: `+91 9${randInt(100000000, 999999999)}`,
              jobTitle: pick(TITLES),
              companyId: company.id,
              ownerId: i % 2 === 0 ? adminUser.id : salesUser?.id || adminUser.id,
              createdById: adminUser.id,
              lifecycleStage: pick(['CUSTOMER', 'OPPORTUNITY', 'LEAD', 'SQL', 'MQL']),
              leadScore: randInt(40, 98),
              rating: pick(['HOT', 'WARM', 'COLD']),
              priority: pick(['HIGH', 'MEDIUM', 'LOW']),
              source: pick(['MANUAL', 'REFERRAL', 'WEBSITE', 'EMAIL']),
              status: 'ACTIVE',
              emailConsent: true,
              marketingConsent: true,
              lastActivityAt: daysAgo(randInt(1, 30)),
            },
          });
        }
        allContacts.push(contact);

        // Tag some contacts
        if (randInt(0, 1) === 1) {
          const tag = pick(Object.values(tagMap));
          await prisma.contactTag.upsert({
            where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
            update: {},
            create: { contactId: contact.id, tagId: tag.id },
          });
        }
      } catch (_) {
        /* skip duplicate */
      }
    }
    contactIdx++;
  }
  console.log(`  ✓ Contacts: ${allContacts.length}`);

  // ── Products ──
  const productMap = {};
  for (const p of config.products) {
    const sku = `${config.slug.toUpperCase().replace(/-/g, '')}-${p.hsnCode}-${randInt(100, 999)}`;
    let product = await prisma.product.findFirst({
      where: { tenantId: tenant.id, name: p.name },
    });
    if (!product) {
      product = await prisma.product.create({
        data: {
          tenantId: tenant.id,
          name: p.name,
          sku,
          unitPrice: p.unitPrice,
          currency: 'INR',
          gstRate: p.gstRate,
          hsnCode: p.hsnCode,
          productType: 'GOODS',
          isActive: true,
        },
      });
    }
    productMap[p.name] = product;
  }
  console.log(`  ✓ Products: ${config.products.length}`);

  // ── Pipeline & Stages ──
  let pipeline = await prisma.pipeline.findFirst({
    where: { tenantId: tenant.id, name: config.pipelineName },
  });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: config.pipelineName,
        type: 'DEAL',
        isDefault: true,
      },
    });
  }

  const stageMap = {};
  for (let i = 0; i < config.stages.length; i++) {
    let stage = await prisma.stage.findFirst({
      where: { tenantId: tenant.id, pipelineId: pipeline.id, name: config.stages[i] },
    });
    if (!stage) {
      const isLast = i === config.stages.length - 1;
      const isWon =
        config.stages[i].toLowerCase().includes('won') ||
        config.stages[i].toLowerCase().includes('fulfilled') ||
        config.stages[i].toLowerCase().includes('converted') ||
        config.stages[i].toLowerCase().includes('signed');
      const isLost =
        config.stages[i].toLowerCase().includes('churn') ||
        config.stages[i].toLowerCase().includes('discharged');

      stage = await prisma.stage.create({
        data: {
          tenantId: tenant.id,
          pipelineId: pipeline.id,
          name: config.stages[i],
          order: i + 1,
          probability: isWon ? 100 : isLost ? 0 : Math.round(((i + 1) / config.stages.length) * 90),
          isWon,
          isLost,
          color: pick(['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6']),
        },
      });
    }
    stageMap[config.stages[i]] = stage;
  }
  console.log(`  ✓ Pipeline: "${config.pipelineName}" with ${config.stages.length} stages`);

  // ── Deals ──
  const allDeals = [];
  const products = Object.values(productMap);
  for (let i = 0; i < config.dealNames.length; i++) {
    const d = config.dealNames[i];
    const stageIdx = i < config.stages.length ? i : randInt(0, config.stages.length - 1);
    const stageName = config.stages[stageIdx];
    const stage = stageMap[stageName];
    const contact = allContacts[i % allContacts.length] || null;
    const companyName = config.companies[i % config.companies.length].name;
    const company = companyMap[companyName];

    const isWon = stage?.isWon;
    const isLost = stage?.isLost;

    try {
      const deal = await prisma.deal.create({
        data: {
          tenantId: tenant.id,
          name: d.name,
          pipelineId: pipeline.id,
          stageId: stage.id,
          amount: d.amount,
          currency: 'INR',
          contactId: contact?.id || null,
          companyId: company?.id || null,
          ownerId: i % 2 === 0 ? adminUser.id : salesUser?.id || adminUser.id,
          expectedCloseDate:
            isWon || isLost ? daysAgo(randInt(5, 60)) : daysFromNow(randInt(15, 90)),
          closedAt: isWon || isLost ? daysAgo(randInt(1, 30)) : null,
          wonReason: isWon
            ? pick(['Best pricing', 'Strong relationship', 'Feature superiority', 'Timeline fit'])
            : null,
          lostReason: isLost
            ? pick([
                'Budget constraints',
                'Went with competitor',
                'Project cancelled',
                'No decision',
              ])
            : null,
        },
      });
      allDeals.push(deal);

      // Add 1-2 products to deal
      if (products.length > 0) {
        const prod = products[i % products.length];
        await prisma.dealProduct
          .create({
            data: {
              dealId: deal.id,
              productId: prod.id,
              quantity: randInt(1, 5),
              unitPrice: prod.unitPrice,
              discount: randInt(0, 15),
            },
          })
          .catch(() => {});
      }
    } catch (_) {
      /* skip on error */
    }
  }
  console.log(`  ✓ Deals: ${allDeals.length}`);

  // ── Activities ──
  const activityTypes = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK'];
  for (let i = 0; i < 10; i++) {
    const contact = allContacts[i % allContacts.length];
    const deal = allDeals[i % allDeals.length];
    const type = activityTypes[i % activityTypes.length];
    await prisma.activity
      .create({
        data: {
          tenantId: tenant.id,
          type,
          subject: `${type === 'CALL' ? 'Follow-up call' : type === 'EMAIL' ? 'Sent proposal email' : type === 'MEETING' ? 'Demo meeting' : type === 'NOTE' ? 'Client update note' : 'Follow-up task'} - ${contact?.firstName || ''}`,
          description: `${type} activity with ${contact?.firstName} ${contact?.lastName} regarding ${deal?.name}`,
          contactId: contact?.id || null,
          dealId: deal?.id || null,
          assignedToId: adminUser.id,
          createdById: adminUser.id,
          status: pick(['COMPLETED', 'COMPLETED', 'PLANNED']),
          dueDate: daysAgo(randInt(1, 14)),
          completedAt: daysAgo(randInt(0, 7)),
        },
      })
      .catch(() => {});
  }
  console.log(`  ✓ Activities: 10`);

  // ── Invoices ──
  const invoiceStatuses = ['PAID', 'PAID', 'SENT', 'OVERDUE', 'DRAFT'];
  let invoiceNum = 1;
  for (let i = 0; i < Math.min(6, allContacts.length); i++) {
    const contact = allContacts[i];
    const status = invoiceStatuses[i % invoiceStatuses.length];
    const amount = parseFloat(config.products[i % config.products.length]?.unitPrice || '5000');
    const gstRate = parseFloat(config.products[i % config.products.length]?.gstRate || '18');
    const taxAmount = (amount * gstRate) / 100;
    const total = amount + taxAmount;
    const prefix = config.slug.toUpperCase().replace(/-/g, '').substring(0, 3);

    const issueDate = daysAgo(randInt(10, 60));
    const dueDate = new Date(issueDate);
    dueDate.setDate(dueDate.getDate() + 30);

    try {
      const invoice = await prisma.invoice.create({
        data: {
          tenantId: tenant.id,
          invoiceNumber: `${prefix}-INV-2025-${String(invoiceNum++).padStart(4, '0')}`,
          contactId: contact.id,
          status,
          issueDate,
          dueDate,
          subtotal: String(amount.toFixed(2)),
          taxAmount: String(taxAmount.toFixed(2)),
          totalAmount: String(total.toFixed(2)),
          currency: 'INR',
          notes: 'Thank you for your business.',
        },
      });

      // Record payment for PAID invoices
      if (status === 'PAID') {
        await prisma.payment
          .create({
            data: {
              tenantId: tenant.id,
              invoiceId: invoice.id,
              amount: String(total.toFixed(2)),
              currency: 'INR',
              method: pick(['BANK_TRANSFER', 'UPI', 'CASH']),
              status: 'COMPLETED',
              processedAt: daysAgo(randInt(1, 10)),
            },
          })
          .catch(() => {});
      }
    } catch (_) {
      /* skip */
    }
  }
  console.log(`  ✓ Invoices: 6`);

  // ── HR: Employees ──
  const employees = [];
  const deptHeads = [];
  for (let i = 0; i < config.hrDepts.length; i++) {
    const dept = config.hrDepts[i];
    const fn = FIRST_NAMES[(i * 2) % FIRST_NAMES.length];
    const ln = LAST_NAMES[(i * 3) % LAST_NAMES.length];
    const empEmail = `${fn.toLowerCase()}.${ln.toLowerCase()}.head@${config.teamDomain}`;

    try {
      const emp = await prisma.employee.upsert({
        where: { tenantId_email: { tenantId: tenant.id, email: empEmail } },
        update: {},
        create: {
          tenantId: tenant.id,
          employeeId: `EMP${String(i + 1).padStart(3, '0')}`,
          firstName: fn,
          lastName: ln,
          email: empEmail,
          phone: `+91 9${randInt(100000000, 999999999)}`,
          role: `${dept} Head`,
          department: dept,
          joinDate: daysAgo(randInt(180, 1800)),
          salary: String(randInt(80000, 250000)),
          employmentType: 'FULL_TIME',
          status: 'ACTIVE',
        },
      });
      deptHeads.push(emp);
      employees.push(emp);

      // Leave balance for this employee
      await prisma.leaveBalance.upsert({
        where: {
          tenantId_employeeId_year: { tenantId: tenant.id, employeeId: emp.id, year: 2025 },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          employeeId: emp.id,
          year: 2025,
          annual: 20,
          sick: 10,
          personal: 5,
          usedAnnual: randInt(0, 8),
          usedSick: randInt(0, 3),
          usedPersonal: randInt(0, 2),
        },
      });
    } catch (_) {
      /* skip */
    }
  }

  // Add 2-3 staff under first dept head
  if (deptHeads.length > 0) {
    for (let i = 0; i < 3; i++) {
      const fn = FIRST_NAMES[(i + 5) % FIRST_NAMES.length];
      const ln = LAST_NAMES[(i + 7) % LAST_NAMES.length];
      const empEmail = `${fn.toLowerCase()}.${ln.toLowerCase()}.staff@${config.teamDomain}`;
      try {
        const emp = await prisma.employee.upsert({
          where: { tenantId_email: { tenantId: tenant.id, email: empEmail } },
          update: {},
          create: {
            tenantId: tenant.id,
            employeeId: `EMP${String(deptHeads.length + i + 1).padStart(3, '0')}`,
            firstName: fn,
            lastName: ln,
            email: empEmail,
            phone: `+91 9${randInt(100000000, 999999999)}`,
            role: 'Executive',
            department: config.hrDepts[0],
            managerId: deptHeads[0].id,
            joinDate: daysAgo(randInt(30, 365)),
            salary: String(randInt(35000, 75000)),
            employmentType: 'FULL_TIME',
            status: 'ACTIVE',
          },
        });
        employees.push(emp);

        await prisma.leaveBalance.upsert({
          where: {
            tenantId_employeeId_year: { tenantId: tenant.id, employeeId: emp.id, year: 2025 },
          },
          update: {},
          create: {
            tenantId: tenant.id,
            employeeId: emp.id,
            year: 2025,
            annual: 20,
            sick: 10,
            personal: 5,
            usedAnnual: randInt(0, 5),
            usedSick: randInt(0, 2),
            usedPersonal: 0,
          },
        });
      } catch (_) {
        /* skip */
      }
    }
  }

  // Leave requests
  if (employees.length > 0) {
    await prisma.leaveRequest
      .create({
        data: {
          tenantId: tenant.id,
          employeeId: employees[0].id,
          type: 'ANNUAL',
          startDate: daysFromNow(7),
          endDate: daysFromNow(11),
          days: 5,
          reason: 'Family vacation',
          status: 'PENDING',
        },
      })
      .catch(() => {});

    if (employees.length > 1) {
      await prisma.leaveRequest
        .create({
          data: {
            tenantId: tenant.id,
            employeeId: employees[1].id,
            type: 'SICK',
            startDate: daysAgo(5),
            endDate: daysAgo(3),
            days: 3,
            reason: 'Medical emergency',
            status: 'APPROVED',
            approvedBy: adminUser.id,
            approvedAt: daysAgo(5),
          },
        })
        .catch(() => {});
    }
  }
  console.log(`  ✓ HR: ${employees.length} employees, leave records`);

  // ── Projects & Tasks ──
  for (let pi = 0; pi < config.projectNames.length; pi++) {
    const projectName = config.projectNames[pi];
    let project = await prisma.project.findFirst({
      where: { tenantId: tenant.id, name: projectName },
    });
    if (!project) {
      project = await prisma.project.create({
        data: {
          tenantId: tenant.id,
          name: projectName,
          description: `Strategic initiative: ${projectName}`,
          status: pi === 0 ? 'IN_PROGRESS' : pi === 1 ? 'PLANNING' : 'NOT_STARTED',
          priority: pick(['HIGH', 'MEDIUM', 'URGENT']),
          startDate: daysAgo(randInt(10, 60)),
          endDate: daysFromNow(randInt(30, 120)),
          budget: String(randInt(500000, 5000000)),
          currency: 'INR',
          progress: pi === 0 ? randInt(20, 60) : 0,
          ownerId: adminUser.id,
        },
      });

      await prisma.projectMember
        .create({
          data: { projectId: project.id, userId: adminUser.id, role: 'OWNER' },
        })
        .catch(() => {});

      // Tasks for this project
      const taskTitles = [
        'Kickoff meeting with stakeholders',
        'Requirements gathering',
        'Design & architecture review',
        'Implementation - Phase 1',
        'QA & testing',
        'Deployment & go-live',
      ];

      const taskStatuses = ['COMPLETED', 'COMPLETED', 'IN_PROGRESS', 'TODO', 'TODO', 'TODO'];

      for (let ti = 0; ti < taskTitles.length; ti++) {
        await prisma.task
          .create({
            data: {
              tenantId: tenant.id,
              title: taskTitles[ti],
              description: `Task: ${taskTitles[ti]} for project ${projectName}`,
              projectId: project.id,
              status: pi === 0 ? taskStatuses[ti] : 'TODO',
              priority: ti === 0 ? 'HIGH' : 'MEDIUM',
              assigneeId: adminUser.id,
              createdById: adminUser.id,
              dueDate: daysFromNow(randInt(3, 30) + ti * 7),
            },
          })
          .catch(() => {});
      }
    }
  }
  console.log(`  ✓ Projects: ${config.projectNames.length} with tasks`);

  console.log(`\n  ✅ ${config.name} fully seeded!`);
  return tenant;
}

// ==================== MAIN ====================

async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║     NEXORA CRM - DEMO TENANT SEEDER              ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const plans = await getPlans();

  for (const config of TENANT_CONFIGS) {
    await seedTenant(config, plans);
  }

  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║                 SEED COMPLETE!                   ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  Login credentials for all demo tenants:         ║');
  console.log('║  Password: Demo@2025                             ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  ZenShop India  → admin@zenshopindia.com         ║');
  console.log('║  Vortex SaaS    → hello@vortexsaas.io            ║');
  console.log('║  MedCore Health → admin@medcorehealth.in          ║');
  console.log('║  BuildPro       → info@buildpro.co.in            ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
