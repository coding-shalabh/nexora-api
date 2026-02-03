// Seed script to create sample customer journeys in Nexora CRM
// Run with: DATABASE_URL="postgresql://postgres:TrdnPDDXyoFJEIZvmRpxLugHxwtSMbPp@nozomi.proxy.rlwy.net:34866/railway" node scripts/seed-customer-journeys.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helix Code tenant info
const TENANT_ID = 'cmk76mz0w00021230zcfawvtw';
const WORKSPACE_ID = 'cmk7ur80s0002noe46dip69wb';
const OWNER_ID = 'cmk7ur81l0009noe4x2cztuxd'; // admin@helixcode.in

// Generate unique ID
const generateId = () => {
  return 'cust_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
};

// Sample customers from 72orionx.com with purchase history
const sampleCustomers = [
  {
    firstName: 'Rahul',
    lastName: 'Sharma',
    email: 'rahul.sharma@techstartup.in',
    phone: '+919876543210',
    company: 'TechStartup.in',
    jobTitle: 'CTO',
    source: '72orionx.com',
    lifecycleStage: 'MQL',
    leadStatus: 'NEW',
    leadScore: 55,
    rating: 'WARM',
    customFields: {
      interest_area: 'IT Infrastructure',
      company_size: '10-50',
      industry: 'Technology',
      referrer: 'google-organic',
    },
    activities: [
      {
        type: 'NOTE',
        subject: 'Contact created from newsletter signup',
        description: 'Signed up on 72orionx.com for newsletter',
      },
      {
        type: 'EMAIL',
        subject: 'Welcome email sent',
        description: 'Sent welcome email with company intro',
      },
      {
        type: 'NOTE',
        subject: 'Whitepaper downloaded',
        description: 'Downloaded: IT Infrastructure Guide for Startups',
      },
    ],
  },
  {
    firstName: 'Priya',
    lastName: 'Patel',
    email: 'priya.patel@designstudio.com',
    phone: '+919765432100',
    company: 'Design Studio Co',
    jobTitle: 'Creative Director',
    source: '72orionx.com',
    lifecycleStage: 'CUSTOMER',
    leadStatus: 'CONNECTED',
    leadScore: 85,
    rating: 'HOT',
    customFields: {
      total_purchases: 2,
      lifetime_value: 94998,
      product_categories: ['Hardware', 'Support'],
      last_order_id: 'ORD-2026-0001',
    },
    activities: [
      {
        type: 'NOTE',
        subject: 'Order Completed: Business Laptop Pro 15',
        description: 'Customer completed purchase of 1x Business Laptop Pro 15 for ₹74,999',
      },
      {
        type: 'NOTE',
        subject: 'Order Completed: IT Support Annual',
        description: 'Added IT Support subscription for ₹19,999/year',
      },
      {
        type: 'EMAIL',
        subject: 'Order confirmation sent',
        description: 'Sent order confirmation email for ORD-2026-0001',
      },
      {
        type: 'EMAIL',
        subject: 'Shipping notification sent',
        description: 'Order shipped via BlueDart - AWB: BD123456789',
      },
    ],
    deal: {
      name: 'Order #ORD-2026-0001 - Business Laptop + IT Support',
      amount: 94998,
      stage: 'Closed Won',
    },
  },
  {
    firstName: 'Amit',
    lastName: 'Kumar',
    email: 'amit.kumar@fintech.io',
    phone: '+919654321000',
    company: 'Fintech.io',
    jobTitle: 'IT Director',
    source: '72orionx.com',
    lifecycleStage: 'CUSTOMER',
    leadStatus: 'CONNECTED',
    leadScore: 90,
    rating: 'HOT',
    customFields: {
      total_service_value: 299999,
      services_purchased: ['Cloud Migration', 'IT Support'],
      satisfaction_score: 9,
    },
    activities: [
      {
        type: 'NOTE',
        subject: 'Service Request: Cloud Migration',
        description: 'Customer requested cloud migration consultation',
      },
      {
        type: 'CALL',
        subject: 'Discovery call completed',
        description: '30-minute call to discuss cloud requirements',
      },
      {
        type: 'EMAIL',
        subject: 'Quote sent - Cloud Migration Project',
        description: 'Sent detailed proposal for ₹2,99,999',
      },
      {
        type: 'MEETING',
        subject: 'Project kickoff meeting',
        description: 'Started cloud migration project',
      },
      {
        type: 'NOTE',
        subject: 'Project completed successfully',
        description: 'Cloud migration completed - customer satisfied',
      },
    ],
    deal: {
      name: 'Cloud Migration Project - Fintech.io',
      amount: 299999,
      stage: 'Closed Won',
    },
  },
  {
    firstName: 'Sneha',
    lastName: 'Reddy',
    email: 'sneha.reddy@creative.co',
    phone: '+919543210987',
    company: 'Creative Co',
    jobTitle: 'Operations Manager',
    source: '72orionx.com',
    lifecycleStage: 'CUSTOMER',
    leadStatus: 'CONNECTED',
    leadScore: 70,
    rating: 'WARM',
    customFields: {
      cart_recovery: true,
      discount_used: 'CART10',
      recovery_time: '48 hours',
    },
    activities: [
      {
        type: 'NOTE',
        subject: 'Cart abandoned - Workstation Desktop',
        description: 'Customer added Workstation Desktop (₹1,49,999) but left site',
      },
      {
        type: 'EMAIL',
        subject: 'Cart reminder email #1 sent',
        description: 'Sent: You left something behind',
      },
      {
        type: 'EMAIL',
        subject: 'Cart reminder email #2 sent with discount',
        description: 'Sent: 10% off - CART10',
      },
      {
        type: 'NOTE',
        subject: 'Order completed after cart recovery',
        description: 'Customer completed purchase with 10% discount',
      },
    ],
    deal: {
      name: 'Order #ORD-2026-0002 - Workstation Desktop (Cart Recovery)',
      amount: 134999,
      stage: 'Closed Won',
    },
  },
  {
    firstName: 'Vikram',
    lastName: 'Singh',
    email: 'vikram@manufacturing.in',
    phone: '+919432109876',
    company: 'Singh Manufacturing',
    jobTitle: 'Managing Director',
    source: '72orionx.com',
    lifecycleStage: 'CUSTOMER',
    leadStatus: 'CONNECTED',
    leadScore: 80,
    rating: 'HOT',
    whatsappConsent: true,
    customFields: {
      preferred_channel: 'whatsapp',
      response_time_avg: '2 hours',
      total_purchases: 3,
    },
    activities: [
      {
        type: 'WHATSAPP',
        subject: 'Welcome message sent via WhatsApp',
        description: 'Hi Vikram, welcome to 72orionx!',
      },
      {
        type: 'WHATSAPP',
        subject: 'Product inquiry received',
        description: 'Customer asked about Business Server warranty',
      },
      {
        type: 'WHATSAPP',
        subject: 'Product details shared',
        description: 'Sent server specs and 3-year warranty info',
      },
      {
        type: 'NOTE',
        subject: 'Order completed - Business Server',
        description: 'Purchased 1x Business Server for ₹2,49,999',
      },
      {
        type: 'WHATSAPP',
        subject: 'Order confirmation sent',
        description: 'Order #ORD-2026-0003 confirmed via WhatsApp',
      },
    ],
    deal: {
      name: 'Order #ORD-2026-0003 - Business Server',
      amount: 249999,
      stage: 'Closed Won',
    },
  },
  {
    firstName: 'Ananya',
    lastName: 'Gupta',
    email: 'ananya@startup.io',
    phone: '+919321098765',
    company: 'StartupIO',
    jobTitle: 'CEO',
    source: '72orionx.com',
    lifecycleStage: 'EVANGELIST',
    leadStatus: 'CONNECTED',
    leadScore: 95,
    rating: 'HOT',
    customFields: {
      referral_count: 3,
      referral_rewards: 3000,
      referral_code: 'ANANYA10',
      nps_score: 10,
    },
    activities: [
      {
        type: 'NOTE',
        subject: 'Initial purchase - Web Development',
        description: 'Purchased web development services for ₹49,999',
      },
      {
        type: 'EMAIL',
        subject: 'NPS survey sent',
        description: 'Sent post-purchase satisfaction survey',
      },
      {
        type: 'NOTE',
        subject: 'NPS score: 10 (Promoter)',
        description: 'Customer gave highest NPS score',
      },
      {
        type: 'EMAIL',
        subject: 'Referral program invitation sent',
        description: 'Invited to referral program with code ANANYA10',
      },
      {
        type: 'NOTE',
        subject: 'Referral reward: ₹1,000',
        description: 'First referral converted - Deepak Verma',
      },
      {
        type: 'NOTE',
        subject: 'Referral reward: ₹1,000',
        description: 'Second referral converted - Meera Kapoor',
      },
      {
        type: 'NOTE',
        subject: 'Referral reward: ₹1,000',
        description: 'Third referral converted - Rajesh Menon',
      },
    ],
    deal: {
      name: 'Web Development - StartupIO',
      amount: 49999,
      stage: 'Closed Won',
    },
  },
  {
    firstName: 'Deepak',
    lastName: 'Verma',
    email: 'deepak@newcompany.com',
    phone: '+919210987654',
    company: 'NewCompany Pvt Ltd',
    jobTitle: 'CTO',
    source: 'referral',
    lifecycleStage: 'CUSTOMER',
    leadStatus: 'CONNECTED',
    leadScore: 75,
    rating: 'WARM',
    customFields: {
      referred_by: 'ananya@startup.io',
      referral_code: 'ANANYA10',
    },
    activities: [
      {
        type: 'NOTE',
        subject: 'Contact from referral',
        description: 'Referred by Ananya Gupta (ANANYA10)',
      },
      {
        type: 'NOTE',
        subject: 'Applied referral discount',
        description: '10% discount applied on first purchase',
      },
      {
        type: 'NOTE',
        subject: 'Order completed - IT Support',
        description: 'Purchased IT Support subscription for ₹17,999 (after discount)',
      },
    ],
    deal: {
      name: 'IT Support - NewCompany (Referral)',
      amount: 17999,
      stage: 'Closed Won',
    },
  },
  {
    firstName: 'Meera',
    lastName: 'Kapoor',
    email: 'meera@healthtech.com',
    phone: '+919109876543',
    company: 'HealthTech Solutions',
    jobTitle: 'IT Manager',
    source: '72orionx.com',
    lifecycleStage: 'CUSTOMER',
    leadStatus: 'CONNECTED',
    leadScore: 80,
    rating: 'WARM',
    customFields: {
      subscription_tier: 'Premium',
      renewal_count: 2,
      contract_value: 59998,
      renewal_due: '2026-12-15',
    },
    activities: [
      {
        type: 'NOTE',
        subject: 'Initial subscription',
        description: 'Started IT Support Premium subscription',
      },
      {
        type: 'EMAIL',
        subject: 'First renewal reminder',
        description: '30-day renewal reminder sent',
      },
      {
        type: 'CALL',
        subject: 'Renewal discussion call',
        description: 'Discussed renewal and upsell options',
      },
      {
        type: 'NOTE',
        subject: 'Subscription renewed',
        description: 'Renewed for another year with Priority Response add-on',
      },
      {
        type: 'EMAIL',
        subject: 'Second renewal reminder',
        description: '30-day reminder for upcoming renewal',
      },
    ],
    deal: {
      name: 'IT Support Renewal 2026 - HealthTech',
      amount: 59998,
      stage: 'Closed Won',
    },
  },
  {
    firstName: 'Rajesh',
    lastName: 'Menon',
    email: 'rajesh.menon@techcorp.in',
    phone: '+919098765432',
    company: 'TechCorp Solutions Pvt Ltd',
    jobTitle: 'IT Director',
    source: '72orionx.com',
    lifecycleStage: 'SQL',
    leadStatus: 'IN_PROGRESS',
    leadScore: 70,
    rating: 'WARM',
    customFields: {
      company_size: '100-500',
      industry: 'Information Technology',
      budget_range: '₹10-20 lakhs',
      decision_timeline: 'Q1 2026',
    },
    activities: [
      {
        type: 'NOTE',
        subject: 'RFP received',
        description: 'Enterprise IT infrastructure RFP submitted',
      },
      {
        type: 'MEETING',
        subject: 'Discovery call scheduled',
        description: 'Initial requirements gathering call',
      },
      {
        type: 'CALL',
        subject: 'Discovery call completed',
        description: 'Identified needs: Cloud setup, security audit, annual support',
      },
      {
        type: 'NOTE',
        subject: 'Technical requirements documented',
        description: 'Created detailed requirements document',
      },
      {
        type: 'EMAIL',
        subject: 'Proposal sent',
        description: 'Sent enterprise IT proposal for ₹15,00,000',
      },
    ],
    deal: {
      name: 'TechCorp - Enterprise IT Infrastructure',
      amount: 1500000,
      stage: 'Proposal',
    },
  },
  {
    firstName: 'Pooja',
    lastName: 'Jain',
    email: 'pooja@retailchain.in',
    phone: '+918987654321',
    company: 'Retail Chain India',
    jobTitle: 'Head of IT',
    source: '72orionx.com',
    lifecycleStage: 'LEAD',
    leadStatus: 'OPEN',
    leadScore: 45,
    rating: 'WARM',
    customFields: {
      interest_area: 'Hardware',
      products_viewed: ['Laptop', 'Desktop', 'Server'],
      last_visit: '2026-01-15',
    },
    activities: [
      {
        type: 'NOTE',
        subject: 'Contact form submission',
        description: 'Requested quote for 50 business laptops',
      },
      {
        type: 'EMAIL',
        subject: 'Initial response sent',
        description: 'Sent product catalog and bulk pricing',
      },
      { type: 'NOTE', subject: 'Pricing page viewed', description: 'Viewed bulk pricing 3 times' },
    ],
  },
];

