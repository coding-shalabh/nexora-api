/**
 * Background Workers Initialization
 * Starts all BullMQ workers for processing background jobs
 */

import { logger } from '../common/logger.js';
import { meetingRemindersWorker, checkPendingReminders } from '../jobs/meeting-reminders.job.js';

/**
 * Initialize all background workers
 */
export async function initializeWorkers() {
  logger.info('Initializing background workers...');

  // Meeting reminders worker is automatically started on import

  // Schedule cron job to check for pending reminders every 5 minutes
  setInterval(
    async () => {
      try {
        await checkPendingReminders();
      } catch (error) {
        logger.error({ error: error.message }, 'Error checking pending reminders');
      }
    },
    5 * 60 * 1000
  ); // 5 minutes

  logger.info('Background workers initialized successfully');
}

/**
 * Graceful shutdown of all workers
 */
export async function shutdownWorkers() {
  logger.info('Shutting down background workers...');

  try {
    await meetingRemindersWorker.close();
    logger.info('Meeting reminders worker closed');
  } catch (error) {
    logger.error({ error: error.message }, 'Error closing workers');
  }
}

// Handle process termination
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down workers...');
  await shutdownWorkers();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down workers...');
  await shutdownWorkers();
  process.exit(0);
});
