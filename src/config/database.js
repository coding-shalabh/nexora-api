/**
 * Database Configuration
 *
 * Centralized Prisma Client instance for the application
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../common/logger.js';

// Create a single Prisma Client instance
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  logger.info('Prisma client disconnected');
});

// Export as named exports for flexibility
export const db = prisma;
export default prisma;
