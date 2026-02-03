import { prisma } from '@crm360/database'
import { BadRequestError, UnauthorizedError, NotFoundError } from '@crm360/shared'
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from '../../common/auth.js'
import { nanoid } from 'nanoid'

// Token expiry times
const SESSION_EXPIRY_HOURS = 24

class SuperAdminService {
  /**
   * Login super admin
   */
  async login(input, ipAddress, userAgent) {
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { email: input.email.toLowerCase() },
    })

    if (!superAdmin || !superAdmin.passwordHash) {
      throw new UnauthorizedError('Invalid email or password')
    }

    const isValidPassword = await verifyPassword(input.password, superAdmin.passwordHash)

    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password')
    }

    if (!superAdmin.isActive) {
      throw new UnauthorizedError('Account is not active')
    }

    // Create session
    const sessionToken = nanoid(64)
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000)

    await prisma.superAdminSession.create({
      data: {
        superAdminId: superAdmin.id,
        token: sessionToken,
        userAgent,
        ipAddress,
        expiresAt,
      },
    })

    // Update last login
    await prisma.superAdmin.update({
      where: { id: superAdmin.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    })

    // Log action
    await this.createAuditLog({
      superAdminId: superAdmin.id,
      action: 'LOGIN',
      ipAddress,
      userAgent,
    })

    // Generate JWT tokens
    const tokenPayload = {
      superAdminId: superAdmin.id,
      role: superAdmin.role,
      type: 'super_admin',
    }

    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken(tokenPayload),
      generateRefreshToken(tokenPayload),
    ])

    return {
      accessToken,
      refreshToken,
      sessionToken,
      expiresIn: 900,
      superAdmin: {
        id: superAdmin.id,
        email: superAdmin.email,
        firstName: superAdmin.firstName,
        lastName: superAdmin.lastName,
        role: superAdmin.role,
        avatarUrl: superAdmin.avatarUrl,
      },
    }
  }

  /**
   * Logout super admin
   */
  async logout(sessionToken, superAdminId, ipAddress, userAgent) {
    if (sessionToken) {
      await prisma.superAdminSession.deleteMany({
        where: { token: sessionToken },
      })
    }

    await this.createAuditLog({
      superAdminId,
      action: 'LOGOUT',
      ipAddress,
      userAgent,
    })
  }

  /**
   * Get current super admin profile
   */
  async getMe(superAdminId) {
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: superAdminId },
    })

    if (!superAdmin) {
      throw new NotFoundError('Super admin not found')
    }

    return {
      id: superAdmin.id,
      email: superAdmin.email,
      firstName: superAdmin.firstName,
      lastName: superAdmin.lastName,
      role: superAdmin.role,
      avatarUrl: superAdmin.avatarUrl,
      permissions: superAdmin.permissions,
      mfaEnabled: superAdmin.mfaEnabled,
      lastLoginAt: superAdmin.lastLoginAt,
      createdAt: superAdmin.createdAt,
    }
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(refreshToken) {
    const payload = await verifyToken(refreshToken)

    if (!payload || payload.type !== 'refresh' || !payload.superAdminId) {
      throw new UnauthorizedError('Invalid refresh token')
    }

    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: payload.superAdminId },
    })

    if (!superAdmin || !superAdmin.isActive) {
      throw new UnauthorizedError('Super admin not found or inactive')
    }

    const tokenPayload = {
      superAdminId: superAdmin.id,
      role: superAdmin.role,
      type: 'super_admin',
    }

    const [newAccessToken, newRefreshToken] = await Promise.all([
      generateAccessToken(tokenPayload),
      generateRefreshToken(tokenPayload),
    ])

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
    }
  }

  // ==================== TENANT MANAGEMENT ====================

  /**
   * List all tenants with pagination
   */
  async listTenants({ page = 1, limit = 20, search, status }) {
    const where = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (status) {
      where.status = status
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              workspaces: true,
            },
          },
        },
      }),
      prisma.tenant.count({ where }),
    ])

    return {
      data: tenants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Get tenant by ID with details
   */
  async getTenant(tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            users: true,
            workspaces: true,
            subscriptions: true,
          },
        },
        users: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            createdAt: true,
          },
        },
        wallet: true,
      },
    })

    if (!tenant) {
      throw new NotFoundError('Tenant not found')
    }

    return tenant
  }

  /**
   * Update tenant
   */
  async updateTenant(tenantId, data, superAdminId, ipAddress, userAgent) {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: data.name,
        status: data.status,
        settings: data.settings,
      },
    })

    await this.createAuditLog({
      superAdminId,
      action: 'UPDATE_TENANT',
      entityType: 'Tenant',
      entityId: tenantId,
      details: data,
      ipAddress,
      userAgent,
    })

    return tenant
  }

  /**
   * Suspend tenant
   */
  async suspendTenant(tenantId, reason, superAdminId, ipAddress, userAgent) {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: 'SUSPENDED',
        settings: {
          suspendedAt: new Date().toISOString(),
          suspendReason: reason,
          suspendedBy: superAdminId,
        },
      },
    })

    await this.createAuditLog({
      superAdminId,
      action: 'SUSPEND_TENANT',
      entityType: 'Tenant',
      entityId: tenantId,
      details: { reason },
      ipAddress,
      userAgent,
    })

    return tenant
  }

  /**
   * Activate tenant
   */
  async activateTenant(tenantId, superAdminId, ipAddress, userAgent) {
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: { status: 'ACTIVE' },
    })

    await this.createAuditLog({
      superAdminId,
      action: 'ACTIVATE_TENANT',
      entityType: 'Tenant',
      entityId: tenantId,
      ipAddress,
      userAgent,
    })

    return tenant
  }

  // ==================== PLATFORM ANALYTICS ====================

  /**
   * Get platform overview stats
   */
  async getPlatformStats() {
    const [
      totalTenants,
      activeTenants,
      totalUsers,
      totalWorkspaces,
      recentTenants,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.tenant.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
        },
      }),
    ])

    return {
      tenants: {
        total: totalTenants,
        active: activeTenants,
        inactive: totalTenants - activeTenants,
      },
      users: { total: totalUsers },
      workspaces: { total: totalWorkspaces },
      recentTenants,
    }
  }

  // ==================== SUPER ADMIN MANAGEMENT ====================

  /**
   * List super admins (only for SUPER_ADMIN role)
   */
  async listSuperAdmins({ page = 1, limit = 20 }) {
    const [admins, total] = await Promise.all([
      prisma.superAdmin.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      prisma.superAdmin.count(),
    ])

    return {
      data: admins,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Create super admin (only for SUPER_ADMIN role)
   */
  async createSuperAdmin(data, creatorId, ipAddress, userAgent) {
    const existing = await prisma.superAdmin.findUnique({
      where: { email: data.email.toLowerCase() },
    })

    if (existing) {
      throw new BadRequestError('Email already registered')
    }

    const passwordHash = await hashPassword(data.password)

    const superAdmin = await prisma.superAdmin.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || 'ADMIN',
        permissions: data.permissions,
      },
    })

    await this.createAuditLog({
      superAdminId: creatorId,
      action: 'CREATE_SUPER_ADMIN',
      entityType: 'SuperAdmin',
      entityId: superAdmin.id,
      details: { email: superAdmin.email, role: superAdmin.role },
      ipAddress,
      userAgent,
    })

    return {
      id: superAdmin.id,
      email: superAdmin.email,
      firstName: superAdmin.firstName,
      lastName: superAdmin.lastName,
      role: superAdmin.role,
    }
  }

  /**
   * Update super admin
   */
  async updateSuperAdmin(adminId, data, updaterId, ipAddress, userAgent) {
    const updates = {}

    if (data.firstName) updates.firstName = data.firstName
    if (data.lastName) updates.lastName = data.lastName
    if (data.role) updates.role = data.role
    if (data.isActive !== undefined) updates.isActive = data.isActive
    if (data.permissions) updates.permissions = data.permissions

    if (data.password) {
      updates.passwordHash = await hashPassword(data.password)
    }

    const superAdmin = await prisma.superAdmin.update({
      where: { id: adminId },
      data: updates,
    })

    await this.createAuditLog({
      superAdminId: updaterId,
      action: 'UPDATE_SUPER_ADMIN',
      entityType: 'SuperAdmin',
      entityId: adminId,
      details: { ...data, password: data.password ? '[REDACTED]' : undefined },
      ipAddress,
      userAgent,
    })

    return {
      id: superAdmin.id,
      email: superAdmin.email,
      firstName: superAdmin.firstName,
      lastName: superAdmin.lastName,
      role: superAdmin.role,
      isActive: superAdmin.isActive,
    }
  }

  // ==================== AUDIT LOGS ====================

  /**
   * Create audit log entry
   */
  async createAuditLog({ superAdminId, action, entityType, entityId, details, ipAddress, userAgent }) {
    return prisma.platformAuditLog.create({
      data: {
        superAdminId,
        action,
        entityType,
        entityId,
        details,
        ipAddress,
        userAgent,
      },
    })
  }

  /**
   * Get audit logs
   */
  async getAuditLogs({ page = 1, limit = 50, action, superAdminId, entityType }) {
    const where = {}

    if (action) where.action = action
    if (superAdminId) where.superAdminId = superAdminId
    if (entityType) where.entityType = entityType

    const [logs, total] = await Promise.all([
      prisma.platformAuditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          superAdmin: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      prisma.platformAuditLog.count({ where }),
    ])

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }
}

export const superAdminService = new SuperAdminService()
