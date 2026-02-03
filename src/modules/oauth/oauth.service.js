import { prisma } from '@crm360/database';
import { logger } from '../../common/logger.js';
import crypto from 'crypto';

// Google OAuth configuration
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

// Microsoft OAuth configuration
const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MICROSOFT_USERINFO_URL = 'https://graph.microsoft.com/v1.0/me';

// Twilio Connect configuration
const TWILIO_CONNECT_APP_SID =
  process.env.TWILIO_CONNECT_APP_SID || 'CN22c8891281a8adab60c5ed6be5219153';
const TWILIO_CONNECT_AUTH_URL = 'https://www.twilio.com/authorize';

// Scopes
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ');

const MICROSOFT_SCOPES = [
  'openid',
  'email',
  'profile',
  'offline_access',
  'Mail.Read',
  'Mail.ReadWrite',
  'Mail.Send',
  'User.Read',
].join(' ');

// Store pending OAuth states (in production, use Redis)
const pendingStates = new Map();

export const oauthService = {
  /**
   * Generate Google OAuth authorization URL
   */
  getGoogleAuthUrl(userId, tenantId, returnUrl) {
    const state = crypto.randomBytes(32).toString('hex');

    // Store state with user context (expires in 10 minutes)
    pendingStates.set(state, {
      userId,
      tenantId,
      returnUrl: returnUrl || '/settings/email',
      provider: 'google',
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: GOOGLE_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  },

  /**
   * Generate Microsoft OAuth authorization URL
   */
  getMicrosoftAuthUrl(userId, tenantId, returnUrl) {
    const state = crypto.randomBytes(32).toString('hex');

    pendingStates.set(state, {
      userId,
      tenantId,
      returnUrl: returnUrl || '/settings/email',
      provider: 'microsoft',
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
      response_type: 'code',
      scope: MICROSOFT_SCOPES,
      state,
    });

    return `${MICROSOFT_AUTH_URL}?${params.toString()}`;
  },

  /**
   * Handle Google OAuth callback
   */
  async handleGoogleCallback(code, state) {
    // Validate state
    const stateData = pendingStates.get(state);
    if (!stateData || stateData.expiresAt < Date.now()) {
      pendingStates.delete(state);
      throw new Error('Invalid or expired OAuth state');
    }
    pendingStates.delete(state);

    const { userId, tenantId, returnUrl } = stateData;

    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      logger.error({ error }, 'Failed to exchange Google auth code');
      throw new Error('Failed to authenticate with Google');
    }

    const tokens = await tokenResponse.json();

    // Get user info
    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to get Google user info');
    }

    const userInfo = await userInfoResponse.json();

    logger.info({ email: userInfo.email }, 'Google OAuth successful');

    // Create or update email account
    const emailAccount = await prisma.emailAccount.upsert({
      where: {
        tenantId_email: {
          tenantId,
          email: userInfo.email,
        },
      },
      create: {
        tenantId,
        userId,
        email: userInfo.email,
        displayName: userInfo.name || userInfo.email.split('@')[0],
        provider: 'GOOGLE',
        authType: 'OAUTH',
        status: 'ACTIVE',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: GOOGLE_SCOPES.split(' '),
        syncEnabled: true,
        syncFolders: ['INBOX', 'SENT'],
      },
      update: {
        displayName: userInfo.name || userInfo.email.split('@')[0],
        status: 'ACTIVE',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: GOOGLE_SCOPES.split(' '),
        lastSyncError: null,
      },
    });

    return {
      success: true,
      email: userInfo.email,
      returnUrl,
      accountId: emailAccount.id,
    };
  },

  /**
   * Handle Microsoft OAuth callback
   */
  async handleMicrosoftCallback(code, state) {
    const stateData = pendingStates.get(state);
    if (!stateData || stateData.expiresAt < Date.now()) {
      pendingStates.delete(state);
      throw new Error('Invalid or expired OAuth state');
    }
    pendingStates.delete(state);

    const { userId, tenantId, returnUrl } = stateData;

    // Exchange code for tokens
    const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI,
        grant_type: 'authorization_code',
        scope: MICROSOFT_SCOPES,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      logger.error({ error }, 'Failed to exchange Microsoft auth code');
      throw new Error('Failed to authenticate with Microsoft');
    }

    const tokens = await tokenResponse.json();

    // Get user info
    const userInfoResponse = await fetch(MICROSOFT_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to get Microsoft user info');
    }

    const userInfo = await userInfoResponse.json();
    const email = userInfo.mail || userInfo.userPrincipalName;

    logger.info({ email }, 'Microsoft OAuth successful');

    // Create or update email account
    const emailAccount = await prisma.emailAccount.upsert({
      where: {
        tenantId_email: {
          tenantId,
          email,
        },
      },
      create: {
        tenantId,
        userId,
        email,
        displayName: userInfo.displayName || email.split('@')[0],
        provider: 'MICROSOFT',
        authType: 'OAUTH',
        status: 'ACTIVE',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: MICROSOFT_SCOPES.split(' '),
        syncEnabled: true,
        syncFolders: ['Inbox', 'SentItems'],
      },
      update: {
        displayName: userInfo.displayName || email.split('@')[0],
        status: 'ACTIVE',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        scopes: MICROSOFT_SCOPES.split(' '),
        lastSyncError: null,
      },
    });

    return {
      success: true,
      email,
      returnUrl,
      accountId: emailAccount.id,
    };
  },

  /**
   * Refresh Google access token
   */
  async refreshGoogleToken(emailAccountId) {
    const account = await prisma.emailAccount.findUnique({
      where: { id: emailAccountId },
    });

    if (!account?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: account.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Google token');
    }

    const tokens = await response.json();

    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: {
        accessToken: tokens.access_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    return tokens.access_token;
  },

  /**
   * Generate Twilio Connect authorization URL
   */
  getTwilioAuthUrl(userId, tenantId, returnUrl) {
    const state = crypto.randomBytes(32).toString('hex');

    pendingStates.set(state, {
      userId,
      tenantId,
      returnUrl: returnUrl || '/settings/channels',
      provider: 'twilio',
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Twilio Connect uses a simple redirect with state parameter
    return `${TWILIO_CONNECT_AUTH_URL}/${TWILIO_CONNECT_APP_SID}?state=${state}`;
  },

  /**
   * Handle Twilio Connect callback
   * Twilio Connect redirects with AccountSid (not code) after user authorizes
   */
  async handleTwilioCallback(accountSid, state) {
    const stateData = pendingStates.get(state);
    if (!stateData || stateData.expiresAt < Date.now()) {
      pendingStates.delete(state);
      throw new Error('Invalid or expired OAuth state');
    }
    pendingStates.delete(state);

    const { userId, tenantId, returnUrl } = stateData;

    if (!accountSid) {
      throw new Error('No AccountSid received from Twilio');
    }

    logger.info({ accountSid, tenantId }, 'Twilio Connect authorization successful');

    // Store Twilio account in Channel model
    // Note: With Twilio Connect, we use the user's AccountSid with our platform's Auth Token
    // For full functionality, user may need to provide their Auth Token separately
    const channel = await prisma.channel.upsert({
      where: {
        tenantId_type_provider: {
          tenantId,
          type: 'SMS',
          provider: 'twilio',
        },
      },
      create: {
        tenantId,
        type: 'SMS',
        provider: 'twilio',
        name: `Twilio - ${accountSid}`,
        status: 'PENDING_AUTH_TOKEN',
        credentials: {
          accountSid: accountSid,
          authType: 'connect',
          connectedAt: new Date().toISOString(),
        },
        config: {
          connectAppSid: TWILIO_CONNECT_APP_SID,
          needsAuthToken: true,
        },
      },
      update: {
        name: `Twilio - ${accountSid}`,
        status: 'PENDING_AUTH_TOKEN',
        credentials: {
          accountSid: accountSid,
          authType: 'connect',
          connectedAt: new Date().toISOString(),
        },
        config: {
          connectAppSid: TWILIO_CONNECT_APP_SID,
          needsAuthToken: true,
        },
      },
    });

    // Also create Voice and WhatsApp channels
    await prisma.channel.upsert({
      where: {
        tenantId_type_provider: {
          tenantId,
          type: 'VOICE',
          provider: 'twilio_voice',
        },
      },
      create: {
        tenantId,
        type: 'VOICE',
        provider: 'twilio_voice',
        name: `Twilio Voice - ${accountSid}`,
        status: 'PENDING_AUTH_TOKEN',
        credentials: {
          accountSid: accountSid,
          authType: 'connect',
        },
        config: {
          connectAppSid: TWILIO_CONNECT_APP_SID,
        },
      },
      update: {
        status: 'PENDING_AUTH_TOKEN',
        credentials: {
          accountSid: accountSid,
          authType: 'connect',
        },
      },
    });

    await prisma.channel.upsert({
      where: {
        tenantId_type_provider: {
          tenantId,
          type: 'WHATSAPP',
          provider: 'twilio',
        },
      },
      create: {
        tenantId,
        type: 'WHATSAPP',
        provider: 'twilio',
        name: `Twilio WhatsApp - ${accountSid}`,
        status: 'PENDING_AUTH_TOKEN',
        credentials: {
          accountSid: accountSid,
          authType: 'connect',
        },
        config: {
          connectAppSid: TWILIO_CONNECT_APP_SID,
        },
      },
      update: {
        status: 'PENDING_AUTH_TOKEN',
        credentials: {
          accountSid: accountSid,
          authType: 'connect',
        },
      },
    });

    return {
      success: true,
      accountSid: accountSid,
      returnUrl,
      channelId: channel.id,
      needsAuthToken: true,
    };
  },

  /**
   * Handle Twilio Connect deauthorization
   * Called when user revokes access from their Twilio account
   */
  async handleTwilioDeauthorize(accountSid, connectAppSid) {
    logger.info({ accountSid, connectAppSid }, 'Twilio Connect deauthorization received');

    // Find and deactivate all channels with this accountSid
    const channels = await prisma.channel.findMany({
      where: {
        provider: { in: ['twilio', 'twilio_voice', 'twilio_sms'] },
        credentials: {
          path: ['accountSid'],
          equals: accountSid,
        },
      },
    });

    for (const channel of channels) {
      await prisma.channel.update({
        where: { id: channel.id },
        data: {
          status: 'DISCONNECTED',
          credentials: {
            ...channel.credentials,
            disconnectedAt: new Date().toISOString(),
            disconnectReason: 'user_revoked',
          },
        },
      });
    }

    return { success: true, deactivatedChannels: channels.length };
  },
};
