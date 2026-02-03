import { prisma } from '@crm360/database';
import { UnauthorizedError, ForbiddenError } from '@crm360/shared';
import { verifyToken } from '../auth.js';

export async function tenantMiddleware(req, res, next) {
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

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        tenant: true,
        workspaces: {
          include: {
            workspace: true,
          },
        },
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

    // Get primary workspace (first one or from token)
    const workspaceId = payload.workspaceId || user.workspaces[0]?.workspaceId || null;

    // Collect all permissions from all roles
    const permissions = new Set();
    let maxRoleLevel = 0;
    const roleNames = [];

    user.roles.forEach((userRole) => {
      const roleName = userRole.role.name?.toLowerCase()?.trim() || '';
      roleNames.push(roleName);

      // Infer role level from role name for permission hierarchy
      let effectiveLevel = 1;
      if (roleName.includes('super') && roleName.includes('admin')) effectiveLevel = 10;
      else if (roleName === 'admin' || roleName.includes('administrator')) effectiveLevel = 9;
      else if (roleName.includes('manager')) effectiveLevel = 8;
      else if (roleName.includes('marketing')) effectiveLevel = 7;
      else if (roleName.includes('sales')) effectiveLevel = 6;
      else if (roleName.includes('support') || roleName.includes('agent')) effectiveLevel = 5;

      if (effectiveLevel > maxRoleLevel) {
        maxRoleLevel = effectiveLevel;
      }

      userRole.role.permissions.forEach((rolePermission) => {
        if (rolePermission.permission) {
          permissions.add(rolePermission.permission.code);
        }
      });
    });

    // Level-based permission fallback (for tenants without explicit permissions)
    // Level 9-10 (Admin/Super Admin) = full access
    // Level 7-8 (Manager/Marketing) = most access
    // Level 5-6 (Support/Sales) = operational access
    if (maxRoleLevel >= 9) {
      permissions.add('*'); // Full access for Admin and Super Admin
    } else if (maxRoleLevel >= 7) {
      // Manager/Marketing level - add common permissions
      ['crm:*', 'analytics:read', 'inbox:*', 'pipeline:*', 'settings:read'].forEach(p => permissions.add(p));
    } else if (maxRoleLevel >= 5) {
      // Support/Sales level - add operational permissions
      ['crm:contacts:*', 'crm:deals:*', 'crm:activities:*', 'inbox:*', 'tickets:*', 'analytics:read'].forEach(p => permissions.add(p));
    }

    // Attach user context to request
    req.userId = user.id;
    req.tenantId = user.tenantId;
    req.workspaceId = workspaceId;
    req.permissions = Array.from(permissions);
    req.roleLevel = maxRoleLevel;

    next();
  } catch (error) {
    next(error);
  }
}

export function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    // Super admin has all permissions
    if (req.permissions.includes('*')) {
      return next();
    }

    // Check if user has any of the required permissions
    const hasPermission = requiredPermissions.some((required) => {
      // Direct match
      if (req.permissions.includes(required)) return true;

      // Wildcard match (e.g., 'crm:*' matches 'crm:contacts:read')
      const requiredParts = required.split(':');
      return req.permissions.some((userPerm) => {
        if (userPerm === '*') return true;
        const userParts = userPerm.split(':');
        // Check if wildcard permission covers the required permission
        for (let i = 0; i < userParts.length; i++) {
          if (userParts[i] === '*') return true;
          if (userParts[i] !== requiredParts[i]) return false;
        }
        return userParts.length >= requiredParts.length;
      });
    });

    if (!hasPermission) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
}
