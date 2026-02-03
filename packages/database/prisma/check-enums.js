import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check category enum
  const categoryEnum = await prisma.$queryRaw`
    SELECT enumlabel FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TemplateCategory'
  `;
  console.log('TemplateCategory enum values:', categoryEnum);

  // Check status enum
  const statusEnum = await prisma.$queryRaw`
    SELECT enumlabel FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TemplateStatus'
  `;
  console.log('TemplateStatus enum values:', statusEnum);

  // Check headerType enum
  const headerEnum = await prisma.$queryRaw`
    SELECT enumlabel FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'TemplateHeaderType'
  `;
  console.log('TemplateHeaderType enum values:', headerEnum);

  // Check channels table
  const channels = await prisma.$queryRaw`
    SELECT id, type, name FROM channels LIMIT 10
  `;
  console.log('\nChannels in database:', channels);
}

main().finally(() => prisma.$disconnect());
