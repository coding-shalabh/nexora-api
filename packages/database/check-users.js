import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      tenantId: true,
      firstName: true,
      lastName: true,
    },
  });

  console.log('📧 Users in database:');
  users.forEach((user) => {
    console.log(`  - ${user.email} (${user.firstName} ${user.lastName}) - Tenant: ${user.tenantId}`);
  });

  console.log(`\nTotal users: ${users.length}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
