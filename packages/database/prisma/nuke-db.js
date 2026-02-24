/**
 * NUKE DB — Deletes ALL data from ALL tables in the local database.
 * Then re-seeds the essential admin tenant + user so the app can boot.
 *
 * Usage: node nexora-api/packages/database/prisma/nuke-db.js
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function nukeAllData() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   NUKING ALL DATA FROM LOCAL DATABASE    ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // Get all table names from the public schema (excluding Prisma migrations)
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename != '_prisma_migrations'
    ORDER BY tablename;
  `;

  const tableNames = tables.map((t) => t.tablename);
  console.log(`Found ${tableNames.length} tables to truncate:\n`);

  // Group for display
  for (let i = 0; i < tableNames.length; i += 5) {
    const group = tableNames
      .slice(i, i + 5)
      .map((n) => n.padEnd(30))
      .join(' ');
    console.log(`  ${group}`);
  }
  console.log('');

  // TRUNCATE ALL with CASCADE — handles FK constraints automatically
  const truncateSQL = tableNames.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${truncateSQL} CASCADE;`);

  console.log(`✅ Truncated ${tableNames.length} tables\n`);
  return tableNames.length;
}

async function seedEssentials() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   RE-SEEDING ESSENTIAL DATA              ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // 1. Platform tenant (Nexora Platform itself)
  const platformTenant = await prisma.tenant.create({
    data: {
      name: 'Nexora CRM Platform',
      slug: 'nexora-platform',
      domain: 'nexora.app',
      email: 'adminio@72orionx.com',
      phone: '+91 9876543210',
      timezone: 'Asia/Kolkata',
      currency: 'USD',
      locale: 'en-US',
      industry: 'Technology',
      size: '10-50',
      status: 'ACTIVE',
      settings: {
        branding: { primaryColor: '#6366f1' },
        isPlatformAdmin: true,
      },
    },
  });
  console.log(`  ✅ Platform tenant: ${platformTenant.name} (${platformTenant.id})`);

  // 2. Customer tenant (Helix Code — the one you log into)
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Helix Code Inc.',
      slug: 'helix-code',
      domain: '72orionx.com',
      email: 'hello@72orionx.com',
      phone: '+91 9876543210',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      locale: 'en-IN',
      industry: 'Technology',
      size: '10-50',
      status: 'ACTIVE',
      settings: {
        branding: { primaryColor: '#6366f1' },
      },
    },
  });
  console.log(`  ✅ Customer tenant: ${tenant.name} (${tenant.id})`);

  // 3. Workspaces
  const platformWorkspace = await prisma.workspace.create({
    data: {
      tenantId: platformTenant.id,
      name: 'Platform Workspace',
      isDefault: true,
      status: 'ACTIVE',
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      tenantId: tenant.id,
      name: 'Main Workspace',
      isDefault: true,
      status: 'ACTIVE',
    },
  });
  console.log(`  ✅ Workspaces created`);

  // 4. Admin user (the one you log in with)
  const passwordHash = await bcrypt.hash('Helixcodeinc@2005', 12);
  const adminUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: 'adminio@72orionx.com',
      firstName: 'Super',
      lastName: 'Admin',
      displayName: 'Platform Admin',
      phone: '+91 9876543210',
      passwordHash,
      emailVerified: true,
      status: 'ACTIVE',
      settings: {
        preferences: { theme: 'system', language: 'en' },
        isPlatformSuperAdmin: true,
      },
    },
  });
  console.log(`  ✅ Admin user: ${adminUser.email}`);

  // 5. Link user to workspace
  await prisma.userWorkspace.create({
    data: { userId: adminUser.id, workspaceId: workspace.id },
  });

  // Also link to platform workspace
  const platformAdmin = await prisma.user.create({
    data: {
      tenantId: platformTenant.id,
      email: 'adminio@72orionx.com',
      firstName: 'Super',
      lastName: 'Admin',
      displayName: 'Platform Admin',
      phone: '+91 9876543210',
      passwordHash,
      emailVerified: true,
      status: 'ACTIVE',
      settings: {
        preferences: { theme: 'system', language: 'en' },
        isPlatformSuperAdmin: true,
      },
    },
  });
  await prisma.userWorkspace.create({
    data: { userId: platformAdmin.id, workspaceId: platformWorkspace.id },
  });
  console.log(`  ✅ User-workspace links created`);

  // 6. Roles + permissions
  const adminRole = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: 'Admin',
      description: 'Full access with all permissions',
      isSystem: true,
    },
  });

  const platformAdminRole = await prisma.role.create({
    data: {
      tenantId: platformTenant.id,
      name: 'Platform Admin',
      description: 'Full platform access with all permissions',
      isSystem: true,
    },
  });

  // Core permissions
  const permissionCodes = [
    { code: '*', name: 'Full Access', module: 'system' },
    { code: 'crm:contacts:read', name: 'View Contacts', module: 'crm' },
    { code: 'crm:contacts:create', name: 'Create Contacts', module: 'crm' },
    { code: 'crm:contacts:update', name: 'Update Contacts', module: 'crm' },
    { code: 'crm:contacts:delete', name: 'Delete Contacts', module: 'crm' },
    { code: 'crm:companies:read', name: 'View Companies', module: 'crm' },
    { code: 'crm:companies:create', name: 'Create Companies', module: 'crm' },
    { code: 'crm:companies:update', name: 'Update Companies', module: 'crm' },
    { code: 'crm:companies:delete', name: 'Delete Companies', module: 'crm' },
    { code: 'crm:activities:read', name: 'View Activities', module: 'crm' },
    { code: 'crm:activities:create', name: 'Create Activities', module: 'crm' },
    { code: 'pipeline:deals:read', name: 'View Deals', module: 'pipeline' },
    { code: 'pipeline:deals:create', name: 'Create Deals', module: 'pipeline' },
    { code: 'pipeline:deals:update', name: 'Update Deals', module: 'pipeline' },
    { code: 'pipeline:deals:delete', name: 'Delete Deals', module: 'pipeline' },
    { code: 'tickets:read', name: 'View Tickets', module: 'tickets' },
    { code: 'tickets:create', name: 'Create Tickets', module: 'tickets' },
    { code: 'tickets:update', name: 'Update Tickets', module: 'tickets' },
    { code: 'projects:read', name: 'View Projects', module: 'projects' },
    { code: 'projects:create', name: 'Create Projects', module: 'projects' },
    { code: 'tasks:read', name: 'View Tasks', module: 'tasks' },
    { code: 'tasks:create', name: 'Create Tasks', module: 'tasks' },
    { code: 'calendar:read', name: 'View Calendar', module: 'calendar' },
    { code: 'calendar:create', name: 'Create Events', module: 'calendar' },
    { code: 'inbox:read', name: 'View Inbox', module: 'inbox' },
    { code: 'inbox:send', name: 'Send Messages', module: 'inbox' },
    { code: 'settings:read', name: 'View Settings', module: 'settings' },
    { code: 'settings:update', name: 'Update Settings', module: 'settings' },
    { code: 'analytics:read', name: 'View Analytics', module: 'analytics' },
    { code: 'marketing:campaigns:read', name: 'View Campaigns', module: 'marketing' },
    { code: 'marketing:campaigns:create', name: 'Create Campaigns', module: 'marketing' },
  ];

  for (const p of permissionCodes) {
    const permission = await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: { code: p.code, name: p.name, module: p.module },
    });

    // Link to admin role
    await prisma.rolePermission
      .create({
        data: { roleId: adminRole.id, permissionId: permission.id },
      })
      .catch(() => {}); // ignore duplicates
  }
  console.log(`  ✅ ${permissionCodes.length} permissions + admin role created`);

  // Link admin user to admin role
  await prisma.userRole.create({
    data: { userId: adminUser.id, roleId: adminRole.id },
  });
  await prisma.userRole.create({
    data: { userId: platformAdmin.id, roleId: platformAdminRole.id },
  });
  console.log(`  ✅ User-role links created`);

  // 7. Default pipeline + stages (so Sales hub works)
  const pipeline = await prisma.pipeline.create({
    data: {
      tenantId: tenant.id,
      name: 'Sales Pipeline',
      type: 'DEAL',
      isDefault: true,
    },
  });

  const stages = [
    'Discovery',
    'Qualification',
    'Proposal',
    'Negotiation',
    'Closed Won',
    'Closed Lost',
  ];
  for (let i = 0; i < stages.length; i++) {
    await prisma.stage.create({
      data: {
        pipelineId: pipeline.id,
        tenantId: tenant.id,
        name: stages[i],
        order: i,
        probability: i === 4 ? 100 : i === 5 ? 0 : (i + 1) * 20,
        color: ['#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#6B7280'][i],
      },
    });
  }
  console.log(`  ✅ Default pipeline + ${stages.length} stages created`);

  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   DATABASE CLEAN & READY                 ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Login: adminio@72orionx.com              ║`);
  console.log(`║  Pass:  Helixcodeinc@2005                 ║`);
  console.log(`║  Tenant: Helix Code Inc.                  ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
}

async function main() {
  try {
    await nukeAllData();
    await seedEssentials();
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
