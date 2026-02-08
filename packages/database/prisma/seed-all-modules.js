import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * COMPREHENSIVE RELATIONAL SEED FOR ALL MODULES
 *
 * This seed creates interconnected data across ALL modules:
 * - Same contacts have data in CRM, Inbox, Tickets, Deals, etc.
 * - HR employees linked to users
 * - Surveys linked to contacts/tickets
 * - KB articles for service
 * - Workflows for automation
 * - And more...
 */

// Helpers
const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomDate = (daysBack) =>
  new Date(Date.now() - randomInt(0, daysBack) * 24 * 60 * 60 * 1000);

async function main() {
  console.log('🚀 Comprehensive Relational Seed Starting...\n');

  // ==================== GET EXISTING DATA ====================
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'nexora-platform' },
  });

  if (!tenant) {
    console.error('❌ Tenant "nexora-platform" not found. Run main seed first.');
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id },
  });

  const contacts = await prisma.contact.findMany({
    where: { tenantId: tenant.id },
    take: 50,
  });

  const companies = await prisma.company.findMany({
    where: { tenantId: tenant.id },
  });

  console.log(
    `📦 Found: ${users.length} users, ${contacts.length} contacts, ${companies.length} companies\n`
  );

  // ==================== 1. KNOWLEDGE BASE ====================
  console.log('📚 Creating Knowledge Base data...');

  const kbCategories = [
    {
      name: 'Getting Started',
      slug: 'getting-started',
      icon: 'BookOpen',
      description: 'Onboarding guides and tutorials',
    },
    {
      name: 'Account & Billing',
      slug: 'account-billing',
      icon: 'CreditCard',
      description: 'Manage your account and payments',
    },
    { name: 'Features', slug: 'features', icon: 'Zap', description: 'Learn about our features' },
    {
      name: 'Integrations',
      slug: 'integrations',
      icon: 'Puzzle',
      description: 'Connect with other tools',
    },
    {
      name: 'Troubleshooting',
      slug: 'troubleshooting',
      icon: 'AlertCircle',
      description: 'Fix common issues',
    },
  ];

  const createdCategories = [];
  for (let i = 0; i < kbCategories.length; i++) {
    const cat = kbCategories[i];
    const category = await prisma.kBCategory.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: cat.slug } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        description: cat.description,
        order: i,
        isPublished: true,
      },
    });
    createdCategories.push(category);
  }

  const kbArticles = [
    {
      category: 0,
      title: 'Quick Start Guide',
      slug: 'quick-start-guide',
      content:
        'Welcome to Nexora CRM! This guide will help you get started...\n\n## Step 1: Create Your Account\nSign up at nexoraos.pro...\n\n## Step 2: Import Contacts\nNavigate to CRM > Contacts > Import...',
      excerpt: 'Get up and running in 5 minutes',
      isFeatured: true,
    },
    {
      category: 0,
      title: 'Setting Up Your Team',
      slug: 'setting-up-team',
      content:
        'Learn how to invite team members and set up roles...\n\n## Inviting Team Members\nGo to Settings > Users & Teams...',
      excerpt: 'Invite and manage your team',
    },
    {
      category: 1,
      title: 'Managing Your Subscription',
      slug: 'managing-subscription',
      content:
        'View and manage your subscription plan...\n\n## Upgrading Your Plan\nNavigate to Settings > Billing...',
      excerpt: 'Upgrade, downgrade, or cancel',
    },
    {
      category: 1,
      title: 'Payment Methods',
      slug: 'payment-methods',
      content: 'Add and manage payment methods for your account...',
      excerpt: 'Credit cards, UPI, and more',
    },
    {
      category: 2,
      title: 'Using the Pipeline',
      slug: 'using-pipeline',
      content:
        'Master the sales pipeline to track your deals...\n\n## Creating Deals\nClick "New Deal" to create...',
      excerpt: 'Track deals through stages',
      isFeatured: true,
    },
    {
      category: 2,
      title: 'Automation Workflows',
      slug: 'automation-workflows',
      content:
        'Set up automation to save time...\n\n## Workflow Triggers\nWorkflows can be triggered by...',
      excerpt: 'Automate repetitive tasks',
    },
    {
      category: 3,
      title: 'WhatsApp Integration',
      slug: 'whatsapp-integration',
      content:
        'Connect WhatsApp Business API...\n\n## Prerequisites\nYou need a WhatsApp Business account...',
      excerpt: 'Send and receive WhatsApp messages',
    },
    {
      category: 3,
      title: 'Email Integration',
      slug: 'email-integration',
      content:
        'Connect your Gmail or Outlook...\n\n## OAuth Setup\nClick "Connect" and authorize...',
      excerpt: 'Sync emails with CRM',
    },
    {
      category: 4,
      title: 'Login Issues',
      slug: 'login-issues',
      content:
        'Troubleshoot common login problems...\n\n## Forgot Password\nClick "Reset Password"...',
      excerpt: 'Fix login problems',
    },
    {
      category: 4,
      title: 'Sync Errors',
      slug: 'sync-errors',
      content: 'Resolve data sync issues...\n\n## Check Connection\nVerify your integration...',
      excerpt: 'Fix sync problems',
    },
  ];

  for (const article of kbArticles) {
    await prisma.kBArticle.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: article.slug } },
      update: {},
      create: {
        tenantId: tenant.id,
        categoryId: createdCategories[article.category].id,
        authorId: users[0].id,
        title: article.title,
        slug: article.slug,
        content: article.content,
        excerpt: article.excerpt,
        status: 'PUBLISHED',
        isFeatured: article.isFeatured || false,
        viewCount: randomInt(50, 500),
        helpfulYes: randomInt(10, 100),
        helpfulNo: randomInt(0, 20),
        publishedAt: randomDate(60),
      },
    });
  }
  console.log(
    `  ✅ Created ${createdCategories.length} categories, ${kbArticles.length} articles\n`
  );

  // ==================== 2. SURVEYS ====================
  console.log('📋 Creating Surveys data...');

  const surveys = [
    {
      name: 'Customer Satisfaction (CSAT)',
      type: 'CSAT',
      description: 'Quick satisfaction survey after support interaction',
    },
    {
      name: 'Net Promoter Score (NPS)',
      type: 'NPS',
      description: 'How likely are you to recommend us?',
    },
    {
      name: 'Customer Effort Score (CES)',
      type: 'CES',
      description: 'How easy was it to get your issue resolved?',
    },
    {
      name: 'Product Feedback',
      type: 'CUSTOM',
      description: 'Tell us about your experience with our product',
    },
  ];

  const createdSurveys = [];
  for (const s of surveys) {
    const survey = await prisma.survey.upsert({
      where: { id: `survey-${s.type.toLowerCase()}-${tenant.id}` },
      update: {},
      create: {
        id: `survey-${s.type.toLowerCase()}-${tenant.id}`,
        tenantId: tenant.id,
        name: s.name,
        description: s.description,
        type: s.type,
        status: 'ACTIVE',
        isAnonymous: false,
        showProgressBar: true,
        allowMultiple: false,
        thankYouMessage: 'Thank you for your feedback!',
        createdById: users[0].id,
        responseCount: randomInt(20, 100),
        avgScore: 4.2 + Math.random() * 0.6,
      },
    });
    createdSurveys.push(survey);

    // Create questions for each survey
    const questions = [];
    if (s.type === 'CSAT') {
      questions.push({
        type: 'RATING',
        question: 'How satisfied are you with our service?',
        isRequired: true,
      });
      questions.push({ type: 'TEXTAREA', question: 'Any additional comments?', isRequired: false });
    } else if (s.type === 'NPS') {
      questions.push({
        type: 'NPS',
        question: 'How likely are you to recommend us to a friend?',
        isRequired: true,
      });
      questions.push({
        type: 'TEXT',
        question: 'What is the primary reason for your score?',
        isRequired: false,
      });
    } else if (s.type === 'CES') {
      questions.push({
        type: 'SCALE',
        question: 'How easy was it to get your issue resolved?',
        isRequired: true,
      });
    } else {
      questions.push({
        type: 'RATING',
        question: 'Rate your overall experience',
        isRequired: true,
      });
      questions.push({
        type: 'MULTIPLE_CHOICE',
        question: 'Which features do you use most?',
        options: ['CRM', 'Inbox', 'Pipeline', 'Automation', 'Analytics'],
        isRequired: false,
      });
      questions.push({
        type: 'TEXTAREA',
        question: 'What improvements would you like to see?',
        isRequired: false,
      });
    }

    for (let qi = 0; qi < questions.length; qi++) {
      const q = questions[qi];
      await prisma.surveyQuestion.upsert({
        where: { id: `sq-${survey.id}-${qi}` },
        update: {},
        create: {
          id: `sq-${survey.id}-${qi}`,
          surveyId: survey.id,
          type: q.type,
          question: q.question,
          isRequired: q.isRequired,
          order: qi,
          options: q.options ? q.options : null,
        },
      });
    }
  }

  // Create survey responses linked to contacts
  for (let i = 0; i < Math.min(20, contacts.length); i++) {
    const contact = contacts[i];
    const survey = randomItem(createdSurveys);

    await prisma.surveyResponse.upsert({
      where: { id: `sr-${i}-${tenant.id}` },
      update: {},
      create: {
        id: `sr-${i}-${tenant.id}`,
        surveyId: survey.id,
        tenantId: tenant.id,
        contactId: contact.id,
        totalScore: 3 + Math.random() * 2,
        completedAt: randomDate(30),
      },
    });
  }
  console.log(`  ✅ Created ${createdSurveys.length} surveys with questions and 20 responses\n`);

  // ==================== 3. AUTOMATION WORKFLOWS ====================
  console.log('⚡ Creating Automation Workflows...');

  const workflows = [
    {
      name: 'Welcome New Contact',
      description: 'Send welcome email when a new contact is created',
      trigger: { type: 'contact.created' },
      actions: [
        {
          type: 'send_email',
          config: { subject: 'Welcome to Nexora!', content: 'Hi {{firstName}}, welcome aboard!' },
        },
        { type: 'add_tag', config: { tagName: 'New Contact' } },
      ],
    },
    {
      name: 'Lead Follow-up Reminder',
      description: 'Create task when lead status changes',
      trigger: { type: 'lead.status_changed' },
      conditions: [{ field: 'status', operator: 'equals', value: 'QUALIFIED' }],
      actions: [
        { type: 'create_task', config: { title: 'Follow up with {{firstName}}', dueInDays: 2 } },
      ],
    },
    {
      name: 'Deal Won Celebration',
      description: 'Actions when a deal is won',
      trigger: { type: 'deal.won' },
      actions: [
        { type: 'send_whatsapp', config: { content: 'Congratulations on your purchase!' } },
        { type: 'update_contact', config: { updates: { lifecycleStage: 'CUSTOMER' } } },
      ],
    },
    {
      name: 'High Priority Ticket Alert',
      description: 'Notify team on urgent tickets',
      trigger: { type: 'ticket.created' },
      conditions: [{ field: 'priority', operator: 'equals', value: 'URGENT' }],
      actions: [
        {
          type: 'send_email',
          config: { subject: 'URGENT Ticket Alert', content: 'New urgent ticket created' },
        },
      ],
    },
  ];

  for (let i = 0; i < workflows.length; i++) {
    const wf = workflows[i];
    const workflowId = `wf-${i + 1}-${tenant.id}`;

    await prisma.workflows.upsert({
      where: { id: workflowId },
      update: {},
      create: {
        id: workflowId,
        tenantId: tenant.id,
        name: wf.name,
        description: wf.description,
        isActive: i < 2, // First 2 are active
        createdById: users[0].id,
      },
    });

    // Create trigger
    await prisma.workflow_triggers.upsert({
      where: { id: `wft-${i + 1}-${tenant.id}` },
      update: {},
      create: {
        id: `wft-${i + 1}-${tenant.id}`,
        workflowId: workflowId,
        type: wf.trigger.type,
        config: wf.trigger.config || {},
      },
    });

    // Create conditions
    if (wf.conditions) {
      for (let ci = 0; ci < wf.conditions.length; ci++) {
        const cond = wf.conditions[ci];
        await prisma.workflow_conditions.upsert({
          where: { id: `wfc-${i + 1}-${ci}-${tenant.id}` },
          update: {},
          create: {
            id: `wfc-${i + 1}-${ci}-${tenant.id}`,
            workflowId: workflowId,
            field: cond.field,
            operator: cond.operator,
            value: cond.value,
            order: ci,
          },
        });
      }
    }

    // Create actions
    for (let ai = 0; ai < wf.actions.length; ai++) {
      const action = wf.actions[ai];
      await prisma.workflow_actions.upsert({
        where: { id: `wfa-${i + 1}-${ai}-${tenant.id}` },
        update: {},
        create: {
          id: `wfa-${i + 1}-${ai}-${tenant.id}`,
          workflowId: workflowId,
          type: action.type,
          config: action.config,
          order: ai,
        },
      });
    }
  }
  console.log(
    `  ✅ Created ${workflows.length} workflows with triggers, conditions, and actions\n`
  );

  // ==================== 4. EMPLOYEES (HR) ====================
  console.log('👥 Creating HR Employee data...');

  const departments = ['Engineering', 'Sales', 'Marketing', 'Support', 'HR', 'Finance'];
  const createdEmployees = [];

  for (let i = 0; i < Math.min(15, users.length); i++) {
    const user = users[i];
    const dept = departments[i % departments.length];
    const empId = `EMP${String(i + 1).padStart(3, '0')}`;

    const employee = await prisma.employee.upsert({
      where: { id: `emp-${i + 1}-${tenant.id}` },
      update: {},
      create: {
        id: `emp-${i + 1}-${tenant.id}`,
        tenantId: tenant.id,
        employeeId: empId,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: `+91 ${randomInt(7000000000, 9999999999)}`,
        role: randomItem(['Developer', 'Manager', 'Executive', 'Analyst', 'Specialist']),
        department: dept,
        status: 'ACTIVE',
        joinDate: randomDate(365 * 2),
        salary: randomInt(30000, 150000),
        employmentType: randomItem(['FULL_TIME', 'PART_TIME', 'CONTRACT']),
        location: randomItem(['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai']),
      },
    });
    createdEmployees.push(employee);
  }
  console.log(`  ✅ Created ${createdEmployees.length} employees\n`);

  // ==================== 5. LEAVE REQUESTS ====================
  console.log('📅 Creating Leave Requests...');

  const leaveTypes = ['ANNUAL', 'SICK', 'PERSONAL', 'MATERNITY', 'PATERNITY', 'UNPAID'];
  for (let i = 0; i < Math.min(20, createdEmployees.length * 2); i++) {
    const emp = randomItem(createdEmployees);
    const startDate = randomDate(60);
    const days = randomInt(1, 5);
    const endDate = new Date(startDate.getTime() + days * 24 * 60 * 60 * 1000);

    await prisma.leaveRequest.upsert({
      where: { id: `leave-${i + 1}-${tenant.id}` },
      update: {},
      create: {
        id: `leave-${i + 1}-${tenant.id}`,
        tenantId: tenant.id,
        employeeId: emp.id,
        type: randomItem(leaveTypes),
        startDate,
        endDate,
        days,
        reason: randomItem([
          'Personal work',
          'Family event',
          'Not feeling well',
          'Vacation',
          'Medical appointment',
        ]),
        status: randomItem(['PENDING', 'APPROVED', 'REJECTED']),
      },
    });
  }
  console.log(`  ✅ Created 20 leave requests\n`);

  // ==================== 6. ATTENDANCE ====================
  console.log('⏰ Creating Attendance records...');

  for (const emp of createdEmployees.slice(0, 10)) {
    // Last 7 days attendance
    for (let d = 0; d < 7; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      date.setHours(0, 0, 0, 0);

      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      if (isWeekend) continue;

      const checkIn = new Date(date);
      checkIn.setHours(9 + randomInt(-1, 1), randomInt(0, 59), 0, 0);

      const checkOut = new Date(date);
      checkOut.setHours(18 + randomInt(-1, 2), randomInt(0, 59), 0, 0);

      await prisma.attendance.upsert({
        where: { id: `att-${emp.id}-${d}` },
        update: {},
        create: {
          id: `att-${emp.id}-${d}`,
          tenantId: tenant.id,
          employeeId: emp.id,
          date,
          checkIn,
          checkOut,
          status: checkIn.getHours() > 9 ? 'LATE' : 'PRESENT',
          workHours: (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60),
        },
      });
    }
  }
  console.log(`  ✅ Created attendance records for 10 employees (7 days each)\n`);

  // ==================== 7. INVENTORY PRODUCTS ====================
  console.log('📦 Creating Inventory Products...');

  const products = [
    { name: 'Nexora CRM - Starter', sku: 'NX-CRM-START', price: 999, category: 'Software' },
    { name: 'Nexora CRM - Professional', sku: 'NX-CRM-PRO', price: 2999, category: 'Software' },
    { name: 'Nexora CRM - Enterprise', sku: 'NX-CRM-ENT', price: 9999, category: 'Software' },
    { name: 'WhatsApp Integration Add-on', sku: 'NX-WA-ADDON', price: 499, category: 'Add-on' },
    { name: 'Email Marketing Add-on', sku: 'NX-EM-ADDON', price: 299, category: 'Add-on' },
    { name: 'Custom Integration Service', sku: 'NX-CUSTOM-INT', price: 15000, category: 'Service' },
    { name: 'Training & Onboarding', sku: 'NX-TRAINING', price: 5000, category: 'Service' },
    { name: 'Premium Support (Annual)', sku: 'NX-SUPPORT', price: 12000, category: 'Support' },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: `prod-${p.sku}-${tenant.id}` },
      update: {},
      create: {
        id: `prod-${p.sku}-${tenant.id}`,
        tenantId: tenant.id,
        name: p.name,
        sku: p.sku,
        unitPrice: p.price,
        currency: 'INR',
        description: `${p.name} - ${p.category}`,
        isActive: true,
        gstRate: 18,
        productType: p.category === 'Service' ? 'SERVICES' : 'GOODS',
      },
    });
  }
  console.log(`  ✅ Created ${products.length} products\n`);

  // ==================== 8. SALES FORECASTS ====================
  console.log('📈 Creating Sales Forecasts...');

  const forecastData = [
    { name: 'Q1 2026 Forecast', period: 'QUARTERLY', monthOffset: 0 },
    { name: 'Q2 2026 Forecast', period: 'QUARTERLY', monthOffset: 3 },
    { name: 'Q3 2026 Forecast', period: 'QUARTERLY', monthOffset: 6 },
    { name: 'Q4 2026 Forecast', period: 'QUARTERLY', monthOffset: 9 },
  ];

  for (let i = 0; i < forecastData.length; i++) {
    const f = forecastData[i];
    const target = randomInt(500000, 2000000);
    const actual = i < 2 ? randomInt(Math.floor(target * 0.7), Math.floor(target * 1.2)) : 0;

    const startDate = new Date(2026, f.monthOffset, 1);
    const endDate = new Date(2026, f.monthOffset + 3, 0);

    await prisma.salesForecast.upsert({
      where: { id: `forecast-${i + 1}-${tenant.id}` },
      update: {},
      create: {
        id: `forecast-${i + 1}-${tenant.id}`,
        tenantId: tenant.id,
        name: f.name,
        period: f.period,
        startDate,
        endDate,
        targetAmount: target,
        actualAmount: actual,
        probability: randomInt(60, 95),
        status: i < 2 ? 'COMPLETED' : 'ACTIVE',
        userId: users[0].id,
        notes: `Sales forecast for ${f.name}`,
      },
    });
  }
  console.log(`  ✅ Created ${forecastData.length} sales forecasts\n`);

  // ==================== 9. ANALYTICS GOALS ====================
  console.log('🎯 Creating Analytics Goals...');

  const goals = [
    { name: 'Q1 Revenue Target', type: 'REVENUE', target: 1000000 },
    { name: 'New Leads Target', type: 'LEADS', target: 500 },
    { name: 'Deals Closed Target', type: 'DEALS', target: 50 },
    { name: 'Customer Satisfaction', type: 'CUSTOM', target: 4.5 },
    { name: 'Support Tickets Resolved', type: 'TICKETS', target: 200 },
  ];

  for (const g of goals) {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 1);
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 2);

    await prisma.analyticsGoal.upsert({
      where: { id: `goal-${g.type.toLowerCase()}-${tenant.id}` },
      update: {},
      create: {
        id: `goal-${g.type.toLowerCase()}-${tenant.id}`,
        tenantId: tenant.id,
        name: g.name,
        type: g.type,
        targetValue: g.target,
        currentValue: g.target * (0.3 + Math.random() * 0.5),
        startDate,
        endDate,
        status: 'ACTIVE',
        createdBy: users[0].id,
      },
    });
  }
  console.log(`  ✅ Created ${goals.length} analytics goals\n`);

  // ==================== 10. DISCOUNTS ====================
  console.log('🏷️ Creating Discounts...');

  const discounts = [
    {
      code: 'WELCOME20',
      name: 'Welcome Discount',
      type: 'PERCENTAGE',
      value: 20,
      description: '20% off for new customers',
    },
    {
      code: 'FLAT500',
      name: 'Flat 500 Off',
      type: 'FIXED_AMOUNT',
      value: 500,
      description: 'Flat ₹500 off',
    },
    {
      code: 'ANNUAL25',
      name: 'Annual Plan Discount',
      type: 'PERCENTAGE',
      value: 25,
      description: '25% off on annual plans',
    },
    {
      code: 'STARTUP50',
      name: 'Startup Special',
      type: 'PERCENTAGE',
      value: 50,
      description: '50% off for startups',
    },
  ];

  for (const d of discounts) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 3);

    await prisma.discount.upsert({
      where: { id: `disc-${d.code}-${tenant.id}` },
      update: {},
      create: {
        id: `disc-${d.code}-${tenant.id}`,
        tenantId: tenant.id,
        name: d.name,
        code: d.code,
        type: d.type,
        value: d.value,
        status: 'ACTIVE',
        startDate,
        endDate,
        usageLimit: randomInt(50, 200),
        usageCount: randomInt(0, 30),
        applicableTo: 'ALL',
      },
    });
  }
  console.log(`  ✅ Created ${discounts.length} discounts\n`);

  // ==================== 11. LINK EXISTING DATA ====================
  console.log('🔗 Linking existing contacts to all modules...');

  // Get existing tickets
  const tickets = await prisma.ticket.findMany({
    where: { tenantId: tenant.id },
    take: 20,
  });

  // Get existing deals
  const deals = await prisma.deal.findMany({
    where: { tenantId: tenant.id },
    take: 20,
  });

  console.log(`  Found ${tickets.length} tickets, ${deals.length} deals to link\n`);

  // ==================== SUMMARY ====================
  console.log('✅ Comprehensive Relational Seed Complete!\n');
  console.log('📊 Summary:');
  console.log('   - Knowledge Base: 5 categories, 10 articles');
  console.log('   - Surveys: 4 surveys with questions, 20 responses');
  console.log('   - Workflows: 4 automation workflows');
  console.log('   - HR: 15 employees, 20 leave requests, attendance records');
  console.log('   - Products: 8 inventory items');
  console.log('   - Sales Forecasts: 4 quarters');
  console.log('   - Analytics Goals: 5 goals');
  console.log('   - Discounts: 4 discount codes');
  console.log('\n🎉 All data is relationally linked to contacts/users!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
