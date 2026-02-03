import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Fix Railway tenant mismatch:
 * Railway API returns tenant cmk76mz0w00021230zcfawvtw and user cmk7ya1ul00013xqdjhu66lx3
 * But these don't exist in the database. We need to create them.
 */

async function main() {
  const tenantId = 'cmk76mz0w00021230zcfawvtw';
  const userId = 'cmk7ya1ul00013xqdjhu66lx3';
  const workspaceId = 'cmk7ur80s0002noe46dip69wb';

  console.log('Creating missing tenant and user for Railway...\n');

  // 1. Create the tenant
  try {
    await prisma.$executeRaw`
      INSERT INTO tenants (id, name, slug, status, "createdAt", "updatedAt")
      VALUES (${tenantId}, 'Railway Demo Tenant', 'railway-demo', 'ACTIVE'::"TenantStatus", NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET "updatedAt" = NOW()
    `;
    console.log('✓ Tenant created/updated:', tenantId);
  } catch (e) {
    console.log('Tenant error:', e.message);
  }

  // 2. Create workspace
  try {
    await prisma.$executeRaw`
      INSERT INTO workspaces (id, "tenantId", name, "isDefault", "createdAt", "updatedAt")
      VALUES (${workspaceId}, ${tenantId}, 'Default Workspace', true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET "updatedAt" = NOW()
    `;
    console.log('✓ Workspace created/updated:', workspaceId);
  } catch (e) {
    console.log('Workspace error:', e.message);
  }

  // 3. Create the user with known credentials
  const pwdHash = await bcrypt.hash('Demo123456', 12);
  try {
    await prisma.$executeRaw`
      INSERT INTO users (id, "tenantId", email, "firstName", "lastName", "passwordHash", status, "emailVerified", "createdAt", "updatedAt")
      VALUES (${userId}, ${tenantId}, 'arpit.sharma@helixcode.in', 'Arpit', 'Sharma', ${pwdHash}, 'ACTIVE'::"UserStatus", true, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET
        "passwordHash" = ${pwdHash},
        "emailVerified" = true,
        status = 'ACTIVE'::"UserStatus",
        "updatedAt" = NOW()
    `;
    console.log('✓ User created/updated:', userId);
  } catch (e) {
    console.log('User error:', e.message);
  }

  // 4. Create user-workspace mapping
  try {
    await prisma.$executeRaw`
      INSERT INTO user_workspaces ("userId", "workspaceId", "joinedAt")
      VALUES (${userId}, ${workspaceId}, NOW())
      ON CONFLICT DO NOTHING
    `;
    console.log('✓ User-workspace mapping created');
  } catch (e) {
    console.log('User-workspace error:', e.message);
  }

  // 5. Create a role and assign to user
  try {
    const roleId = `role-${tenantId}-admin`;
    await prisma.$executeRaw`
      INSERT INTO roles (id, "tenantId", name, description, permissions, "isSystem", "createdAt", "updatedAt")
      VALUES (${roleId}, ${tenantId}, 'Admin', 'Administrator role', '["*"]'::jsonb, true, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING
    `;
    await prisma.$executeRaw`
      INSERT INTO user_roles ("userId", "roleId", "assignedAt")
      VALUES (${userId}, ${roleId}, NOW())
      ON CONFLICT DO NOTHING
    `;
    console.log('✓ Role and user-role mapping created');
  } catch (e) {
    console.log('Role error:', e.message);
  }

  console.log('\n✓ Railway tenant setup complete!');
  console.log('\nNow seeding templates to this tenant...\n');

  // 6. Seed templates to the new tenant
  await seedTemplates(tenantId);
}

