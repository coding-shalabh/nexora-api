import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.$queryRaw`
    SELECT id, name, "tenantId", type, content, "isActive"
    FROM templates
    WHERE "tenantId" = 'cmk76mz0w00021230zcfawvtw'
    LIMIT 10
  `;
  console.log('Templates for tenant cmk76mz0w00021230zcfawvtw:');
  console.log(JSON.stringify(templates, null, 2));
}

main().finally(() => prisma.$disconnect());
