import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const activityTypes = ['CALL', 'MEETING', 'EMAIL', 'TASK', 'NOTE'];
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

const activityTemplates = {
  CALL: [
    { subject: 'Discovery Call', description: 'Initial discovery call to understand needs and requirements.' },
    { subject: 'Follow-up Call', description: 'Follow-up discussion on proposal and next steps.' },
    { subject: 'Product Demo Call', description: 'Demonstrated key product features and answered questions.' },
    { subject: 'Pricing Discussion', description: 'Discussed pricing options and potential discounts.' },
    { subject: 'Technical Support Call', description: 'Resolved technical queries regarding integration.' },
  ],
  MEETING: [
    { subject: 'Introductory Meeting', description: 'Face-to-face meeting to establish relationship.' },
    { subject: 'Quarterly Business Review', description: 'Reviewed performance metrics and discussed expansion.' },
    { subject: 'Strategy Session', description: 'Discussed long-term strategy and partnership opportunities.' },
    { subject: 'Product Training Session', description: 'Conducted training on new features and best practices.' },
    { subject: 'Contract Negotiation', description: 'Meeting to finalize contract terms and conditions.' },
  ],
  EMAIL: [
    { subject: 'Welcome Email Sent', description: 'Sent welcome email with onboarding materials.' },
    { subject: 'Proposal Sent', description: 'Emailed detailed proposal with pricing breakdown.' },
    { subject: 'Follow-up on Meeting', description: 'Sent meeting summary and action items.' },
    { subject: 'Invoice Reminder', description: 'Sent friendly reminder about pending invoice.' },
    { subject: 'Newsletter Sent', description: 'Monthly newsletter with product updates.' },
  ],
  TASK: [
    { subject: 'Prepare Proposal', description: 'Draft and send customized proposal document.' },
    { subject: 'Update CRM Record', description: 'Update contact information and notes in CRM.' },
    { subject: 'Schedule Demo', description: 'Arrange product demonstration session.' },
    { subject: 'Send Contract', description: 'Prepare and send contract for review.' },
    { subject: 'Review Requirements', description: 'Review client requirements document.' },
  ],
  NOTE: [
    { subject: 'Important Note', description: 'Key decision maker. Very interested in enterprise features.' },
    { subject: 'Budget Information', description: 'Budget approved for Q1. Ready to proceed.' },
    { subject: 'Competition Alert', description: 'Currently evaluating our competitor. Need to highlight differentiators.' },
    { subject: 'Expansion Opportunity', description: 'Potential to expand to other departments.' },
    { subject: 'Contract Renewal', description: 'Contract up for renewal in 3 months. Start early discussions.' },
  ],
};

const callOutcomes = ['Connected', 'Left Voicemail', 'No Answer', 'Busy', 'Wrong Number'];
const meetingLocations = [
  'Virtual - Zoom',
  'Virtual - Google Meet',
  'Office - Conference Room A',
  'Client Office',
  'Coffee Shop',
];

function randomFromArray(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPastDate(maxDaysAgo = 30) {
  const daysAgo = Math.floor(Math.random() * maxDaysAgo) + 1;
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

function randomFutureDate(maxDaysAhead = 14) {
  const daysAhead = Math.floor(Math.random() * maxDaysAhead) + 1;
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log('Adding activities to contacts...\n');

  // Get tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'acme-corp' },
  });

  if (!tenant) {
    console.error('Tenant not found. Run seed first.');
    process.exit(1);
  }

  // Get user (admin)
  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id },
  });

  if (!user) {
    console.error('User not found. Run seed first.');
    process.exit(1);
  }

  // Get all contacts
  const contacts = await prisma.contact.findMany({
    where: { tenantId: tenant.id },
    include: { company: true },
  });

  console.log(`Found ${contacts.length} contacts\n`);

  let totalActivities = 0;

  for (const contact of contacts) {
    // Generate 3-6 activities per contact
    const numActivities = Math.floor(Math.random() * 4) + 3;

    console.log(`Adding ${numActivities} activities for ${contact.firstName} ${contact.lastName}...`);

    for (let i = 0; i < numActivities; i++) {
      const type = randomFromArray(activityTypes);
      const template = randomFromArray(activityTemplates[type]);
      const isPast = Math.random() > 0.3; // 70% chance of being completed

      const activityData = {
        tenantId: tenant.id,
        type,
        subject: template.subject,
        description: template.description,
        contactId: contact.id,
        companyId: contact.companyId || null,
        priority: randomFromArray(priorities),
        assignedToId: user.id,
        createdById: user.id,
        dueDate: isPast ? randomPastDate() : randomFutureDate(),
        completedAt: isPast ? randomPastDate() : null,
      };

      // Add type-specific fields
      if (type === 'CALL') {
        activityData.callOutcome = isPast ? randomFromArray(callOutcomes) : null;
        activityData.callDuration = isPast ? Math.floor(Math.random() * 45) + 5 : null;
      }

      if (type === 'MEETING') {
        activityData.meetingLocation = randomFromArray(meetingLocations);
        if (activityData.meetingLocation.startsWith('Virtual')) {
          activityData.meetingUrl = 'https://meet.example.com/' + Math.random().toString(36).substring(7);
        }
      }

      await prisma.activity.create({ data: activityData });
      totalActivities++;
    }
  }

  console.log(`\nSuccessfully created ${totalActivities} activities!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
