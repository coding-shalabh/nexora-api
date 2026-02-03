import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedEmailConversations() {
  console.log('Seeding email conversations...');

  // Use the specific tenant ID for admin@helixcode.in user
  const targetTenantId = 'cmk76mz0w00021230zcfawvtw';

  let tenant = await prisma.tenant.findUnique({
    where: { id: targetTenantId },
  });

  if (!tenant) {
    // Fallback - try to find by name
    tenant = await prisma.tenant.findFirst({
      where: { name: 'Helix Code Inc' },
    });
  }

  if (!tenant) {
    console.error('No tenant found!');
    const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
    console.log('Available tenants:', tenants);
    return;
  }

  console.log(`Using tenant: ${tenant.name} (${tenant.id})`);

  // Get or create email Channel (for Conversation model)
  let emailChannel = await prisma.channel.findFirst({
    where: {
      tenantId: tenant.id,
      type: 'EMAIL',
    },
  });

  if (!emailChannel) {
    emailChannel = await prisma.channel.create({
      data: {
        tenantId: tenant.id,
        type: 'EMAIL',
        name: 'Helix Code Email',
        provider: 'smtp',
        status: 'ACTIVE',
        providerConfig: {
          email: 'hello@helixcode.in',
          host: 'smtp.helixcode.in',
          port: 587,
        },
      },
    });
    console.log('Created email channel');
  }

  console.log(`Using email channel: ${emailChannel.name} (${emailChannel.id})`);

  // Get user for assignment
  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id },
  });

  // Create email contacts
  const emailContacts = [
    {
      firstName: 'James',
      lastName: 'Wilson',
      email: 'james.wilson@techcorp.com',
      company: 'TechCorp Solutions',
    },
    {
      firstName: 'Emily',
      lastName: 'Chen',
      email: 'emily.chen@startup.io',
      company: 'Startup.io',
    },
    {
      firstName: 'Michael',
      lastName: 'Brown',
      email: 'michael.brown@enterprise.com',
      company: 'Enterprise Ltd',
    },
    {
      firstName: 'Sarah',
      lastName: 'Davis',
      email: 'sarah.davis@retail.com',
      company: 'Retail Plus',
    },
    {
      firstName: 'David',
      lastName: 'Lee',
      email: 'david.lee@consulting.com',
      company: 'Consulting Group',
    },
  ];

  const createdContacts = [];

  for (const contactData of emailContacts) {
    // Check if contact already exists
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId: tenant.id,
        email: contactData.email,
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId: tenant.id,
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          email: contactData.email,
          source: 'EMAIL',
        },
      });
    }
    createdContacts.push(contact);
  }

  console.log(`Created/found ${createdContacts.length} email contacts`);

  // Email conversations data using Conversation model
  const emailConversations = [
    {
      contactIndex: 0,
      status: 'OPEN',
      assignedToId: user?.id,
      subject: 'Urgent: API Integration Issues',
      lastMessage: 'Thanks for the quick response! Issues started around 2 AM UTC today...',
      minutesAgo: 15,
    },
    {
      contactIndex: 1,
      status: 'OPEN',
      assignedToId: null,
      subject: 'Feature Request: Custom Dashboard',
      lastMessage: "I'm the product manager at Startup.io and we've been using your platform...",
      minutesAgo: 180,
    },
    {
      contactIndex: 2,
      status: 'PENDING',
      assignedToId: user?.id,
      subject: 'Contract Renewal Discussion',
      lastMessage: 'Thursday 10 AM works perfectly. Looking forward to it.',
      minutesAgo: 240,
    },
    {
      contactIndex: 3,
      status: 'RESOLVED',
      assignedToId: user?.id,
      subject: 'Invoice Query - INV-2024-0892',
      lastMessage: 'That makes sense now. Thank you for the quick clarification!',
      minutesAgo: 1320,
    },
    {
      contactIndex: 4,
      status: 'OPEN',
      assignedToId: null,
      subject: 'Partnership Opportunity',
      lastMessage:
        "I'm reaching out on behalf of Consulting Group regarding a potential partnership...",
      minutesAgo: 90,
    },
  ];

  // Create conversations using the Conversation model
  for (const convData of emailConversations) {
    const contact = createdContacts[convData.contactIndex];

    // Delete existing conversation if exists (to allow re-seeding)
    const existingConv = await prisma.conversation.findFirst({
      where: {
        tenantId: tenant.id,
        contactId: contact.id,
        channelType: 'EMAIL',
      },
    });

    if (existingConv) {
      await prisma.conversation.delete({
        where: { id: existingConv.id },
      });
      console.log(`Deleted existing conversation for ${contact.email}`);
    }

    const lastMsgTime = new Date(Date.now() - convData.minutesAgo * 60000);

    await prisma.conversation.create({
      data: {
        tenantId: tenant.id,
        channelId: emailChannel.id,
        channelType: 'EMAIL',
        contactId: contact.id,
        contactName: `${contact.firstName} ${contact.lastName}`,
        status: convData.status,
        assignedToId: convData.assignedToId,
        lastMessagePreview: convData.lastMessage.slice(0, 100),
        lastCustomerMessageAt: lastMsgTime,
        unreadCount: convData.status === 'RESOLVED' ? 0 : 1,
      },
    });

    console.log(`Created email conversation: ${convData.subject}`);
  }

  console.log('Email conversations seeded successfully!');
}

seedEmailConversations()
  .catch((e) => {
    console.error('Error seeding email conversations:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
