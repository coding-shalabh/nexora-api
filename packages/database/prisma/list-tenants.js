import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.$queryRaw`SELECT id, name, slug FROM tenants`;
  console.log('All tenants:');
  console.log(JSON.stringify(tenants, null, 2));
}

main().finally(() => prisma.$disconnect());
