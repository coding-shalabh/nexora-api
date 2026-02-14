/**
 * OAuth Service - Handles OAuth token exchange and management
 * Supports: Google, Microsoft, Zoom
 */

import crypto from 'crypto';
import axios from 'axios';
import { prisma } from '@crm360/database';

const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  console.warn('⚠️  OAUTH_ENCRYPTION_KEY must be a 64-character hex string');
}

/**
 * Encrypt sensitive data (access tokens, refresh tokens)
 */
function encrypt(text) {
  if (!ENCRYPTION_KEY) throw new Error('OAUTH_ENCRYPTION_KEY not configured');

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
function decrypt(encrypted) {
  if (!ENCRYPTION_KEY) throw new Error('OAUTH_ENCRYPTION_KEY not configured');

  const [ivHex, authTagHex, encryptedText] = encrypted.split(':');
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export const oauthService = {
  /**
   * Connect OAuth account - Exchange authorization code for tokens
   */
  async connectAccount(tenantId, userId, platform, code, redirectUri) {
    let tokenData;

    if (platform === 'google') {
      tokenData = await this.exchangeGoogleCode(code, redirectUri);
    } else if (platform === 'microsoft') {
      tokenData = await this.exchangeMicrosoftCode(code, redirectUri);
    } else if (platform === 'zoom') {
      tokenData = await this.exchangeZoomCode(code, redirectUri);
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    // Store encrypted tokens
    const account = await prisma.connectedAccount.upsert({
      where: { userId_platform: { userId, platform } },
      update: {
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
        email: tokenData.email,
        scope: tokenData.scope?.split(' ') || [],
        metadata: tokenData.metadata || {},
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        userId,
        platform,
        accessToken: encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null,
        email: tokenData.email,
        scope: tokenData.scope?.split(' ') || [],
        metadata: tokenData.metadata || {},
      },
    });

    // Return without sensitive data
    return {
      id: account.id,
      platform: account.platform,
      email: account.email,
      connectedAt: account.createdAt,
      expiresAt: account.expiresAt,
      scope: account.scope,
    };
  },

  /**
   * Exchange Google authorization code for tokens
   */
  async exchangeGoogleCode(code, redirectUri) {
    try {
      const response = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });

      // Get user info
      const userInfo = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${response.data.access_token}` },
      });

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
        scope: response.data.scope,
        email: userInfo.data.email,
        metadata: {
          googleId: userInfo.data.id,
          name: userInfo.data.name,
          picture: userInfo.data.picture,
        },
      };
    } catch (error) {
      console.error('Google OAuth error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.error_description || 'Failed to connect Google account'
      );
    }
  },

  /**
   * Exchange Microsoft authorization code for tokens
   */
  async exchangeMicrosoftCode(code, redirectUri) {
    try {
      const response = await axios.post(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        new URLSearchParams({
          code,
          client_id: process.env.MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      // Get user info from Microsoft Graph
      const userInfo = await axios.get('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${response.data.access_token}` },
      });

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
        scope: response.data.scope,
        email: userInfo.data.mail || userInfo.data.userPrincipalName,
        metadata: {
          microsoftId: userInfo.data.id,
          displayName: userInfo.data.displayName,
        },
      };
    } catch (error) {
      console.error('Microsoft OAuth error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.error_description || 'Failed to connect Microsoft account'
      );
    }
  },

  /**
   * Exchange Zoom authorization code for tokens
   */
  async exchangeZoomCode(code, redirectUri) {
    try {
      const credentials = Buffer.from(
        `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
      ).toString('base64');

      const response = await axios.post(
        'https://zoom.us/oauth/token',
        new URLSearchParams({
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      // Get user info from Zoom
      const userInfo = await axios.get('https://api.zoom.us/v2/users/me', {
        headers: { Authorization: `Bearer ${response.data.access_token}` },
      });

      return {
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        expires_in: response.data.expires_in,
        scope: response.data.scope,
        email: userInfo.data.email,
        metadata: {
          zoomId: userInfo.data.id,
          firstName: userInfo.data.first_name,
          lastName: userInfo.data.last_name,
        },
      };
    } catch (error) {
      console.error('Zoom OAuth error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to connect Zoom account');
    }
  },

  /**
   * Get access token - Auto-refresh if expired
   */
  async getAccessToken(userId, platform) {
    const account = await prisma.connectedAccount.findUnique({
      where: { userId_platform: { userId, platform } },
    });

    if (!account) {
      throw new Error(`No ${platform} account connected`);
    }

    // Check if token expired
    if (account.expiresAt && account.expiresAt < new Date()) {
      console.log(`Token expired for ${platform}, refreshing...`);
      return await this.refreshToken(account);
    }

    return decrypt(account.accessToken);
  },

  /**
   * Refresh expired token
   */
  async refreshToken(account) {
    if (!account.refreshToken) {
      throw new Error('Cannot refresh token - no refresh token available');
    }

    const refreshToken = decrypt(account.refreshToken);
    let newTokenData;

    if (account.platform === 'google') {
      newTokenData = await this.refreshGoogleToken(refreshToken);
    } else if (account.platform === 'microsoft') {
      newTokenData = await this.refreshMicrosoftToken(refreshToken);
    } else if (account.platform === 'zoom') {
      newTokenData = await this.refreshZoomToken(refreshToken);
    }

    // Update stored tokens
    await prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encrypt(newTokenData.access_token),
        expiresAt: new Date(Date.now() + newTokenData.expires_in * 1000),
        updatedAt: new Date(),
      },
    });

    return newTokenData.access_token;
  },

  /**
   * Refresh Google token
   */
  async refreshGoogleToken(refreshToken) {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    });

    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
    };
  },

  /**
   * Refresh Microsoft token
   */
  async refreshMicrosoftToken(refreshToken) {
    const response = await axios.post(
      'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        grant_type: 'refresh_token',
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
    };
  },

  /**
   * Refresh Zoom token
   */
  async refreshZoomToken(refreshToken) {
    const credentials = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
    ).toString('base64');

    const response = await axios.post(
      'https://zoom.us/oauth/token',
      new URLSearchParams({
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in,
    };
  },

  /**
   * Get all connected accounts for a user
   */
  async getConnectedAccounts(tenantId, userId) {
    const accounts = await prisma.connectedAccount.findMany({
      where: { tenantId, userId },
      select: {
        id: true,
        platform: true,
        email: true,
        scope: true,
        createdAt: true,
        expiresAt: true,
        metadata: true,
      },
    });

    return accounts.reduce((acc, account) => {
      acc[account.platform] = {
        email: account.email,
        connectedAt: account.createdAt,
        expiresAt: account.expiresAt,
        scope: account.scope,
        metadata: account.metadata,
      };
      return acc;
    }, {});
  },

  /**
   * Disconnect OAuth account
   */
  async disconnectAccount(tenantId, userId, platform) {
    await prisma.connectedAccount.deleteMany({
      where: { tenantId, userId, platform },
    });

    return { success: true, message: `${platform} account disconnected` };
  },
};
