import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateTemplates() {
  console.log('Updating templates with type and content...\n');

  // Get all templates that need updating
  const templates = await prisma.$queryRaw`
    SELECT id, "channelId", "bodyContent"
    FROM templates
    WHERE type IS NULL OR content IS NULL
  `;

  console.log(`Found ${templates.length} templates to update\n`);

  let updated = 0;
  for (const t of templates) {
    try {
      // Get channel type
      const channels = await prisma.$queryRaw`
        SELECT type FROM channels WHERE id = ${t.channelId}
      `;

      const channelType = channels[0]?.type || 'EMAIL';

      // Update the template
      await prisma.$executeRaw`
        UPDATE templates
        SET type = ${channelType}, content = ${t.bodyContent || ''}
        WHERE id = ${t.id}
      `;

      updated++;
      console.log(`✓ Updated: ${t.id} -> ${channelType}`);
    } catch (error) {
      console.error(`✗ Failed: ${t.id}`, error.message);
    }
  }

  console.log(`\nDone! Updated ${updated} templates.`);
}

updateTemplates()
  .catch((e) => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());
