import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * SIMPLE TEMPLATES SEED
 *
 * Creates templates using the simple schema expected by the API:
 * - type: whatsapp, email, sms
 * - content: message body
 * - subject: for emails
 * - isActive: boolean
 * - category: marketing, transactional, support, etc.
 */

const templates = [
  // WHATSAPP Templates
  {
    name: 'Product Launch Announcement',
    type: 'WHATSAPP',
    category: 'marketing',
    content: `🎉 *Exciting News, {{name}}!*

We're thrilled to announce the launch of *{{product_name}}*!

✨ Key Features:
• Premium quality
• Best-in-class support
• Competitive pricing

🎁 *Special Launch Offer*: Get {{discount}}% off for the first 100 customers!

Shop now: {{link}}

Reply STOP to unsubscribe.`,
    isActive: true,
  },
  {
    name: 'Order Confirmation',
    type: 'WHATSAPP',
    category: 'transactional',
    content: `✅ *Order Confirmed!*

Hi {{name}},

Thank you for your order!

📦 *Order Details*
Order ID: #{{order_id}}
Items: {{item_count}}
Total: {{currency}}{{total_amount}}

📍 Delivery to: {{address}}
🚚 Expected: {{delivery_date}}

Track your order: {{tracking_link}}`,
    isActive: true,
  },
  {
    name: 'Payment Receipt',
    type: 'WHATSAPP',
    category: 'transactional',
    content: `💳 *Payment Received*

Hi {{name}},

We've received your payment!

Transaction ID: {{transaction_id}}
Amount: {{currency}}{{amount}}
Date: {{payment_date}}
Method: {{payment_method}}

Invoice: {{invoice_link}}

Thank you for your business!`,
    isActive: true,
  },
  {
    name: 'Support Ticket Created',
    type: 'WHATSAPP',
    category: 'support',
    content: `🎫 *Support Ticket Created*

Hi {{name}},

We've received your support request.

Ticket #: {{ticket_id}}
Subject: {{subject}}
Priority: {{priority}}

Our team will respond within {{response_time}}. You can check status anytime at: {{portal_link}}

Reply to this message to add more details.`,
    isActive: true,
  },
  {
    name: 'Appointment Reminder',
    type: 'WHATSAPP',
    category: 'reminder',
    content: `⏰ *Appointment Reminder*

Hi {{name}},

This is a reminder for your upcoming appointment:

📅 Date: {{date}}
🕐 Time: {{time}}
📍 Location: {{location}}
👤 With: {{staff_name}}

Reply:
✅ CONFIRM to confirm
❌ CANCEL to cancel
📅 RESCHEDULE to change time`,
    isActive: true,
  },
  {
    name: 'Welcome Message',
    type: 'WHATSAPP',
    category: 'onboarding',
    content: `👋 *Welcome to {{company_name}}, {{name}}!*

We're excited to have you on board!

Here's what you can do next:
1️⃣ Complete your profile
2️⃣ Explore our features
3️⃣ Connect your first integration

Quick start guide: {{guide_link}}

Questions? Just reply to this message!`,
    isActive: true,
  },

  // EMAIL Templates
  {
    name: 'Monthly Newsletter',
    type: 'EMAIL',
    category: 'marketing',
    subject: '📬 Your {{month}} Newsletter from {{company_name}}',
    content: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1>Hi {{name}},</h1>
  <p>Here's what's new this month at {{company_name}}:</p>
  <h2>🎯 Highlights</h2>
  <ul>
    <li>{{highlight_1}}</li>
    <li>{{highlight_2}}</li>
    <li>{{highlight_3}}</li>
  </ul>
  <a href="{{cta_link}}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">{{cta_text}}</a>
</body>
</html>`,
    isActive: true,
  },
  {
    name: 'Promotional Offer',
    type: 'EMAIL',
    category: 'marketing',
    subject: '🎁 Exclusive {{discount}}% Off Just For You, {{name}}!',
    content: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 40px; text-align: center;">
    <h1 style="margin: 0;">{{discount}}% OFF</h1>
    <p>Exclusive offer for you!</p>
  </div>
  <div style="padding: 30px;">
    <p>Hi {{name}},</p>
    <p>Use code: <strong>{{promo_code}}</strong></p>
    <p>Valid until {{expiry_date}}</p>
    <a href="{{shop_link}}" style="background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">Shop Now</a>
  </div>
</body>
</html>`,
    isActive: true,
  },
  {
    name: 'Invoice',
    type: 'EMAIL',
    category: 'transactional',
    subject: 'Invoice #{{invoice_number}} from {{company_name}}',
    content: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>Invoice #{{invoice_number}}</h1>
  <p>Hi {{name}},</p>
  <p>Amount Due: <strong>{{currency}}{{total_amount}}</strong></p>
  <p>Due Date: {{due_date}}</p>
  <a href="{{payment_link}}" style="background: #22c55e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">Pay Now</a>
</body>
</html>`,
    isActive: true,
  },
  {
    name: 'Welcome Email',
    type: 'EMAIL',
    category: 'onboarding',
    subject: '🎉 Welcome to {{company_name}}, {{name}}!',
    content: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>Welcome to {{company_name}}! 🎉</h1>
  <p>Hi {{name}},</p>
  <p>We're thrilled to have you on board!</p>
  <h2>Getting Started</h2>
  <ol>
    <li>Complete your profile</li>
    <li>Explore features</li>
    <li>Connect integrations</li>
  </ol>
  <a href="{{dashboard_link}}" style="background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">Go to Dashboard</a>
</body>
</html>`,
    isActive: true,
  },
  {
    name: 'Password Changed',
    type: 'EMAIL',
    category: 'notification',
    subject: '🔐 Your Password Was Changed',
    content: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>Password Changed</h1>
  <p>Hi {{name}},</p>
  <p>Your password was changed on {{date}} at {{time}}.</p>
  <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p><strong>⚠️ Wasn't you?</strong></p>
    <p>Reset your password immediately.</p>
  </div>
  <a href="{{reset_link}}" style="background: #ef4444; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
</body>
</html>`,
    isActive: true,
  },
  {
    name: 'Support Ticket Created',
    type: 'EMAIL',
    category: 'support',
    subject: "[Ticket #{{ticket_id}}] {{subject}} - We've Received Your Request",
    content: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>We've Received Your Support Request</h1>
  <p>Hi {{name}},</p>
  <p>Ticket #: <strong>{{ticket_id}}</strong></p>
  <p>Subject: {{subject}}</p>
  <p>Priority: {{priority}}</p>
  <p>Our team will respond within {{response_time}}.</p>
  <a href="{{portal_link}}" style="background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">View Ticket</a>
</body>
</html>`,
    isActive: true,
  },

  // SMS Templates
  {
    name: 'Flash Sale Alert',
    type: 'SMS',
    category: 'marketing',
    content: `{{company_name}}: FLASH SALE! {{discount}}% OFF everything for the next {{hours}} hours only. Use code {{promo_code}}. Shop: {{link}} Reply STOP to opt out`,
    isActive: true,
  },
  {
    name: 'OTP Verification',
    type: 'SMS',
    category: 'transactional',
    content: `{{otp}} is your {{company_name}} verification code. Valid for {{validity_minutes}} minutes. Do not share this code.`,
    isActive: true,
  },
  {
    name: 'Order Confirmation',
    type: 'SMS',
    category: 'transactional',
    content: `{{company_name}}: Order #{{order_id}} confirmed! Total: {{currency}}{{amount}}. Delivery: {{delivery_date}}. Track: {{tracking_link}}`,
    isActive: true,
  },
  {
    name: 'Appointment Reminder',
    type: 'SMS',
    category: 'reminder',
    content: `Reminder: Your appointment at {{company_name}} is on {{date}} at {{time}}. Location: {{location}}. Reply Y to confirm or N to cancel.`,
    isActive: true,
  },
  {
    name: 'Payment Due',
    type: 'SMS',
    category: 'reminder',
    content: `{{company_name}}: Your payment of {{currency}}{{amount}} for invoice #{{invoice_id}} is due on {{due_date}}. Pay now: {{payment_link}}`,
    isActive: true,
  },
  {
    name: 'Delivery Update',
    type: 'SMS',
    category: 'notification',
    content: `{{company_name}}: Your package is out for delivery! Order #{{order_id}} arrives today by {{time_window}}. Track: {{tracking_link}}`,
    isActive: true,
  },
];

