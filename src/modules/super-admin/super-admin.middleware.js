import { prisma } from '@crm360/database'
import { UnauthorizedError, ForbiddenError } from '@crm360/shared'
import { verifyToken } from '../../common/auth.js'

/**
 * Authentication middleware for super admin routes.
 * Verifies JWT token and checks super admin exists and is active.
 */
export async function authenticateSuperAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header')
    }

    const token = authHeader.substring(7)
    const payload = await verifyToken(token)

    if (!payload) {
      throw new UnauthorizedError('Invalid or expired token')
    }

    // Check if this is a super admin token (type is 'access' but includes superAdminId)
    if (!payload.superAdminId) {
      throw new UnauthorizedError('Invalid token type for super admin access')
    }

    // Load super admin
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: payload.superAdminId },
    })

    if (!superAdmin) {
      throw new UnauthorizedError('Super admin not found')
    }

    if (!superAdmin.isActive) {
      throw new ForbiddenError('Super admin account is not active')
    }

    // Attach super admin context to request
    req.superAdmin = {
      id: superAdmin.id,
      email: superAdmin.email,
      role: superAdmin.role,
      permissions: superAdmin.permissions || {},
    }

    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Authorization middleware that checks for specific super admin roles.
 * @param {...string} allowedRoles - Roles that are allowed to access the route
 */
export function authorizeSuperAdmin(...allowedRoles) {
  return (req, res, next) => {
    try {
      const superAdmin = req.superAdmin

      if (!superAdmin) {
        throw new UnauthorizedError('Not authenticated as super admin')
      }

      // SUPER_ADMIN role has access to everything
      if (superAdmin.role === 'SUPER_ADMIN') {
        return next()
      }

      // Check if user's role is in allowed roles
      if (!allowedRoles.includes(superAdmin.role)) {
        throw new ForbiddenError(`Access denied. Required roles: ${allowedRoles.join(' or ')}`)
      }

      next()
    } catch (error) {
      next(error)
    }
  }
}

/**
 * Role hierarchy for super admins:
 * SUPER_ADMIN - Full access to everything
 * ADMIN - Manage tenants, users, but not other super admins
 * SUPPORT - View tenants, handle support issues
 * BILLING - Manage billing and subscriptions
 * ANALYST - View-only access to analytics
 */
export const SUPER_ADMIN_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  SUPPORT: 'SUPPORT',
  BILLING: 'BILLING',
  ANALYST: 'ANALYST',
}

/**
 * Role permissions mapping
 */
export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: ['*'], // All permissions
  ADMIN: [
    'tenants:read',
    'tenants:write',
    'tenants:suspend',
    'users:read',
    'users:write',
    'analytics:read',
    'audit:read',
  ],
  SUPPORT: [
    'tenants:read',
    'users:read',
    'analytics:read',
  ],
  BILLING: [
    'tenants:read',
    'billing:read',
    'billing:write',
    'subscriptions:read',
    'subscriptions:write',
  ],
  ANALYST: [
    'tenants:read',
    'analytics:read',
  ],
}

/**
 * Check if super admin has specific permission
 */
export function hasPermission(req, permission) {
  const superAdmin = req.superAdmin
  if (!superAdmin) return false

  const rolePermissions = ROLE_PERMISSIONS[superAdmin.role] || []

  // SUPER_ADMIN has all permissions
  if (rolePermissions.includes('*')) return true

  return rolePermissions.includes(permission)
}
