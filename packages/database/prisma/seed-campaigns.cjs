/**
 * Marketing Campaigns Seed Data
 * Seeds realistic marketing campaigns for testing
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const campaigns = [
  {
    name: 'Q1 2026 Product Launch',
    description: 'Multi-channel campaign to announce our new product features and drive adoption',
    type: 'PROMOTIONAL',
    status: 'ACTIVE',
    channels: ['EMAIL', 'WHATSAPP'],
    goal: 'Increase product adoption by 25%',
    targetAudience: 'ALL_CONTACTS',
    startDate: new Date('2026-01-15'),
    endDate: new Date('2026-03-31'),
    timezone: 'UTC',
    budget: 15000,
    actualCost: 8500,
    totalRecipients: 2500,
    sentCount: 2450,
    deliveredCount: 2380,
    openedCount: 1420,
    clickedCount: 680,
    convertedCount: 145,
    tags: ['product-launch', 'q1-2026', 'high-priority'],
  },
  {
    name: 'Customer Onboarding Sequence',
    description: 'Automated welcome sequence for new customers',
    type: 'ONBOARDING',
    status: 'ACTIVE',
    channels: ['EMAIL'],
    goal: 'Improve 30-day retention to 85%',
    targetAudience: 'SEGMENT',
    startDate: new Date('2026-01-01'),
    timezone: 'UTC',
    budget: 5000,
    actualCost: 2200,
    totalRecipients: 850,
    sentCount: 850,
    deliveredCount: 842,
    openedCount: 720,
    clickedCount: 450,
    convertedCount: 380,
    tags: ['onboarding', 'automated', 'evergreen'],
  },
  {
    name: 'Summer Sale 2026',
    description: 'Seasonal promotional campaign with exclusive discounts',
    type: 'PROMOTIONAL',
    status: 'DRAFT',
    channels: ['EMAIL', 'SMS', 'WHATSAPP'],
    goal: 'Generate $50,000 in additional revenue',
    targetAudience: 'ALL_CONTACTS',
    startDate: new Date('2026-06-01'),
    endDate: new Date('2026-08-31'),
    timezone: 'UTC',
    budget: 25000,
    tags: ['seasonal', 'summer-2026', 'sales'],
  },
  {
    name: 'Re-engagement Campaign',
    description: 'Win back inactive customers with personalized offers',
    type: 'REENGAGEMENT',
    status: 'ACTIVE',
    channels: ['EMAIL', 'WHATSAPP'],
    goal: 'Reactivate 20% of dormant users',
    targetAudience: 'SEGMENT',
    startDate: new Date('2026-01-20'),
    endDate: new Date('2026-04-30'),
    timezone: 'UTC',
    budget: 8000,
    actualCost: 3500,
    totalRecipients: 1200,
    sentCount: 1180,
    deliveredCount: 1150,
    openedCount: 580,
    clickedCount: 220,
    convertedCount: 85,
    tags: ['reengagement', 'win-back', 'personalized'],
  },
  {
    name: 'Newsletter - February 2026',
    description: 'Monthly newsletter with product updates and industry insights',
    type: 'BROADCAST',
    status: 'COMPLETED',
    channels: ['EMAIL'],
    goal: 'Maintain engagement with existing customers',
    targetAudience: 'ALL_CONTACTS',
    startDate: new Date('2026-02-01'),
    endDate: new Date('2026-02-01'),
    timezone: 'UTC',
    budget: 500,
    actualCost: 450,
    totalRecipients: 3200,
    sentCount: 3200,
    deliveredCount: 3150,
    openedCount: 1580,
    clickedCount: 420,
    convertedCount: 35,
    tags: ['newsletter', 'monthly', 'february-2026'],
  },
  {
    name: 'Enterprise Nurture Program',
    description: 'Long-term nurture campaign for enterprise prospects',
    type: 'NURTURE',
    status: 'ACTIVE',
    channels: ['EMAIL'],
    goal: 'Convert 15% of enterprise leads to opportunities',
    targetAudience: 'SEGMENT',
    startDate: new Date('2025-10-01'),
    timezone: 'UTC',
    budget: 12000,
    actualCost: 6800,
    totalRecipients: 450,
    sentCount: 2250,
    deliveredCount: 2200,
    openedCount: 1540,
    clickedCount: 680,
    convertedCount: 52,
    tags: ['enterprise', 'nurture', 'long-term'],
  },
  {
    name: 'Webinar Registration Drive',
    description: 'Promote upcoming product demo webinar',
    type: 'EVENT',
    status: 'SCHEDULED',
    channels: ['EMAIL', 'WHATSAPP'],
    goal: '500 webinar registrations',
    targetAudience: 'ALL_CONTACTS',
    startDate: new Date('2026-02-15'),
    endDate: new Date('2026-02-28'),
    timezone: 'UTC',
    budget: 3000,
    tags: ['webinar', 'event', 'registration'],
  },
  {
    name: 'Holiday Promotion 2025',
    description: 'End of year holiday sales campaign',
    type: 'PROMOTIONAL',
    status: 'COMPLETED',
    channels: ['EMAIL', 'SMS'],
    goal: 'Achieve $100,000 in holiday sales',
    targetAudience: 'ALL_CONTACTS',
    startDate: new Date('2025-12-15'),
    endDate: new Date('2025-12-31'),
    timezone: 'UTC',
    budget: 20000,
    actualCost: 18500,
    totalRecipients: 5000,
    sentCount: 4950,
    deliveredCount: 4850,
    openedCount: 2425,
    clickedCount: 1200,
    convertedCount: 380,
    attributedRevenue: 125000,
    tags: ['holiday', '2025', 'sales', 'completed'],
  },
  {
    name: 'Feature Announcement - AI Assistant',
    description: 'Announce new AI-powered features to existing customers',
    type: 'BROADCAST',
    status: 'PAUSED',
    channels: ['EMAIL', 'WHATSAPP'],
    goal: 'Drive AI feature adoption',
    targetAudience: 'ALL_CONTACTS',
    startDate: new Date('2026-01-25'),
    endDate: new Date('2026-02-15'),
    timezone: 'UTC',
    budget: 4000,
    actualCost: 1500,
    totalRecipients: 2800,
    sentCount: 1400,
    deliveredCount: 1380,
    openedCount: 920,
    clickedCount: 380,
    tags: ['feature', 'ai', 'announcement'],
  },
  {
    name: 'Partner Referral Program',
    description: 'Campaign to promote partner referral incentives',
    type: 'CUSTOM',
    status: 'ACTIVE',
    channels: ['EMAIL'],
    goal: 'Generate 100 new partner referrals',
    targetAudience: 'SEGMENT',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-06-30'),
    timezone: 'UTC',
    budget: 10000,
    actualCost: 4200,
    totalRecipients: 320,
    sentCount: 640,
    deliveredCount: 635,
    openedCount: 480,
    clickedCount: 210,
    convertedCount: 45,
    tags: ['partner', 'referral', 'b2b'],
  },
];

async function seedCampaigns() {
  // Get the first tenant to use as default
  const tenant = await prisma.tenant.findFirst({
    where: { status: 'ACTIVE' },
  });

  if (!tenant) {
    console.error('No active tenant found. Please seed tenants first.');
    process.exit(1);
  }

  // Get the first user as creator
  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id },
  });

  if (!user) {
    console.error('No user found for tenant. Please seed users first.');
    process.exit(1);
  }

  console.log(`\n🚀 Seeding campaigns for tenant: ${tenant.name}`);

  let created = 0;
  let updated = 0;

  for (const campaign of campaigns) {
    const existing = await prisma.marketing_campaigns.findFirst({
      where: { tenantId: tenant.id, name: campaign.name },
    });

    if (existing) {
      await prisma.marketing_campaigns.update({
        where: { id: existing.id },
        data: {
          ...campaign,
          tenantId: tenant.id,
          createdById: user.id,
        },
      });
      updated++;
    } else {
      await prisma.marketing_campaigns.create({
        data: {
          ...campaign,
          tenantId: tenant.id,
          createdById: user.id,
        },
      });
      created++;
    }
  }

  console.log(`✅ Campaigns seeded: ${created} created, ${updated} updated`);

  // Show stats
  const stats = await prisma.marketing_campaigns.groupBy({
    by: ['status'],
    where: { tenantId: tenant.id },
    _count: { status: true },
  });

  console.log('\n📊 Campaign stats:');
  stats.forEach(({ status, _count }) => {
    console.log(`   ${status}: ${_count.status}`);
  });
}

seedCampaigns()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
