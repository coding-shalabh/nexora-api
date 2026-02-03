// Seed templates to the correct Railway tenant: cmk5uq0nt000013wya3rzrku2 (Demo Company)
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const TENANT_ID = 'cmk5uq0nt000013wya3rzrku2'; // Demo Company - the actual tenant on Railway

const templates = [
  // WhatsApp Templates (6)
  {
    name: 'Welcome Message',
    type: 'WHATSAPP',
    category: 'marketing',
    content:
      'Hello {{name}}! Welcome to {{company}}. We\'re excited to have you on board. Reply with "START" to begin your journey!',
    subject: null,
    variables: JSON.stringify(['name', 'company']),
    isActive: true,
  },
  {
    name: 'Order Confirmation',
    type: 'WHATSAPP',
    category: 'transactional',
    content:
      'Hi {{name}}, your order #{{orderNumber}} has been confirmed! Total: ${{amount}}. Track your order: {{trackingUrl}}',
    subject: null,
    variables: JSON.stringify(['name', 'orderNumber', 'amount', 'trackingUrl']),
    isActive: true,
  },
  {
    name: 'Appointment Reminder',
    type: 'WHATSAPP',
    category: 'reminder',
    content:
      'Reminder: {{name}}, your appointment with {{agentName}} is scheduled for {{date}} at {{time}}. Reply "CONFIRM" to confirm or "RESCHEDULE" to change.',
    subject: null,
    variables: JSON.stringify(['name', 'agentName', 'date', 'time']),
    isActive: true,
  },
  {
    name: 'Payment Receipt',
    type: 'WHATSAPP',
    category: 'transactional',
    content:
      'Thank you {{name}}! Payment of ${{amount}} received for Invoice #{{invoiceNumber}}. Your balance is now ${{balance}}.',
    subject: null,
    variables: JSON.stringify(['name', 'amount', 'invoiceNumber', 'balance']),
    isActive: true,
  },
  {
    name: 'Feedback Request',
    type: 'WHATSAPP',
    category: 'marketing',
    content:
      "Hi {{name}}, we'd love your feedback on your recent purchase! Rate us 1-5: {{feedbackUrl}}",
    subject: null,
    variables: JSON.stringify(['name', 'feedbackUrl']),
    isActive: true,
  },
  {
    name: 'Support Ticket Update',
    type: 'WHATSAPP',
    category: 'support',
    content:
      'Hi {{name}}, your support ticket #{{ticketId}} has been {{status}}. {{message}} Reply for more help.',
    subject: null,
    variables: JSON.stringify(['name', 'ticketId', 'status', 'message']),
    isActive: true,
  },

  // Email Templates (6)
  {
    name: 'Welcome Email',
    type: 'EMAIL',
    category: 'onboarding',
    content:
      '<h1>Welcome to {{company}}, {{name}}!</h1><p>We\'re thrilled to have you join our community. Here\'s what you can expect:</p><ul><li>Exclusive offers</li><li>Priority support</li><li>Early access to new features</li></ul><p>Get started: <a href="{{dashboardUrl}}">Visit your dashboard</a></p>',
    subject: "Welcome to {{company}} - Let's Get Started!",
    variables: JSON.stringify(['name', 'company', 'dashboardUrl']),
    isActive: true,
  },
  {
    name: 'Invoice Email',
    type: 'EMAIL',
    category: 'transactional',
    content:
      '<h2>Invoice #{{invoiceNumber}}</h2><p>Dear {{name}},</p><p>Please find your invoice attached for ${{amount}}.</p><p>Due date: {{dueDate}}</p><p><a href="{{paymentUrl}}">Pay Now</a></p>',
    subject: 'Invoice #{{invoiceNumber}} - ${{amount}} Due',
    variables: JSON.stringify(['name', 'invoiceNumber', 'amount', 'dueDate', 'paymentUrl']),
    isActive: true,
  },
  {
    name: 'Monthly Newsletter',
    type: 'EMAIL',
    category: 'marketing',
    content:
      "<h1>{{month}} Newsletter</h1><p>Hi {{name}},</p><p>Here's what's new this month:</p>{{content}}<p>Best regards,<br>{{senderName}}</p>",
    subject: '{{company}} Newsletter - {{month}} Updates',
    variables: JSON.stringify(['name', 'month', 'content', 'senderName', 'company']),
    isActive: true,
  },
  {
    name: 'Password Reset',
    type: 'EMAIL',
    category: 'transactional',
    content:
      '<p>Hi {{name}},</p><p>We received a request to reset your password. Click the link below to set a new password:</p><p><a href="{{resetUrl}}">Reset Password</a></p><p>This link expires in 24 hours. If you didn\'t request this, please ignore this email.</p>',
    subject: 'Reset Your Password',
    variables: JSON.stringify(['name', 'resetUrl']),
    isActive: true,
  },
  {
    name: 'Meeting Invitation',
    type: 'EMAIL',
    category: 'notification',
    content:
      '<p>Hi {{name}},</p><p>You\'re invited to a meeting:</p><p><strong>{{meetingTitle}}</strong><br>Date: {{date}}<br>Time: {{time}}<br>Location: {{location}}</p><p><a href="{{calendarUrl}}">Add to Calendar</a></p>',
    subject: 'Meeting Invitation: {{meetingTitle}}',
    variables: JSON.stringify(['name', 'meetingTitle', 'date', 'time', 'location', 'calendarUrl']),
    isActive: true,
  },
  {
    name: 'Shipping Notification',
    type: 'EMAIL',
    category: 'transactional',
    content:
      '<p>Great news, {{name}}!</p><p>Your order #{{orderNumber}} has shipped!</p><p>Tracking: {{trackingNumber}}<br>Carrier: {{carrier}}<br>Est. Delivery: {{deliveryDate}}</p><p><a href="{{trackingUrl}}">Track Package</a></p>',
    subject: 'Your Order Has Shipped!',
    variables: JSON.stringify([
      'name',
      'orderNumber',
      'trackingNumber',
      'carrier',
      'deliveryDate',
      'trackingUrl',
    ]),
    isActive: true,
  },

  // SMS Templates (6)
  {
    name: 'OTP Verification',
    type: 'SMS',
    category: 'transactional',
    content:
      'Your {{company}} verification code is {{otp}}. Valid for 10 minutes. Do not share this code.',
    subject: null,
    variables: JSON.stringify(['company', 'otp']),
    isActive: true,
  },
  {
    name: 'Order Shipped SMS',
    type: 'SMS',
    category: 'transactional',
    content: '{{company}}: Order #{{orderNumber}} shipped! Track at {{trackingUrl}}',
    subject: null,
    variables: JSON.stringify(['company', 'orderNumber', 'trackingUrl']),
    isActive: true,
  },
  {
    name: 'Appointment Confirmation',
    type: 'SMS',
    category: 'reminder',
    content: 'Confirmed: Your appt with {{company}} on {{date}} at {{time}}. Reply C to cancel.',
    subject: null,
    variables: JSON.stringify(['company', 'date', 'time']),
    isActive: true,
  },
  {
    name: 'Flash Sale Alert',
    type: 'SMS',
    category: 'marketing',
    content:
      '{{company}} FLASH SALE! {{discount}}% off everything for {{hours}} hours! Shop now: {{shopUrl}}',
    subject: null,
    variables: JSON.stringify(['company', 'discount', 'hours', 'shopUrl']),
    isActive: true,
  },
  {
    name: 'Payment Reminder',
    type: 'SMS',
    category: 'reminder',
    content: 'Reminder: ${{amount}} due on {{dueDate}} for {{company}}. Pay now: {{paymentUrl}}',
    subject: null,
    variables: JSON.stringify(['amount', 'dueDate', 'company', 'paymentUrl']),
    isActive: true,
  },
  {
    name: 'Delivery Notification',
    type: 'SMS',
    category: 'transactional',
    content: '{{company}}: Your package was delivered today! Questions? Reply or call {{phone}}',
    subject: null,
    variables: JSON.stringify(['company', 'phone']),
    isActive: true,
  },
];

