import { Router } from 'express';
import { z } from 'zod';
import { authRateLimiter } from '../../common/middleware/rate-limiter.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { authService } from './auth.service.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  companyName: z.string().min(1),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshSchema = z.object({
  refreshToken: z.string(),
});

// Routes
router.post('/register', authRateLimiter, async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);

    res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', authRateLimiter, async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refreshTokens(refreshToken);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await authService.getMe(req.user.userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      await authService.logout(token);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/forgot-password', authRateLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    await authService.requestPasswordReset(email);

    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-password', authRateLimiter, async (req, res, next) => {
  try {
    const data = z.object({
      token: z.string(),
      password: z.string().min(8),
    }).parse(req.body);

    await authService.resetPassword(data.token, data.password);

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    next(error);
  }
});

// Email verification routes
router.post('/send-verification', authenticate, async (req, res, next) => {
  try {
    await authService.requestEmailVerification(req.user.userId);

    res.json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (error) {
    next(error);
  }
});

// Public endpoint to resend verification email (for login page)
router.post('/resend-verification', authRateLimiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    await authService.resendVerificationByEmail(email);

    res.json({
      success: true,
      message: 'If the email exists and is not verified, a verification link has been sent',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/verify-email', async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    const result = await authService.verifyEmail(token);

    res.json({
      success: true,
      message: 'Email verified successfully',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Check if email exists (for 72Orionx sign-up validation)
 * GET /api/v1/auth/check-email?email=user@example.com
 */
router.get('/check-email', async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.query);
    const exists = await authService.checkEmailExists(email);

    res.json({
      success: true,
      data: {
        email,
        exists,
        available: !exists,
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
