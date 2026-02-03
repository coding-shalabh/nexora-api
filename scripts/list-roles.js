import { prisma } from '../packages/database/src/index.js';

const tenantId = 'cmk76mz0w00021230zcfawvtw';

const roles = await prisma.role.findMany({
  where: { tenantId },
});

console.log('Roles for tenant:', tenantId);
console.log(JSON.stringify(roles, null, 2));

await prisma.$disconnect();
