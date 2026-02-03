import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import { featureAccessService } from './feature-access.service.js';

class TenantService {
  async getTenant(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        settings: true,
        createdAt: true,
      },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    return tenant;
  }

  /**
   * Get tenant with full subscription and plan details
   */
  async getTenantWithPlan(tenantId) {
    const [tenant, accessControl] = await Promise.all([
      this.getTenant(tenantId),
      featureAccessService.getAccessControl(tenantId),
    ]);

    return {
      ...tenant,
      ...accessControl,
    };
  }

  async updateTenant(tenantId, data) {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.name,
        settings: data.settings,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        plan: true,
        settings: true,
      },
    });

    return tenant;
  }

  async getWorkspaces(tenantId) {
    const workspaces = await prisma.workspace.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        isDefault: true,
        settings: true,
        createdAt: true,
        _count: {
          select: { users: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return workspaces.map((w) => ({
      ...w,
      userCount: w._count.users,
      _count: undefined,
    }));
  }

  async createWorkspace(tenantId, data) {
    const workspace = await prisma.workspace.create({
      data: {
        tenantId,
        name: data.name,
        isDefault: false,
        settings: data.settings || {},
      },
      select: {
        id: true,
        name: true,
        isDefault: true,
        settings: true,
        createdAt: true,
      },
    });

    return workspace;
  }

  async getUsers(tenantId) {
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return users;
  }

  async inviteUser(tenantId, defaultWorkspaceId, data) {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Create invited user (pending status)
    const user = await prisma.user.create({
      data: {
        tenantId,
        workspaceId: data.workspaceId || defaultWorkspaceId,
        roleId: data.roleId,
        email: data.email.toLowerCase(),
        firstName: '',
        lastName: '',
        status: 'PENDING',
        settings: {},
      },
    });

    // TODO: Send invitation email

    return user;
  }

  async getRoles(tenantId) {
    const roles = await prisma.role.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        permissions: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((r) => ({
      ...r,
      userCount: r._count.users,
      _count: undefined,
    }));
  }
}

export const tenantService = new TenantService();
