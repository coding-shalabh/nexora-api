/**
 * Rate Limiter Middleware Unit Tests
 *
 * Tests for per-tenant rate limiting
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock config - path relative from test file to config
vi.mock('../config/index.js', () => ({
  config: {
    rateLimitWindowMs: 60000,
    rateLimitMax: 1000,
  },
}));

// Mock express-rate-limit
vi.mock('express-rate-limit', () => ({
  default: vi.fn((options) => {
    // Return a mock middleware
    const middleware = (req, res, next) => next();
    middleware.options = options;
    return middleware;
  }),
}));

import {
  tenantRateLimiter,
  rateLimiter,
  authRateLimiter,
  strictRateLimiter,
  webhookRateLimiter,
  createEndpointRateLimiter,
  getTenantRateLimitStats,
  resetTenantRateLimit,
  RATE_LIMIT_TIERS,
} from '../common/middleware/rate-limiter.js';

describe('Rate Limiter', () => {
  describe('RATE_LIMIT_TIERS', () => {
    it('should define rate limits for all tiers', () => {
      expect(RATE_LIMIT_TIERS.FREE).toEqual({ windowMs: 60000, max: 100 });
      expect(RATE_LIMIT_TIERS.STARTER).toEqual({ windowMs: 60000, max: 500 });
      expect(RATE_LIMIT_TIERS.PROFESSIONAL).toEqual({ windowMs: 60000, max: 2000 });
      expect(RATE_LIMIT_TIERS.ENTERPRISE).toEqual({ windowMs: 60000, max: 10000 });
      expect(RATE_LIMIT_TIERS.UNLIMITED).toEqual({ windowMs: 60000, max: 100000 });
    });
  });

  describe('tenantRateLimiter', () => {
    let mockReq;
    let mockRes;
    let nextFn;

    beforeEach(() => {
      mockReq = {
        path: '/api/v1/contacts',
        user: {
          tenantId: 'tenant-123',
          tenant: { plan: 'STARTER' },
        },
      };
      mockRes = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      nextFn = vi.fn();

      // Reset tenant limit store by resetting
      resetTenantRateLimit('tenant-123');
    });

    it('should skip rate limiting for health check endpoints', async () => {
      mockReq.path = '/health';
      mockReq.user = undefined;

      tenantRateLimiter(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should skip rate limiting for /api/v1/health', async () => {
      mockReq.path = '/api/v1/health';
      mockReq.user = undefined;

      tenantRateLimiter(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should allow requests within rate limit', async () => {
      tenantRateLimiter(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 500);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
    });

    it('should set rate limit headers', async () => {
      tenantRateLimiter(mockReq, mockRes, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 500);
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    it('should pass through for unauthenticated requests', async () => {
      mockReq.user = undefined;

      tenantRateLimiter(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should use FREE tier for tenants without plan', async () => {
      mockReq.user = {
        tenantId: 'tenant-456',
        tenant: {},
      };

      resetTenantRateLimit('tenant-456');
      tenantRateLimiter(mockReq, mockRes, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
    });

    it('should decrement remaining count on each request', async () => {
      // First request
      tenantRateLimiter(mockReq, mockRes, nextFn);
      const firstRemaining = mockRes.setHeader.mock.calls.find(
        (call) => call[0] === 'X-RateLimit-Remaining'
      )[1];

      // Reset mocks
      mockRes.setHeader.mockClear();

      // Second request
      tenantRateLimiter(mockReq, mockRes, nextFn);
      const secondRemaining = mockRes.setHeader.mock.calls.find(
        (call) => call[0] === 'X-RateLimit-Remaining'
      )[1];

      expect(secondRemaining).toBe(firstRemaining - 1);
    });

    it('should block requests when limit exceeded', async () => {
      // Simulate a tenant that has exceeded limits by setting up a low limit tenant
      const lowLimitTenant = {
        tenantId: 'low-limit-tenant',
        tenant: { plan: 'FREE' },
      };
      mockReq.user = lowLimitTenant;

      resetTenantRateLimit('low-limit-tenant');

      // Make 100 requests (FREE tier limit)
      for (let i = 0; i < 100; i++) {
        mockRes.status.mockClear();
        mockRes.json.mockClear();
        nextFn.mockClear();
        tenantRateLimiter(mockReq, mockRes, nextFn);
      }

      // 101st request should be blocked
      mockRes.status.mockClear();
      mockRes.json.mockClear();
      nextFn.mockClear();
      tenantRateLimiter(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.',
          retryAfter: expect.any(Number),
        },
      });
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should set Retry-After header when limit exceeded', async () => {
      mockReq.user = {
        tenantId: 'retry-test',
        tenant: { plan: 'FREE' },
      };

      resetTenantRateLimit('retry-test');

      // Exhaust the limit
      for (let i = 0; i < 100; i++) {
        tenantRateLimiter(mockReq, mockRes, nextFn);
      }

      mockRes.setHeader.mockClear();
      tenantRateLimiter(mockReq, mockRes, nextFn);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });
  });

  describe('getTenantRateLimitStats', () => {
    it('should return stats for tenant with requests', () => {
      const mockReq = {
        path: '/api/v1/test',
        user: { tenantId: 'stats-test', tenant: { plan: 'STARTER' } },
      };
      const mockRes = { setHeader: vi.fn() };
      const next = vi.fn();

      resetTenantRateLimit('stats-test');
      tenantRateLimiter(mockReq, mockRes, next);

      const stats = getTenantRateLimitStats('stats-test');

      expect(stats.used).toBe(1);
      expect(stats.remaining).toBe(99); // FREE tier default
      expect(stats.resetTime).toBeTruthy();
    });

    it('should return empty stats for tenant without requests', () => {
      resetTenantRateLimit('no-requests');
      const stats = getTenantRateLimitStats('no-requests');

      expect(stats.used).toBe(0);
      expect(stats.remaining).toBeNull();
      expect(stats.resetTime).toBeNull();
    });
  });

  describe('resetTenantRateLimit', () => {
    it('should reset rate limit for a tenant', () => {
      const mockReq = {
        path: '/api/v1/test',
        user: { tenantId: 'reset-test', tenant: { plan: 'FREE' } },
      };
      const mockRes = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      // Make some requests
      for (let i = 0; i < 50; i++) {
        tenantRateLimiter(mockReq, mockRes, next);
      }

      // Reset
      const result = resetTenantRateLimit('reset-test');
      expect(result).toBe(true);

      // Stats should be empty
      const stats = getTenantRateLimitStats('reset-test');
      expect(stats.used).toBe(0);
    });
  });

  describe('createEndpointRateLimiter', () => {
    it('should create rate limiter with custom limits for known endpoints', () => {
      const loginLimiter = createEndpointRateLimiter('/api/v1/auth/login');
      expect(loginLimiter.options.windowMs).toBe(15 * 60 * 1000);
      expect(loginLimiter.options.max).toBe(50);
    });

    it('should create rate limiter with default limits for unknown endpoints', () => {
      const customLimiter = createEndpointRateLimiter('/api/v1/custom');
      expect(customLimiter.options.windowMs).toBe(60000);
      expect(customLimiter.options.max).toBe(100);
    });
  });

  describe('rateLimiter (express-rate-limit based)', () => {
    it('should be defined', () => {
      expect(rateLimiter).toBeDefined();
    });

    it('should have keyGenerator that uses tenant and user', () => {
      const req = {
        user: { tenantId: 'tenant-1', id: 'user-1' },
        headers: {},
        ip: '127.0.0.1',
      };
      const key = rateLimiter.options.keyGenerator(req);
      expect(key).toBe('tenant-1:user-1');
    });

    it('should use IP when no tenant or user', () => {
      const req = {
        headers: {},
        ip: '192.168.1.1',
      };
      const key = rateLimiter.options.keyGenerator(req);
      expect(key).toBe('192.168.1.1');
    });

    it('should skip health check endpoints', () => {
      const req = { path: '/health' };
      expect(rateLimiter.options.skip(req)).toBe(true);

      const req2 = { path: '/api/v1/health' };
      expect(rateLimiter.options.skip(req2)).toBe(true);

      const req3 = { path: '/api/v1/contacts' };
      expect(rateLimiter.options.skip(req3)).toBe(false);
    });
  });

  describe('authRateLimiter', () => {
    it('should be defined', () => {
      expect(authRateLimiter).toBeDefined();
    });

    it('should have 15 minute window', () => {
      expect(authRateLimiter.options.windowMs).toBe(15 * 60 * 1000);
    });

    it('should allow 50 attempts', () => {
      expect(authRateLimiter.options.max).toBe(50);
    });

    it('should use IP and email for key', () => {
      const req = {
        ip: '127.0.0.1',
        body: { email: 'Test@Example.com' },
      };
      const key = authRateLimiter.options.keyGenerator(req);
      expect(key).toBe('auth:127.0.0.1:test@example.com');
    });
  });

  describe('strictRateLimiter', () => {
    it('should be defined', () => {
      expect(strictRateLimiter).toBeDefined();
    });

    it('should have 1 minute window', () => {
      expect(strictRateLimiter.options.windowMs).toBe(60 * 1000);
    });

    it('should allow only 10 requests', () => {
      expect(strictRateLimiter.options.max).toBe(10);
    });
  });

  describe('webhookRateLimiter', () => {
    it('should be defined', () => {
      expect(webhookRateLimiter).toBeDefined();
    });

    it('should have 1 minute window', () => {
      expect(webhookRateLimiter.options.windowMs).toBe(60 * 1000);
    });

    it('should allow 1000 requests (high limit for webhooks)', () => {
      expect(webhookRateLimiter.options.max).toBe(1000);
    });

    it('should use webhook source header for key', () => {
      const req = {
        headers: { 'x-webhook-source': 'msg91' },
        ip: '127.0.0.1',
      };
      const key = webhookRateLimiter.options.keyGenerator(req);
      expect(key).toBe('webhook:msg91');
    });

    it('should fallback to IP when no source header', () => {
      const req = {
        headers: {},
        ip: '127.0.0.1',
      };
      const key = webhookRateLimiter.options.keyGenerator(req);
      expect(key).toBe('webhook:127.0.0.1');
    });
  });
});
