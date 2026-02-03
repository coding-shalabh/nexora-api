/**
 * Email Accounts API Router
 * Handles connecting and managing user email accounts
 */

import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { emailAccountsService } from './email-accounts.service.js';
import { emailImapService } from '../../services/email-imap.service.js';
import { authenticate } from '../../common/middleware/authenticate.js';
import { emailAccessRouter } from './email-access.routes.js';

const router = Router();

// All email routes require authentication
router.use(authenticate);

// Mount access routes (these need to come before /:id routes to avoid conflicts)
router.use('/', emailAccessRouter);

// ==================== SCHEMAS ====================

const detectProviderSchema = z.object({
  email: z.string().email(),
});

const connectIMAPSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  displayName: z.string().optional(),
  imapHost: z.string().optional(),
  imapPort: z.number().optional(),
  imapSecure: z.boolean().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpSecure: z.boolean().optional(),
});

const testConnectionSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  imapHost: z.string().optional(),
  imapPort: z.number().optional(),
  imapSecure: z.boolean().optional(),
});

const updateAccountSchema = z.object({
  displayName: z.string().optional(),
  signature: z.string().optional(),
  syncEnabled: z.boolean().optional(),
  syncFolders: z.array(z.string()).optional(),
  isDefault: z.boolean().optional(),
});

// ==================== ROUTES ====================

/**
 * Get available email providers info
 */
router.get('/providers/list', async (req, res, next) => {
  try {
    const providers = [
      {
        id: 'google',
        name: 'Google',
        description: 'Gmail and Google Workspace',
        icon: 'gmail',
        color: '#EA4335',
        authType: 'oauth',
        domains: ['gmail.com', 'googlemail.com'],
      },
      {
        id: 'microsoft',
        name: 'Microsoft',
        description: 'Outlook, Hotmail, Office 365',
        icon: 'outlook',
        color: '#0078D4',
        authType: 'oauth',
        domains: ['outlook.com', 'hotmail.com', 'live.com'],
      },
      {
        id: 'yahoo',
        name: 'Yahoo',
        description: 'Yahoo Mail',
        icon: 'yahoo',
        color: '#6001D2',
        authType: 'password',
        requiresAppPassword: true,
        domains: ['yahoo.com', 'ymail.com'],
      },
      {
        id: 'zoho',
        name: 'Zoho',
        description: 'Zoho Mail',
        icon: 'zoho',
        color: '#F9B21D',
        authType: 'password',
        requiresAppPassword: true,
        domains: ['zoho.com', 'zohomail.com'],
      },
      {
        id: 'icloud',
        name: 'iCloud',
        description: 'Apple iCloud Mail',
        icon: 'apple',
        color: '#000000',
        authType: 'password',
        requiresAppPassword: true,
        domains: ['icloud.com', 'me.com', 'mac.com'],
      },
      {
        id: 'other',
        name: 'Other Email',
        description: 'Any other email provider (IMAP/SMTP)',
        icon: 'mail',
        color: '#6B7280',
        authType: 'password',
        domains: [],
      },
    ];

    res.json({ success: true, data: providers });
  } catch (error) {
    next(error);
  }
});

/**
 * Get all connected email accounts
 */
router.get('/', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const accounts = await emailAccountsService.getAccounts(tenantId, userId);

    res.json({ success: true, data: accounts });
  } catch (error) {
    next(error);
  }
});

/**
 * Get single email account
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { id } = req.params;
    const account = await emailAccountsService.getAccount(tenantId, userId, id);

    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Email account not found',
      });
    }

    res.json({ success: true, data: account });
  } catch (error) {
    next(error);
  }
});

/**
 * Detect email provider settings
 */
router.post('/detect', async (req, res, next) => {
  try {
    const { email } = detectProviderSchema.parse(req.body);
    const provider = emailAccountsService.detectProvider(email);

    res.json({ success: true, data: provider });
  } catch (error) {
    next(error);
  }
});

/**
 * Test IMAP/SMTP connection
 */
