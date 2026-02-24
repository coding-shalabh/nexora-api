/**
 * Storage Quota Testing Seed Script
 *
 * Creates multiple tenants with different plans and tests storage usage tracking
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Helper to format bytes
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Helper to generate random storage usage
function generateRandomUsage(maxBytes) {
  // Use 20-80% of max limit to simulate realistic usage
  const minPercent = 0.2;
  const maxPercent = 0.8;
  const percent = minPercent + Math.random() * (maxPercent - minPercent);
  return Math.floor(maxBytes * percent);
}

async function main() {
  console.log('🌱 Starting storage quota test seed...\n');

  // Clean up existing test data
  console.log('🧹 Cleaning up existing test data...');

  // Get existing test tenants
  const existingTenants = await prisma.tenant.findMany({
    where: {
      slug: {
        in: [
          'acme-corp-free',
          'techstart-inc-starter',
          'probiz-ltd-professional',
          'enterprise-global-enterprise',
        ],
      },
    },
    select: { id: true },
  });

  const tenantIds = existingTenants.map((t) => t.id);

  if (tenantIds.length > 0) {
    // Delete related data in correct order
    await prisma.contact.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.subscription.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  }

  // Delete test plans
  await prisma.plan.deleteMany({
    where: {
      name: {
        in: ['free', 'starter', 'professional', 'enterprise'],
      },
    },
  });

  console.log('✅ Cleanup completed\n');

  // Create subscription plans with storage limits
  console.log('📦 Creating subscription plans...');

  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { name: 'free' },
      update: {
        storageGb: 1,
        monthlyPrice: 0,
        yearlyPrice: 0,
      },
      create: {
        id: crypto.randomUUID(),
        name: 'free',
        displayName: 'Free Plan',
        description: 'Perfect for getting started',
        monthlyPrice: 0,
        yearlyPrice: 0,
        currency: 'INR',
        maxUsers: 1,
        maxContacts: 100,
        maxEmailsPerDay: 50,
        storageGb: 1,
        features: {
          contacts: 100,
          users: 1,
          storage: '1GB',
          support: 'Community',
          automation: false,
          whatsapp: false,
          voice: false,
        },
        modules: {
          crm: true,
          inbox: true,
          marketing: false,
          sales: false,
          automation: false,
        },
      },
    }),
    prisma.plan.upsert({
      where: { name: 'starter' },
      update: {
        storageGb: 10,
        monthlyPrice: 29,
        yearlyPrice: 290,
      },
      create: {
        id: crypto.randomUUID(),
        name: 'starter',
        displayName: 'Starter Plan',
        description: 'For small teams and businesses',
        monthlyPrice: 29,
        yearlyPrice: 290,
        currency: 'INR',
        maxUsers: 5,
        maxContacts: 1000,
        maxEmailsPerDay: 500,
        maxSmsPerDay: 100,
        maxWhatsAppPerDay: 100,
        storageGb: 10,
        features: {
          contacts: 1000,
          users: 5,
          storage: '10GB',
          support: 'Email',
          automation: true,
          whatsapp: true,
          voice: false,
        },
        modules: {
          crm: true,
          inbox: true,
          marketing: true,
          sales: true,
          automation: true,
        },
      },
    }),
    prisma.plan.upsert({
      where: { name: 'professional' },
      update: {
        storageGb: 50,
        monthlyPrice: 99,
        yearlyPrice: 990,
      },
      create: {
        id: crypto.randomUUID(),
        name: 'professional',
        displayName: 'Professional Plan',
        description: 'For growing businesses',
        monthlyPrice: 99,
        yearlyPrice: 990,
        currency: 'INR',
        maxUsers: 20,
        maxContacts: 10000,
        maxEmailsPerDay: 5000,
        maxSmsPerDay: 1000,
        maxWhatsAppPerDay: 1000,
        storageGb: 50,
        features: {
          contacts: 10000,
          users: 20,
          storage: '50GB',
          support: 'Priority',
          automation: true,
          whatsapp: true,
          voice: true,
        },
        modules: {
          crm: true,
          inbox: true,
          marketing: true,
          sales: true,
          automation: true,
          analytics: true,
        },
      },
    }),
    prisma.plan.upsert({
      where: { name: 'enterprise' },
      update: {
        storageGb: 250,
        monthlyPrice: 299,
        yearlyPrice: 2990,
      },
      create: {
        id: crypto.randomUUID(),
        name: 'enterprise',
        displayName: 'Enterprise Plan',
        description: 'For large organizations',
        monthlyPrice: 299,
        yearlyPrice: 2990,
        currency: 'INR',
        maxUsers: 50,
        maxContacts: null, // unlimited
        maxEmailsPerDay: 50000,
        maxSmsPerDay: 10000,
        maxWhatsAppPerDay: 10000,
        storageGb: 250,
        features: {
          contacts: 'unlimited',
          users: 50,
          storage: '250GB',
          support: '24/7',
          automation: true,
          whatsapp: true,
          voice: true,
          customBranding: true,
        },
        modules: {
          crm: true,
          inbox: true,
          marketing: true,
          sales: true,
          automation: true,
          analytics: true,
          hr: true,
          finance: true,
        },
      },
    }),
  ]);

  console.log('✅ Created 4 subscription plans\n');

  // Create test tenants with different plans
  console.log('🏢 Creating test tenants...\n');

  const tenantData = [
    {
      name: 'Acme Corp (Free)',
      plan: plans[0],
      storageLimit: 1 * 1024 * 1024 * 1024, // 1GB
      userEmail: 'admin@acmecorp.com',
    },
    {
      name: 'TechStart Inc (Starter)',
      plan: plans[1],
      storageLimit: 10 * 1024 * 1024 * 1024, // 10GB
      userEmail: 'admin@techstart.com',
    },
    {
      name: 'ProBiz Ltd (Professional)',
      plan: plans[2],
      storageLimit: 50 * 1024 * 1024 * 1024, // 50GB
      userEmail: 'admin@probiz.com',
    },
    {
      name: 'Enterprise Global (Enterprise)',
      plan: plans[3],
      storageLimit: 250 * 1024 * 1024 * 1024, // 250GB
      userEmail: 'admin@entglobal.com',
    },
  ];

  const createdTenants = [];

  for (const data of tenantData) {
    // Generate realistic storage usage (20-80% of limit)
    const storageUsed = generateRandomUsage(data.storageLimit);

    // Generate unique slug
    const slug = data.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .substring(0, 50);

    // Create tenant
    const tenant = await prisma.tenant.create({
      data: {
        id: crypto.randomUUID(),
        name: data.name,
        slug,
        domain: data.name.toLowerCase().replace(/\s+/g, '') + '.com',
        storageUsed: BigInt(storageUsed),
        settings: {
          timezone: 'UTC',
          currency: 'USD',
          dateFormat: 'MM/DD/YYYY',
        },
      },
    });

    // Create subscription
    const subscription = await prisma.subscription.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: tenant.id,
        planId: data.plan.id,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        seats: 1,
      },
    });

    // Create admin user
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: data.userEmail,
        firstName: 'Admin',
        lastName: 'User',
        displayName: 'Admin User',
        passwordHash: '$2a$10$YourHashedPasswordHere', // placeholder - bcrypt hash
        emailVerified: true,
        tenantId: tenant.id,
        status: 'ACTIVE',
      },
    });

    createdTenants.push({
      tenant,
      subscription,
      plan: data.plan,
      storageLimit: data.storageLimit,
      user,
    });

    const percentUsed = ((Number(storageUsed) / data.storageLimit) * 100).toFixed(1);

    console.log(`✅ Created: ${data.name}`);
    console.log(`   Plan: ${data.plan.displayName} (${data.plan.storageGb}GB limit)`);
    console.log(`   Admin: ${data.userEmail}`);
    console.log(
      `   Storage Used: ${formatBytes(Number(storageUsed))} / ${formatBytes(data.storageLimit)} (${percentUsed}%)`
    );
    console.log('');
  }

  // Display storage statistics summary
  console.log('\n📊 STORAGE USAGE SUMMARY\n');
  console.log(
    '┌─────────────────────────────┬──────────────┬──────────────┬──────────────┬──────────┐'
  );
  console.log(
    '│ Tenant                      │ Plan         │ Used         │ Limit        │ %Used    │'
  );
  console.log(
    '├─────────────────────────────┼──────────────┼──────────────┼──────────────┼──────────┤'
  );

  for (const { tenant, plan, storageLimit } of createdTenants) {
    const used = Number(tenant.storageUsed);
    const percentUsed = ((used / storageLimit) * 100).toFixed(1);
    const warning = percentUsed >= 80 ? ' ⚠️' : '';

    console.log(
      `│ ${tenant.name.padEnd(27)} │ ${plan.name.padEnd(12)} │ ${formatBytes(used).padEnd(12)} │ ${formatBytes(storageLimit).padEnd(12)} │ ${(percentUsed + '%').padEnd(8)}${warning} │`
    );
  }

  console.log(
    '└─────────────────────────────┴──────────────┴──────────────┴──────────────┴──────────┘'
  );

  // Test storage quota function simulation
  console.log('\n🧪 STORAGE QUOTA CHECKS\n');

  for (const { tenant, plan, storageLimit } of createdTenants) {
    const used = Number(tenant.storageUsed);
    const remaining = storageLimit - used;
    const testFileSize = 50 * 1024 * 1024; // 50MB test file
    const canUpload = used + testFileSize <= storageLimit;

    console.log(`${tenant.name}:`);
    console.log(`  Current: ${formatBytes(used)} / ${formatBytes(storageLimit)}`);
    console.log(`  Remaining: ${formatBytes(remaining)}`);
    console.log(`  Can upload 50MB file? ${canUpload ? '✅ Yes' : '❌ No (would exceed quota)'}`);
    console.log('');
  }

  // Create some sample contacts and activities to simulate realistic data
  console.log('📇 Creating sample contacts for each tenant...\n');

  for (const { tenant } of createdTenants) {
    // Create 5 contacts per tenant
    const contacts = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        prisma.contact.create({
          data: {
            id: crypto.randomUUID(),
            tenantId: tenant.id,
            email: `contact${i + 1}@${tenant.domain}.com`,
            firstName: `Contact`,
            lastName: `${i + 1}`,
            phone: `+1-555-${String(i).padStart(4, '0')}`,
            source: 'MANUAL',
          },
        })
      )
    );

    console.log(`  ✅ Created ${contacts.length} contacts for ${tenant.name}`);
  }

  console.log('\n✨ Seed completed successfully!\n');
  console.log('📌 Next Steps:');
  console.log('  1. Test file uploads via API endpoints');
  console.log('  2. Verify storage quota enforcement');
  console.log('  3. Check GET /api/v1/tenant/storage/stats endpoint');
  console.log('  4. Try uploading files that exceed quota limits\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
