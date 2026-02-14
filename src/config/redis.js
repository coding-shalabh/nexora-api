/**
 * Redis Configuration for BullMQ
 */

import Redis from 'ioredis';
import { logger } from '../common/logger.js';

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD;

export const redis = new Redis({
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('connect', () => {
  logger.info({ host: redisHost, port: redisPort }, 'Redis connected');
});

redis.on('error', (error) => {
  logger.error({ error: error.message }, 'Redis connection error');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});
