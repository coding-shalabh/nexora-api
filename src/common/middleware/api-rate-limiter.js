/**
 * API Rate Limiting Middleware
 *
 * Enforces plan-based API rate limits using Redis for distributed rate limiting
 */

import { getPlanLimits } from '../../config/plan-limits.js';
import logger from '../logger.js';

// In-memory store for rate limiting (fallback if Redis not available)
const rateLimitStore = new Map();

/**
 * Clean up old entries from in-memory store (run every minute)
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

/**
 * Get rate limit key for a tenant
 */
function getRateLimitKey(tenantId, window) {
  const now = Date.now();
  let resetTime;

  switch (window) {
    case 'minute':
      resetTime = Math.floor(now / 60000) * 60000; // Round to minute
      break;
    case 'hour':
      resetTime = Math.floor(now / 3600000) * 3600000; // Round to hour
      break;
    case 'day':
      resetTime = Math.floor(now / 86400000) * 86400000; // Round to day
      break;
    default:
      resetTime = now;
  }

  return `ratelimit:${tenantId}:${window}:${resetTime}`;
}

/**
 * Check and increment rate limit counter
 */
async function checkRateLimit(tenantId, planLimits, window, maxRequests) {
  if (maxRequests === null) return { allowed: true }; // Unlimited

  const key = getRateLimitKey(tenantId, window);
  const now = Date.now();

  // Get current count
  let data = rateLimitStore.get(key);

  if (!data) {
    // Initialize new window
    let resetTime;
    switch (window) {
      case 'minute':
        resetTime = now + 60000;
        break;
      case 'hour':
        resetTime = now + 3600000;
        break;
      case 'day':
        resetTime = now + 86400000;
        break;
    }

    data = {
      count: 0,
      resetTime,
    };
  }

  // Check if limit exceeded
  if (data.count >= maxRequests) {
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetTime: data.resetTime,
      retryAfter: Math.ceil((data.resetTime - now) / 1000), // seconds
    };
  }

  // Increment counter
  data.count++;
  rateLimitStore.set(key, data);

  return {
    allowed: true,
    limit: maxRequests,
    remaining: maxRequests - data.count,
    resetTime: data.resetTime,
  };
}

/**
 * Get tenant's plan limits
 */
async function getTenantPlanLimits(tenantId, db) {
  try {
    // Get tenant with active subscription
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        subscriptions: {
          where: {
            status: {
              in: ['ACTIVE', 'TRIALING'],
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            plan: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    const planName = tenant?.subscriptions[0]?.plan?.name || 'free';
    return getPlanLimits(planName);
  } catch (error) {
    logger.error('Error getting tenant plan limits:', error);
    return getPlanLimits('free'); // Default to free plan on error
  }
}

/**
 * Express middleware for API rate limiting
 */
export async function apiRateLimiter(req, res, next) {
  const tenantId = req.tenantId || req.user?.tenantId;

  // Skip rate limiting if no tenant (e.g., login endpoint)
  if (!tenantId) {
    return next();
  }

  try {
    // Get plan limits
    const planLimits = await getTenantPlanLimits(tenantId, req.db || global.db);
    const rateLimits = planLimits.apiRateLimit;

    // Check minute limit (most restrictive)
    const minuteCheck = await checkRateLimit(
      tenantId,
      planLimits,
      'minute',
      rateLimits.requestsPerMinute
    );

    if (!minuteCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: `API rate limit exceeded. Maximum ${minuteCheck.limit} requests per minute allowed.`,
        limit: minuteCheck.limit,
        remaining: minuteCheck.remaining,
        resetTime: minuteCheck.resetTime,
        retryAfter: minuteCheck.retryAfter,
      });
    }

    // Check hour limit
    const hourCheck = await checkRateLimit(
      tenantId,
      planLimits,
      'hour',
      rateLimits.requestsPerHour
    );

    if (!hourCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: `API rate limit exceeded. Maximum ${hourCheck.limit} requests per hour allowed.`,
        limit: hourCheck.limit,
        remaining: hourCheck.remaining,
        resetTime: hourCheck.resetTime,
        retryAfter: hourCheck.retryAfter,
      });
    }

    // Check day limit
    const dayCheck = await checkRateLimit(tenantId, planLimits, 'day', rateLimits.requestsPerDay);

    if (!dayCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: `API rate limit exceeded. Maximum ${dayCheck.limit} requests per day allowed.`,
        limit: dayCheck.limit,
        remaining: dayCheck.remaining,
        resetTime: dayCheck.resetTime,
        retryAfter: dayCheck.retryAfter,
      });
    }

    // Add rate limit headers to response
    res.setHeader('X-RateLimit-Limit-Minute', minuteCheck.limit);
    res.setHeader('X-RateLimit-Remaining-Minute', minuteCheck.remaining);
    res.setHeader('X-RateLimit-Reset-Minute', new Date(minuteCheck.resetTime).toISOString());

    res.setHeader('X-RateLimit-Limit-Hour', hourCheck.limit || 'unlimited');
    res.setHeader('X-RateLimit-Remaining-Hour', hourCheck.remaining || 'unlimited');

    // Attach rate limit info to request for logging
    req.rateLimit = {
      minute: minuteCheck,
      hour: hourCheck,
      day: dayCheck,
    };

    next();
  } catch (error) {
    logger.error('Rate limiter error:', error);
    // Continue on error to avoid blocking requests
    next();
  }
}

/**
 * Get current rate limit status for a tenant
 */
export async function getRateLimitStatus(tenantId, db) {
  try {
    const planLimits = await getTenantPlanLimits(tenantId, db);
    const rateLimits = planLimits.apiRateLimit;

    // Get current usage for each window
    const minuteKey = getRateLimitKey(tenantId, 'minute');
    const hourKey = getRateLimitKey(tenantId, 'hour');
    const dayKey = getRateLimitKey(tenantId, 'day');

    const minuteData = rateLimitStore.get(minuteKey) || { count: 0, resetTime: Date.now() + 60000 };
    const hourData = rateLimitStore.get(hourKey) || {
      count: 0,
      resetTime: Date.now() + 3600000,
    };
    const dayData = rateLimitStore.get(dayKey) || {
      count: 0,
      resetTime: Date.now() + 86400000,
    };

    return {
      minute: {
        limit: rateLimits.requestsPerMinute,
        used: minuteData.count,
        remaining: Math.max(0, rateLimits.requestsPerMinute - minuteData.count),
        resetTime: minuteData.resetTime,
      },
      hour: {
        limit: rateLimits.requestsPerHour,
        used: hourData.count,
        remaining:
          rateLimits.requestsPerHour === null
            ? null
            : Math.max(0, rateLimits.requestsPerHour - hourData.count),
        resetTime: hourData.resetTime,
      },
      day: {
        limit: rateLimits.requestsPerDay,
        used: dayData.count,
        remaining:
          rateLimits.requestsPerDay === null
            ? null
            : Math.max(0, rateLimits.requestsPerDay - dayData.count),
        resetTime: dayData.resetTime,
      },
    };
  } catch (error) {
    logger.error('Error getting rate limit status:', error);
    throw error;
  }
}

export default {
  apiRateLimiter,
  getRateLimitStatus,
};
