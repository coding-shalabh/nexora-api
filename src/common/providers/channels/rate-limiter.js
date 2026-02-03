/**
 * Rate Limiter Service
 * Implements rate limiting for channel operations
 * Supports per-channel, per-tenant, and global limits
 */

import { prisma } from '@crm360/database';
import { logger } from '../../logger.js';
import { eventBus, createEvent } from '../../events/event-bus.js';
import { ChannelEventTypes } from './base-adapter.js';

/**
 * Rate limit configurations by channel type
 */
const DEFAULT_RATE_LIMITS = {
  WHATSAPP: {
    messagesPerSecond: 80,
    messagesPerMinute: 1000,
    messagesPerHour: 10000,
    templatesPerDay: 100000,
    cooldownMs: 1000,
  },
  SMS: {
    messagesPerSecond: 30,
    messagesPerMinute: 500,
    messagesPerHour: 5000,
    templatesPerDay: 50000,
    cooldownMs: 500,
  },
  EMAIL: {
    messagesPerSecond: 10,
    messagesPerMinute: 100,
    messagesPerHour: 1000,
    messagesPerDay: 10000,
    cooldownMs: 100,
  },
  VOICE: {
    callsPerMinute: 10,
    callsPerHour: 100,
    concurrentCalls: 5,
    cooldownMs: 2000,
  },
};

class RateLimiterService {
  constructor() {
    // In-memory counters (for speed, backed by DB for persistence)
    this.counters = new Map();
    this.logger = logger.child({ service: 'RateLimiter' });
  }

  /**
   * Get rate limit key
   */
  getKey(channelAccountId, window) {
    return `${channelAccountId}:${window}`;
  }

