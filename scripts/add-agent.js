/**
 * Add agent user to Helix Code tenant
 */
import { prisma } from '../packages/database/src/index.js';
import bcrypt from 'bcryptjs';

async function addAgent() {
  const tenantId = 'cmk76mz0w00021230zcfawvtw';
  const workspaceId = 'cmk7ur80s0002noe46dip69wb';

  // Find the Sales Representative role
  const salesRepRole = await prisma.role.findFirst({
    where: {
      tenantId,
      name: 'Sales Representative',
    },
  });

  if (!salesRepRole) {
    console.error('Sales Representative role not found!');
    process.exit(1);
  }

  // Hash password
  const passwordHash = await bcrypt.hash('Demo123456', 12);

  // Create user
  const user = await prisma.user.create({
    data: {
      tenantId,
      email: 'arpit.sharma@helixcode.in',
      firstName: 'Arpit',
      lastName: 'Sharma',
      passwordHash,
      status: 'ACTIVE',
      emailVerified: true,
      settings: {
        timezone: 'Asia/Kolkata',
      },
    },
  });

  // Link to workspace
  await prisma.userWorkspace.create({
    data: {
      userId: user.id,
      workspaceId,
    },
  });

  // Assign role
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: salesRepRole.id,
    },
  });

  console.log('Agent created successfully!');
  console.log('Email:', user.email);
  console.log('User ID:', user.id);
  console.log('Password: Demo123456');

  await prisma.$disconnect();
}

addAgent().catch((e) => {
  console.error(e);
  process.exit(1);
});
