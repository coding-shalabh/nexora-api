import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const newPwd = 'Demo123456';
  const hash = await bcrypt.hash(newPwd, 12);

  // Update hash for arpit.sharma@helixcode.in
  const result = await prisma.$executeRaw`
    UPDATE users
    SET "passwordHash" = ${hash}
    WHERE email = 'arpit.sharma@helixcode.in'
  `;

  console.log('Updated rows:', result);
  console.log('Credentials updated!');
}

main()
  .catch((e) => {
    console.error('Error:', e);
  })
  .finally(() => prisma.$disconnect());
