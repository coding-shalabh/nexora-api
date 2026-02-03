import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock data
const mockUser = {
  id: 'user_123',
  tenantId: 'tenant_123',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  passwordHash: 'hashed_password',
  status: 'ACTIVE',
  emailVerified: true,
  verificationResendCount: 0,
  settings: {},
  tenant: {
    id: 'tenant_123',
    name: 'Test Company',
    status: 'ACTIVE',
    logoUrl: null,
    settings: {},
  },
  workspaces: [
    {
      workspace: {
        id: 'workspace_123',
        name: 'Default',
      },
    },
  ],
  roles: [
    {
      role: {
        id: 'role_123',
        name: 'Admin',
      },
    },
  ],
};

const mockTenant = {
  id: 'tenant_123',
  name: 'Test Company',
  slug: 'test-company-abc123',
  status: 'ACTIVE',
};

const mockWorkspace = {
  id: 'workspace_123',
  name: 'Default',
  tenantId: 'tenant_123',
};

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  tenant: {
    create: vi.fn(),
  },
  workspace: {
    create: vi.fn(),
  },
  wallet: {
    create: vi.fn(),
  },
  role: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  userRole: {
    create: vi.fn(),
  },
  userWorkspace: {
    create: vi.fn(),
  },
  passwordResetToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  emailVerificationToken: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock('@crm360/database', () => ({
  prisma: mockPrisma,
}));

// Mock shared errors
vi.mock('@crm360/shared', () => ({
  BadRequestError: class BadRequestError extends Error {
    constructor(message) {
      super(message);
      this.name = 'BadRequestError';
      this.statusCode = 400;
    }
  },
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message) {
      super(message);
      this.name = 'UnauthorizedError';
      this.statusCode = 401;
    }
  },
  ConflictError: class ConflictError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ConflictError';
      this.statusCode = 409;
    }
  },
}));

// Mock auth utilities
vi.mock('../../common/auth.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed_password'),
  verifyPassword: vi.fn().mockResolvedValue(true),
  generateAccessToken: vi.fn().mockResolvedValue('mock_access_token'),
  generateRefreshToken: vi.fn().mockResolvedValue('mock_refresh_token'),
  verifyToken: vi.fn().mockResolvedValue({
    userId: 'user_123',
    tenantId: 'tenant_123',
    type: 'refresh',
  }),
}));

// Mock mailer
vi.mock('../../common/mailer.js', () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
  sendEmailVerificationEmail: vi.fn().mockResolvedValue(true),
}));

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn().mockReturnValue('mock_token_123456'),
}));

