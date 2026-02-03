import { prisma } from '@crm360/database';
import { BadRequestError, UnauthorizedError, ConflictError } from '@crm360/shared';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} from '../../common/auth.js';
import { sendPasswordResetEmail, sendEmailVerificationEmail } from '../../common/mailer.js';
import { nanoid } from 'nanoid';

// Token expiry times
const PASSWORD_RESET_EXPIRY_HOURS = 1;
const EMAIL_VERIFICATION_EXPIRY_HOURS = 24;

class AuthService {
  async register(input) {
    // Check if email already exists for any tenant
    const existingUser = await prisma.user.findFirst({
      where: { email: input.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Create tenant, workspace, default role, and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          name: input.companyName,
          slug: this.generateSlug(input.companyName),
          status: 'ACTIVE',
          settings: {},
        },
      });

      // Create default workspace
      const workspace = await tx.workspace.create({
        data: {
          tenantId: tenant.id,
          name: 'Default',
          isDefault: true,
        },
      });

      // Create admin role with all permissions
      const adminRole = await tx.role.create({
        data: {
          tenantId: tenant.id,
          name: 'Admin',
          description: 'Full access to all features',
          isSystem: true,
        },
      });

      // Hash password
      const passwordHash = await hashPassword(input.password);

      // Create user
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: input.email.toLowerCase(),
          passwordHash,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          status: 'ACTIVE',
          settings: {},
        },
      });

      // Create user-workspace relationship
      await tx.userWorkspace.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
        },
      });

      // Create user-role relationship
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: adminRole.id,
        },
      });

      // Create wallet for tenant
      await tx.wallet.create({
        data: {
          tenantId: tenant.id,
          balance: 0,
          currency: 'USD',
          lowBalanceThreshold: 10,
          autoTopUpEnabled: false,
        },
      });

      return { tenant, workspace, user };
    });

    // Send verification email automatically after registration
    try {
      const verificationToken = nanoid(32);
      const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);

      await prisma.emailVerificationToken.create({
        data: {
          token: verificationToken,
          userId: result.user.id,
          email: result.user.email,
          expiresAt,
        },
      });

      await sendEmailVerificationEmail({
        email: result.user.email,
        verificationToken,
        firstName: result.user.firstName,
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails, user can request resend
    }

    // Generate tokens
    const tokenPayload = {
      userId: result.user.id,
      tenantId: result.tenant.id,
      workspaceId: result.workspace.id,
    };

    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken(tokenPayload),
      generateRefreshToken(tokenPayload),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 31536000, // 1 year
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
      },
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        logo: result.tenant.logoUrl,
        brandColor: result.tenant.settings?.brandColor || null,
      },
    };
  }

  async login(input) {
    const user = await prisma.user.findFirst({
      where: { email: input.email.toLowerCase() },
      include: {
        tenant: true,
        workspaces: {
          include: {
            workspace: true,
          },
          take: 1,
        },
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValidPassword = await verifyPassword(input.password, user.passwordHash);

    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active');
    }

    if (user.tenant.status !== 'ACTIVE') {
      throw new UnauthorizedError('Tenant account is not active');
    }

    // Check email verification
    if (!user.emailVerified) {
      throw new UnauthorizedError(
        'Please verify your email before logging in. Check your inbox for the verification link.'
      );
    }

    // Update last login time
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Get default workspace
    const defaultWorkspace = user.workspaces[0]?.workspace;

    // Calculate permissions based on role
    const permissions = new Set();
    let roleLevel = 0;
    let roleName = '';

    user.roles.forEach((userRole) => {
      const rn = userRole.role.name?.toLowerCase()?.trim() || '';
      roleName = userRole.role.name || '';

      let level = 1;
      if (rn.includes('super') && rn.includes('admin')) level = 10;
      else if (rn === 'admin' || rn.includes('administrator')) level = 9;
      else if (rn.includes('manager')) level = 8;
      else if (rn.includes('marketing')) level = 7;
      else if (rn.includes('sales')) level = 6;
      else if (rn.includes('support') || rn.includes('agent')) level = 5;

      if (level > roleLevel) roleLevel = level;
    });

    // Add permissions based on role level
    if (roleLevel >= 9) {
      permissions.add('*');
    } else if (roleLevel >= 7) {
      ['crm:*', 'analytics:read', 'inbox:*', 'pipeline:*', 'settings:read'].forEach((p) =>
        permissions.add(p)
      );
    } else if (roleLevel >= 5) {
      [
        'crm:contacts:*',
        'crm:deals:*',
        'crm:activities:*',
        'inbox:*',
        'tickets:*',
        'analytics:read',
      ].forEach((p) => permissions.add(p));
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      workspaceId: defaultWorkspace?.id,
    };

    const [accessToken, refreshToken] = await Promise.all([
      generateAccessToken(tokenPayload),
      generateRefreshToken(tokenPayload),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 31536000, // 1 year
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: roleName,
        roleLevel,
        permissions: Array.from(permissions),
        emailVerified: user.emailVerified,
      },
    };
  }

  async refreshTokens(refreshToken) {
    const payload = await verifyToken(refreshToken);

    if (!payload || payload.type !== 'refresh') {
      throw new UnauthorizedError('Invalid refresh token');
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { tenant: true },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Check email verification - force logout if not verified
    if (!user.emailVerified) {
      throw new UnauthorizedError('Email not verified. Please verify your email to continue.');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active');
    }

    if (user.tenant.status !== 'ACTIVE') {
      throw new UnauthorizedError('Organization account is not active');
    }

    const tokenPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      workspaceId: user.workspaceId,
    };

    const [newAccessToken, newRefreshToken] = await Promise.all([
      generateAccessToken(tokenPayload),
      generateRefreshToken(tokenPayload),
    ]);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 31536000, // 1 year
    };
  }

  async logout(_token) {
    // In a production system, you would add the token to a blacklist
    // For now, we just return success (client should clear tokens)
  }

  async getMe(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        workspaces: {
          include: { workspace: true },
          take: 1,
        },
        roles: {
          include: { role: true },
          take: 1,
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Check email verification - force logout if not verified
    if (!user.emailVerified) {
      throw new UnauthorizedError('Email not verified. Please verify your email to continue.');
    }

    // Check user status
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active');
    }

    // Check tenant status
    if (user.tenant.status !== 'ACTIVE') {
      throw new UnauthorizedError('Organization account is not active');
    }

    const defaultWorkspace = user.workspaces[0]?.workspace;
    const primaryRole = user.roles[0]?.role;

    // Calculate permissions based on role
    const permissions = new Set();
    let roleLevel = 0;

    user.roles.forEach((userRole) => {
      const rn = userRole.role.name?.toLowerCase()?.trim() || '';

      let level = 1;
      if (rn.includes('super') && rn.includes('admin')) level = 10;
      else if (rn === 'admin' || rn.includes('administrator')) level = 9;
      else if (rn.includes('manager')) level = 8;
      else if (rn.includes('marketing')) level = 7;
      else if (rn.includes('sales')) level = 6;
      else if (rn.includes('support') || rn.includes('agent')) level = 5;

      if (level > roleLevel) roleLevel = level;
    });

    // Add permissions based on role level
    if (roleLevel >= 9) {
      permissions.add('*');
    } else if (roleLevel >= 7) {
      ['crm:*', 'analytics:read', 'inbox:*', 'pipeline:*', 'settings:read'].forEach((p) =>
        permissions.add(p)
      );
    } else if (roleLevel >= 5) {
      [
        'crm:contacts:*',
        'crm:deals:*',
        'crm:activities:*',
        'inbox:*',
        'tickets:*',
        'analytics:read',
      ].forEach((p) => permissions.add(p));
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      status: user.status,
      emailVerified: user.emailVerified,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        plan: user.tenant.plan,
        logo: user.tenant.logoUrl,
        brandColor: user.tenant.settings?.brandColor || null,
      },
      workspace: defaultWorkspace
        ? {
            id: defaultWorkspace.id,
            name: defaultWorkspace.name,
          }
        : null,
      role: primaryRole
        ? {
            id: primaryRole.id,
            name: primaryRole.name,
          }
        : null,
      roleLevel,
      permissions: Array.from(permissions),
    };
  }

  async requestPasswordReset(email) {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if email exists - always return success
      return;
    }

    // Generate reset token
    const resetToken = nanoid(32);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_HOURS * 60 * 60 * 1000);

    // Invalidate any existing tokens for this user
    await prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: { usedAt: new Date() }, // Mark as used/invalidated
    });

    // Create new reset token
    await prisma.passwordResetToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Send password reset email
    await sendPasswordResetEmail({
      email: user.email,
      resetToken,
      firstName: user.firstName,
    });
  }

  async resetPassword(token, newPassword) {
    // Find valid token
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        token,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!resetToken) {
      throw new BadRequestError('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  async requestEmailVerification(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestError('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestError('Email is already verified');
    }

    // Generate verification token
    const verificationToken = nanoid(32);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);

    // Invalidate any existing tokens for this user
    await prisma.emailVerificationToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    // Create new verification token
    await prisma.emailVerificationToken.create({
      data: {
        token: verificationToken,
        userId: user.id,
        email: user.email,
        expiresAt,
      },
    });

    // Send verification email
    await sendEmailVerificationEmail({
      email: user.email,
      verificationToken,
      firstName: user.firstName,
    });

    return { success: true };
  }

  async verifyEmail(token) {
    // Find valid token
    const verificationToken = await prisma.emailVerificationToken.findFirst({
      where: {
        token,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!verificationToken) {
      throw new BadRequestError('Invalid or expired verification token');
    }

    // Update email verification status and mark token as used
    await prisma.$transaction([
      prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerified: true },
      }),
      prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { success: true, email: verificationToken.email };
  }

  generateSlug(name) {
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    return `${baseSlug}-${nanoid(6)}`;
  }

  /**
   * Resend verification email by email address (public endpoint for login page)
   * Limited to 5 attempts, after which account is blocked
   */
  async resendVerificationByEmail(email) {
    const MAX_RESEND_ATTEMPTS = 5;

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
    });

    // Don't reveal if email exists - always return success-like response
    if (!user) {
      return { remainingAttempts: MAX_RESEND_ATTEMPTS };
    }

    // If already verified, silently return
    if (user.emailVerified) {
      return { remainingAttempts: MAX_RESEND_ATTEMPTS };
    }

    // Check if already blocked due to too many resend attempts
    const currentCount = user.verificationResendCount || 0;
    if (currentCount >= MAX_RESEND_ATTEMPTS) {
      return { blocked: true, remainingAttempts: 0 };
    }

    // Increment resend count
    const newCount = currentCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationResendCount: newCount },
    });

    // If this was the last attempt, block the account
    if (newCount >= MAX_RESEND_ATTEMPTS) {
      // Update user status to indicate blocked for verification
      await prisma.user.update({
        where: { id: user.id },
        data: {
          status: 'SUSPENDED',
          settings: {
            ...(user.settings || {}),
            blockedReason: 'Too many verification email resend attempts',
            blockedAt: new Date().toISOString(),
          },
        },
      });
      return { blocked: true, remainingAttempts: 0 };
    }

    // Generate new verification token
    const verificationToken = nanoid(32);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000);

    // Invalidate any existing tokens for this user
    await prisma.emailVerificationToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });

    // Create new verification token
    await prisma.emailVerificationToken.create({
      data: {
        token: verificationToken,
        userId: user.id,
        email: user.email,
        expiresAt,
      },
    });

    // Send verification email
    await sendEmailVerificationEmail({
      email: user.email,
      verificationToken,
      firstName: user.firstName,
    });

    return {
      success: true,
      remainingAttempts: MAX_RESEND_ATTEMPTS - newCount,
    };
  }

  /**
   * Check if email already exists (for 72Orionx sign-up validation)
   */
  async checkEmailExists(email) {
    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });

    return !!user;
  }
}

export const authService = new AuthService();
