import { prisma } from '@crm360/database';
import { UnauthorizedError, ForbiddenError } from '@crm360/shared';
import { verifyToken } from '../auth.js';

/**
 * Authentication middleware that verifies the JWT token
 * and attaches user info to the request with role permissions.
 */
export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      throw new UnauthorizedError('Invalid or expired token');
    }

    // Load user with permissions
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        tenant: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User not found or inactive');
    }

    if (user.tenant.status !== 'ACTIVE') {
      throw new ForbiddenError('Tenant account is not active');
    }

    // Collect all permissions from all roles
    const permissions = new Set();
    let maxRoleLevel = 0;

    user.roles.forEach((userRole) => {
      const roleName = userRole.role.name?.toLowerCase()?.trim() || '';

      // Infer role level from role name
      let level = 1;
      if (roleName.includes('super') && roleName.includes('admin')) level = 10;
      else if (roleName === 'admin' || roleName.includes('administrator')) level = 9;
      else if (roleName.includes('manager')) level = 8;
      else if (roleName.includes('marketing')) level = 7;
      else if (roleName.includes('sales')) level = 6;
      else if (roleName.includes('support') || roleName.includes('agent')) level = 5;

      if (level > maxRoleLevel) maxRoleLevel = level;

      // Also collect explicit permissions
      userRole.role.permissions.forEach((rolePermission) => {
        if (rolePermission.permission) {
          permissions.add(rolePermission.permission.code);
        }
      });
    });

    // Add role-level based permissions (fallback for tenants without explicit permissions)
    if (maxRoleLevel >= 9) {
      permissions.add('*'); // Full access for Admin and Super Admin
    } else if (maxRoleLevel >= 7) {
      ['crm:*', 'analytics:read', 'inbox:*', 'pipeline:*', 'settings:read'].forEach(p => permissions.add(p));
    } else if (maxRoleLevel >= 5) {
      ['crm:contacts:*', 'crm:deals:*', 'crm:activities:*', 'inbox:*', 'tickets:*', 'analytics:read'].forEach(p => permissions.add(p));
    }

    // Attach user context to request
    req.user = {
      id: user.id,
      userId: user.id,
      tenantId: user.tenantId,
      workspaceId: payload.workspaceId || 'default-workspace',
      permissions: Array.from(permissions),
      roleLevel: maxRoleLevel,
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Authorization middleware that checks for required permissions.
 * @param {...string} permissions - Required permissions (any of them grants access)
 */
export function authorize(...permissions) {
  return (req, res, next) => {
    try {
      const userPermissions = req.user?.permissions || [];

      // Super admin has all permissions
      if (userPermissions.includes('*')) {
        return next();
      }

      // Check if user has any of the required permissions
      const hasPermission = permissions.some((p) => userPermissions.includes(p));

      if (!hasPermission) {
        // Log for debugging
        console.log('[Authorize] User permissions:', userPermissions);
        console.log('[Authorize] Required permissions (any of):', permissions);
        return next(new ForbiddenError(`Insufficient permissions. Required: ${permissions.join(' or ')}`));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
