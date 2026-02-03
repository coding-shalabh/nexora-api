import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  // Check what columns exist in templates table
  const cols = await prisma.$queryRaw`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'templates'
    ORDER BY ordinal_position
  `;
  console.log('Templates columns:', JSON.stringify(cols, null, 2));

  // Check what columns exist in channels table
  const chanCols = await prisma.$queryRaw`
    SELECT column_name, data_type, udt_name
    FROM information_schema.columns
    WHERE table_name = 'channels'
    ORDER BY ordinal_position
  `;
  console.log('\nChannels columns:', JSON.stringify(chanCols, null, 2));

  // Check if there are existing channels
  const channels = await prisma.$queryRaw`
    SELECT * FROM channels LIMIT 5
  `;
  console.log('\nExisting channels:', JSON.stringify(channels, null, 2));

  // Check for enum types
  const enums = await prisma.$queryRaw`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    ORDER BY t.typname, e.enumsortorder
  `;
  console.log('\nDatabase enums:', JSON.stringify(enums, null, 2));
}

check()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
