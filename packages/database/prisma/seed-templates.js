import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * TEMPLATES SEED
 *
 * Creates sample templates for all channels using the actual database schema:
 * - Channels: WHATSAPP, EMAIL, SMS (as available in ChannelType enum)
 * - Categories: MARKETING, UTILITY, AUTHENTICATION, FEEDBACK (as available in TemplateCategory enum)
 */

const templates = [
  // ==================== WHATSAPP TEMPLATES ====================
  // Marketing
  {
    name: 'product_launch',
    channelType: 'WHATSAPP',
    category: 'MARKETING',
    language: 'en',
    headerType: 'TEXT',
    headerContent: '🎉 Exciting News!',
    bodyContent: `Hi {{1}},

We're thrilled to announce the launch of {{2}}!

✨ Key Features:
• Feature 1
• Feature 2
• Feature 3

🎁 Special Launch Offer: Get {{3}}% off for the first 100 customers!

Shop now and be among the first to experience it!`,
    footerContent: 'Reply STOP to unsubscribe',
    variables: ['name', 'product_name', 'discount'],
    buttons: [{ type: 'URL', text: 'Shop Now', url: '{{4}}' }],
  },
  {
    name: 'seasonal_sale',
    channelType: 'WHATSAPP',
    category: 'MARKETING',
    language: 'en',
    headerType: 'TEXT',
    headerContent: '🔥 Sale is LIVE!',
    bodyContent: `Hi {{1}},

Don't miss out on our biggest sale of the year!

💰 Up to {{2}}% OFF on everything
📅 Valid till: {{3}}

Use code: {{4}}

Limited stock available!`,
    footerContent: 'Nexora CRM',
    variables: ['name', 'max_discount', 'end_date', 'promo_code'],
    buttons: [{ type: 'URL', text: 'Shop Now', url: '{{5}}' }],
  },
  // Utility (Transactional)
  {
    name: 'order_confirmation',
    channelType: 'WHATSAPP',
    category: 'UTILITY',
    language: 'en',
    headerType: 'TEXT',
    headerContent: '✅ Order Confirmed!',
    bodyContent: `Hi {{1}},

Thank you for your order!

📦 Order Details
Order ID: #{{2}}
Items: {{3}}
Total: {{4}}

📍 Delivery to: {{5}}
🚚 Expected: {{6}}`,
    footerContent: 'Track your order anytime',
    variables: ['name', 'order_id', 'item_count', 'total_amount', 'address', 'delivery_date'],
    buttons: [{ type: 'URL', text: 'Track Order', url: '{{7}}' }],
  },
  {
    name: 'payment_receipt',
    channelType: 'WHATSAPP',
    category: 'UTILITY',
    language: 'en',
    headerType: 'TEXT',
    headerContent: '💳 Payment Received',
    bodyContent: `Hi {{1}},

We've received your payment!

Transaction ID: {{2}}
Amount: {{3}}
Date: {{4}}
Method: {{5}}

Thank you for your business!`,
    footerContent: 'Nexora CRM',
    variables: ['name', 'transaction_id', 'amount', 'payment_date', 'payment_method'],
    buttons: [{ type: 'URL', text: 'View Invoice', url: '{{6}}' }],
  },
  {
    name: 'shipping_update',
    channelType: 'WHATSAPP',
    category: 'UTILITY',
    language: 'en',
    headerType: 'TEXT',
    headerContent: '📦 Shipping Update',
    bodyContent: `Hi {{1}},

Your order #{{2}} is on its way!

Status: {{3}}
Carrier: {{4}}
Tracking: {{5}}

Expected delivery: {{6}}`,
    footerContent: 'Nexora CRM',
    variables: ['name', 'order_id', 'status', 'carrier', 'tracking_number', 'delivery_date'],
    buttons: [{ type: 'URL', text: 'Track Package', url: '{{7}}' }],
  },
  // Authentication
  {
    name: 'otp_verification',
    channelType: 'WHATSAPP',
    category: 'AUTHENTICATION',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `Your verification code is: {{1}}

This code is valid for {{2}} minutes.

Do not share this code with anyone.`,
    footerContent: null,
    variables: ['otp', 'validity_minutes'],
    buttons: [{ type: 'OTP', text: 'Copy Code' }],
  },
  {
    name: 'password_reset',
    channelType: 'WHATSAPP',
    category: 'AUTHENTICATION',
    language: 'en',
    headerType: 'TEXT',
    headerContent: '🔐 Password Reset',
    bodyContent: `Hi {{1}},

We received a request to reset your password.

Click the button below to reset your password. This link expires in {{2}} minutes.

If you didn't request this, please ignore this message.`,
    footerContent: null,
    variables: ['name', 'expiry_minutes'],
    buttons: [{ type: 'URL', text: 'Reset Password', url: '{{3}}' }],
  },
  // Feedback
  {
    name: 'ticket_created',
    channelType: 'WHATSAPP',
    category: 'FEEDBACK',
    language: 'en',
    headerType: 'TEXT',
    headerContent: '🎫 Support Ticket Created',
    bodyContent: `Hi {{1}},

We've received your support request.

Ticket #: {{2}}
Subject: {{3}}
Priority: {{4}}

Our team will respond within {{5}}.

Reply to this message to add more details.`,
    footerContent: null,
    variables: ['name', 'ticket_id', 'subject', 'priority', 'response_time'],
    buttons: [{ type: 'URL', text: 'View Ticket', url: '{{6}}' }],
  },
  {
    name: 'ticket_resolved',
    channelType: 'WHATSAPP',
    category: 'FEEDBACK',
    language: 'en',
    headerType: 'TEXT',
    headerContent: '✅ Ticket Resolved',
    bodyContent: `Hi {{1}},

Good news! Your support ticket has been resolved.

Ticket #: {{2}}
Resolution: {{3}}

Was this helpful?`,
    footerContent: 'Reply to reopen if needed',
    variables: ['name', 'ticket_id', 'resolution_summary'],
    buttons: [
      { type: 'QUICK_REPLY', text: '👍 Yes' },
      { type: 'QUICK_REPLY', text: '👎 No' },
    ],
  },
  {
    name: 'appointment_reminder',
    channelType: 'WHATSAPP',
    category: 'UTILITY',
    language: 'en',
    headerType: 'TEXT',
    headerContent: '⏰ Appointment Reminder',
    bodyContent: `Hi {{1}},

This is a reminder for your upcoming appointment:

📅 Date: {{2}}
🕐 Time: {{3}}
📍 Location: {{4}}
👤 With: {{5}}`,
    footerContent: null,
    variables: ['name', 'date', 'time', 'location', 'staff_name'],
    buttons: [
      { type: 'QUICK_REPLY', text: '✅ Confirm' },
      { type: 'QUICK_REPLY', text: '📅 Reschedule' },
    ],
  },
  {
    name: 'payment_reminder',
    channelType: 'WHATSAPP',
    category: 'UTILITY',
    language: 'en',
    headerType: 'TEXT',
    headerContent: '💰 Payment Reminder',
    bodyContent: `Hi {{1}},

This is a friendly reminder that your payment is due.

Invoice #: {{2}}
Amount: {{3}}
Due Date: {{4}}

Already paid? Please disregard this message.`,
    footerContent: null,
    variables: ['name', 'invoice_id', 'amount', 'due_date'],
    buttons: [{ type: 'URL', text: 'Pay Now', url: '{{5}}' }],
  },
  {
    name: 'welcome_message',
    channelType: 'WHATSAPP',
    category: 'MARKETING',
    language: 'en',
    headerType: 'TEXT',
    headerContent: '👋 Welcome!',
    bodyContent: `Hi {{1}},

Welcome to {{2}}!

We're excited to have you on board!

Here's what you can do next:
1️⃣ Complete your profile
2️⃣ Explore our features
3️⃣ Connect your first integration

Questions? Just reply to this message!`,
    footerContent: null,
    variables: ['name', 'company_name'],
    buttons: [{ type: 'URL', text: 'Get Started', url: '{{3}}' }],
  },

  // ==================== EMAIL TEMPLATES ====================
  {
    name: 'newsletter_monthly',
    channelType: 'EMAIL',
    category: 'MARKETING',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1>Hi {{1}},</h1>

  <p>Here's what's new this month at {{2}}:</p>

  <h2>🎯 Highlights</h2>
  <ul>
    <li>{{3}}</li>
    <li>{{4}}</li>
    <li>{{5}}</li>
  </ul>

  <a href="{{6}}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Read More</a>

  <p style="margin-top: 30px; color: #666; font-size: 12px;">
    You're receiving this because you subscribed to our newsletter.
  </p>
</body>
</html>`,
    footerContent: null,
    variables: ['name', 'company_name', 'highlight_1', 'highlight_2', 'highlight_3', 'cta_link'],
    buttons: null,
  },
  {
    name: 'promotional_email',
    channelType: 'EMAIL',
    category: 'MARKETING',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; padding: 40px; text-align: center;">
    <h1 style="margin: 0;">{{1}}% OFF</h1>
    <p>Exclusive offer for you!</p>
  </div>

  <div style="padding: 30px;">
    <p>Hi {{2}},</p>

    <p>As a valued customer, we're giving you an exclusive discount on your next purchase.</p>

    <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
      <p style="margin: 0; color: #666;">Use code:</p>
      <h2 style="margin: 10px 0; color: #6366f1;">{{3}}</h2>
      <p style="margin: 0; color: #666;">Valid until {{4}}</p>
    </div>

    <a href="{{5}}" style="background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; width: 100%; text-align: center; box-sizing: border-box;">Shop Now</a>
  </div>
</body>
</html>`,
    footerContent: null,
    variables: ['discount', 'name', 'promo_code', 'expiry_date', 'shop_link'],
    buttons: null,
  },
  {
    name: 'invoice_email',
    channelType: 'EMAIL',
    category: 'UTILITY',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>Invoice #{{1}}</h1>

  <p>Hi {{2}},</p>

  <p>Please find your invoice details below:</p>

  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr style="background: #f3f4f6;">
      <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e5e7eb;">Description</th>
      <th style="padding: 12px; text-align: right; border-bottom: 2px solid #e5e7eb;">Amount</th>
    </tr>
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">{{3}}</td>
      <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">{{4}}</td>
    </tr>
    <tr>
      <td style="padding: 12px; font-weight: bold;">Total</td>
      <td style="padding: 12px; text-align: right; font-weight: bold;">{{5}}</td>
    </tr>
  </table>

  <p><strong>Due Date:</strong> {{6}}</p>

  <a href="{{7}}" style="background: #22c55e; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">Pay Now</a>
</body>
</html>`,
    footerContent: null,
    variables: [
      'invoice_number',
      'name',
      'item_description',
      'item_amount',
      'total_amount',
      'due_date',
      'payment_link',
    ],
    buttons: null,
  },
  {
    name: 'welcome_email',
    channelType: 'EMAIL',
    category: 'UTILITY',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="text-align: center; margin-bottom: 30px;">
    <h1>Welcome to {{1}}! 🎉</h1>
  </div>

  <p>Hi {{2}},</p>

  <p>We're thrilled to have you on board! Your account has been successfully created.</p>

  <h2>Getting Started</h2>
  <ol>
    <li><strong>Complete your profile</strong> - Add your details and preferences</li>
    <li><strong>Explore features</strong> - Check out what you can do</li>
    <li><strong>Connect integrations</strong> - Link your favorite tools</li>
  </ol>

  <a href="{{3}}" style="background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">Go to Dashboard</a>

  <p>Best regards,<br>The {{1}} Team</p>
</body>
</html>`,
    footerContent: null,
    variables: ['company_name', 'name', 'dashboard_link'],
    buttons: null,
  },
  {
    name: 'password_changed_email',
    channelType: 'EMAIL',
    category: 'AUTHENTICATION',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>Password Changed</h1>

  <p>Hi {{1}},</p>

  <p>Your password was successfully changed on {{2}} at {{3}}.</p>

  <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
    <p style="margin: 0;"><strong>⚠️ Wasn't you?</strong></p>
    <p style="margin: 10px 0 0;">If you didn't make this change, please reset your password immediately and contact support.</p>
  </div>

  <a href="{{4}}" style="background: #ef4444; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
</body>
</html>`,
    footerContent: null,
    variables: ['name', 'date', 'time', 'reset_link'],
    buttons: null,
  },
  {
    name: 'ticket_created_email',
    channelType: 'EMAIL',
    category: 'FEEDBACK',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h1>We've Received Your Support Request</h1>

  <p>Hi {{1}},</p>

  <p>Thank you for contacting us. We've created a support ticket for your request.</p>

  <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0 0 10px;"><strong>Ticket Number:</strong> #{{2}}</p>
    <p style="margin: 0 0 10px;"><strong>Subject:</strong> {{3}}</p>
    <p style="margin: 0 0 10px;"><strong>Priority:</strong> {{4}}</p>
    <p style="margin: 0;"><strong>Status:</strong> Open</p>
  </div>

  <p>Our support team will review your request and get back to you within <strong>{{5}}</strong>.</p>

  <a href="{{6}}" style="background: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block;">View Ticket</a>
</body>
</html>`,
    footerContent: null,
    variables: ['name', 'ticket_id', 'subject', 'priority', 'response_time', 'portal_link'],
    buttons: null,
  },

  // ==================== SMS TEMPLATES ====================
  {
    name: 'flash_sale_sms',
    channelType: 'SMS',
    category: 'MARKETING',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `{{1}}: FLASH SALE! {{2}}% OFF everything for the next {{3}} hours only. Use code {{4}} at checkout. Shop: {{5}}`,
    footerContent: null,
    variables: ['company_name', 'discount', 'hours', 'promo_code', 'link'],
    buttons: null,
  },
  {
    name: 'new_arrival_sms',
    channelType: 'SMS',
    category: 'MARKETING',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `Hi {{1}}! New arrivals just dropped at {{2}}. Be the first to check out our latest {{3}} collection. Shop now: {{4}}`,
    footerContent: null,
    variables: ['name', 'company_name', 'category', 'link'],
    buttons: null,
  },
  {
    name: 'otp_sms',
    channelType: 'SMS',
    category: 'AUTHENTICATION',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `{{1}} is your {{2}} verification code. Valid for {{3}} minutes. Do not share this code with anyone.`,
    footerContent: null,
    variables: ['otp', 'company_name', 'validity_minutes'],
    buttons: null,
  },
  {
    name: 'order_confirmation_sms',
    channelType: 'SMS',
    category: 'UTILITY',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `{{1}}: Order #{{2}} confirmed! Total: {{3}}. Expected delivery: {{4}}. Track: {{5}}`,
    footerContent: null,
    variables: ['company_name', 'order_id', 'amount', 'delivery_date', 'tracking_link'],
    buttons: null,
  },
  {
    name: 'support_update_sms',
    channelType: 'SMS',
    category: 'FEEDBACK',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `{{1}} Support: Your ticket #{{2}} has been updated. Status: {{3}}. View details: {{4}}`,
    footerContent: null,
    variables: ['company_name', 'ticket_id', 'status', 'portal_link'],
    buttons: null,
  },
  {
    name: 'appointment_sms',
    channelType: 'SMS',
    category: 'UTILITY',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `Reminder: You have an appointment at {{1}} on {{2}} at {{3}}. Location: {{4}}. Reply Y to confirm or N to cancel.`,
    footerContent: null,
    variables: ['company_name', 'date', 'time', 'location'],
    buttons: null,
  },
  {
    name: 'payment_due_sms',
    channelType: 'SMS',
    category: 'UTILITY',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `{{1}}: Your payment of {{2}} for invoice #{{3}} is due on {{4}}. Pay now: {{5}}`,
    footerContent: null,
    variables: ['company_name', 'amount', 'invoice_id', 'due_date', 'payment_link'],
    buttons: null,
  },
  {
    name: 'delivery_update_sms',
    channelType: 'SMS',
    category: 'UTILITY',
    language: 'en',
    headerType: null,
    headerContent: null,
    bodyContent: `{{1}}: Your package is out for delivery! Order #{{2}} will arrive today by {{3}}. Track: {{4}}`,
    footerContent: null,
    variables: ['company_name', 'order_id', 'time_window', 'tracking_link'],
    buttons: null,
  },
];

