/**
 * Settings Service
 * Handles user profile, preferences, notifications, and organization settings
 */

import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import crypto from 'crypto';

class SettingsService {
  // =====================
  // User Profile
  // =====================

  async getUserProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        displayName: true,
        status: true,
        mfaEnabled: true,
        emailVerified: true,
        phoneVerified: true,
        lastSeenAt: true,
        createdAt: true,
        roles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        workspaces: {
          select: {
            workspace: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      ...user,
      role: user.roles[0]?.role || null,
      workspace: user.workspaces[0]?.workspace || null,
      roles: undefined,
      workspaces: undefined,
    };
  }

  async updateUserProfile(userId, data) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        phone: true,
        avatarUrl: true,
      },
    });

    return user;
  }

  async updatePassword(userId, currentPassword, newPassword) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // TODO: Verify current password with bcrypt
    // const isValid = await bcrypt.compare(currentPassword, user.passwordHash);

    // Hash new password
    // const newHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: {
        // passwordHash: newHash,
        updatedAt: new Date(),
      },
    });

    return { success: true };
  }

  // =====================
  // User Preferences
  // =====================

  async getUserPreferences(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const defaults = {
      theme: 'system',
      language: 'en',
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h',
      weekStart: 'monday',
      soundEnabled: true,
      desktopNotifications: true,
      emailDigest: 'daily',
      compactMode: false,
      showAvatars: true,
      autoArchive: false,
      keyboardShortcuts: true,
    };

    return { ...defaults, ...(user.settings?.preferences || {}) };
  }

  async updateUserPreferences(userId, preferences) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updatedSettings = {
      ...(user.settings || {}),
      preferences: {
        ...(user.settings?.preferences || {}),
        ...preferences,
      },
    };

    await prisma.user.update({
      where: { id: userId },
      data: {
        settings: updatedSettings,
        updatedAt: new Date(),
      },
    });

    return updatedSettings.preferences;
  }

  // =====================
  // Notification Settings
  // =====================

  async getNotificationSettings(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const defaults = {
      newMessage: { inApp: true, email: false, push: true },
      messageAssigned: { inApp: true, email: true, push: true },
      messageMentioned: { inApp: true, email: true, push: true },
      conversationResolved: { inApp: true, email: false, push: false },
      slaWarning: { inApp: true, email: true, push: true },
      teamMemberAdded: { inApp: true, email: true, push: false },
      campaignCompleted: { inApp: true, email: true, push: false },
      securityAlert: { inApp: true, email: true, push: true },
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
      dailyDigest: true,
      weeklyReport: true,
    };

    return { ...defaults, ...(user.settings?.notifications || {}) };
  }

  async updateNotificationSettings(userId, notifications) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { settings: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const updatedSettings = {
      ...(user.settings || {}),
      notifications: {
        ...(user.settings?.notifications || {}),
        ...notifications,
      },
    };

    await prisma.user.update({
      where: { id: userId },
      data: {
        settings: updatedSettings,
        updatedAt: new Date(),
      },
    });

    return updatedSettings.notifications;
  }

  // =====================
  // Organization Settings
  // =====================

  async getOrganizationSettings(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        domain: true,
        logoUrl: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        timezone: true,
        currency: true,
        locale: true,
        industry: true,
        size: true,
        settings: true,
        status: true,
        createdAt: true,
        _count: {
          select: { users: true, workspaces: true },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundError('Organization not found');
    }

    return {
      ...tenant,
      userCount: tenant._count.users,
      workspaceCount: tenant._count.workspaces,
      _count: undefined,
    };
  }

  async updateOrganizationSettings(tenantId, data) {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.name,
        logoUrl: data.logoUrl,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
        timezone: data.timezone,
        currency: data.currency,
        locale: data.locale,
        industry: data.industry,
        size: data.size,
        settings: data.settings,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        address: true,
        phone: true,
        email: true,
        website: true,
        timezone: true,
        currency: true,
        locale: true,
        industry: true,
        size: true,
        settings: true,
        status: true,
      },
    });

    return tenant;
  }

  // =====================
  // Teams
  // =====================

  async getTeams(tenantId) {
    const workspaces = await prisma.workspace.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        createdAt: true,
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      description: w.description,
      isDefault: w.isDefault,
      color: 'bg-blue-500',
      members: w._count.users,
      createdAt: w.createdAt,
    }));
  }

  async createTeam(tenantId, data) {
    const workspace = await prisma.workspace.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description || '',
        isDefault: false,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isDefault: true,
        createdAt: true,
      },
    });

    return workspace;
  }

  async updateTeam(tenantId, teamId, data) {
    const workspace = await prisma.workspace.update({
      where: { id: teamId, tenantId },
      data: {
        name: data.name,
        description: data.description,
        updatedAt: new Date(),
      },
    });

    return workspace;
  }

  async deleteTeam(tenantId, teamId) {
    // Check if it's the default workspace
    const workspace = await prisma.workspace.findUnique({
      where: { id: teamId },
      select: { isDefault: true },
    });

    if (workspace?.isDefault) {
      throw new Error('Cannot delete default workspace');
    }

    await prisma.workspace.delete({
      where: { id: teamId, tenantId },
    });

    return { success: true };
  }

  // =====================
  // Team Members (using Workspace model since "teams" are workspaces in UI)
  // =====================

  async getTeamMembers(tenantId, teamId) {
    // teamId is actually a workspaceId from the frontend
    const workspace = await prisma.workspace.findFirst({
      where: { id: teamId, tenantId },
      include: {
        users: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundError('Team not found');
    }

    // Return users in the format expected by frontend
    return workspace.users.map((wu) => ({
      id: wu.user.id,
      email: wu.user.email,
      firstName: wu.user.firstName,
      lastName: wu.user.lastName,
      avatarUrl: wu.user.avatarUrl,
      status: wu.user.status,
    }));
  }

  async addTeamMember(tenantId, teamId, data) {
    // teamId is actually a workspaceId from the frontend
    const workspace = await prisma.workspace.findFirst({
      where: { id: teamId, tenantId },
    });

    if (!workspace) {
      throw new NotFoundError('Team not found');
    }

    // Check if user exists in the same tenant
    const user = await prisma.user.findFirst({
      where: { id: data.userId, tenantId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Add member to workspace
    const member = await prisma.userWorkspace.create({
      data: {
        workspaceId: teamId,
        userId: data.userId,
      },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
    };
  }

  async updateTeamMember(tenantId, teamId, userId, data) {
    // UserWorkspace doesn't have a role field, so this is a no-op
    // Just verify workspace exists
    const workspace = await prisma.workspace.findFirst({
      where: { id: teamId, tenantId },
    });

    if (!workspace) {
      throw new NotFoundError('Team not found');
    }

    return { success: true };
  }

  async removeTeamMember(tenantId, teamId, userId) {
    // teamId is actually a workspaceId from the frontend
    const workspace = await prisma.workspace.findFirst({
      where: { id: teamId, tenantId },
    });

    if (!workspace) {
      throw new NotFoundError('Team not found');
    }

    await prisma.userWorkspace.delete({
      where: {
        userId_workspaceId: { userId, workspaceId: teamId },
      },
    });

    return { success: true };
  }

  // =====================
  // Roles & Permissions
  // =====================

  async getRoles(tenantId) {
    const roles = await prisma.role.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
        createdAt: true,
        permissions: {
          select: {
            permission: {
              select: {
                id: true,
                code: true,
                name: true,
                module: true,
              },
            },
          },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      createdAt: r.createdAt,
      permissionCount: r.permissions.length,
      permissions: r.permissions.reduce((acc, p) => {
        // Group by module
        if (!acc[p.permission.module]) {
          acc[p.permission.module] = {};
        }
        acc[p.permission.module][p.permission.code] = true;
        return acc;
      }, {}),
      userCount: r._count.users,
    }));
  }

  async createRole(tenantId, data) {
    // Create role first
    const role = await prisma.role.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        isSystem: false,
      },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
      },
    });

    // Add permissions if provided
    if (data.permissions && Object.keys(data.permissions).length > 0) {
      const permissionCodes = [];
      for (const [module, perms] of Object.entries(data.permissions)) {
        for (const [code, enabled] of Object.entries(perms)) {
          if (enabled) {
            permissionCodes.push(code);
          }
        }
      }

      if (permissionCodes.length > 0) {
        const permissions = await prisma.permission.findMany({
          where: { code: { in: permissionCodes } },
          select: { id: true },
        });

        await prisma.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId: role.id,
            permissionId: p.id,
          })),
        });
      }
    }

    return role;
  }

  async updateRole(tenantId, roleId, data) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { isSystem: true, tenantId: true },
    });

    if (!role || role.tenantId !== tenantId) {
      throw new NotFoundError('Role not found');
    }

    if (role.isSystem) {
      throw new Error('Cannot modify system role');
    }

    // Update role details
    const updatedRole = await prisma.role.update({
      where: { id: roleId },
      data: {
        name: data.name,
        description: data.description,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        description: true,
        isSystem: true,
      },
    });

    // Update permissions if provided
    if (data.permissions) {
      // Remove all existing permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId },
      });

      // Add new permissions
      const permissionCodes = [];
      for (const [module, perms] of Object.entries(data.permissions)) {
        for (const [code, enabled] of Object.entries(perms)) {
          if (enabled) {
            permissionCodes.push(code);
          }
        }
      }

      if (permissionCodes.length > 0) {
        const permissions = await prisma.permission.findMany({
          where: { code: { in: permissionCodes } },
          select: { id: true },
        });

        await prisma.rolePermission.createMany({
          data: permissions.map((p) => ({
            roleId,
            permissionId: p.id,
          })),
        });
      }
    }

    return updatedRole;
  }

  async deleteRole(tenantId, roleId) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { isSystem: true, tenantId: true, _count: { select: { users: true } } },
    });

    if (!role || role.tenantId !== tenantId) {
      throw new NotFoundError('Role not found');
    }

    if (role.isSystem) {
      throw new Error('Cannot delete system role');
    }

    if (role._count.users > 0) {
      throw new Error('Cannot delete role with assigned users');
    }

    await prisma.role.delete({
      where: { id: roleId },
    });

    return { success: true };
  }

  // =====================
  // API Keys
  // =====================

  async getApiKeys(tenantId) {
    try {
      const keys = await prisma.apiKey.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          status: true,
          rateLimit: true,
          expiresAt: true,
          lastUsedAt: true,
          createdAt: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const data = keys.map((k) => ({
        ...k,
        prefix: k.keyPrefix,
        keyPrefix: undefined,
        createdByName: k.user ? `${k.user.firstName} ${k.user.lastName}` : 'System',
        user: undefined,
      }));

      return { success: true, data };
    } catch (error) {
      // Graceful degradation if ApiKey model doesn't exist
      console.error('ApiKey query error:', error.message);
      return { success: true, data: [] };
    }
  }

  async createApiKey(tenantId, userId, data) {
    // Generate secure API key
    const keyValue = `crm_${data.prefix || 'live'}_sk_${crypto.randomBytes(24).toString('hex')}`;
    const keyPrefix = keyValue.substring(0, 16);
    const keyHash = crypto.createHash('sha256').update(keyValue).digest('hex');

    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId,
        userId,
        name: data.name,
        keyHash,
        keyPrefix,
        scopes: data.scopes || [],
        status: 'ACTIVE',
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    // Return the full key only on creation
    return {
      ...apiKey,
      prefix: apiKey.keyPrefix,
      keyPrefix: undefined,
      key: keyValue,
    };
  }

  async revokeApiKey(tenantId, keyId) {
    await prisma.apiKey.update({
      where: { id: keyId, tenantId },
      data: {
        status: 'REVOKED',
      },
    });

    return { success: true };
  }

  // =====================
  // Audit Logs
  // =====================

  async getAuditLogs(tenantId, options = {}) {
    try {
      const { limit = 50, offset = 0, category, status, startDate, endDate } = options;

      const where = {
        tenantId,
        ...(category && category !== 'all' && { entityType: category }),
        ...(startDate && { createdAt: { gte: new Date(startDate) } }),
        ...(endDate && { createdAt: { lte: new Date(endDate) } }),
      };

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          select: {
            id: true,
            action: true,
            entityType: true,
            entityId: true,
            oldValues: true,
            newValues: true,
            ipAddress: true,
            userAgent: true,
            requestId: true,
            metadata: true,
            createdAt: true,
            userId: true,
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.auditLog.count({ where }),
      ]);

      // Fetch user info for logs that have userId
      const userIds = [...new Set(logs.filter((l) => l.userId).map((l) => l.userId))];
      const users =
        userIds.length > 0
          ? await prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, email: true, firstName: true, lastName: true },
            })
          : [];
      const userMap = new Map(users.map((u) => [u.id, u]));

      return {
        logs: logs.map((log) => {
          const user = log.userId ? userMap.get(log.userId) : null;
          return {
            id: log.id,
            action: log.action,
            category: log.entityType,
            resource: log.entityType,
            resourceId: log.entityId,
            status: log.metadata?.status || 'success',
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            details: {
              oldValues: log.oldValues,
              newValues: log.newValues,
              ...log.metadata,
            },
            createdAt: log.createdAt,
            actor: user
              ? {
                  id: user.id,
                  name: `${user.firstName} ${user.lastName}`.trim() || user.email,
                  email: user.email,
                }
              : { id: 'system', name: 'System', email: null },
          };
        }),
        total,
        hasMore: offset + logs.length < total,
      };
    } catch (error) {
      // Graceful degradation if AuditLog model doesn't exist
      console.error('AuditLog query error:', error.message);
      return {
        logs: [],
        total: 0,
        hasMore: false,
      };
    }
  }

  async createAuditLog(data) {
    const log = await prisma.auditLog.create({
      data: {
        tenantId: data.tenantId,
        userId: data.userId,
        action: data.action,
        entityType: data.category || data.entityType,
        entityId: data.resourceId || data.entityId,
        oldValues: data.oldValues,
        newValues: data.newValues,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        requestId: data.requestId,
        metadata: {
          status: data.status || 'success',
          ...data.details,
        },
      },
    });

    return log;
  }

  // =====================
  // Active Sessions
  // =====================

  async getActiveSessions(tenantId, userId = null) {
    // Session doesn't have tenantId, so we filter through user's tenantId
    const where = {
      expiresAt: { gt: new Date() },
      user: {
        tenantId,
      },
      ...(userId && { userId }),
    };

    const sessions = await prisma.session.findMany({
      where,
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        lastActivityAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            tenantId: true,
          },
        },
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    const data = sessions.map((s) => ({
      id: s.id,
      deviceInfo: s.userAgent,
      ipAddress: s.ipAddress,
      lastActiveAt: s.lastActivityAt,
      createdAt: s.createdAt,
      userName: s.user ? `${s.user.firstName} ${s.user.lastName}`.trim() : 'Unknown',
      userEmail: s.user?.email,
      userId: s.user?.id,
    }));

    return { success: true, data };
  }

  async revokeSession(tenantId, sessionId, currentSessionId) {
    if (sessionId === currentSessionId) {
      throw new Error('Cannot revoke current session');
    }

    // Verify the session belongs to this tenant
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { user: { select: { tenantId: true } } },
    });

    if (!session || session.user.tenantId !== tenantId) {
      throw new NotFoundError('Session not found');
    }

    await prisma.session.delete({
      where: { id: sessionId },
    });

    return { success: true };
  }

  async revokeAllOtherSessions(tenantId, userId, currentSessionId) {
    // Verify user belongs to tenant
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });

    if (!user || user.tenantId !== tenantId) {
      throw new NotFoundError('User not found');
    }

    await prisma.session.deleteMany({
      where: {
        userId,
        id: { not: currentSessionId },
      },
    });

    return { success: true };
  }

  // =====================
  // Security Settings
  // =====================

  async getSecuritySettings(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const defaults = {
      twoFactorRequired: false,
      sessionTimeout: 30,
      passwordMinLength: 12,
      passwordRequireSpecial: true,
      passwordExpiryDays: 90,
      maxLoginAttempts: 5,
      ipWhitelistEnabled: false,
      ipWhitelist: [],
      ssoEnabled: false,
      ssoConfig: null,
    };

    return { ...defaults, ...(tenant.settings?.security || {}) };
  }

  async updateSecuritySettings(tenantId, settings) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const updatedSettings = {
      ...(tenant.settings || {}),
      security: {
        ...(tenant.settings?.security || {}),
        ...settings,
      },
    };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: updatedSettings,
        updatedAt: new Date(),
      },
    });

    return updatedSettings.security;
  }

  // =====================
  // User Webhooks
  // =====================

  async getWebhooks(tenantId) {
    try {
      const webhooks = await prisma.webhook.findMany({
        where: { tenantId },
        select: {
          id: true,
          name: true,
          url: true,
          events: true,
          status: true,
          lastTriggeredAt: true,
          successCount: true,
          failureCount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const data = webhooks.map((w) => ({
        ...w,
        successRate:
          w.successCount + w.failureCount > 0
            ? ((w.successCount / (w.successCount + w.failureCount)) * 100).toFixed(1)
            : 100,
      }));

      return { success: true, data };
    } catch (error) {
      // Graceful degradation if Webhook model doesn't exist
      console.error('Webhook query error:', error.message);
      return { success: true, data: [] };
    }
  }

  async createWebhook(tenantId, userId, data) {
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.webhook.create({
      data: {
        tenantId,
        createdById: userId,
        name: data.name,
        url: data.url,
        events: data.events || [],
        secret,
        status: 'ACTIVE',
        successCount: 0,
        failureCount: 0,
      },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        status: true,
        secret: true,
        createdAt: true,
      },
    });

    return webhook;
  }

  async updateWebhook(tenantId, webhookId, data) {
    const webhook = await prisma.webhook.update({
      where: { id: webhookId, tenantId },
      data: {
        name: data.name,
        url: data.url,
        events: data.events,
        status: data.status,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        status: true,
      },
    });

    return webhook;
  }

  async deleteWebhook(tenantId, webhookId) {
    await prisma.webhook.delete({
      where: { id: webhookId, tenantId },
    });

    return { success: true };
  }

  async testWebhook(tenantId, webhookId, event) {
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId, tenantId },
    });

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    const testPayload = {
      event: event || webhook.events[0] || 'test.event',
      timestamp: new Date().toISOString(),
      data: {
        id: 'test_123',
        message: 'This is a test webhook delivery',
      },
    };

    try {
      const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(testPayload))
        .digest('hex');

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': testPayload.event,
        },
        body: JSON.stringify(testPayload),
      });

      return {
        success: response.ok,
        statusCode: response.status,
        message: response.ok
          ? 'Test webhook delivered successfully'
          : `Failed with status ${response.status}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: `Failed to deliver: ${error.message}`,
      };
    }
  }

  async getWebhookDeliveryLogs(tenantId, webhookId, options = {}) {
    const webhook = await prisma.webhook.findUnique({
      where: { id: webhookId, tenantId },
    });

    if (!webhook) {
      throw new NotFoundError('Webhook not found');
    }

    const logs = await prisma.webhookDelivery.findMany({
      where: { webhookId },
      take: options.limit || 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        event: true,
        status: true,
        statusCode: true,
        duration: true,
        error: true,
        createdAt: true,
      },
    });

    return logs;
  }

  // =====================
  // Integrations
  // =====================

  async getIntegrations(tenantId) {
    try {
      const integrations = await prisma.integration.findMany({
        where: { tenantId },
        select: {
          id: true,
          type: true,
          name: true,
          provider: true,
          status: true,
          lastSyncAt: true,
          syncStatus: true,
          createdAt: true,
          connectedBy: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const data = integrations.map((i) => ({
        id: i.id,
        type: i.type,
        name: i.name,
        provider: i.provider,
        status: i.status,
        lastSync: i.lastSyncAt,
        syncStatus: i.syncStatus,
        createdAt: i.createdAt,
        connectedBy: i.connectedBy
          ? `${i.connectedBy.firstName} ${i.connectedBy.lastName}`.trim()
          : 'System',
      }));

      return { success: true, data };
    } catch (error) {
      // Graceful degradation if Integration model doesn't exist
      console.error('Integration query error:', error.message);
      return { success: true, data: [] };
    }
  }

  async createIntegration(tenantId, userId, data) {
    const integration = await prisma.integration.create({
      data: {
        tenantId,
        connectedById: userId,
        type: data.type,
        name: data.name,
        provider: data.provider || data.type,
        status: 'CONNECTED',
        config: data.config || {},
        syncStatus: 'IDLE',
      },
      select: {
        id: true,
        type: true,
        name: true,
        provider: true,
        status: true,
        createdAt: true,
      },
    });

    return integration;
  }

  async updateIntegration(tenantId, integrationId, data) {
    const integration = await prisma.integration.update({
      where: { id: integrationId, tenantId },
      data: {
        name: data.name,
        status: data.status,
        config: data.config,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        type: true,
        name: true,
        status: true,
      },
    });

    return integration;
  }

  async deleteIntegration(tenantId, integrationId) {
    await prisma.integration.delete({
      where: { id: integrationId, tenantId },
    });

    return { success: true };
  }

  async syncIntegration(tenantId, integrationId) {
    const integration = await prisma.integration.findUnique({
      where: { id: integrationId, tenantId },
    });

    if (!integration) {
      throw new NotFoundError('Integration not found');
    }

    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        syncStatus: 'SYNCING',
        lastSyncAt: new Date(),
      },
    });

    // TODO: Implement actual sync logic based on integration type

    return { status: 'syncing', message: 'Sync started' };
  }

  // =====================
  // Users Management
  // =====================

  async getUsers(tenantId, filters = {}) {
    const where = { tenantId };

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 25;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          displayName: true,
          phone: true,
          avatarUrl: true,
          status: true,
          emailVerified: true,
          mfaEnabled: true,
          lastSeenAt: true,
          createdAt: true,
          roles: {
            select: {
              role: { select: { id: true, name: true } },
            },
          },
          workspaces: {
            select: {
              workspace: { select: { id: true, name: true } },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        ...u,
        role: u.roles[0]?.role || null,
        workspace: u.workspaces[0]?.workspace || null,
        roles: undefined,
        workspaces: undefined,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUser(tenantId, userId) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        displayName: true,
        phone: true,
        avatarUrl: true,
        status: true,
        emailVerified: true,
        phoneVerified: true,
        mfaEnabled: true,
        lastSeenAt: true,
        createdAt: true,
        updatedAt: true,
        roles: {
          select: {
            role: { select: { id: true, name: true, description: true } },
          },
        },
        workspaces: {
          select: {
            workspace: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      ...user,
      role: user.roles[0]?.role || null,
      workspacesList: user.workspaces.map((w) => w.workspace),
      roles: undefined,
      workspaces: undefined,
    };
  }

  async inviteUser(tenantId, data) {
    // Check if user already exists
    const existing = await prisma.user.findFirst({
      where: { tenantId, email: data.email.toLowerCase() },
    });

    if (existing) {
      throw new Error('User with this email already exists');
    }

    // Get default workspace
    const defaultWorkspace = await prisma.workspace.findFirst({
      where: { tenantId, isDefault: true },
    });

    // Generate temporary password hash for invited user (they'll set real password on invite acceptance)
    const tempPassword = crypto.randomBytes(32).toString('hex');
    const tempPasswordHash = crypto.createHash('sha256').update(tempPassword).digest('hex');

    // Create user with pending status
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: data.email.toLowerCase(),
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        passwordHash: tempPasswordHash,
        status: 'INACTIVE', // Pending invitation
        settings: { invitedAt: new Date().toISOString() },
      },
    });

    // Add to workspace
    if (defaultWorkspace) {
      await prisma.userWorkspace.create({
        data: {
          userId: user.id,
          workspaceId: defaultWorkspace.id,
        },
      });
    }

    // Assign role
    if (data.roleId) {
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: data.roleId,
        },
      });
    }

    // TODO: Send invitation email

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      invitedAt: new Date(),
    };
  }

  async updateUser(tenantId, userId, data) {
    const existing = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('User not found');
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        phone: data.phone,
        status: data.status,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
      },
    });

    // Update role if provided
    if (data.roleId) {
      await prisma.userRole.deleteMany({ where: { userId } });
      await prisma.userRole.create({
        data: { userId, roleId: data.roleId },
      });
    }

    return user;
  }

  async deleteUser(tenantId, userId, currentUserId) {
    if (userId === currentUserId) {
      throw new Error('Cannot delete your own account');
    }

    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return { success: true };
  }

  async resendInvitation(tenantId, userId) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.status !== 'INACTIVE') {
      throw new Error('User has already accepted the invitation');
    }

    // TODO: Send invitation email

    return { success: true, message: 'Invitation sent' };
  }

  async getPendingInvitations(tenantId) {
    // Get users with INACTIVE status who haven't accepted their invitation yet
    const pendingUsers = await prisma.user.findMany({
      where: {
        tenantId,
        status: 'INACTIVE',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        settings: true,
        createdAt: true,
        roles: {
          select: {
            role: { select: { id: true, name: true } },
          },
        },
        workspaces: {
          select: {
            workspace: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return pendingUsers.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.roles[0]?.role || null,
      team: user.workspaces[0]?.workspace || null,
      invitedAt: user.settings?.invitedAt || user.createdAt,
      expiresAt: user.settings?.invitedAt
        ? new Date(new Date(user.settings.invitedAt).getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days expiry
        : null,
    }));
  }

  async revokeInvitation(tenantId, userId) {
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId, status: 'INACTIVE' },
    });

    if (!user) {
      throw new NotFoundError('Invitation not found');
    }

    // Delete the user (invitation revoked)
    await prisma.user.delete({
      where: { id: userId },
    });

    return { success: true, message: 'Invitation revoked' };
  }

  // =====================
  // Subscription
  // =====================

  async getSubscription(tenantId) {
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId },
      include: {
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return null;
    }

    // Get usage stats
    const [userCount, contactCount] = await Promise.all([
      prisma.user.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.contact.count({ where: { tenantId } }),
    ]);

    return {
      id: subscription.id,
      status: subscription.status,
      plan: subscription.plan,
      billingCycle: subscription.billingCycle,
      seats: subscription.seats,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      trialEndsAt: subscription.trialEndsAt,
      cancelledAt: subscription.cancelledAt,
      usage: {
        users: userCount,
        contacts: contactCount,
        maxUsers: subscription.plan.maxUsers,
        maxContacts: subscription.plan.maxContacts,
      },
    };
  }

  async getAvailablePlans() {
    const plans = await prisma.plan.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { monthlyPrice: 'asc' },
    });

    return plans;
  }

  async changePlan(tenantId, planId, billingCycle) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundError('Plan not found');
    }

    // Update or create subscription
    const subscription = await prisma.subscription.upsert({
      where: { tenantId_planId: { tenantId, planId } },
      create: {
        tenantId,
        planId,
        status: 'ACTIVE',
        billingCycle: billingCycle || 'MONTHLY',
        startDate: new Date(),
      },
      update: {
        planId,
        billingCycle: billingCycle || 'MONTHLY',
        status: 'ACTIVE',
        updatedAt: new Date(),
      },
      include: { plan: true },
    });

    return subscription;
  }

  async cancelSubscription(tenantId) {
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'TRIALING'] } },
    });

    if (!subscription) {
      throw new NotFoundError('No active subscription found');
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    return { success: true, message: 'Subscription cancelled' };
  }

  // =====================
  // Compliance / Opt-outs
  // =====================

  async getOptOuts(tenantId, filters = {}) {
    const where = { tenantId };

    if (filters.channel) {
      where.channel = filters.channel;
    }

    if (filters.search) {
      where.identifier = { contains: filters.search };
    }

    const page = filters.page || 1;
    const limit = filters.limit || 25;

    const [optOuts, total] = await Promise.all([
      prisma.optOut.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { optedOutAt: 'desc' },
      }),
      prisma.optOut.count({ where }),
    ]);

    return {
      optOuts,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async addOptOut(tenantId, data) {
    const optOut = await prisma.optOut.create({
      data: {
        tenantId,
        identifier: data.identifier,
        channel: data.channel,
        reason: data.reason,
        source: data.source || 'manual',
        optedOutAt: new Date(),
      },
    });

    return optOut;
  }

  async removeOptOut(tenantId, optOutId) {
    const optOut = await prisma.optOut.findFirst({
      where: { id: optOutId, tenantId },
    });

    if (!optOut) {
      throw new NotFoundError('Opt-out record not found');
    }

    await prisma.optOut.delete({
      where: { id: optOutId },
    });

    return { success: true };
  }

  async getConsents(tenantId, contactId) {
    const consents = await prisma.consent.findMany({
      where: { tenantId, contactId },
      orderBy: { createdAt: 'desc' },
    });

    return consents;
  }

  async updateConsent(tenantId, contactId, data) {
    const consent = await prisma.consent.upsert({
      where: {
        tenantId_contactId_channel_type: {
          tenantId,
          contactId,
          channel: data.channel,
          type: data.type,
        },
      },
      create: {
        tenantId,
        contactId,
        channel: data.channel,
        type: data.type,
        status: data.status,
        method: data.method,
        grantedAt: data.status === 'GRANTED' ? new Date() : null,
        revokedAt: data.status === 'REVOKED' ? new Date() : null,
      },
      update: {
        status: data.status,
        method: data.method,
        grantedAt: data.status === 'GRANTED' ? new Date() : undefined,
        revokedAt: data.status === 'REVOKED' ? new Date() : undefined,
        updatedAt: new Date(),
      },
    });

    return consent;
  }

  // =====================
  // Email Settings
  // =====================

  async getEmailSettings(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        settings: true,
      },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    // Email settings are stored in the tenant.settings JSON field
    const settings = tenant.settings || {};
    const emailSettings = settings.email || {};

    return {
      // Primary email for outbound communications
      primaryEmail: emailSettings.primaryEmail || tenant.email || '',
      primaryEmailName: emailSettings.primaryEmailName || tenant.name || '',

      // Support email for customer replies
      supportEmail: emailSettings.supportEmail || '',
      supportEmailName: emailSettings.supportEmailName || 'Support Team',

      // Reply-to configuration
      replyToEmail: emailSettings.replyToEmail || '',
      replyToName: emailSettings.replyToName || '',

      // Default from address
      defaultFromEmail: emailSettings.defaultFromEmail || '',
      defaultFromName: emailSettings.defaultFromName || tenant.name || '',

      // Signature
      signature: emailSettings.signature || '',
      signatureHtml: emailSettings.signatureHtml || '',

      // Footer
      footerText: emailSettings.footerText || '',
      footerHtml: emailSettings.footerHtml || '',
      unsubscribeText: emailSettings.unsubscribeText || 'Click here to unsubscribe',

      // Tracking
      trackOpens: emailSettings.trackOpens !== false,
      trackClicks: emailSettings.trackClicks !== false,
      includeLogo: emailSettings.includeLogo !== false,
    };
  }

  async updateEmailSettings(tenantId, data) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    // Merge with existing settings
    const currentSettings = tenant.settings || {};
    const updatedSettings = {
      ...currentSettings,
      email: {
        ...(currentSettings.email || {}),
        ...data,
        updatedAt: new Date().toISOString(),
      },
    };

    const updatedTenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        settings: updatedSettings,
        // Also update main tenant email if primaryEmail is provided
        ...(data.primaryEmail ? { email: data.primaryEmail } : {}),
      },
      select: {
        settings: true,
        email: true,
        name: true,
      },
    });

    return this.getEmailSettings(tenantId);
  }

  async testEmailSettings(tenantId, toEmail, type = 'primary') {
    const settings = await this.getEmailSettings(tenantId);

    // Import mailer
    const { sendEmail } = await import('../../common/mailer.js');

    const fromEmail =
      type === 'support' ? settings.supportEmail || settings.primaryEmail : settings.primaryEmail;

    const fromName =
      type === 'support'
        ? settings.supportEmailName || settings.primaryEmailName
        : settings.primaryEmailName;

    if (!fromEmail) {
      return {
        success: false,
        error: `No ${type} email configured`,
      };
    }

    try {
      await sendEmail({
        to: toEmail,
        from: `"${fromName}" <${fromEmail}>`,
        subject: `[Test] Email Configuration Test - ${type === 'support' ? 'Support' : 'Primary'}`,
        text: `This is a test email from your CRM.\n\nIf you received this email, your ${type} email configuration is working correctly.\n\n${settings.signature || ''}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Email Configuration Test</h2>
            <p>This is a test email from your CRM.</p>
            <p>If you received this email, your <strong>${type}</strong> email configuration is working correctly.</p>
            ${settings.signatureHtml || settings.signature ? `<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">${settings.signatureHtml || settings.signature}</div>` : ''}
          </div>
        `,
      });

      return {
        success: true,
        message: `Test email sent to ${toEmail}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Failed to send test email',
      };
    }
  }

  // =====================
  // Signatures
  // =====================

  /**
   * Get all signatures for a user
   */
  async getSignatures(tenantId, userId) {
    return prisma.signature.findMany({
      where: { tenantId, userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Create a new signature
   */
  async createSignature(tenantId, userId, data) {
    // Map channel string to enum
    const channelMap = {
      all: 'ALL',
      email: 'EMAIL',
      whatsapp: 'WHATSAPP',
    };

    return prisma.signature.create({
      data: {
        tenantId,
        userId,
        name: data.name,
        content: data.content,
        channel: channelMap[data.channel] || 'ALL',
        signatureType: data.signatureType || 'text',
        logoUrl: data.logoUrl || null,
        links: data.links || null,
        isActive: data.isActive ?? true,
      },
    });
  }

  /**
   * Update a signature
   */
  async updateSignature(tenantId, userId, signatureId, data) {
    // Verify ownership
    const signature = await prisma.signature.findFirst({
      where: { id: signatureId, tenantId, userId },
    });

    if (!signature) {
      throw new NotFoundError('Signature not found');
    }

    // Map channel string to enum if provided
    const channelMap = {
      all: 'ALL',
      email: 'EMAIL',
      whatsapp: 'WHATSAPP',
    };

    const updateData = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.channel !== undefined) updateData.channel = channelMap[data.channel] || 'ALL';
    if (data.signatureType !== undefined) updateData.signatureType = data.signatureType;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.links !== undefined) updateData.links = data.links;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.signature.update({
      where: { id: signatureId },
      data: updateData,
    });
  }

  /**
   * Delete a signature
   */
  async deleteSignature(tenantId, userId, signatureId) {
    // Verify ownership
    const signature = await prisma.signature.findFirst({
      where: { id: signatureId, tenantId, userId },
    });

    if (!signature) {
      throw new NotFoundError('Signature not found');
    }

    return prisma.signature.delete({
      where: { id: signatureId },
    });
  }

  /**
   * Set a signature as default for a channel
   */
  async setDefaultSignature(tenantId, userId, signatureId, channel) {
    // Verify ownership
    const signature = await prisma.signature.findFirst({
      where: { id: signatureId, tenantId, userId },
    });

    if (!signature) {
      throw new NotFoundError('Signature not found');
    }

    // Use signature's channel if not specified
    const targetChannel = channel
      ? {
          all: 'ALL',
          email: 'EMAIL',
          whatsapp: 'WHATSAPP',
        }[channel]
      : signature.channel;

    // Start a transaction to:
    // 1. Unset any existing default for the same channel
    // 2. Set the new default
    await prisma.$transaction([
      // Unset existing defaults for this channel
      prisma.signature.updateMany({
        where: {
          tenantId,
          userId,
          channel: targetChannel,
          isDefault: true,
          id: { not: signatureId },
        },
        data: { isDefault: false },
      }),
      // Set new default
      prisma.signature.update({
        where: { id: signatureId },
        data: { isDefault: true },
      }),
    ]);

    return prisma.signature.findUnique({
      where: { id: signatureId },
    });
  }
}

export const settingsService = new SettingsService();