// Helper function to extract variables from content
function extractVariables(content) {
  const matches = content.match(/\{\{([^}]+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '').trim()))];
}

async function main() {
  console.log('Seeding simple templates...\n');

  // Get the tenant
  const tenants =
    await prisma.$queryRaw`SELECT id, name FROM tenants WHERE slug = 'helix-code' LIMIT 1`;

  if (!tenants || tenants.length === 0) {
    console.error('❌ Tenant not found. Please run seed-minimal.js first.');
    process.exit(1);
  }

  const tenant = tenants[0];
  console.log('Found tenant:', tenant.name, '\n');

  // Get or create channels
  const channelTypes = ['WHATSAPP', 'EMAIL', 'SMS'];
  const channels = {};

  for (const type of channelTypes) {
    const existingChannel = await prisma.$queryRaw`
      SELECT id FROM channels WHERE "tenantId" = ${tenant.id} AND type = ${type}::"ChannelType" LIMIT 1
    `;
    if (existingChannel && existingChannel.length > 0) {
      channels[type] = existingChannel[0].id;
    } else {
      channels[type] = `${tenant.id}-${type.toLowerCase()}-default`;
    }
  }

  // Group templates by type for summary
  const summary = { WHATSAPP: 0, EMAIL: 0, SMS: 0 };

  for (const template of templates) {
    try {
      const templateId = `simple-${tenant.id}-${template.type.toLowerCase()}-${template.name.toLowerCase().replace(/\s+/g, '-').substring(0, 25)}`;
      const variables = extractVariables(template.content);
      const variablesJson = JSON.stringify(variables);
      const channelId = channels[template.type];

      // Use raw SQL to insert templates with all required columns
      await prisma.$executeRaw`
        INSERT INTO templates (id, "tenantId", "channelId", name, type, category, content, subject, variables, "isActive", "createdAt", "updatedAt")
        VALUES (
          ${templateId}, ${tenant.id}, ${channelId}, ${template.name}, ${template.type}, ${template.category || null},
          ${template.content}, ${template.subject || null}, ${variablesJson}::jsonb, ${template.isActive},
          NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          subject = EXCLUDED.subject,
          category = EXCLUDED.category,
          variables = EXCLUDED.variables,
          "isActive" = EXCLUDED."isActive",
          "updatedAt" = NOW()
      `;
      summary[template.type]++;
      const channelLabel = template.type.toLowerCase().padEnd(8);
      const categoryLabel = (template.category || 'general').padEnd(14);
      console.log(`✓ ${channelLabel} | ${categoryLabel} | ${template.name}`);
    } catch (error) {
      console.error(`✗ Failed to create: ${template.name}`, error.message);
    }
  }

  console.log('\n========================================');
  console.log('SIMPLE TEMPLATES SEED COMPLETE');
  console.log('========================================');
  console.log('');
  console.log('Templates Created:');
  console.log(`  WhatsApp: ${summary.WHATSAPP}`);
  console.log(`  Email:    ${summary.EMAIL}`);
  console.log(`  SMS:      ${summary.SMS}`);
  console.log(`  ─────────────────`);
  console.log(`  Total:    ${Object.values(summary).reduce((a, b) => a + b, 0)}`);
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
