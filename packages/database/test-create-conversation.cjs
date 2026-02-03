const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get the WhatsApp channel account
  const channelAccount = await prisma.channelAccount.findFirst({
    where: { tenantId: 'cmk81wctq0000bh673trfbhfy', type: 'WHATSAPP' },
  });
  console.log('Channel Account:', channelAccount ? channelAccount.id : 'not found');

  // Get a channel record for WhatsApp
  const channel = await prisma.channel.findFirst({
    where: { tenantId: 'cmk81wctq0000bh673trfbhfy', type: 'WHATSAPP' },
  });
  console.log('Channel:', channel ? channel.id : 'not found');

  let channelId = channel ? channel.id : null;

  // If no channel, create one
  if (!channelId) {
    const newChannel = await prisma.channel.create({
      data: {
        tenantId: 'cmk81wctq0000bh673trfbhfy',
        type: 'WHATSAPP',
        name: 'WhatsApp',
        status: 'ACTIVE',
      },
    });
    channelId = newChannel.id;
    console.log('Created Channel:', channelId);
  }

  // Create a test conversation in the conversations table
  const conversation = await prisma.conversation.create({
    data: {
      tenantId: 'cmk81wctq0000bh673trfbhfy',
      channelId: channelId,
      contactPhone: '917987278543',
      status: 'OPEN',
      priority: 'MEDIUM',
      isStarred: false,
      lastMessageAt: new Date(),
      lastCustomerMessageAt: new Date(),
      unreadCount: 1,
      messageCount: 1,
      lastMessagePreview: 'Hello from Nexora CRM! This is a test message.',
      lastMessageChannel: 'WHATSAPP',
    },
  });
  console.log('Created conversation:', conversation.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
