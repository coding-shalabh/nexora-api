import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check tenants
  const tenants = await prisma.$queryRaw`SELECT id, name FROM tenants ORDER BY name`;
  console.log('All tenants:', JSON.stringify(tenants, null, 2));

  // Check templates for Railway tenant
  const railwayCount = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM templates WHERE "tenantId" = 'cmk76mz0w00021230zcfawvtw'
  `;
  console.log('\nTemplates for Railway tenant (cmk76mz0w00021230zcfawvtw):', railwayCount[0].count);

  // Check templates for all tenants
  for (const tenant of tenants) {
    const count =
      await prisma.$queryRaw`SELECT COUNT(*) as count FROM templates WHERE "tenantId" = ${tenant.id}`;
    console.log(`Templates for ${tenant.name}: ${count[0].count}`);
  }

  // List first 3 templates from Railway tenant
  const samples = await prisma.$queryRaw`
    SELECT id, name, type FROM templates WHERE "tenantId" = 'cmk76mz0w00021230zcfawvtw' LIMIT 3
  `;
  console.log('\nSample templates from Railway tenant:', JSON.stringify(samples, null, 2));
}

main().finally(() => prisma.$disconnect());
