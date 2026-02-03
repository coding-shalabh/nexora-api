import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Voice Calls Seed Data
 * Creates demo call records with transcriptions, AI summaries, and various statuses
 * Uses raw SQL for compatibility with different schema configurations
 */

// Sample transcriptions with speaker labels
const transcriptions = {
  salesCall: `Agent: Hello, this is Sarah from Helix Code. Am I speaking with John Smith?
Customer: Yes, this is John. How can I help you?
Agent: Hi John! I'm following up on your inquiry about our Enterprise CRM solution. You mentioned you're looking to consolidate your sales tools.
Customer: Yes, we're currently using three different platforms and it's becoming quite challenging to manage.
Agent: I completely understand. Our platform integrates all those functions into one unified system. Would you have time this week for a quick demo?
Customer: That sounds great. How about Thursday at 2 PM?
Agent: Perfect! I'll send you a calendar invite. Is there anything specific you'd like me to cover in the demo?
Customer: Mainly the reporting features and how it integrates with our existing ERP system.
Agent: Absolutely, I'll prepare some custom reports for your industry. Looking forward to our call!
Customer: Thanks Sarah, see you Thursday.`,

  supportCall: `Agent: Thank you for calling Helix Support, my name is Mike. How can I assist you today?
Customer: Hi Mike, I'm having trouble with the email integration. It was working yesterday but now I'm getting sync errors.
Agent: I'm sorry to hear that. Let me look into this for you. Can you tell me which email provider you're using?
Customer: We're using Microsoft 365.
Agent: Got it. I can see there was a token refresh issue on your account. Let me re-authenticate the connection for you.
Customer: Okay, thanks.
Agent: Done! I've reset the OAuth token. Could you try syncing again?
Customer: Let me check... Yes! It's working now. That was fast!
Agent: Great! Is there anything else I can help you with today?
Customer: No, that's all. Thank you so much for the quick resolution!
Agent: You're welcome! Have a great day!`,

  followUpCall: `Agent: Hi, this is David from Helix Code. I'm calling to follow up on the proposal we sent last week.
Customer: Oh yes, David. We've reviewed it with the team.
Agent: Excellent! Do you have any questions or concerns about the pricing or implementation timeline?
Customer: The pricing looks good. Our main concern is the data migration from our current system.
Agent: That's a common concern. We offer a dedicated migration specialist who handles the entire process. It typically takes 2-3 weeks depending on data volume.
Customer: That's reassuring. What about training for our team?
Agent: We include 3 sessions of live training plus unlimited access to our learning portal. We also provide on-call support during the first month.
Customer: Sounds comprehensive. I'll discuss with my CFO and get back to you by Friday.
Agent: Perfect. I'll send you a case study from a similar company in your industry. It might help with the discussion.
Customer: That would be helpful. Thanks, David.`,
};

// AI Summaries based on Dialpad/Aircall features
const aiSummaries = {
  salesCall: {
    overview:
      'Sales follow-up call with John Smith regarding Enterprise CRM inquiry. Customer expressed frustration with managing multiple platforms. Demo scheduled for Thursday 2 PM to discuss reporting features and ERP integration.',
    keyPoints: [
      'Customer currently using 3 different platforms',
      'Main interest: unified system and consolidation',
      'Demo scheduled for Thursday 2 PM',
      'Focus areas: reporting and ERP integration',
    ],
    sentiment: 'positive',
    callPurpose: 'Sales Follow-up',
    actionItems: [
      'Send calendar invite for Thursday 2 PM demo',
      'Prepare industry-specific custom reports',
      'Research ERP integration documentation',
    ],
    customerMood: 'interested',
    talkListenRatio: { agent: 45, customer: 55 },
    keywords: ['enterprise', 'CRM', 'integration', 'demo', 'reporting'],
  },
  supportCall: {
    overview:
      'Technical support call regarding Microsoft 365 email integration sync errors. Issue resolved by resetting OAuth token. Customer satisfied with quick resolution.',
    keyPoints: [
      'Email sync errors with Microsoft 365',
      'Root cause: OAuth token refresh failure',
      'Resolution: Token re-authentication',
      'Issue resolved in single call',
    ],
    sentiment: 'positive',
    callPurpose: 'Technical Support',
    actionItems: [
      'Monitor account for sync stability',
      'Document token refresh issue in knowledge base',
    ],
    customerMood: 'satisfied',
    talkListenRatio: { agent: 60, customer: 40 },
    keywords: ['email', 'sync', 'Microsoft 365', 'OAuth', 'integration'],
  },
  followUpCall: {
    overview:
      'Proposal follow-up with decision maker. Customer reviewed proposal with team. Main concerns around data migration and training. Decision expected by Friday.',
    keyPoints: [
      'Proposal reviewed by customer team',
      'Pricing acceptable',
      'Migration timeline: 2-3 weeks',
      '3 training sessions included',
      'Decision expected by Friday',
    ],
    sentiment: 'positive',
    callPurpose: 'Proposal Follow-up',
    actionItems: [
      'Send industry case study',
      'Follow up on Friday for decision',
      'Prepare migration timeline document',
    ],
    customerMood: 'interested',
    talkListenRatio: { agent: 55, customer: 45 },
    keywords: ['proposal', 'migration', 'training', 'decision', 'implementation'],
  },
};

