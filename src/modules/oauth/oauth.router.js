import { Router } from 'express';
import { oauthService } from './oauth.service.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { verifyToken } from '../../common/auth.js';
import { logger } from '../../common/logger.js';

const router = Router();

// Frontend URL for redirects
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://nexoraos.pro';

/**
 * Get OAuth providers configuration
 * GET /api/v1/oauth
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.tenantId;

    // TODO: Implement actual OAuth config retrieval
    // For now, return available OAuth providers
    res.json({
      success: true,
      data: {
        providers: [
          { name: 'Google', enabled: false, configured: false },
          { name: 'Microsoft', enabled: false, configured: false },
        ],
        message: 'OAuth providers available but not configured',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Helper to verify token from query param (for OAuth redirects)
const verifyTokenFromQuery = async (req, res, next) => {
  const token = req.query.token;
  if (!token) {
    return res.redirect(`${FRONTEND_URL}/settings/email?error=missing_token`);
  }

  try {
    const payload = await verifyToken(token);
    if (!payload) {
      return res.redirect(`${FRONTEND_URL}/settings/email?error=invalid_token`);
    }
    req.user = {
      userId: payload.userId,
      tenantId: payload.tenantId,
    };
    next();
  } catch (error) {
    logger.error({ error: error.message }, 'Invalid token in OAuth flow');
    return res.redirect(`${FRONTEND_URL}/settings/email?error=invalid_token`);
  }
};

/**
 * GET /oauth/google/authorize
 * Initiates Google OAuth flow - redirects to Google
 */
router.get('/google/authorize', verifyTokenFromQuery, async (req, res, next) => {
  try {
    const { userId, tenantId } = req.user;
    const returnUrl = req.query.returnUrl || '/settings/email';

    const authUrl = oauthService.getGoogleAuthUrl(userId, tenantId, returnUrl);

    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /oauth/callback/google
 * Google OAuth callback - handles the redirect from Google
 */
router.get('/callback/google', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    if (oauthError) {
      logger.error({ oauthError }, 'Google OAuth error');
      return res.redirect(`${FRONTEND_URL}/settings/email?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/settings/email?error=missing_params`);
    }

    const result = await oauthService.handleGoogleCallback(code, state);

    // Redirect back to frontend with success
    const successUrl = `${FRONTEND_URL}${result.returnUrl}?connected=google&email=${encodeURIComponent(result.email)}`;
    res.redirect(successUrl);
  } catch (error) {
    logger.error({ error: error.message }, 'Google OAuth callback error');
    res.redirect(`${FRONTEND_URL}/settings/email?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * GET /oauth/microsoft/authorize
 * Initiates Microsoft OAuth flow - redirects to Microsoft
 */
router.get('/microsoft/authorize', verifyTokenFromQuery, async (req, res, next) => {
  try {
    const { userId, tenantId } = req.user;
    const returnUrl = req.query.returnUrl || '/settings/email';

    const authUrl = oauthService.getMicrosoftAuthUrl(userId, tenantId, returnUrl);

    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /oauth/callback/microsoft
 * Microsoft OAuth callback - handles the redirect from Microsoft
 */
router.get('/callback/microsoft', async (req, res) => {
  try {
    const { code, state, error: oauthError, error_description } = req.query;

    if (oauthError) {
      logger.error({ oauthError, error_description }, 'Microsoft OAuth error');
      return res.redirect(
        `${FRONTEND_URL}/settings/email?error=${encodeURIComponent(error_description || oauthError)}`
      );
    }

    if (!code || !state) {
      return res.redirect(`${FRONTEND_URL}/settings/email?error=missing_params`);
    }

    const result = await oauthService.handleMicrosoftCallback(code, state);

    // Redirect back to frontend with success
    const successUrl = `${FRONTEND_URL}${result.returnUrl}?connected=microsoft&email=${encodeURIComponent(result.email)}`;
    res.redirect(successUrl);
  } catch (error) {
    logger.error({ error: error.message }, 'Microsoft OAuth callback error');
    res.redirect(`${FRONTEND_URL}/settings/email?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * GET /oauth/twilio/authorize
 * Initiates Twilio OAuth flow - redirects to Twilio
 */
router.get('/twilio/authorize', verifyTokenFromQuery, async (req, res, next) => {
  try {
    const { userId, tenantId } = req.user;
    const returnUrl = req.query.returnUrl || '/settings/channels';

    const authUrl = oauthService.getTwilioAuthUrl(userId, tenantId, returnUrl);

    res.redirect(authUrl);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /oauth/callback/twilio
 * Twilio Connect callback - handles the redirect from Twilio Connect
 * Twilio Connect sends AccountSid (not code) after user authorizes
 */
router.get('/callback/twilio', async (req, res) => {
  try {
    const { AccountSid, state, error: oauthError, error_description } = req.query;

    if (oauthError) {
      logger.error({ oauthError, error_description }, 'Twilio Connect error');
      return res.redirect(
        `${FRONTEND_URL}/settings/channels?error=${encodeURIComponent(error_description || oauthError)}`
      );
    }

    if (!AccountSid || !state) {
      logger.error({ AccountSid, state }, 'Twilio Connect missing params');
      return res.redirect(`${FRONTEND_URL}/settings/channels?error=missing_params`);
    }

    const result = await oauthService.handleTwilioCallback(AccountSid, state);

    // Redirect back to frontend with success
    const successUrl = `${FRONTEND_URL}${result.returnUrl}?connected=twilio&account=${encodeURIComponent(result.accountSid)}&needsAuthToken=${result.needsAuthToken}`;
    res.redirect(successUrl);
  } catch (error) {
    logger.error({ error: error.message }, 'Twilio Connect callback error');
    res.redirect(`${FRONTEND_URL}/settings/channels?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * POST /oauth/twilio/deauthorize
 * Twilio Connect deauthorization webhook - called when user revokes access from Twilio
 */
router.post('/twilio/deauthorize', async (req, res) => {
  try {
    const { AccountSid, ConnectAppSid } = req.body;

    if (!AccountSid) {
      return res.status(400).json({ success: false, error: 'Missing AccountSid' });
    }

    const result = await oauthService.handleTwilioDeauthorize(AccountSid, ConnectAppSid);

    res.json({ success: true, ...result });
  } catch (error) {
    logger.error({ error: error.message }, 'Twilio deauthorize error');
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /oauth/providers
 * Returns available OAuth providers and their status
 */
router.get('/providers', async (req, res) => {
  res.json({
    success: true,
    data: {
      google: {
        enabled: !!process.env.GOOGLE_CLIENT_ID,
        name: 'Google',
        description: 'Connect your Gmail account',
        authUrl: '/api/v1/oauth/google/authorize',
        type: 'email',
      },
      microsoft: {
        enabled: !!process.env.MICROSOFT_CLIENT_ID,
        name: 'Microsoft',
        description: 'Connect your Outlook/Office 365 account',
        authUrl: '/api/v1/oauth/microsoft/authorize',
        type: 'email',
      },
      twilio: {
        enabled: true, // Twilio Connect is always available
        name: 'Twilio Connect',
        description: 'Connect your Twilio account for SMS, Voice & WhatsApp',
        authUrl: '/api/v1/oauth/twilio/authorize',
        type: 'channel',
        features: ['sms', 'voice', 'whatsapp'],
        authMethod: 'twilio_connect',
        note: "After connecting, you'll need to provide your Auth Token separately",
      },
    },
  });
});

export { router as oauthRouter };
