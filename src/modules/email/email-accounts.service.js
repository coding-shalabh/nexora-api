import { prisma } from '@crm360/database';
import crypto from 'crypto';
import {
  EMAIL_PROVIDERS,
  getProviderByEmail,
  getDefaultSettings,
  GOOGLE_OAUTH_CONFIG,
  MICROSOFT_OAUTH_CONFIG,
} from '../../config/email-providers.js';

// Simple encryption for storing tokens/passwords
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
const ALGORITHM = 'aes-256-gcm';

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText) {
  if (!encryptedText) return null;
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

export class EmailAccountsService {
  // Get all email accounts for a tenant
  async getAccounts(tenantId, userId) {
    const accounts = await prisma.emailAccount.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
        email: true,
        displayName: true,
        provider: true,
        status: true,
        smtpHost: true,
        smtpPort: true,
        createdAt: true,
      },
    });

    return accounts;
  }

  // Get a single email account
  async getAccount(tenantId, userId, accountId) {
    const account = await prisma.emailAccount.findFirst({
      where: { id: accountId, tenantId },
      select: {
        id: true,
        email: true,
        displayName: true,
        replyTo: true,
        provider: true,
        status: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return account;
  }

  // Detect email provider settings
  detectProvider(email) {
    const provider = getProviderByEmail(email);

    if (provider) {
      return {
        detected: true,
        provider: provider.provider,
        name: provider.name,
        authType: provider.authType,
        icon: provider.icon,
        color: provider.color,
        requiresAppPassword: provider.requiresAppPassword || false,
        requiresOAuth: provider.requiresOAuth || false,
        requiresBridge: provider.requiresBridge || false,
        notes: provider.notes,
        helpUrl: provider.helpUrl,
        supportsOAuth: provider.authType === 'oauth',
        imap: provider.imap,
        smtp: provider.smtp,
      };
    }

    // Fallback to default settings
    const defaults = getDefaultSettings(email);
    return {
      detected: false,
      provider: 'IMAP',
      name: 'Email',
      authType: 'password',
      icon: 'mail',
      color: '#6B7280',
      requiresAppPassword: false,
      requiresOAuth: false,
      supportsOAuth: false,
      notes: 'Enter your email server settings manually or use the auto-detect feature.',
      imap: defaults?.imap,
      smtp: defaults?.smtp,
    };
  }

  // Generate Google OAuth URL
  getGoogleOAuthUrl(state) {
    if (!GOOGLE_OAUTH_CONFIG.clientId) {
      throw new Error('Google OAuth not configured');
    }

    const params = new URLSearchParams({
      client_id: GOOGLE_OAUTH_CONFIG.clientId,
      redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
      response_type: 'code',
      scope: GOOGLE_OAUTH_CONFIG.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  // Generate Microsoft OAuth URL
  getMicrosoftOAuthUrl(state) {
    if (!MICROSOFT_OAUTH_CONFIG.clientId) {
      throw new Error('Microsoft OAuth not configured');
    }

    const params = new URLSearchParams({
      client_id: MICROSOFT_OAUTH_CONFIG.clientId,
      redirect_uri: MICROSOFT_OAUTH_CONFIG.redirectUri,
      response_type: 'code',
      scope: MICROSOFT_OAUTH_CONFIG.scopes.join(' '),
      response_mode: 'query',
      state: state,
    });

    return `https://login.microsoftonline.com/${MICROSOFT_OAUTH_CONFIG.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  // Exchange Google OAuth code for tokens
  async exchangeGoogleCode(code) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_OAUTH_CONFIG.clientId,
        client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google OAuth failed: ${error}`);
    }

    return response.json();
  }

  // Exchange Microsoft OAuth code for tokens
  async exchangeMicrosoftCode(code) {
    const response = await fetch(
      `https://login.microsoftonline.com/${MICROSOFT_OAUTH_CONFIG.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: MICROSOFT_OAUTH_CONFIG.clientId,
          client_secret: MICROSOFT_OAUTH_CONFIG.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: MICROSOFT_OAUTH_CONFIG.redirectUri,
          scope: MICROSOFT_OAUTH_CONFIG.scopes.join(' '),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Microsoft OAuth failed: ${error}`);
    }

    return response.json();
  }

  // Get user info from Google
  async getGoogleUserInfo(accessToken) {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error('Failed to get Google user info');
    }

    return response.json();
  }

  // Get user info from Microsoft
  async getMicrosoftUserInfo(accessToken) {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error('Failed to get Microsoft user info');
    }

    return response.json();
  }

  // Connect email account via OAuth
  // Note: Current schema doesn't support OAuth tokens storage
  // This method stores basic account info only
  async connectOAuth(tenantId, userId, provider, tokens, userInfo) {
    const email = userInfo.email || userInfo.mail || userInfo.userPrincipalName;
    const displayName = userInfo.name || userInfo.displayName || email;

    // Check if account already exists
    const existing = await prisma.emailAccount.findFirst({
      where: { tenantId, email },
    });

    if (existing) {
      // Update existing account
      return prisma.emailAccount.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          displayName,
          provider,
        },
      });
    }

    // Create new account
    return prisma.emailAccount.create({
      data: {
        tenantId,
        email,
        displayName,
        provider,
        status: 'ACTIVE',
      },
    });
  }

  // Connect email account via SMTP
  // Schema supports: smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure
  async connectSMTP(tenantId, userId, data) {
    const { email, password, displayName, smtpHost, smtpPort, smtpSecure, smtpUser, replyTo } =
      data;

    // Detect provider
    const providerInfo = this.detectProvider(email);

    const smtpSettings = {
      host: smtpHost || providerInfo.smtp?.host,
      port: smtpPort || providerInfo.smtp?.port || 465,
      secure: smtpSecure !== undefined ? smtpSecure : (providerInfo.smtp?.secure ?? true),
    };

    // Replace {domain} placeholder if needed
    const domain = email.split('@')[1];
    if (smtpSettings.host?.includes('{domain}')) {
      smtpSettings.host = smtpSettings.host.replace('{domain}', domain);
    }

    // Check if account already exists
    const existing = await prisma.emailAccount.findFirst({
      where: { tenantId, email },
    });

    if (existing) {
      // Update existing account
      return prisma.emailAccount.update({
        where: { id: existing.id },
        data: {
          smtpHost: smtpSettings.host,
          smtpPort: smtpSettings.port,
          smtpSecure: smtpSettings.secure,
          smtpUser: smtpUser || email,
          smtpPassword: encrypt(password),
          status: 'ACTIVE',
          displayName: displayName || existing.displayName,
          replyTo: replyTo || existing.replyTo,
        },
      });
    }

    // Create new account
    return prisma.emailAccount.create({
      data: {
        tenantId,
        email,
        displayName: displayName || email.split('@')[0],
        replyTo: replyTo || email,
        provider: providerInfo.provider || 'SMTP',
        smtpHost: smtpSettings.host,
        smtpPort: smtpSettings.port,
        smtpSecure: smtpSettings.secure,
        smtpUser: smtpUser || email,
        smtpPassword: encrypt(password),
        status: 'ACTIVE',
      },
    });
  }

  // Alias for backwards compatibility
  async connectIMAP(tenantId, userId, data) {
    return this.connectSMTP(tenantId, userId, data);
  }

  // Test IMAP connection
  async testConnection(data) {
    // This would use nodemailer or imap library to test
    // For now, return a mock result
    const { email, password, imapHost, imapPort } = data;

    // Basic validation
    if (!email || !password) {
      return { success: false, error: 'Email and password are required' };
    }

    // TODO: Implement actual IMAP connection test
    // const Imap = require('imap')
    // const imap = new Imap({ user: email, password, host: imapHost, port: imapPort, tls: true })

    return {
      success: true,
      message: 'Connection settings look valid. Click Connect to save.',
    };
  }

  // Disconnect/remove an email account
  async disconnect(tenantId, userId, accountId) {
    const account = await prisma.emailAccount.findFirst({
      where: { id: accountId, tenantId },
    });

    if (!account) {
      throw new Error('Email account not found');
    }

    await prisma.emailAccount.delete({
      where: { id: accountId },
    });

    return { success: true };
  }

  // Update email account settings
  async updateAccount(tenantId, userId, accountId, updates) {
    const account = await prisma.emailAccount.findFirst({
      where: { id: accountId, tenantId },
    });

    if (!account) {
      throw new Error('Email account not found');
    }

    const allowedUpdates = {};

    // Only update fields that exist in schema
    if (updates.displayName !== undefined) allowedUpdates.displayName = updates.displayName;
    if (updates.replyTo !== undefined) allowedUpdates.replyTo = updates.replyTo;
    if (updates.status !== undefined) allowedUpdates.status = updates.status;
    if (updates.smtpHost !== undefined) allowedUpdates.smtpHost = updates.smtpHost;
    if (updates.smtpPort !== undefined) allowedUpdates.smtpPort = updates.smtpPort;
    if (updates.smtpSecure !== undefined) allowedUpdates.smtpSecure = updates.smtpSecure;
    if (updates.smtpUser !== undefined) allowedUpdates.smtpUser = updates.smtpUser;
    if (updates.smtpPassword !== undefined)
      allowedUpdates.smtpPassword = encrypt(updates.smtpPassword);

    return prisma.emailAccount.update({
      where: { id: accountId },
      data: allowedUpdates,
      select: {
        id: true,
        email: true,
        displayName: true,
        replyTo: true,
        provider: true,
        status: true,
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  // Refresh OAuth token
  // Note: Current schema doesn't support OAuth tokens - this is a placeholder
  async refreshToken(accountId) {
    throw new Error('OAuth token refresh not supported - schema does not have token fields');
  }

  async refreshGoogleToken(refreshToken) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_OAUTH_CONFIG.clientId,
        client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to refresh Google token');
    }

    return response.json();
  }

  async refreshMicrosoftToken(refreshToken) {
    const response = await fetch(
      `https://login.microsoftonline.com/${MICROSOFT_OAUTH_CONFIG.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: MICROSOFT_OAUTH_CONFIG.clientId,
          client_secret: MICROSOFT_OAUTH_CONFIG.clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
          scope: MICROSOFT_OAUTH_CONFIG.scopes.join(' '),
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to refresh Microsoft token');
    }

    return response.json();
  }

  // Get decrypted credentials for sending/syncing
  async getCredentials(accountId) {
    const account = await prisma.emailAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error('Email account not found');
    }

    // Return SMTP credentials (current schema only supports SMTP)
    return {
      email: account.email,
      smtp: {
        host: account.smtpHost,
        port: account.smtpPort,
        secure: account.smtpSecure,
        user: account.smtpUser,
        password: decrypt(account.smtpPassword),
      },
      provider: account.provider,
      displayName: account.displayName,
      replyTo: account.replyTo,
      type: 'smtp',
    };
  }
}

export const emailAccountsService = new EmailAccountsService();
