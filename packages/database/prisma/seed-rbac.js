import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Comprehensive RBAC Setup
 * Creates permissions, roles, and assigns them properly
 */

// Define all permissions with module-based structure
const PERMISSIONS = [
  // CRM Permissions
  { code: 'crm:contacts:read', name: 'Read Contacts', module: 'CRM', description: 'View contacts' },
  {
    code: 'crm:contacts:create',
    name: 'Create Contacts',
    module: 'CRM',
    description: 'Create contacts',
  },
  {
    code: 'crm:contacts:update',
    name: 'Update Contacts',
    module: 'CRM',
    description: 'Update contacts',
  },
  {
    code: 'crm:contacts:delete',
    name: 'Delete Contacts',
    module: 'CRM',
    description: 'Delete contacts',
  },
  {
    code: 'crm:companies:read',
    name: 'Read Companies',
    module: 'CRM',
    description: 'View companies',
  },
  {
    code: 'crm:companies:create',
    name: 'Create Companies',
    module: 'CRM',
    description: 'Create companies',
  },
  {
    code: 'crm:companies:update',
    name: 'Update Companies',
    module: 'CRM',
    description: 'Update companies',
  },
  {
    code: 'crm:companies:delete',
    name: 'Delete Companies',
    module: 'CRM',
    description: 'Delete companies',
  },
  {
    code: 'crm:activities:read',
    name: 'Read Activities',
    module: 'CRM',
    description: 'View activities',
  },
  {
    code: 'crm:activities:create',
    name: 'Create Activities',
    module: 'CRM',
    description: 'Create activities',
  },
  {
    code: 'crm:activities:update',
    name: 'Update Activities',
    module: 'CRM',
    description: 'Update activities',
  },
  {
    code: 'crm:activities:delete',
    name: 'Delete Activities',
    module: 'CRM',
    description: 'Delete activities',
  },
  { code: 'crm:segments:read', name: 'Read Segments', module: 'CRM', description: 'View segments' },
  {
    code: 'crm:segments:create',
    name: 'Create Segments',
    module: 'CRM',
    description: 'Create segments',
  },
  {
    code: 'crm:segments:update',
    name: 'Update Segments',
    module: 'CRM',
    description: 'Update segments',
  },
  {
    code: 'crm:segments:delete',
    name: 'Delete Segments',
    module: 'CRM',
    description: 'Delete segments',
  },
  { code: 'crm:*', name: 'All CRM', module: 'CRM', description: 'All CRM permissions' },

  // Pipeline/Deals Permissions
  { code: 'pipeline:deals:read', module: 'Pipeline', description: 'View deals' },
  { code: 'pipeline:deals:create', module: 'Pipeline', description: 'Create deals' },
  { code: 'pipeline:deals:update', module: 'Pipeline', description: 'Update deals' },
  { code: 'pipeline:deals:delete', module: 'Pipeline', description: 'Delete deals' },
  { code: 'pipeline:*', module: 'Pipeline', description: 'All Pipeline permissions' },

  // Inbox Permissions
  { code: 'inbox:read', module: 'Inbox', description: 'View inbox messages' },
  { code: 'inbox:reply', module: 'Inbox', description: 'Reply to messages' },
  { code: 'inbox:assign', module: 'Inbox', description: 'Assign conversations' },
  { code: 'inbox:manage', module: 'Inbox', description: 'Manage inbox settings' },
  { code: 'inbox:*', module: 'Inbox', description: 'All Inbox permissions' },

  // Tickets Permissions
  { code: 'tickets:read', module: 'Tickets', description: 'View tickets' },
  { code: 'tickets:create', module: 'Tickets', description: 'Create tickets' },
  { code: 'tickets:update', module: 'Tickets', description: 'Update tickets' },
  { code: 'tickets:delete', module: 'Tickets', description: 'Delete tickets' },
  { code: 'tickets:assign', module: 'Tickets', description: 'Assign tickets' },
  { code: 'tickets:*', module: 'Tickets', description: 'All Tickets permissions' },

  // Marketing Permissions
  { code: 'marketing:campaigns:read', module: 'Marketing', description: 'View campaigns' },
  { code: 'marketing:campaigns:create', module: 'Marketing', description: 'Create campaigns' },
  { code: 'marketing:campaigns:update', module: 'Marketing', description: 'Update campaigns' },
  { code: 'marketing:campaigns:delete', module: 'Marketing', description: 'Delete campaigns' },
  { code: 'marketing:broadcasts:send', module: 'Marketing', description: 'Send broadcasts' },
  { code: 'marketing:*', module: 'Marketing', description: 'All Marketing permissions' },

  // Analytics Permissions
  { code: 'analytics:read', module: 'Analytics', description: 'View analytics' },
  { code: 'analytics:export', module: 'Analytics', description: 'Export reports' },
  { code: 'analytics:*', module: 'Analytics', description: 'All Analytics permissions' },

  // Settings Permissions
  { code: 'settings:read', module: 'Settings', description: 'View settings' },
  { code: 'settings:update', module: 'Settings', description: 'Update settings' },
  { code: 'settings:integrations', module: 'Settings', description: 'Manage integrations' },
  { code: 'settings:*', module: 'Settings', description: 'All Settings permissions' },

  // Team & Users Permissions
  { code: 'team:read', module: 'Team', description: 'View team members' },
  { code: 'team:invite', module: 'Team', description: 'Invite team members' },
  { code: 'team:update', module: 'Team', description: 'Update team members' },
  { code: 'team:remove', module: 'Team', description: 'Remove team members' },
  { code: 'team:*', module: 'Team', description: 'All Team permissions' },

  // Billing Permissions
  { code: 'billing:read', module: 'Billing', description: 'View billing' },
  { code: 'billing:manage', module: 'Billing', description: 'Manage billing' },
  { code: 'billing:*', module: 'Billing', description: 'All Billing permissions' },

  // Full Access
  { code: '*', module: 'System', description: 'Full system access (Super Admin)' },
];