function generateId() {
  return (
    'call_' +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

async function main() {
  console.log('Seeding voice call demo data...');

  // Get the test tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'helix-code' },
  });

  if (!tenant) {
    console.error('Tenant "helix-code" not found. Run the main seed first.');
    return;
  }

  console.log('Found tenant:', tenant.name);

  // Get or create voice channel using raw SQL for compatibility
  let voiceChannels = await prisma.$queryRaw`
    SELECT id, name, "phoneNumber" FROM channel_accounts
    WHERE "tenantId" = ${tenant.id} AND type = 'VOICE'
    LIMIT 1
  `;

  let voiceChannel = voiceChannels[0];
  if (!voiceChannel) {
    console.log('Creating voice channel...');
    await prisma.$executeRaw`
      INSERT INTO channel_accounts (id, "tenantId", type, name, "phoneNumber", identifier, provider, status, "healthStatus", "isActive", "createdAt", "updatedAt")
      VALUES ('voice-channel-demo', ${tenant.id}, 'VOICE', 'Demo Voice Line', '+1 800 555 0102', '+1 800 555 0102', 'TELECMI', 'ACTIVE', 'HEALTHY', true, NOW(), NOW())
    `;
    voiceChannels = await prisma.$queryRaw`
      SELECT id, name, "phoneNumber" FROM channel_accounts WHERE id = 'voice-channel-demo'
    `;
    voiceChannel = voiceChannels[0];
  }
  console.log('Voice channel:', voiceChannel?.name);

  // Get the admin user
  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id },
  });
  console.log('User:', user?.email);

  // Get existing contacts using raw SQL
  const contacts = await prisma.$queryRaw`
    SELECT id, phone, "firstName", "lastName" FROM contacts
    WHERE "tenantId" = ${tenant.id}
    LIMIT 10
  `;
  console.log('Found contacts:', contacts.length);

  // Demo phone numbers
  const demoPhones = [
    '+1 415 555 0123',
    '+1 212 555 0456',
    '+1 310 555 0789',
    '+1 650 555 0321',
    '+1 408 555 0654',
  ];

  // Delete existing demo calls using raw SQL
  await prisma.$executeRaw`DELETE FROM call_sessions WHERE "providerCallId" LIKE 'demo-%' AND "tenantId" = ${tenant.id}`;
  console.log('Deleted existing demo calls');

  const now = new Date();

  // Insert calls using raw SQL for compatibility
  const calls = [
    // 1. Completed sales call - 15 minutes ago
    {
      id: generateId(),
      tenantId: tenant.id,
      channelAccountId: voiceChannel.id,
      contactId: contacts[0]?.id || null,
      userId: user?.id,
      direction: 'OUTBOUND',
      fromNumber: voiceChannel.phoneNumber,
      toNumber: contacts[0]?.phone || demoPhones[0],
      phone: contacts[0]?.phone || demoPhones[0],
      status: 'COMPLETED',
      initiatedAt: new Date(now.getTime() - 15 * 60 * 1000),
      startedAt: new Date(now.getTime() - 15 * 60 * 1000),
      answeredAt: new Date(now.getTime() - 14 * 60 * 1000),
      endedAt: new Date(now.getTime() - 5 * 60 * 1000),
      duration: 540,
      recordingUrl: 'https://api.twilio.com/demo-recording-1.mp3',
      transcription: transcriptions.salesCall,
      disposition: 'INTERESTED',
      providerCallId: 'demo-call-001',
      metadata: { aiSummary: aiSummaries.salesCall, callScore: 92 },
      notes: JSON.stringify([
        {
          id: 'n1',
          content: 'Customer very interested in enterprise features',
          createdAt: now.toISOString(),
        },
      ]),
    },
    // 2. Support call - 1 hour ago
    {
      id: generateId(),
      tenantId: tenant.id,
      channelAccountId: voiceChannel.id,
      contactId: contacts[1]?.id || null,
      userId: user?.id,
      direction: 'INBOUND',
      fromNumber: contacts[1]?.phone || demoPhones[1],
      toNumber: voiceChannel.phoneNumber,
      phone: contacts[1]?.phone || demoPhones[1],
      status: 'COMPLETED',
      initiatedAt: new Date(now.getTime() - 60 * 60 * 1000),
      startedAt: new Date(now.getTime() - 60 * 60 * 1000),
      answeredAt: new Date(now.getTime() - 59 * 60 * 1000),
      endedAt: new Date(now.getTime() - 54 * 60 * 1000),
      duration: 300,
      recordingUrl: 'https://api.twilio.com/demo-recording-2.mp3',
      transcription: transcriptions.supportCall,
      disposition: 'FOLLOW_UP_NEEDED',
      providerCallId: 'demo-call-002',
      metadata: { aiSummary: aiSummaries.supportCall, callScore: 95, firstCallResolution: true },
      notes: JSON.stringify([
        { id: 'n3', content: 'OAuth token issue resolved', createdAt: now.toISOString() },
      ]),
    },
    // 3. Missed call - 2 hours ago
    {
      id: generateId(),
      tenantId: tenant.id,
      channelAccountId: voiceChannel.id,
      contactId: contacts[2]?.id || null,
      userId: user?.id,
      direction: 'INBOUND',
      fromNumber: contacts[2]?.phone || demoPhones[2],
      toNumber: voiceChannel.phoneNumber,
      phone: contacts[2]?.phone || demoPhones[2],
      status: 'MISSED',
      initiatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      endedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000 + 30000),
      duration: 0,
      providerCallId: 'demo-call-003',
      metadata: { ringDuration: 30, missedReason: 'No answer' },
    },
    // 4. Follow-up call - 3 hours ago
    {
      id: generateId(),
      tenantId: tenant.id,
      channelAccountId: voiceChannel.id,
      contactId: contacts[3]?.id || null,
      userId: user?.id,
      direction: 'OUTBOUND',
      fromNumber: voiceChannel.phoneNumber,
      toNumber: contacts[3]?.phone || demoPhones[3],
      phone: contacts[3]?.phone || demoPhones[3],
      status: 'COMPLETED',
      initiatedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      startedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      answeredAt: new Date(now.getTime() - 3 * 60 * 60 * 1000 + 15000),
      endedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000 + 8 * 60 * 1000),
      duration: 465,
      recordingUrl: 'https://api.twilio.com/demo-recording-3.mp3',
      transcription: transcriptions.followUpCall,
      disposition: 'CALLBACK_REQUESTED',
      providerCallId: 'demo-call-004',
      metadata: { aiSummary: aiSummaries.followUpCall, callScore: 88 },
      notes: JSON.stringify([
        {
          id: 'n4',
          content: 'CFO needs to approve - follow up Friday',
          createdAt: now.toISOString(),
        },
      ]),
    },
    // 5. Busy signal - 4 hours ago
    {
      id: generateId(),
      tenantId: tenant.id,
      channelAccountId: voiceChannel.id,
      contactId: null,
      userId: user?.id,
      direction: 'OUTBOUND',
      fromNumber: voiceChannel.phoneNumber,
      toNumber: demoPhones[4],
      phone: demoPhones[4],
      status: 'BUSY',
      initiatedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      startedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
      endedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000 + 5000),
      duration: 0,
      providerCallId: 'demo-call-005',
      metadata: { retryScheduled: true },
    },
    // 6. Completed yesterday
    {
      id: generateId(),
      tenantId: tenant.id,
      channelAccountId: voiceChannel.id,
      contactId: contacts[4]?.id || null,
      userId: user?.id,
      direction: 'OUTBOUND',
      fromNumber: voiceChannel.phoneNumber,
      toNumber: contacts[4]?.phone || '+1 555 123 4567',
      phone: contacts[4]?.phone || '+1 555 123 4567',
      status: 'COMPLETED',
      initiatedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      startedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      answeredAt: new Date(now.getTime() - 24 * 60 * 60 * 1000 + 10000),
      endedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000 + 2 * 60 * 1000),
      duration: 110,
      recordingUrl: 'https://api.twilio.com/demo-recording-4.mp3',
      disposition: 'FOLLOW_UP_NEEDED',
      providerCallId: 'demo-call-006',
      metadata: { callScore: 72, prospectType: 'cold' },
    },
    // 7. Demo call yesterday
    {
      id: generateId(),
      tenantId: tenant.id,
      channelAccountId: voiceChannel.id,
      contactId: contacts[5]?.id || null,
      userId: user?.id,
      direction: 'OUTBOUND',
      fromNumber: voiceChannel.phoneNumber,
      toNumber: contacts[5]?.phone || '+1 555 987 6543',
      phone: contacts[5]?.phone || '+1 555 987 6543',
      status: 'COMPLETED',
      initiatedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000),
      startedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000),
      answeredAt: new Date(now.getTime() - 20 * 60 * 60 * 1000 + 5000),
      endedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000 + 35 * 60 * 1000),
      duration: 2095,
      recordingUrl: 'https://api.twilio.com/demo-recording-5.mp3',
      disposition: 'INTERESTED',
      providerCallId: 'demo-call-007',
      metadata: { callScore: 94, attendeeCount: 4, demoType: 'full_product' },
    },
    // 8. Voicemail - 2 days ago
    {
      id: generateId(),
      tenantId: tenant.id,
      channelAccountId: voiceChannel.id,
      contactId: contacts[6]?.id || null,
      userId: user?.id,
      direction: 'OUTBOUND',
      fromNumber: voiceChannel.phoneNumber,
      toNumber: contacts[6]?.phone || '+1 555 456 7890',
      phone: contacts[6]?.phone || '+1 555 456 7890',
      status: 'COMPLETED',
      initiatedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      startedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000),
      answeredAt: new Date(now.getTime() - 48 * 60 * 60 * 1000 + 20000),
      endedAt: new Date(now.getTime() - 48 * 60 * 60 * 1000 + 50000),
      duration: 30,
      recordingUrl: 'https://api.twilio.com/demo-voicemail-1.mp3',
      disposition: 'LEFT_VOICEMAIL',
      providerCallId: 'demo-call-008',
      metadata: { voicemailLeft: true, voicemailDuration: 25 },
    },
    // 9. Failed call - 3 days ago
    {
      id: generateId(),
      tenantId: tenant.id,
      channelAccountId: voiceChannel.id,
      contactId: null,
      userId: user?.id,
      direction: 'OUTBOUND',
      fromNumber: voiceChannel.phoneNumber,
      toNumber: '+1 555 000 0000',
      phone: '+1 555 000 0000',
      status: 'FAILED',
      initiatedAt: new Date(now.getTime() - 72 * 60 * 60 * 1000),
      startedAt: new Date(now.getTime() - 72 * 60 * 60 * 1000),
      endedAt: new Date(now.getTime() - 72 * 60 * 60 * 1000 + 3000),
      duration: 0,
      errorMessage: 'Invalid phone number',
      providerCallId: 'demo-call-009',
      metadata: { errorCode: 'INVALID_NUMBER' },
    },
    // 10. Missed inbound - 3 days ago
    {
      id: generateId(),
      tenantId: tenant.id,
      channelAccountId: voiceChannel.id,
      contactId: contacts[7]?.id || null,
      userId: null,
      direction: 'INBOUND',
      fromNumber: contacts[7]?.phone || '+1 555 222 3333',
      toNumber: voiceChannel.phoneNumber,
      phone: contacts[7]?.phone || '+1 555 222 3333',
      status: 'MISSED',
      initiatedAt: new Date(now.getTime() - 74 * 60 * 60 * 1000),
      startedAt: new Date(now.getTime() - 74 * 60 * 60 * 1000),
      endedAt: new Date(now.getTime() - 74 * 60 * 60 * 1000 + 45000),
      duration: 0,
      providerCallId: 'demo-call-010',
      metadata: { ringDuration: 45, afterHours: true },
    },
  ];

  // Insert each call
  for (const call of calls) {
    try {
      await prisma.$executeRaw`
        INSERT INTO call_sessions (
          id, "tenantId", "channelAccountId", "contactId", "userId",
          direction, "fromNumber", "toNumber", phone, status,
          "initiatedAt", "startedAt", "answeredAt", "endedAt", duration,
          "recordingUrl", transcription, disposition, "providerCallId",
          metadata, notes, "errorMessage", "createdAt", "updatedAt"
        ) VALUES (
          ${call.id}, ${call.tenantId}, ${call.channelAccountId}, ${call.contactId}, ${call.userId},
          ${call.direction}, ${call.fromNumber}, ${call.toNumber}, ${call.phone}, ${call.status}::"CallStatus",
          ${call.initiatedAt}, ${call.startedAt}, ${call.answeredAt || null}, ${call.endedAt}, ${call.duration || 0},
          ${call.recordingUrl || null}, ${call.transcription || null}, ${call.disposition || null}, ${call.providerCallId},
          ${JSON.stringify(call.metadata)}::jsonb, ${call.notes || null}, ${call.errorMessage || null}, NOW(), NOW()
        )
      `;
      console.log(`Created call: ${call.providerCallId}`);
    } catch (err) {
      console.error(`Failed to create ${call.providerCallId}:`, err.message);
    }
  }

  console.log(`\nCreated ${calls.length} demo voice calls`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
