/**
 * Rate Limiter Service
 * Track usage and enforce rate limits
 */

import { prisma } from '@nexora/database';
import { logger } from '../../common/utils/logger.js';

const USER_DAILY_LIMIT = parseInt(process.env.AI_ASSISTANT_RATE_LIMIT_USER || '100');
const TENANT_DAILY_LIMIT = parseInt(process.env.AI_ASSISTANT_RATE_LIMIT_TENANT || '1000');

export class RateLimiterService {
  /**
   * Check if user/tenant is within rate limits
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @returns {boolean} - True if within limits
   */
  async checkLimit(userId, tenantId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Get today's usage
      const usage = await prisma.aIAssistantUsage.findUnique({
        where: {
          tenantId_userId_date: {
            tenantId,
            userId,
            date: today,
          },
        },
      });

      const currentCount = usage?.messageCount || 0;

      // Check user limit
      if (currentCount >= USER_DAILY_LIMIT) {
        logger.warn({ userId, currentCount, limit: USER_DAILY_LIMIT }, 'User rate limit exceeded');
        return false;
      }

      // Check tenant limit (sum all users in tenant)
      const tenantUsage = await prisma.aIAssistantUsage.aggregate({
        where: {
          tenantId,
          date: today,
        },
        _sum: {
          messageCount: true,
        },
      });

      const tenantCount = tenantUsage._sum.messageCount || 0;

      if (tenantCount >= TENANT_DAILY_LIMIT) {
        logger.warn(
          { tenantId, tenantCount, limit: TENANT_DAILY_LIMIT },
          'Tenant rate limit exceeded'
        );
        return false;
      }

      return true;
    } catch (error) {
      logger.error({ error, userId, tenantId }, 'Rate limit check failed');
      // On error, allow the query (fail open)
      return true;
    }
  }

  /**
   * Record query usage
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @param {number} tokensUsed - AI tokens used
   * @param {number} cost - Cost in USD
   */
  async recordQuery(userId, tenantId, tokensUsed, cost) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Upsert usage record
      await prisma.aIAssistantUsage.upsert({
        where: {
          tenantId_userId_date: {
            tenantId,
            userId,
            date: today,
          },
        },
        create: {
          tenantId,
          userId,
          date: today,
          messageCount: 1,
          aiTokensUsed: tokensUsed,
          totalCostUSD: cost,
        },
        update: {
          messageCount: { increment: 1 },
          aiTokensUsed: { increment: tokensUsed },
          totalCostUSD: { increment: cost },
        },
      });

      logger.info({ userId, tokensUsed, cost }, 'Usage recorded');
    } catch (error) {
      logger.error({ error, userId, tenantId }, 'Failed to record usage');
      // Don't throw - usage tracking failure shouldn't block the query
    }
  }

  /**
   * Get usage statistics for user
   * @param {string} userId - User ID
   * @param {string} tenantId - Tenant ID
   * @returns {Object} - Usage stats
   */
  async getUserUsage(userId, tenantId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const usage = await prisma.aIAssistantUsage.findUnique({
        where: {
          tenantId_userId_date: {
            tenantId,
            userId,
            date: today,
          },
        },
      });

      return {
        today: usage?.messageCount || 0,
        limit: USER_DAILY_LIMIT,
        remaining: Math.max(0, USER_DAILY_LIMIT - (usage?.messageCount || 0)),
        tokensUsed: usage?.aiTokensUsed || 0,
        cost: usage?.totalCostUSD || 0,
      };
    } catch (error) {
      logger.error({ error, userId, tenantId }, 'Failed to get user usage');
      return {
        today: 0,
        limit: USER_DAILY_LIMIT,
        remaining: USER_DAILY_LIMIT,
        tokensUsed: 0,
        cost: 0,
      };
    }
  }

  /**
   * Get usage statistics for tenant (all users)
   * @param {string} tenantId - Tenant ID
   * @returns {Object} - Tenant usage stats
   */
  async getTenantUsage(tenantId) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const usage = await prisma.aIAssistantUsage.aggregate({
        where: {
          tenantId,
          date: today,
        },
        _sum: {
          messageCount: true,
          aiTokensUsed: true,
          totalCostUSD: true,
        },
      });

      return {
        today: usage._sum.messageCount || 0,
        limit: TENANT_DAILY_LIMIT,
        remaining: Math.max(0, TENANT_DAILY_LIMIT - (usage._sum.messageCount || 0)),
        tokensUsed: usage._sum.aiTokensUsed || 0,
        cost: usage._sum.totalCostUSD || 0,
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to get tenant usage');
      return {
        today: 0,
        limit: TENANT_DAILY_LIMIT,
        remaining: TENANT_DAILY_LIMIT,
        tokensUsed: 0,
        cost: 0,
      };
    }
  }
}
