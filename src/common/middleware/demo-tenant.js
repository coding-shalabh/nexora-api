import { environmentConfig } from '../../config/environment.js';
import { logger } from '../logger.js';

/**
 * Demo Tenant Middleware
 * If demo mode is enabled, override tenant with demo tenant
 * This allows using a fixed demo tenant for development/testing
 */
export function demoTenantMiddleware(req, res, next) {
  // Only apply if demo mode is enabled
  if (!environmentConfig.demo.enabled) {
    return next();
  }

  // Store original tenant ID
  req.originalTenantId = req.tenantId;

  // Override with demo tenant
  req.tenantId = environmentConfig.demo.tenantId;
  req.isDemoMode = true;

  // Add demo mode headers to response
  res.setHeader('X-Demo-Mode', 'true');
  res.setHeader('X-Demo-Tenant-Id', req.tenantId);

  logger.debug('[Demo Mode] Using demo tenant', {
    originalTenant: req.originalTenantId,
    demoTenant: req.tenantId,
  });

  next();
}

/**
 * Demo User Middleware
 * Optionally override user ID for demo mode
 */
export function demoUserMiddleware(req, res, next) {
  if (!environmentConfig.demo.enabled) {
    return next();
  }

  // Store original user ID
  req.originalUserId = req.userId;

  // You can optionally override userId for demo mode
  // Uncomment if you want a fixed demo user:
  // req.userId = environmentConfig.demo.userId;

  next();
}
