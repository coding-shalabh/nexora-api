import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = 'cmk76mz0w00021230zcfawvtw';

  console.log('Testing with raw SQL...');

  // Test 1: Direct query
  const test1 = await prisma.$queryRaw`
    SELECT COUNT(*) as count FROM templates WHERE "tenantId" = ${tenantId}
  `;
  console.log('Direct query count:', test1[0].count);

  // Test 2: Query with actual content
  const test2 = await prisma.$queryRaw`
    SELECT id, name FROM templates WHERE "tenantId" = ${tenantId} LIMIT 3
  `;
  console.log('Query results:', JSON.stringify(test2, null, 2));

  // Test 3: QueryRawUnsafe (like the service)
  const sql = `
    SELECT id, name, type, category, content, subject, variables, "isActive", "createdAt", "updatedAt"
    FROM templates
    WHERE "tenantId" = $1
    ORDER BY "createdAt" DESC
  `;
  const test3 = await prisma.$queryRawUnsafe(sql, tenantId);
  console.log('QueryRawUnsafe count:', test3.length);
  if (test3.length > 0) {
    console.log('First template:', JSON.stringify(test3[0], null, 2));
  }
}

main().finally(() => prisma.$disconnect());