async function main() {
  console.log('Seeding templates...\n');

  // Get the tenant (using raw query to avoid schema issues)
  const tenants =
    await prisma.$queryRaw`SELECT id, name FROM tenants WHERE slug = 'helix-code' LIMIT 1`;

  if (!tenants || tenants.length === 0) {
    console.error('❌ Tenant not found. Please run seed-minimal.js first.');
    process.exit(1);
  }

  const tenant = tenants[0];
  console.log('Found tenant:', tenant.name, '\n');

  // Create channels for each type if they don't exist
  const channelTypes = ['WHATSAPP', 'EMAIL', 'SMS'];
  const channels = {};

  for (const type of channelTypes) {
    // Check if channel exists
    const existingChannel = await prisma.$queryRaw`
      SELECT id, name FROM channels WHERE "tenantId" = ${tenant.id} AND type = ${type}::"ChannelType" LIMIT 1
    `;

    if (existingChannel && existingChannel.length > 0) {
      channels[type] = existingChannel[0];
      console.log(`✓ Found existing ${type} channel: ${channels[type].name}`);
    } else {
      // Create channel
      const channelId = `${tenant.id}-${type.toLowerCase()}-default`;
      const channelName =
        type === 'WHATSAPP'
          ? 'WhatsApp Default'
          : type === 'EMAIL'
            ? 'Email Default'
            : 'SMS Default';
      const provider = type === 'WHATSAPP' ? 'MSG91' : type === 'EMAIL' ? 'SMTP' : 'MSG91';

      await prisma.$executeRaw`
        INSERT INTO channels (id, "tenantId", name, type, provider, status, "createdAt", "updatedAt")
        VALUES (${channelId}, ${tenant.id}, ${channelName}, ${type}::"ChannelType", ${provider}, 'ACTIVE'::"ChannelStatus", NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `;

      channels[type] = { id: channelId, name: channelName };
      console.log(`✓ Created ${type} channel: ${channelName}`);
    }
  }

  console.log('');

  // Group templates by type for summary
  const summary = { WHATSAPP: 0, EMAIL: 0, SMS: 0 };

  for (const template of templates) {
    try {
      const channel = channels[template.channelType];
      if (!channel) {
        console.error(`✗ No channel for type: ${template.channelType}`);
        continue;
      }

      const templateId = `${tenant.id}-${template.channelType.toLowerCase()}-${template.name}`;
      const variablesJson = JSON.stringify(template.variables);
      const buttonsJson = template.buttons ? JSON.stringify(template.buttons) : null;

      // Use raw SQL to insert/update template
      await prisma.$executeRaw`
        INSERT INTO templates (
          id, "tenantId", "channelId", name, category, language,
          "headerType", "headerContent", "bodyContent", "footerContent",
          buttons, variables, status, "sentCount", "deliveredCount", "readCount",
          "createdAt", "updatedAt"
        )
        VALUES (
          ${templateId}, ${tenant.id}, ${channel.id}, ${template.name},
          ${template.category}::"TemplateCategory", ${template.language},
          ${template.headerType}::"TemplateHeaderType", ${template.headerContent}, ${template.bodyContent}, ${template.footerContent},
          ${buttonsJson}::jsonb, ${variablesJson}::jsonb, 'APPROVED'::"TemplateStatus", 0, 0, 0,
          NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          "bodyContent" = EXCLUDED."bodyContent",
          "headerContent" = EXCLUDED."headerContent",
          "footerContent" = EXCLUDED."footerContent",
          buttons = EXCLUDED.buttons,
          variables = EXCLUDED.variables,
          "updatedAt" = NOW()
      `;
      summary[template.channelType]++;
      console.log(
        `✓ ${template.channelType.padEnd(8)} | ${template.category.padEnd(14)} | ${template.name}`
      );
    } catch (error) {
      console.error(`✗ Failed to create: ${template.name}`, error.message);
    }
  }

  console.log('\n========================================');
  console.log('TEMPLATE SEED COMPLETE');
  console.log('========================================');
  console.log('');
  console.log('Templates Created:');
  console.log(`  WhatsApp: ${summary.WHATSAPP}`);
  console.log(`  Email:    ${summary.EMAIL}`);
  console.log(`  SMS:      ${summary.SMS}`);
  console.log(`  ─────────────────`);
  console.log(`  Total:    ${Object.values(summary).reduce((a, b) => a + b, 0)}`);
  console.log('');
  console.log('Categories covered:');
  console.log('  • MARKETING');
  console.log('  • UTILITY (transactional)');
  console.log('  • AUTHENTICATION');
  console.log('  • FEEDBACK (support)');
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
