import { prisma } from '../packages/database/src/index.js';

const tenantId = 'cmk76mz0w00021230zcfawvtw';

const tenant = await prisma.tenant.findUnique({
  where: { id: tenantId },
});

console.log('Tenant:', tenant?.name || 'NOT FOUND');

const roles = await prisma.role.findMany({
  where: { tenantId },
});

console.log('Roles count:', roles.length);

const users = await prisma.user.findMany({
  where: { tenantId },
  select: { id: true, email: true, firstName: true, lastName: true }
});

console.log('Users:', users);

await prisma.$disconnect();
