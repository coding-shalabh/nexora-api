import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const accounts = await prisma.channelAccount.findMany({ where: { type: 'WHATSAPP' } });
  console.log('WhatsApp Accounts:', accounts.length);

  for (const a of accounts) {
    console.log('---');
    console.log('ID:', a.id);
    console.log('Name:', a.name);
    console.log('Phone:', a.phoneNumber);
    console.log('Provider:', a.provider);
    console.log('Setup Mode:', a.whatsappSetupMode);
    console.log('Direct msg91AuthKey Present:', !!a.msg91AuthKey);
    if (a.msg91AuthKey) {
      const key = a.msg91AuthKey;
      console.log('Direct msg91AuthKey:', key.substring(0, 10) + '...' + key.substring(key.length - 4));
    }
    console.log('providerConfig.msg91AuthKey Present:', !!a.providerConfig?.msg91AuthKey);
    if (a.providerConfig?.msg91AuthKey) {
      const key = a.providerConfig.msg91AuthKey;
      console.log('providerConfig.msg91AuthKey:', key.substring(0, 10) + '...' + key.substring(key.length - 4));
    }
    console.log('Full Config:', JSON.stringify(a.providerConfig, null, 2));
  }

  // Check env variable
  console.log('\n--- ENV ---');
  console.log('MSG91_AUTH_KEY from env:', process.env.MSG91_AUTH_KEY ? 'SET' : 'NOT SET');

  await prisma.$disconnect();
}
check().catch(console.error);