describe('AuthService', () => {
  let authService;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset transaction mock to execute callback
    mockPrisma.$transaction.mockImplementation(async (callbackOrArray) => {
      if (typeof callbackOrArray === 'function') {
        return callbackOrArray({
          tenant: { create: vi.fn().mockResolvedValue(mockTenant) },
          workspace: { create: vi.fn().mockResolvedValue(mockWorkspace) },
          role: { create: vi.fn().mockResolvedValue({ id: 'role_123', name: 'Admin' }) },
          user: { create: vi.fn().mockResolvedValue(mockUser), update: vi.fn() },
          userWorkspace: { create: vi.fn() },
          userRole: { create: vi.fn() },
          wallet: { create: vi.fn() },
        });
      }
      // Array of operations
      return Promise.all(callbackOrArray);
    });

    // Import fresh module
    const module = await import('../modules/auth/auth.service.js');
    authService = module.authService;
  });

  afterEach(() => {
    vi.resetModules();
  });

  // ============================================
  // REGISTRATION TESTS
  // ============================================

  describe('register', () => {
    const validInput = {
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      firstName: 'Jane',
      lastName: 'Smith',
      companyName: 'New Company',
      phone: '+1234567890',
    };

    it('should register a new user successfully', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      const result = await authService.register(validInput);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('tenant');
      expect(result.expiresIn).toBe(900);
    });

    it('should throw ConflictError if email already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(authService.register(validInput)).rejects.toThrow('Email already registered');
    });

    it('should create tenant, workspace, role, and wallet in transaction', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      await authService.register(validInput);

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should send verification email after registration', async () => {
      const { sendEmailVerificationEmail } = await import('../../common/mailer.js');
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      await authService.register(validInput);

      expect(sendEmailVerificationEmail).toHaveBeenCalled();
    });

    it('should normalize email to lowercase', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      await authService.register({
        ...validInput,
        email: 'TEST@EXAMPLE.COM',
      });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });
  });

  // ============================================
  // LOGIN TESTS
  // ============================================

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result).toHaveProperty('accessToken', 'mock_access_token');
      expect(result).toHaveProperty('refreshToken', 'mock_refresh_token');
      expect(result.user).toHaveProperty('email', 'test@example.com');
    });

    it('should throw UnauthorizedError for invalid email', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw UnauthorizedError for invalid password', async () => {
      const { verifyPassword } = await import('../../common/auth.js');
      verifyPassword.mockResolvedValueOnce(false);
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'WrongPassword',
        })
      ).rejects.toThrow('Invalid email or password');
    });

    it('should throw UnauthorizedError if user is not active', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        status: 'SUSPENDED',
      });

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('Account is not active');
    });

    it('should throw UnauthorizedError if tenant is not active', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        tenant: { ...mockUser.tenant, status: 'SUSPENDED' },
      });

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('Tenant account is not active');
    });

    it('should throw UnauthorizedError if email not verified', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      });

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'Password123!',
        })
      ).rejects.toThrow('Please verify your email');
    });

    it('should update lastLoginAt on successful login', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      await authService.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        data: { lastLoginAt: expect.any(Date) },
      });
    });

    it('should return correct permissions for admin role', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result.user.permissions).toContain('*');
      expect(result.user.roleLevel).toBe(9);
    });
  });

  // ============================================
  // REFRESH TOKEN TESTS
  // ============================================

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.refreshTokens('valid_refresh_token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.expiresIn).toBe(900);
    });

    it('should throw UnauthorizedError for invalid refresh token', async () => {
      const { verifyToken } = await import('../../common/auth.js');
      verifyToken.mockResolvedValueOnce(null);

      await expect(authService.refreshTokens('invalid_token')).rejects.toThrow(
        'Invalid refresh token'
      );
    });

    it('should throw UnauthorizedError if token type is not refresh', async () => {
      const { verifyToken } = await import('../../common/auth.js');
      verifyToken.mockResolvedValueOnce({
        userId: 'user_123',
        type: 'access', // Wrong type
      });

      await expect(authService.refreshTokens('access_token')).rejects.toThrow(
        'Invalid refresh token'
      );
    });

    it('should throw UnauthorizedError if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.refreshTokens('valid_token')).rejects.toThrow('User not found');
    });

    it('should throw UnauthorizedError if email not verified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      });

      await expect(authService.refreshTokens('valid_token')).rejects.toThrow('Email not verified');
    });
  });

  // ============================================
  // GET ME TESTS
  // ============================================

  describe('getMe', () => {
    it('should return user profile successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await authService.getMe('user_123');

      expect(result).toHaveProperty('id', 'user_123');
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(result).toHaveProperty('tenant');
      expect(result).toHaveProperty('permissions');
    });

    it('should throw UnauthorizedError if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(authService.getMe('nonexistent_user')).rejects.toThrow('User not found');
    });

    it('should throw UnauthorizedError if email not verified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
      });

      await expect(authService.getMe('user_123')).rejects.toThrow('Email not verified');
    });

    it('should throw UnauthorizedError if user not active', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...mockUser,
        status: 'SUSPENDED',
      });

      await expect(authService.getMe('user_123')).rejects.toThrow('Account is not active');
    });
  });

  // ============================================
  // PASSWORD RESET TESTS
  // ============================================

  describe('requestPasswordReset', () => {
    it('should create reset token and send email for existing user', async () => {
      const { sendPasswordResetEmail } = await import('../../common/mailer.js');
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.passwordResetToken.updateMany.mockResolvedValue({});
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      await authService.requestPasswordReset('test@example.com');

      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();
      expect(sendPasswordResetEmail).toHaveBeenCalledWith({
        email: 'test@example.com',
        resetToken: 'mock_token_123456',
        firstName: 'John',
      });
    });

    it('should not reveal if email does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      // Should not throw, just return silently
      await expect(
        authService.requestPasswordReset('nonexistent@example.com')
      ).resolves.not.toThrow();

      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled();
    });

    it('should invalidate existing tokens before creating new one', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.passwordResetToken.updateMany.mockResolvedValue({});
      mockPrisma.passwordResetToken.create.mockResolvedValue({});

      await authService.requestPasswordReset('test@example.com');

      expect(mockPrisma.passwordResetToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user_123',
          usedAt: null,
        },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  describe('resetPassword', () => {
    const validToken = {
      id: 'token_123',
      token: 'valid_reset_token',
      userId: 'user_123',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
      user: mockUser,
    };

    it('should reset password with valid token', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(validToken);

      const result = await authService.resetPassword('valid_reset_token', 'NewPassword123!');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestError for invalid token', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);

      await expect(authService.resetPassword('invalid_token', 'NewPassword123!')).rejects.toThrow(
        'Invalid or expired reset token'
      );
    });
  });

  // ============================================
  // EMAIL VERIFICATION TESTS
  // ============================================

  describe('verifyEmail', () => {
    const validToken = {
      id: 'token_123',
      token: 'valid_verification_token',
      userId: 'user_123',
      email: 'test@example.com',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
      user: mockUser,
    };

    it('should verify email with valid token', async () => {
      mockPrisma.emailVerificationToken.findFirst.mockResolvedValue(validToken);

      const result = await authService.verifyEmail('valid_verification_token');

      expect(result).toEqual({
        success: true,
        email: 'test@example.com',
      });
    });

    it('should throw BadRequestError for invalid token', async () => {
      mockPrisma.emailVerificationToken.findFirst.mockResolvedValue(null);

      await expect(authService.verifyEmail('invalid_token')).rejects.toThrow(
        'Invalid or expired verification token'
      );
    });
  });

  describe('resendVerificationByEmail', () => {
    it('should resend verification email', async () => {
      const { sendEmailVerificationEmail } = await import('../../common/mailer.js');
      mockPrisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
        verificationResendCount: 0,
      });
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.emailVerificationToken.updateMany.mockResolvedValue({});
      mockPrisma.emailVerificationToken.create.mockResolvedValue({});

      const result = await authService.resendVerificationByEmail('test@example.com');

      expect(result.success).toBe(true);
      expect(result.remainingAttempts).toBe(4);
      expect(sendEmailVerificationEmail).toHaveBeenCalled();
    });

    it('should block after max attempts', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        emailVerified: false,
        verificationResendCount: 5,
      });

      const result = await authService.resendVerificationByEmail('test@example.com');

      expect(result.blocked).toBe(true);
      expect(result.remainingAttempts).toBe(0);
    });

    it('should not reveal if email does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await authService.resendVerificationByEmail('nonexistent@example.com');

      expect(result.remainingAttempts).toBe(5);
    });
  });

  // ============================================
  // CHECK EMAIL EXISTS TESTS
  // ============================================

  describe('checkEmailExists', () => {
    it('should return true if email exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: 'user_123' });

      const result = await authService.checkEmailExists('test@example.com');

      expect(result).toBe(true);
    });

    it('should return false if email does not exist', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await authService.checkEmailExists('nonexistent@example.com');

      expect(result).toBe(false);
    });
  });

  // ============================================
  // SLUG GENERATION TESTS
  // ============================================

  describe('generateSlug', () => {
    it('should generate valid slug from company name', () => {
      const slug = authService.generateSlug('My Test Company');

      expect(slug).toMatch(/^my-test-company-[a-z0-9]+$/);
    });

    it('should handle special characters', () => {
      const slug = authService.generateSlug("Company's Name! @#$%");

      expect(slug).toMatch(/^company-s-name-[a-z0-9]+$/);
    });

    it('should handle leading/trailing dashes', () => {
      const slug = authService.generateSlug('---Test---');

      expect(slug).toMatch(/^test-[a-z0-9]+$/);
    });
  });
});

// ============================================
// HELPER FUNCTION TESTS
// ============================================

describe('Validation Helpers', () => {
  describe('isValidEmail', () => {
    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('test')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('test@.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('isValidPassword', () => {
    const isValidPassword = (password) => {
      if (password.length < 8) return false;
      if (!/[A-Z]/.test(password)) return false;
      if (!/[a-z]/.test(password)) return false;
      if (!/[0-9]/.test(password)) return false;
      return true;
    };

    it('should validate strong passwords', () => {
      expect(isValidPassword('Password123!')).toBe(true);
      expect(isValidPassword('Str0ngPass')).toBe(true);
      expect(isValidPassword('MyP@ssw0rd123')).toBe(true);
    });

    it('should reject weak passwords', () => {
      expect(isValidPassword('123456')).toBe(false);
      expect(isValidPassword('password')).toBe(false);
      expect(isValidPassword('short')).toBe(false);
      expect(isValidPassword('')).toBe(false);
      expect(isValidPassword('alllowercase1')).toBe(false);
      expect(isValidPassword('ALLUPPERCASE1')).toBe(false);
      expect(isValidPassword('NoNumbers!')).toBe(false);
    });
  });
});
