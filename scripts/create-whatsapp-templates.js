/**
 * Create MSG91 WhatsApp Templates for AI Assistant
 * Run with: node scripts/create-whatsapp-templates.js
 */

import 'dotenv/config';

const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const WHATSAPP_NUMBER =
  process.env.AI_ASSISTANT_WHATSAPP_NUMBER ||
  process.env.MSG91_WHATSAPP_NUMBER ||
  process.env.MSG91_INTEGRATED_NUMBER;

if (!MSG91_AUTH_KEY) {
  console.error('❌ MSG91_AUTH_KEY not found in environment');
  process.exit(1);
}

if (!WHATSAPP_NUMBER) {
  console.error('❌ WHATSAPP_NUMBER not found in environment');
  console.log('Set AI_ASSISTANT_WHATSAPP_NUMBER or MSG91_WHATSAPP_NUMBER');
  process.exit(1);
}

// Template definitions
const templates = [
  {
    name: 'nexora_ai_welcome',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Welcome to Nexora AI Assistant',
      },
      {
        type: 'BODY',
        text: `Your WhatsApp is now linked. I can help you with:

Business Analytics:
• Sales reports and pipeline metrics
• CRM statistics (contacts, companies)
• Ticket and project insights

Subscription Management:
• Check your plan and billing
• View usage statistics

Automated Reports:
• Daily/weekly summaries
• Real-time event alerts

Just send me a message like:
• "Show this month's sales"
• "What's my plan?"
• "Schedule daily report at 9 AM"

Your link expires in 30 days. You'll get a reminder to renew.

Let's get started!`,
      },
    ],
  },
  {
    name: 'nexora_ai_goodbye',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Goodbye from Nexora AI',
      },
      {
        type: 'BODY',
        text: `Your WhatsApp AI Assistant has been unlinked.

You can re-link anytime from:
Settings > AI Assistant

Thank you for using Nexora!`,
      },
    ],
  },
  {
    name: 'nexora_ai_link_request',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Link Your Nexora Account',
      },
      {
        type: 'BODY',
        text: `Hi! Click the button below to link your Nexora account to WhatsApp AI Assistant.

This link expires in 5 minutes.
Never share this link with anyone.`,
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Authorize Now',
            url: 'https://nexoraos.pro/ai-assistant/authorize?state={{1}}',
          },
        ],
      },
    ],
  },
  {
    name: 'nexora_ai_expiry_reminder',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Link Expiring Soon',
      },
      {
        type: 'BODY',
        text: `Your Nexora AI Assistant link expires in {{1}} days.

To continue receiving updates:
1. Visit Settings > AI Assistant
2. Click "Renew Link"

Do not lose access to your AI assistant!`,
        example: {
          body_text: [['3']],
        },
      },
    ],
  },
  {
    name: 'nexora_ai_expired',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Link Expired',
      },
      {
        type: 'BODY',
        text: `Your Nexora AI Assistant link has expired.

To re-activate:
1. Visit Settings > AI Assistant
2. Link your WhatsApp again

We will be here when you are ready!`,
      },
    ],
  },
];

async function createTemplate(template) {
  try {
    console.log(`\n📝 Creating template: ${template.name}...`);

    const response = await fetch('https://api.msg91.com/api/v5/whatsapp/client-panel-template/', {
      method: 'POST',
      headers: {
        authkey: MSG91_AUTH_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        integrated_number: WHATSAPP_NUMBER,
        template_name: template.name,
        language: template.language,
        category: template.category,
        button_url: template.components.some((c) => c.type === 'BUTTONS'),
        components: template.components,
      }),
    });

    const data = await response.json();

    if (data.status === 'success' || response.ok) {
      console.log(`✅ ${template.name}: ${data.data?.message || 'Created successfully'}`);
      if (data.data?.template_id) {
        console.log(`   Template ID: ${data.data.template_id}`);
      }
      return { success: true, data };
    } else {
      console.log(`❌ ${template.name}: ${data.message || 'Failed'}`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
      return { success: false, data };
    }
  } catch (error) {
    console.error(`❌ ${template.name}: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🚀 Creating MSG91 WhatsApp Templates for AI Assistant\n');
  console.log(`WhatsApp Number: ${WHATSAPP_NUMBER}`);
  console.log(`Auth Key: ${MSG91_AUTH_KEY.substring(0, 10)}...`);

  const results = [];

  for (const template of templates) {
    const result = await createTemplate(template);
    results.push({ name: template.name, ...result });
    // Wait 2 seconds between requests to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary:\n');

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);

  console.log('\n📋 Templates created:');
  results
    .filter((r) => r.success)
    .forEach((r) => {
      console.log(`  • ${r.name}`);
    });

  if (failed > 0) {
    console.log('\n❌ Failed templates:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  • ${r.name}`);
      });
  }

  console.log('\n⏳ Templates are now pending approval from WhatsApp.');
  console.log('   Check MSG91 dashboard for approval status.');
  console.log('   Approval usually takes 1-2 hours.');
}

main().catch(console.error);