router.post('/test-connection', async (req, res, next) => {
  try {
    const data = testConnectionSchema.parse(req.body);
    const result = await emailAccountsService.testConnection(data);

    res.json({ success: result.success, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Connect via IMAP/SMTP (password)
 */
router.post('/connect/imap', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const data = connectIMAPSchema.parse(req.body);

    const account = await emailAccountsService.connectIMAP(tenantId, userId, data);

    res.status(201).json({
      success: true,
      data: {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        provider: account.provider,
        status: account.status,
      },
      message: 'Email connected successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Google OAuth URL
 */
router.get('/oauth/google/url', async (req, res, next) => {
  try {
    // Create state token for security
    const state = crypto.randomBytes(32).toString('hex');
    // TODO: Store state with userId in session/Redis

    const url = emailAccountsService.getGoogleOAuthUrl(state);

    res.json({ success: true, data: { url, state } });
  } catch (error) {
    console.error('Failed to get Google OAuth URL:', error);
    res.status(500).json({
      success: false,
      error: 'OAUTH_ERROR',
      message: error.message || 'Google OAuth not configured',
    });
  }
});

/**
 * Google OAuth callback
 */
router.post('/oauth/google/callback', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CODE',
        message: 'Authorization code is required',
      });
    }

    // Exchange code for tokens
    const tokens = await emailAccountsService.exchangeGoogleCode(code);

    // Get user info
    const userInfo = await emailAccountsService.getGoogleUserInfo(tokens.access_token);

    // Connect account
    const account = await emailAccountsService.connectOAuth(
      tenantId,
      userId,
      'GMAIL',
      tokens,
      userInfo
    );

    res.json({
      success: true,
      data: {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        provider: account.provider,
        status: account.status,
      },
      message: 'Google account connected successfully',
    });
  } catch (error) {
    console.error('Google OAuth callback failed:', error);
    res.status(500).json({
      success: false,
      error: 'OAUTH_FAILED',
      message: error.message || 'Failed to connect Google account',
    });
  }
});

/**
 * Get Microsoft OAuth URL
 */
router.get('/oauth/microsoft/url', async (req, res, next) => {
  try {
    // Create state token for security
    const state = crypto.randomBytes(32).toString('hex');

    const url = emailAccountsService.getMicrosoftOAuthUrl(state);

    res.json({ success: true, data: { url, state } });
  } catch (error) {
    console.error('Failed to get Microsoft OAuth URL:', error);
    res.status(500).json({
      success: false,
      error: 'OAUTH_ERROR',
      message: error.message || 'Microsoft OAuth not configured',
    });
  }
});

/**
 * Microsoft OAuth callback
 */
router.post('/oauth/microsoft/callback', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_CODE',
        message: 'Authorization code is required',
      });
    }

    // Exchange code for tokens
    const tokens = await emailAccountsService.exchangeMicrosoftCode(code);

    // Get user info
    const userInfo = await emailAccountsService.getMicrosoftUserInfo(tokens.access_token);

    // Connect account
    const account = await emailAccountsService.connectOAuth(
      tenantId,
      userId,
      'OUTLOOK',
      tokens,
      userInfo
    );

    res.json({
      success: true,
      data: {
        id: account.id,
        email: account.email,
        displayName: account.displayName,
        provider: account.provider,
        status: account.status,
      },
      message: 'Microsoft account connected successfully',
    });
  } catch (error) {
    console.error('Microsoft OAuth callback failed:', error);
    res.status(500).json({
      success: false,
      error: 'OAUTH_FAILED',
      message: error.message || 'Failed to connect Microsoft account',
    });
  }
});

/**
 * Update email account
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { id } = req.params;
    const updates = updateAccountSchema.parse(req.body);

    const account = await emailAccountsService.updateAccount(tenantId, userId, id, updates);

    res.json({
      success: true,
      data: account,
      message: 'Email account updated',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Disconnect email account
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { id } = req.params;

    await emailAccountsService.disconnect(tenantId, userId, id);

    res.json({
      success: true,
      message: 'Email account disconnected',
    });
  } catch (error) {
    next(error);
  }
});

// ==================== IMAP ROUTES ====================

/**
 * Fetch emails from account via IMAP
 */
router.get('/:id/messages', async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { folder = 'INBOX', limit = 50, page = 1, since, before, search } = req.query;

    const account = await emailAccountsService.getAccount(tenantId, req.user.id, id);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Email account not found',
      });
    }

    const result = await emailImapService.fetchEmails(id, {
      folder,
      limit: parseInt(limit),
      page: parseInt(page),
      since,
      before,
      search,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Failed to fetch emails:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch emails',
    });
  }
});

/**
 * Fetch single email with full body
 */
router.get('/:id/messages/:uid', async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { id, uid } = req.params;
    const { folder = 'INBOX' } = req.query;

    const account = await emailAccountsService.getAccount(tenantId, req.user.id, id);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Email account not found',
      });
    }

    const email = await emailImapService.fetchEmail(id, uid, folder);
    if (!email) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Email not found',
      });
    }

    res.json({ success: true, data: email });
  } catch (error) {
    console.error('Failed to fetch email:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch email',
    });
  }
});

/**
 * List email folders
 */
router.get('/:id/folders', async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const account = await emailAccountsService.getAccount(tenantId, req.user.id, id);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Email account not found',
      });
    }

    const folders = await emailImapService.listFolders(id);
    res.json({ success: true, data: folders });
  } catch (error) {
    console.error('Failed to list folders:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to list folders',
    });
  }
});

/**
 * Get email stats for account
 */
router.get('/:id/stats', async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const account = await emailAccountsService.getAccount(tenantId, req.user.id, id);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Email account not found',
      });
    }

    const stats = await emailImapService.getEmailStats(id);
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Failed to get stats:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to get email stats',
    });
  }
});

/**
 * Mark email as read/unread
 */
router.post('/:id/messages/:uid/read', async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { id, uid } = req.params;
    const { read = true, folder = 'INBOX' } = req.body;

    const account = await emailAccountsService.getAccount(tenantId, req.user.id, id);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Email account not found',
      });
    }

    await emailImapService.markAsRead(id, uid, folder, read);
    res.json({ success: true, message: read ? 'Marked as read' : 'Marked as unread' });
  } catch (error) {
    console.error('Failed to mark email:', error);
    res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: error.message || 'Failed to update email',
    });
  }
});

/**
 * Sync emails from server to database
 */
router.post('/:id/sync', async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { folder = 'INBOX', since, fullSync = false, limit = 100 } = req.body;

    const account = await emailAccountsService.getAccount(tenantId, req.user.id, id);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Email account not found',
      });
    }

    const result = await emailImapService.syncEmails(tenantId, id, {
      folder,
      since,
      fullSync,
      limit,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Failed to sync emails:', error);
    res.status(500).json({
      success: false,
      error: 'SYNC_FAILED',
      message: error.message || 'Failed to sync emails',
    });
  }
});

/**
 * Test IMAP connection for account
 */
router.post('/:id/test-imap', async (req, res, next) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    const account = await emailAccountsService.getAccount(tenantId, req.user.id, id);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Email account not found',
      });
    }

    const result = await emailImapService.testConnection(id);
    res.json({ success: result.success, data: result });
  } catch (error) {
    console.error('IMAP test failed:', error);
    res.status(500).json({
      success: false,
      error: 'TEST_FAILED',
      message: error.message || 'IMAP connection test failed',
    });
  }
});

export { router as emailAccountsRouter };
export default router;
