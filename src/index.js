import 'dotenv/config';
import http from 'http';
import { createServer } from './server.js';
import { logger } from './common/logger.js';
import { config } from './config/index.js';
import { initializeSocketIO } from './common/websocket/socket.service.js';
import { initializeWorkers, shutdownWorkers } from './workers/index.js';
import { prisma } from '@crm360/database';

async function bootstrap() {
  try {
    // 1. First, connect to database and warm up connection pool
    logger.info('Connecting to database...');
    await prisma.$connect();
    // Run a simple query to fully warm up the connection pool
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection established and warmed up');

    // 2. Create Express app
    const app = await createServer();

    // 3. Create HTTP server (but don't listen yet)
    const server = http.createServer(app);

    // 4. Initialize Socket.io BEFORE starting to listen
    initializeSocketIO(server);
    logger.info('WebSocket server initialized');

    // 5. Initialize background workers
    await initializeWorkers();
    logger.info('Background workers initialized');

    // 6. Now start listening - everything is ready
    await new Promise((resolve) => {
      server.listen(config.port, () => {
        logger.info(`API server running on port ${config.port}`);
        logger.info(`Environment: ${config.nodeEnv}`);
        logger.info('Server is ready to accept connections');
        resolve();
      });
    });

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);

      server.close(async () => {
        logger.info('HTTP server closed');
        // Shutdown background workers
        await shutdownWorkers();
        logger.info('Background workers stopped');
        // Disconnect from database
        await prisma.$disconnect();
        logger.info('Database connection closed');
        process.exit(0);
      });

      // Force shutdown after 30 seconds
      setTimeout(async () => {
        logger.error('Could not close connections in time, forcefully shutting down');
        await prisma.$disconnect();
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.fatal(error, 'Failed to start server');
    process.exit(1);
  }
}

bootstrap();