// Define roles with their permission mappings
const ROLES = [
  {
    name: 'Super Admin',
    description: 'Full access to all features and settings',
    isSystem: true,
    permissions: ['*'],
  },
  {
    name: 'Admin',
    description: 'Administrative access with most permissions',
    isSystem: true,
    permissions: [
      'crm:*',
      'pipeline:*',
      'inbox:*',
      'tickets:*',
      'marketing:*',
      'analytics:*',
      'settings:*',
      'team:*',
      'billing:*',
    ],
  },
  {
    name: 'Manager',
    description: 'Manager with team oversight capabilities',
    isSystem: true,
    permissions: [
      'crm:*',
      'pipeline:*',
      'inbox:*',
      'tickets:*',
      'analytics:read',
      'analytics:export',
      'team:read',
      'team:invite',
      'settings:read',
    ],
  },
  {
    name: 'Sales',
    description: 'Sales team member',
    isSystem: true,
    permissions: [
      'crm:contacts:read',
      'crm:contacts:create',
      'crm:contacts:update',
      'crm:companies:read',
      'crm:companies:create',
      'crm:companies:update',
      'crm:activities:read',
      'crm:activities:create',
      'crm:activities:update',
      'pipeline:deals:read',
      'pipeline:deals:create',
      'pipeline:deals:update',
      'inbox:read',
      'inbox:reply',
      'analytics:read',
    ],
  },
  {
    name: 'Support',
    description: 'Customer support team member',
    isSystem: true,
    permissions: [
      'inbox:read',
      'inbox:reply',
      'inbox:assign',
      'tickets:read',
      'tickets:create',
      'tickets:update',
      'tickets:assign',
      'crm:contacts:read',
      'crm:contacts:update',
      'crm:activities:read',
      'crm:activities:create',
      'analytics:read',
    ],
  },
  {
    name: 'Marketing',
    description: 'Marketing team member',
    isSystem: true,
    permissions: [
      'marketing:*',
      'crm:contacts:read',
      'crm:segments:read',
      'crm:segments:create',
      'crm:segments:update',
      'analytics:read',
      'analytics:export',
      'inbox:read',
    ],
  },
  {
    name: 'Member',
    description: 'Basic team member with limited access',
    isSystem: true,
    permissions: [
      'crm:contacts:read',
      'crm:companies:read',
      'crm:activities:read',
      'crm:activities:create',
      'inbox:read',
      'inbox:reply',
      'analytics:read',
    ],
  },
];

async function seedRBAC(tenantId) {
  console.log(`\n🔐 Setting up RBAC for tenant: ${tenantId}`);

  // 1. Create all permissions
  console.log('\n📝 Creating permissions...');
  const createdPermissions = [];

  for (const perm of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { code: perm.code },
      update: {
        name: perm.name || perm.description || perm.code,
        module: perm.module,
        description: perm.description,
      },
      create: {
        code: perm.code,
        name: perm.name || perm.description || perm.code,
        module: perm.module,
        description: perm.description,
      },
    });
    createdPermissions.push(permission);
    console.log(`  ✓ ${permission.code}`);
  }

  console.log(`\n✅ Created ${createdPermissions.length} permissions`);

  // 2. Create roles and assign permissions
  console.log('\n👥 Creating roles...');

  for (const roleData of ROLES) {
    // Create role
    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId, name: roleData.name } },
      update: { description: roleData.description, isSystem: roleData.isSystem },
      create: {
        tenantId,
        name: roleData.name,
        description: roleData.description,
        isSystem: roleData.isSystem,
      },
    });

    console.log(`\n  📌 Role: ${role.name}`);

    // Assign permissions to role
    for (const permCode of roleData.permissions) {
      const permission = createdPermissions.find((p) => p.code === permCode);
      if (permission) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
        console.log(`    ✓ ${permCode}`);
      }
    }
  }

  console.log('\n✅ RBAC setup completed successfully!\n');
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting RBAC Setup...\n');

    // Get all active tenants
    const tenants = await prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
    });

    console.log(`Found ${tenants.length} active tenant(s)`);

    // Setup RBAC for each tenant
    for (const tenant of tenants) {
      await seedRBAC(tenant.id);
    }

    console.log('🎉 All tenants have been configured with RBAC!');
  } catch (error) {
    console.error('❌ Error setting up RBAC:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