async function seedCustomerJourneys() {
  console.log('Starting customer journey seeding...');
  console.log('Tenant ID:', TENANT_ID);
  console.log('Workspace ID:', WORKSPACE_ID);
  console.log('');

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connected successfully!');
    console.log('');

    // Create contacts with activities
    for (const customer of sampleCustomers) {
      const contactId = generateId();
      console.log(`Creating contact: ${customer.firstName} ${customer.lastName}`);

      try {
        // Create contact
        const contact = await prisma.contact.create({
          data: {
            id: contactId,
            tenantId: TENANT_ID,
            firstName: customer.firstName,
            lastName: customer.lastName,
            displayName: `${customer.firstName} ${customer.lastName}`,
            email: customer.email,
            phone: customer.phone,
            source: customer.source,
            lifecycleStage: customer.lifecycleStage,
            leadStatus: customer.leadStatus,
            leadScore: customer.leadScore,
            rating: customer.rating,
            jobTitle: customer.jobTitle,
            marketingConsent: true,
            whatsappConsent: customer.whatsappConsent || false,
            customFields: customer.customFields,
            ownerId: OWNER_ID,
            status: 'ACTIVE',
          },
        });
        console.log(`  - Contact created: ${contact.id}`);

        // Create company if provided
        if (customer.company) {
          const companyId = generateId();
          try {
            const existingCompany = await prisma.company.findFirst({
              where: {
                tenantId: TENANT_ID,
                name: customer.company,
              },
            });

            if (!existingCompany) {
              const company = await prisma.company.create({
                data: {
                  id: companyId,
                  tenantId: TENANT_ID,
                  name: customer.company,
                  industry: customer.customFields?.industry || 'Technology',
                  ownerId: OWNER_ID,
                  status: 'ACTIVE',
                },
              });
              console.log(`  - Company created: ${company.name}`);

              // Link contact to company
              await prisma.contact.update({
                where: { id: contact.id },
                data: { companyId: company.id },
              });
            } else {
              await prisma.contact.update({
                where: { id: contact.id },
                data: { companyId: existingCompany.id },
              });
              console.log(`  - Company linked: ${existingCompany.name}`);
            }
          } catch (e) {
            console.log(`  - Company creation skipped: ${e.message}`);
          }
        }

        // Create activities
        if (customer.activities) {
          for (const activity of customer.activities) {
            const activityId = generateId();
            try {
              await prisma.activity.create({
                data: {
                  id: activityId,
                  tenantId: TENANT_ID,
                  type: activity.type,
                  subject: activity.subject,
                  description: activity.description,
                  contactId: contact.id,
                  ownerId: OWNER_ID,
                  metadata: {
                    source: '72orionx.com',
                    automated: false,
                  },
                },
              });
              console.log(`  - Activity: ${activity.subject}`);
            } catch (e) {
              console.log(`  - Activity skipped: ${e.message}`);
            }
          }
        }

        // Create deal if provided
        if (customer.deal) {
          const dealId = generateId();
          try {
            // Find default pipeline and stage
            const pipeline = await prisma.pipeline.findFirst({
              where: { tenantId: TENANT_ID },
              include: { stages: true },
            });

            if (pipeline) {
              let stage;
              if (customer.deal.stage === 'Closed Won') {
                stage =
                  pipeline.stages.find((s) => s.isWon) ||
                  pipeline.stages[pipeline.stages.length - 1];
              } else if (customer.deal.stage === 'Proposal') {
                stage =
                  pipeline.stages.find((s) => s.name.toLowerCase().includes('proposal')) ||
                  pipeline.stages[Math.floor(pipeline.stages.length / 2)];
              } else {
                stage = pipeline.stages[0];
              }

              const deal = await prisma.deal.create({
                data: {
                  id: dealId,
                  tenantId: TENANT_ID,
                  pipelineId: pipeline.id,
                  stageId: stage.id,
                  contactId: contact.id,
                  name: customer.deal.name,
                  amount: customer.deal.amount,
                  currency: 'INR',
                  probability: customer.deal.stage === 'Closed Won' ? 100 : 60,
                  source: customer.source,
                  ownerId: OWNER_ID,
                  closedAt: customer.deal.stage === 'Closed Won' ? new Date() : null,
                },
              });
              console.log(`  - Deal created: ${deal.name} (₹${deal.amount})`);
            }
          } catch (e) {
            console.log(`  - Deal skipped: ${e.message}`);
          }
        }

        console.log('');
      } catch (e) {
        console.log(`  Error creating contact: ${e.message}`);
        console.log('');
      }
    }

    console.log('='.repeat(50));
    console.log('Customer journey seeding completed!');

    // Show summary
    const contactCount = await prisma.contact.count({ where: { tenantId: TENANT_ID } });
    const dealCount = await prisma.deal.count({ where: { tenantId: TENANT_ID } });
    const activityCount = await prisma.activity.count({ where: { tenantId: TENANT_ID } });

    console.log('');
    console.log('Summary:');
    console.log(`  Total Contacts: ${contactCount}`);
    console.log(`  Total Deals: ${dealCount}`);
    console.log(`  Total Activities: ${activityCount}`);
  } catch (error) {
    console.error('Seed error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedCustomerJourneys();
