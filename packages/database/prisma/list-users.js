import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.$queryRaw`
    SELECT id, email, "firstName", "lastName", "tenantId"
    FROM users
    LIMIT 20
  `;
  console.log('All users:');
  console.log(JSON.stringify(users, null, 2));
}

main().finally(() => prisma.$disconnect());
