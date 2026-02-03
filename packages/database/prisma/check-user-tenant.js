import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.$queryRaw`
    SELECT id, email, "tenantId"
    FROM users
    WHERE id = 'cmk7ya1ul00013xqdjhu66lx3'
  `;
  console.log('User from JWT:', JSON.stringify(users, null, 2));
}

main().finally(() => prisma.$disconnect());
