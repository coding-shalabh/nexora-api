/**
 * Seed the first SuperAdmin account
 * Run: node packages/database/prisma/seed-super-admin.js
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'sa@nexoraos.pro';
  const password = 'Nexora@SuperAdmin2025';

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.superAdmin.upsert({
    where: { email },
    update: { passwordHash, isActive: true },
    create: {
      email,
      passwordHash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.log('✅ Super admin created/updated:');
  console.log('   Email   :', admin.email);
  console.log('   Password: Nexora@SuperAdmin2025');
  console.log('   Role    :', admin.role);
  console.log('');
  console.log('Login at: http://localhost:3001/super-admin/login');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
