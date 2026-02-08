/**
 * Script to create Support Pipeline for tickets
 * Run with: node scripts/create-support-pipeline.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_ID = 'cmkpjtp1d0010ue6xfvy65ari'; // Default tenant

async function createSupportPipeline() {
  console.log('Creating Support Pipeline...');

  try {
    // Create the pipeline
    const pipeline = await prisma.pipeline.create({
      data: {
        tenantId: TENANT_ID,
        name: 'Support Pipeline',
        description: 'Pipeline for managing customer support tickets',
        type: 'DEAL', // Using DEAL type since TICKET type may not exist in schema
        isDefault: false,
      },
    });

    console.log('✓ Pipeline created:', pipeline.id);

    // Create stages
    const stages = [
      { name: 'New', color: '#94a3b8', order: 0, description: 'Newly created ticket' },
      { name: 'Open', color: '#3b82f6', order: 1, description: 'Ticket assigned and in progress' },
      { name: 'Pending', color: '#f59e0b', order: 2, description: 'Waiting for customer response' },
      { name: 'Resolved', color: '#10b981', order: 3, description: 'Issue resolved' },
      { name: 'Closed', color: '#6b7280', order: 4, description: 'Ticket closed', isClosed: true },
    ];

    for (const stageData of stages) {
      const stage = await prisma.stage.create({
        data: {
          tenantId: TENANT_ID,
          pipelineId: pipeline.id,
          ...stageData,
        },
      });
      console.log(`✓ Stage created: ${stage.name} (${stage.id})`);
    }

    console.log('\n✅ Support Pipeline created successfully!');
    console.log(`Pipeline ID: ${pipeline.id}`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createSupportPipeline();
