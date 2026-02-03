import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

/**
 * MINIMAL SEED - Fresh Company Setup
 *
 * Creates only the essential data for a company that just:
 * 1. Purchased a plan
 * 2. Created their account
 * 3. No integrations, no data - just login ready
 *
 * Company: Helix Code
 * CRM Email: hello@helixcode.in
 * Agent: arpit.sharma@helixcode.in
 */

async function main() {
  console.log('Creating minimal seed for Helix Code...\n')

  // ==================== 1. TENANT (Company) ====================
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'helix-code' },
    update: {},
    create: {
      name: 'Helix Code',
      slug: 'helix-code',
      domain: 'helixcode.in',
      email: 'hello@helixcode.in',
      phone: '+91 9876543210',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      locale: 'en-IN',
      industry: 'Technology',
      size: '1-10',
      status: 'ACTIVE',
      settings: {
        branding: {
          primaryColor: '#6366f1',
          logoUrl: null
        },
        features: {
          inbox: true,
          crm: true,
          pipeline: false,  // Not activated yet
          tickets: false,   // Not activated yet
          automation: false // Not activated yet
        }
      },
    },
  })
  console.log('✓ Created tenant:', tenant.name)

  // ==================== 2. DEFAULT WORKSPACE ====================
  const workspace = await prisma.workspace.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: 'Default Workspace' }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Default Workspace',
      description: 'Main workspace for Helix Code',
      isDefault: true,
      status: 'ACTIVE',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
    },
  })
  console.log('✓ Created workspace:', workspace.name)

  // ==================== 3. ADMIN USER ====================
  const passwordHash = await bcrypt.hash('demo123456', 12)

  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: { tenantId: tenant.id, email: 'arpit.sharma@helixcode.in' }
    },
    update: { passwordHash },
    create: {
      tenantId: tenant.id,
      email: 'arpit.sharma@helixcode.in',
      firstName: 'Arpit',
      lastName: 'Sharma',
      displayName: 'Arpit Sharma',
      phone: '+91 9876543210',
      passwordHash,
      emailVerified: true,
      status: 'ACTIVE',
      settings: {
        preferences: {
          theme: 'light',
          language: 'en',
          timezone: 'Asia/Kolkata'
        },
        notifications: {
          email: true,
          push: true,
          inApp: true
        }
      },
    },
  })
  console.log('✓ Created admin user:', adminUser.email)

  // Link user to workspace
  await prisma.userWorkspace.upsert({
    where: {
      userId_workspaceId: { userId: adminUser.id, workspaceId: workspace.id }
    },
    update: {},
    create: {
      userId: adminUser.id,
      workspaceId: workspace.id
    },
  })
  console.log('✓ Linked user to workspace')

  // ==================== 4. BASIC ROLE (Admin) ====================
  const adminRole = await prisma.role.upsert({
    where: {
      tenantId_name: { tenantId: tenant.id, name: 'Admin' }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Admin',
      description: 'Full access to all features',
      isSystem: true,
    },
  })
  console.log('✓ Created admin role')

  // Link user to role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: { userId: adminUser.id, roleId: adminRole.id }
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id
    },
  })
  console.log('✓ Assigned admin role to user')

  // ==================== 5. SAMPLE TAGS (for later use) ====================
  const tags = ['VIP', 'Hot Lead', 'Follow Up', 'New']
  for (const tagName of tags) {
    await prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: tagName } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: tagName,
        color: tagName === 'VIP' ? '#f59e0b' :
               tagName === 'Hot Lead' ? '#ef4444' :
               tagName === 'Follow Up' ? '#3b82f6' : '#22c55e',
      },
    })
  }
  console.log('✓ Created default tags')

  // ==================== DONE ====================
  console.log('\n========================================')
  console.log('MINIMAL SEED COMPLETE')
  console.log('========================================')
  console.log('')
  console.log('Company:', tenant.name)
  console.log('Domain:', tenant.domain)
  console.log('CRM Email:', tenant.email)
  console.log('')
  console.log('Login Credentials:')
  console.log('  Email:', adminUser.email)
  console.log('  Password: demo123456')
  console.log('')
  console.log('Status:')
  console.log('  - No channels connected (WhatsApp/Email/SMS)')
  console.log('  - No contacts imported')
  console.log('  - No integrations')
  console.log('  - Ready to start fresh!')
  console.log('========================================\n')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