async function seedTemplates(tenantId) {
  const templates = [
    // WHATSAPP Templates
    {
      name: 'Product Launch Announcement',
      type: 'WHATSAPP',
      category: 'marketing',
      content: `🎉 *Exciting News, {{name}}!*\n\nWe're thrilled to announce the launch of *{{product_name}}*!\n\n✨ Key Features:\n• Premium quality\n• Best-in-class support\n• Competitive pricing\n\n🎁 *Special Launch Offer*: Get {{discount}}% off for the first 100 customers!\n\nShop now: {{link}}\n\nReply STOP to unsubscribe.`,
    },
    {
      name: 'Order Confirmation',
      type: 'WHATSAPP',
      category: 'transactional',
      content: `✅ *Order Confirmed!*\n\nHi {{name}},\n\nThank you for your order!\n\n📦 *Order Details*\nOrder ID: #{{order_id}}\nItems: {{item_count}}\nTotal: {{currency}}{{total_amount}}\n\n📍 Delivery to: {{address}}\n🚚 Expected: {{delivery_date}}\n\nTrack your order: {{tracking_link}}`,
    },
    {
      name: 'Welcome Message',
      type: 'WHATSAPP',
      category: 'onboarding',
      content: `👋 *Welcome to {{company_name}}, {{name}}!*\n\nWe're excited to have you on board!\n\nHere's what you can do next:\n1️⃣ Complete your profile\n2️⃣ Explore our features\n3️⃣ Connect your first integration\n\nQuick start guide: {{guide_link}}\n\nQuestions? Just reply to this message!`,
    },
    // EMAIL Templates
    {
      name: 'Monthly Newsletter',
      type: 'EMAIL',
      category: 'marketing',
      subject: '📬 Your {{month}} Newsletter from {{company_name}}',
      content: `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;"><h1>Hi {{name}},</h1><p>Here's what's new this month at {{company_name}}:</p><h2>🎯 Highlights</h2><ul><li>{{highlight_1}}</li><li>{{highlight_2}}</li><li>{{highlight_3}}</li></ul><a href="{{cta_link}}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">{{cta_text}}</a></body></html>`,
    },
    {
      name: 'Welcome Email',
      type: 'EMAIL',
      category: 'onboarding',
      subject: '🎉 Welcome to {{company_name}}, {{name}}!',
      content: `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><h1>Welcome to {{company_name}}! 🎉</h1><p>Hi {{name}},</p><p>We're thrilled to have you on board!</p><h2>Getting Started</h2><ol><li>Complete your profile</li><li>Explore features</li><li>Connect integrations</li></ol><a href="{{dashboard_link}}" style="background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px;">Go to Dashboard</a></body></html>`,
    },
    {
      name: 'Invoice Email',
      type: 'EMAIL',
      category: 'transactional',
      subject: 'Invoice #{{invoice_number}} from {{company_name}}',
      content: `<!DOCTYPE html><html><body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><h1>Invoice #{{invoice_number}}</h1><p>Hi {{name}},</p><p>Amount Due: <strong>{{currency}}{{total_amount}}</strong></p><p>Due Date: {{due_date}}</p><a href="{{payment_link}}" style="background: #22c55e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px;">Pay Now</a></body></html>`,
    },
    // SMS Templates
    {
      name: 'Flash Sale Alert',
      type: 'SMS',
      category: 'marketing',
      content: `{{company_name}}: FLASH SALE! {{discount}}% OFF for {{hours}} hours. Code: {{promo_code}}. Shop: {{link}} STOP to opt out`,
    },
    {
      name: 'OTP Verification',
      type: 'SMS',
      category: 'transactional',
      content: `{{otp}} is your {{company_name}} code. Valid for {{validity_minutes}} mins. Do not share.`,
    },
    {
      name: 'Appointment Reminder SMS',
      type: 'SMS',
      category: 'reminder',
      content: `Reminder: {{company_name}} appt on {{date}} at {{time}}. Location: {{location}}. Reply Y to confirm, N to cancel.`,
    },
  ];

  // Create channels first
  const channelTypes = ['WHATSAPP', 'EMAIL', 'SMS'];
  const channels = {};

  for (const type of channelTypes) {
    const channelId = `ch-${tenantId}-${type.toLowerCase()}`;
    try {
      await prisma.$executeRaw`
        INSERT INTO channels (id, "tenantId", type, name, status, provider, "createdAt", "updatedAt")
        VALUES (${channelId}, ${tenantId}, ${type}::"ChannelType", ${type + ' Channel'}, 'ACTIVE'::"ChannelStatus", 'default', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `;
      channels[type] = channelId;
      console.log(`✓ ${type} channel ready`);
    } catch (e) {
      console.log(`Channel error for ${type}:`, e.message);
    }
  }

  // Extract variables helper
  function extractVariables(content) {
    const matches = content.match(/\{\{([^}]+)\}\}/g) || [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()))];
  }

  // Insert templates
  let count = 0;
  for (const template of templates) {
    try {
      const variables = extractVariables(template.content);
      const variablesJson = JSON.stringify(variables);
      const channelId = channels[template.type];
      const templateId = `tpl-${tenantId}-${template.type.toLowerCase()}-${template.name.toLowerCase().replace(/\s+/g, '-').substring(0, 20)}`;

      await prisma.$executeRaw`
        INSERT INTO templates (
          id, "tenantId", "channelId", name, category, language,
          "bodyContent", variables, status, "sentCount", "deliveredCount", "readCount",
          type, content, subject, "isActive", "createdAt", "updatedAt"
        )
        VALUES (
          ${templateId}, ${tenantId}, ${channelId}, ${template.name}, ${template.category}, 'en',
          ${template.content}, ${variablesJson}::jsonb, 'APPROVED'::"TemplateStatus", 0, 0, 0,
          ${template.type}, ${template.content}, ${template.subject || null}, true, NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          "bodyContent" = EXCLUDED."bodyContent",
          content = EXCLUDED.content,
          subject = EXCLUDED.subject,
          variables = EXCLUDED.variables,
          "updatedAt" = NOW()
      `;
      count++;
      console.log(`✓ ${template.type.padEnd(8)} | ${template.name}`);
    } catch (error) {
      console.error(`✗ Failed: ${template.name}`, error.message);
    }
  }

  console.log(`\n✓ Seeded ${count} templates to Railway tenant!`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
  })
  .finally(() => prisma.$disconnect());
