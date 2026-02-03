import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding email credit plans...\n');

  const emailPlansData = [
    {
      name: 'Starter',
      slug: 'starter',
      emails: 5000,
      priceInr: 29900, // ₹299
      priceUsd: 399, // $3.99
      pricePerEmail: 0.06,
      description: 'Perfect for small businesses getting started with email marketing',
      features: ['5,000 emails', 'Basic templates', 'Email support', '30-day validity'],
      isPopular: false,
      sortOrder: 1,
      isActive: true,
    },
    {
      name: 'Growth',
      slug: 'growth',
      emails: 25000,
      priceInr: 79900, // ₹799
      priceUsd: 999, // $9.99
      pricePerEmail: 0.032,
      description: 'Ideal for growing businesses with regular campaigns',
      features: [
        '25,000 emails',
        'All templates',
        'Priority support',
        'Analytics dashboard',
        '60-day validity',
      ],
      isPopular: true,
      sortOrder: 2,
      isActive: true,
    },
    {
      name: 'Pro',
      slug: 'pro',
      emails: 100000,
      priceInr: 199900, // ₹1,999
      priceUsd: 2499, // $24.99
      pricePerEmail: 0.02,
      description: 'For businesses with high-volume email needs',
      features: [
        '100,000 emails',
        'Custom templates',
        'API access',
        'Dedicated support',
        'Advanced analytics',
        '90-day validity',
      ],
      isPopular: false,
      sortOrder: 3,
      isActive: true,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      emails: 500000,
      priceInr: 499900, // ₹4,999
      priceUsd: 5999, // $59.99
      pricePerEmail: 0.01,
      description: 'Enterprise-grade solution for large organizations',
      features: [
        '500,000 emails',
        'White-label sending',
        'Custom domain',
        'SLA guarantee',
        'Account manager',
        '1-year validity',
      ],
      isPopular: false,
      sortOrder: 4,
      isActive: true,
    },
  ];

  console.log('Creating email credit plans:\n');

  for (const plan of emailPlansData) {
    const result = await prisma.emailCreditPlan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        emails: plan.emails,
        priceInr: plan.priceInr,
        priceUsd: plan.priceUsd,
        pricePerEmail: plan.pricePerEmail,
        description: plan.description,
        features: plan.features,
        isPopular: plan.isPopular,
        sortOrder: plan.sortOrder,
        isActive: plan.isActive,
      },
      create: plan,
    });

    const priceInrFormatted = (result.priceInr / 100).toLocaleString('en-IN');
    const priceUsdFormatted = (result.priceUsd / 100).toFixed(2);
    console.log(
      `  ${result.name.padEnd(12)} - ${result.emails.toLocaleString().padStart(7)} emails @ Rs.${priceInrFormatted} / $${priceUsdFormatted}`
    );
  }

  console.log('\nEmail credit plans seeded successfully!');
  console.log('\nPricing summary:');
  console.log('  - Starter:    Rs.0.06/email ($0.08/email)');
  console.log('  - Growth:     Rs.0.032/email ($0.04/email) - Best for growing teams');
  console.log('  - Pro:        Rs.0.02/email ($0.025/email) - High volume');
  console.log('  - Enterprise: Rs.0.01/email ($0.012/email) - Bulk pricing');
}

main()
  .catch((e) => {
    console.error('Error seeding email plans:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
