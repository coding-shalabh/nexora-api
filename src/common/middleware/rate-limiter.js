import rateLimit from 'express-rate-limit';
import { config } from '../../config/index.js';

/**
 * Rate limit tiers based on subscription plans
 * Requests per minute
 */
export const RATE_LIMIT_TIERS = {
  FREE: { windowMs: 60000, max: 100 },
  STARTER: { windowMs: 60000, max: 500 },
  PROFESSIONAL: { windowMs: 60000, max: 2000 },
  ENTERPRISE: { windowMs: 60000, max: 10000 },
  UNLIMITED: { windowMs: 60000, max: 100000 },
};

/**
 * Endpoint-specific rate limits (stricter limits for sensitive operations)
 */
const ENDPOINT_LIMITS = {
  '/api/v1/auth/login': { windowMs: 15 * 60 * 1000, max: 50 },
  '/api/v1/auth/register': { windowMs: 60 * 60 * 1000, max: 10 },
  '/api/v1/auth/forgot-password': { windowMs: 60 * 60 * 1000, max: 5 },
  '/api/v1/webhooks': { windowMs: 60000, max: 1000 },
  '/api/v1/inbox/send': { windowMs: 60000, max: 100 },
  '/api/v1/billing': { windowMs: 60000, max: 200 },
};

/**
 * In-memory store for tenant rate limits
 * Tracks: { [tenantId]: { count: number, resetTime: number } }
 */
const tenantLimitStore = new Map();

/**
 * Clean up expired entries every 5 minutes
 */
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of tenantLimitStore.entries()) {
      if (value.resetTime < now) {
        tenantLimitStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
);

/**
 * Get rate limit for a tenant based on their subscription tier
 */
function getTenantLimit(tenant) {
  if (!tenant) {
    return RATE_LIMIT_TIERS.FREE;
  }

  const plan = tenant.plan?.toUpperCase() || 'FREE';
  return RATE_LIMIT_TIERS[plan] || RATE_LIMIT_TIERS.FREE;
}

/**
 * Check if request should be rate limited for tenant
 */
function checkTenantRateLimit(tenantId, tenant) {
  const limits = getTenantLimit(tenant);
  const now = Date.now();
  const key = `tenant:${tenantId}`;

  let record = tenantLimitStore.get(key);

  if (!record || record.resetTime < now) {
    // Create new record
    record = {
      count: 1,
      resetTime: now + limits.windowMs,
    };
    tenantLimitStore.set(key, record);
    return { allowed: true, remaining: limits.max - 1, resetTime: record.resetTime };
  }

  if (record.count >= limits.max) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
      retryAfter: Math.ceil((record.resetTime - now) / 1000),
    };
  }

  record.count++;
  return { allowed: true, remaining: limits.max - record.count, resetTime: record.resetTime };
}

/**
 * Per-tenant rate limiting middleware
 * Uses tenant subscription tier to determine limits
 */
export function tenantRateLimiter(req, res, next) {
  try {
    // Skip rate limiting for health checks
    if (req.path === '/health' || req.path === '/api/v1/health') {
      return next();
    }

    const tenantId = req.user?.tenantId;

    if (!tenantId) {
      // Use IP-based limiting for unauthenticated requests
      return next();
    }

    const tenant = req.user?.tenant;
    const result = checkTenantRateLimit(tenantId, tenant);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', getTenantLimit(tenant).max);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      res.setHeader('Retry-After', result.retryAfter);
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: result.retryAfter,
        },
      });
    }

    next();
  } catch (error) {
    // Don't block requests on rate limiter errors
    console.error('[RateLimiter] Error:', error.message);
    next();
  }
}

/**
 * Default rate limiter using express-rate-limit
 * Falls back to IP-based limiting
 */
export const rateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use tenant ID + user ID if available, otherwise IP
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.id || req.userId;

    if (tenantId && userId) {
      return `${tenantId}:${userId}`;
    }

    if (tenantId) {
      return `tenant:${tenantId}`;
    }

    return req.ip || 'unknown';
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/v1/health';
  },
});

/**
 * Stricter rate limiter for auth endpoints
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 attempts per 15 minutes
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many authentication attempts, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use IP + email for auth endpoints
    const email = req.body?.email?.toLowerCase() || '';
    return `auth:${req.ip}:${email}`;
  },
});

/**
 * Strict rate limiter for sensitive operations
 */
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests for this operation, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const userId = req.user?.id || req.userId;
    return `strict:${tenantId}:${userId}:${req.path}`;
  },
});

/**
 * API endpoint-specific rate limiter
 * Creates rate limiters for specific paths with custom limits
 */
export function createEndpointRateLimiter(path) {
  const limits = ENDPOINT_LIMITS[path] || { windowMs: 60000, max: 100 };

  return rateLimit({
    windowMs: limits.windowMs,
    max: limits.max,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests to ${path}, please try again later`,
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
      const userId = req.user?.id;
      return `endpoint:${path}:${tenantId}:${userId}:${req.ip}`;
    },
  });
}

/**
 * Webhook rate limiter (higher limits for webhooks)
 */
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Webhook rate limit exceeded',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use webhook source identifier
    const source = req.headers['x-webhook-source'] || req.ip;
    return `webhook:${source}`;
  },
});

/**
 * Get current rate limit stats for a tenant
 */
export function getTenantRateLimitStats(tenantId) {
  const key = `tenant:${tenantId}`;
  const record = tenantLimitStore.get(key);

  if (!record) {
    return { used: 0, remaining: null, resetTime: null };
  }

  const tenant = null; // Would need to fetch from DB
  const limits = getTenantLimit(tenant);

  return {
    used: record.count,
    remaining: Math.max(0, limits.max - record.count),
    resetTime: new Date(record.resetTime).toISOString(),
  };
}

/**
 * Reset rate limit for a tenant (admin function)
 */
export function resetTenantRateLimit(tenantId) {
  const key = `tenant:${tenantId}`;
  tenantLimitStore.delete(key);
  return true;
}

export default {
  rateLimiter,
  authRateLimiter,
  strictRateLimiter,
  tenantRateLimiter,
  webhookRateLimiter,
  createEndpointRateLimiter,
  getTenantRateLimitStats,
  resetTenantRateLimit,
  RATE_LIMIT_TIERS,
};
