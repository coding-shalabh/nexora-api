import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const columns = await prisma.$queryRaw`
    SELECT column_name, is_nullable, column_default, data_type
    FROM information_schema.columns
    WHERE table_name = 'channels'
    ORDER BY ordinal_position
  `;
  console.log('Channels table columns:');
  console.log(JSON.stringify(columns, null, 2));
}

main().finally(() => prisma.$disconnect());