async function seedTemplates() {
  console.log('Seeding templates to tenant:', TENANT_ID);

  // Delete existing templates for this tenant
  const deleted = await prisma.$executeRaw`
    DELETE FROM templates WHERE "tenantId" = ${TENANT_ID}
  `;
  console.log(`Deleted ${deleted} existing templates`);

  // Insert new templates - Railway schema uses TEXT for type, no channelId
  let inserted = 0;
  for (const template of templates) {
    const templateId = `tpl_${Date.now()}_${inserted}`;

    await prisma.$executeRaw`
      INSERT INTO templates (id, name, type, category, content, subject, variables, "isActive", "tenantId", "createdAt", "updatedAt")
      VALUES (
        ${templateId},
        ${template.name},
        ${template.type},
        ${template.category},
        ${template.content},
        ${template.subject},
        ${template.variables}::jsonb,
        ${template.isActive},
        ${TENANT_ID},
        NOW(),
        NOW()
      )
    `;
    inserted++;
    console.log(`Inserted: ${template.name}`);
  }

  console.log(`\nSuccessfully seeded ${inserted} templates to tenant ${TENANT_ID}`);

  // Verify
  const count = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM templates WHERE "tenantId" = ${TENANT_ID}
  `;
  console.log(`Verification: ${count[0].count} templates in database`);
}

seedTemplates()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