  /**
   * Get current window timestamp
   */
  getWindowTimestamp(windowType) {
    const now = new Date();
    switch (windowType) {
      case 'second':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
      case 'minute':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes());
      case 'hour':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());
      case 'day':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      default:
        return now;
    }
  }

  /**
   * Check if an action is rate limited
   * @param {string} channelAccountId
   * @param {string} channelType
   * @param {string} actionType - 'message' | 'template' | 'call'
   * @returns {Promise<{allowed: boolean, retryAfter?: number, remaining?: number}>}
   */
  async checkLimit(channelAccountId, channelType, actionType = 'message') {
    const limits = DEFAULT_RATE_LIMITS[channelType];
    if (!limits) {
      return { allowed: true };
    }

    // Check multiple time windows
    const windows = this.getRelevantWindows(channelType, actionType);

    for (const window of windows) {
      const key = this.getKey(channelAccountId, window.name);
      const count = await this.getCount(key, window.duration);

      if (count >= window.limit) {
        // Rate limited
        const retryAfter = await this.calculateRetryAfter(key, window);

        this.logger.warn({
          channelAccountId,
          channelType,
          window: window.name,
          count,
          limit: window.limit,
        }, 'Rate limit exceeded');

        return {
          allowed: false,
          retryAfter,
          window: window.name,
          limit: window.limit,
        };
      }
    }

    return { allowed: true, remaining: this.calculateRemaining(windows) };
  }

  /**
   * Record an action against rate limits
   * @param {string} channelAccountId
   * @param {string} channelType
   * @param {string} actionType
   */
  async recordAction(channelAccountId, channelType, actionType = 'message') {
    const windows = this.getRelevantWindows(channelType, actionType);

    for (const window of windows) {
      const key = this.getKey(channelAccountId, window.name);
      await this.incrementCount(key, window.duration);
    }

    // Persist to database periodically
    await this.persistState(channelAccountId, channelType);
  }

  /**
   * Get relevant rate limit windows for a channel/action combination
   */
  getRelevantWindows(channelType, actionType) {
    const limits = DEFAULT_RATE_LIMITS[channelType];
    const windows = [];

    if (actionType === 'message' || actionType === 'template') {
      if (limits.messagesPerSecond) {
        windows.push({ name: 'second', limit: limits.messagesPerSecond, duration: 1000 });
      }
      if (limits.messagesPerMinute) {
        windows.push({ name: 'minute', limit: limits.messagesPerMinute, duration: 60000 });
      }
      if (limits.messagesPerHour) {
        windows.push({ name: 'hour', limit: limits.messagesPerHour, duration: 3600000 });
      }
      if (actionType === 'template' && limits.templatesPerDay) {
        windows.push({ name: 'day', limit: limits.templatesPerDay, duration: 86400000 });
      }
    } else if (actionType === 'call') {
      if (limits.callsPerMinute) {
        windows.push({ name: 'minute', limit: limits.callsPerMinute, duration: 60000 });
      }
      if (limits.callsPerHour) {
        windows.push({ name: 'hour', limit: limits.callsPerHour, duration: 3600000 });
      }
    }

    return windows;
  }

  /**
   * Get current count for a rate limit key
   */
  async getCount(key, duration) {
    const now = Date.now();
    const entry = this.counters.get(key);

    if (!entry || now - entry.timestamp > duration) {
      // Window expired, reset
      return 0;
    }

    return entry.count;
  }

  /**
   * Increment count for a rate limit key
   */
  async incrementCount(key, duration) {
    const now = Date.now();
    const entry = this.counters.get(key);

    if (!entry || now - entry.timestamp > duration) {
      // New window
      this.counters.set(key, { count: 1, timestamp: now });
    } else {
      entry.count++;
    }
  }

  /**
   * Calculate when the rate limit will reset
   */
  async calculateRetryAfter(key, window) {
    const entry = this.counters.get(key);
    if (!entry) return 0;

    const elapsed = Date.now() - entry.timestamp;
    return Math.max(0, window.duration - elapsed);
  }

  /**
   * Calculate remaining actions in current window
   */
  calculateRemaining(windows) {
    // Return the minimum remaining across all windows
    // This is a simplified version
    return null;
  }

  /**
   * Persist rate limit state to database
   */
  async persistState(channelAccountId, channelType) {
    try {
      const state = {};
      const prefix = `${channelAccountId}:`;

      for (const [key, value] of this.counters.entries()) {
        if (key.startsWith(prefix)) {
          state[key] = value;
        }
      }

      await prisma.rateLimitState.upsert({
        where: {
          channelAccountId_channelType: {
            channelAccountId,
            channelType,
          },
        },
        update: {
          counters: state,
          updatedAt: new Date(),
        },
        create: {
          channelAccountId,
          channelType,
          counters: state,
          windowStart: new Date(),
        },
      });
    } catch (error) {
      this.logger.error({ error }, 'Failed to persist rate limit state');
    }
  }

  /**
   * Load rate limit state from database
   */
  async loadState(channelAccountId, channelType) {
    try {
      const state = await prisma.rateLimitState.findUnique({
        where: {
          channelAccountId_channelType: {
            channelAccountId,
            channelType,
          },
        },
      });

      if (state && state.counters) {
        for (const [key, value] of Object.entries(state.counters)) {
          this.counters.set(key, value);
        }
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to load rate limit state');
    }
  }

  /**
   * Get rate limit status for a channel account
   */
  async getStatus(channelAccountId, channelType) {
    const limits = DEFAULT_RATE_LIMITS[channelType];
    const status = {};

    for (const [window, limit] of Object.entries(limits)) {
      if (typeof limit === 'number') {
        const key = this.getKey(channelAccountId, window);
        const count = await this.getCount(key, this.getWindowDuration(window));
        status[window] = {
          current: count,
          limit,
          remaining: limit - count,
          percentUsed: Math.round((count / limit) * 100),
        };
      }
    }

    return status;
  }

  /**
   * Get window duration in ms from window name
   */
  getWindowDuration(windowName) {
    const match = windowName.match(/(second|minute|hour|day)/i);
    if (!match) return 60000;

    switch (match[1].toLowerCase()) {
      case 'second': return 1000;
      case 'minute': return 60000;
      case 'hour': return 3600000;
      case 'day': return 86400000;
      default: return 60000;
    }
  }

  /**
   * Clear rate limits (for testing or admin override)
   */
  async clearLimits(channelAccountId) {
    const prefix = `${channelAccountId}:`;
    for (const key of this.counters.keys()) {
      if (key.startsWith(prefix)) {
        this.counters.delete(key);
      }
    }

    await prisma.rateLimitState.deleteMany({
      where: { channelAccountId },
    });
  }
}

// Singleton instance
export const rateLimiter = new RateLimiterService();
