/**
 * Unified Channel Connection Service
 * Handles connecting, testing, and managing all channel providers
 * Supports: Email, WhatsApp, SMS
 */

import { prisma } from '@crm360/database';
import { logger } from '../common/logger.js';
import {
  CHANNEL_TYPES,
  EMAIL_PROVIDERS,
  WHATSAPP_PROVIDERS,
  SMS_PROVIDERS,
  detectEmailProvider,
  getProviderById,
  validateProviderCredentials,
} from '../config/channel-providers.js';

// Provider-specific services
import { fast2smsService } from './fast2sms.service.js';
import { emailImapService } from './email-imap.service.js';

const log = logger.child({ service: 'ChannelConnectionService' });

/**
 * ============================================
 * EMAIL PROVIDER CONNECTIONS
 * ============================================
 */

/**
 * Test Email SMTP connection
 */
async function testEmailSMTP(credentials) {
  const { email, password, smtpHost, smtpPort, secure = true } = credentials;

  try {
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.default.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure,
      auth: { user: email, pass: password },
      connectionTimeout: 10000,
    });

    await transporter.verify();

    return {
      success: true,
      message: 'SMTP connection successful',
      provider: 'smtp',
    };
  } catch (error) {
    log.error('SMTP test failed', { error: error.message, email });
    return {
      success: false,
      error: error.message,
      code: error.code,
    };
  }
}

/**
 * Test Email IMAP connection
 */
async function testEmailIMAP(credentials) {
  const { email, password, imapHost, imapPort, secure = true } = credentials;

  try {
    const { ImapFlow } = await import('imapflow');

    const client = new ImapFlow({
      host: imapHost,
      port: imapPort,
      secure,
      auth: { user: email, pass: password },
      logger: false,
    });

    await client.connect();
    const mailboxes = await client.list();
    await client.logout();

    return {
      success: true,
      message: 'IMAP connection successful',
      folders: mailboxes.length,
    };
  } catch (error) {
    log.error('IMAP test failed', { error: error.message, email });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Connect Email account (SMTP/IMAP)
 */
export async function connectEmailAccount(tenantId, workspaceId, data) {
  const { email, password, provider: providerId, name } = data;

  // Auto-detect provider if not specified
  let provider = providerId
    ? getProviderById(CHANNEL_TYPES.EMAIL, providerId)
    : detectEmailProvider(email);

  // Default to custom SMTP if no provider detected
  if (!provider) {
    provider = EMAIL_PROVIDERS.CUSTOM_SMTP;
  }

  // For OAuth providers, return auth URL
  if (provider.type === 'oauth') {
    return {
      success: true,
      requiresOAuth: true,
      provider: provider.id,
      authUrl: await generateOAuthUrl(provider, tenantId),
    };
  }

  // Build SMTP/IMAP config
  let smtpHost, smtpPort, imapHost, imapPort;

  if (provider.smtp) {
    smtpHost = provider.smtp.host;
    smtpPort = provider.smtp.port;
    imapHost = provider.imap.host;
    imapPort = provider.imap.port;
  } else {
    // Custom SMTP - use provided values
    smtpHost = data.smtpHost;
    smtpPort = data.smtpPort || 465;
    imapHost = data.imapHost;
    imapPort = data.imapPort || 993;
  }

  const credentials = {
    email,
    password,
    smtpHost,
    smtpPort,
    imapHost,
    imapPort,
    secure: true,
  };

  // Test SMTP connection
  const smtpTest = await testEmailSMTP(credentials);
  if (!smtpTest.success) {
    return {
      success: false,
      error: 'SMTP connection failed',
      details: smtpTest.error,
    };
  }

  // Test IMAP connection
  const imapTest = await testEmailIMAP(credentials);
  if (!imapTest.success) {
    return {
      success: false,
      error: 'IMAP connection failed',
      details: imapTest.error,
    };
  }

  // Save to database
  const account = await prisma.emailAccount.create({
    data: {
      tenantId,
      workspaceId,
      name: name || email,
      email,
      provider: provider.id,
      smtpHost,
      smtpPort,
      smtpSecure: true,
      smtpUser: email,
      smtpPassword: password, // Should be encrypted in production
      imapHost,
      imapPort,
      imapSecure: true,
      imapUser: email,
      imapPassword: password,
      isActive: true,
      isVerified: true,
      lastSyncAt: new Date(),
    },
  });

  return {
    success: true,
    message: 'Email account connected successfully',
    account: {
      id: account.id,
      email: account.email,
      provider: provider.name,
    },
  };
}

/**
 * Send test email
 */
export async function sendTestEmail(accountId, toEmail) {
  const account = await prisma.emailAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  try {
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.default.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: account.smtpSecure,
      auth: { user: account.smtpUser, pass: account.smtpPassword },
    });

    const info = await transporter.sendMail({
      from: `"Nexora Test" <${account.email}>`,
      to: toEmail,
      subject: 'Nexora Email Test - Connection Successful! ✓',
      text: 'This is a test email from Nexora CRM. Your email integration is working correctly.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #10B981;">✓ Email Connection Successful!</h2>
          <p>This is a test email from <strong>Nexora CRM</strong>.</p>
          <p>Your email integration is working correctly.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">Sent from: ${account.email}</p>
        </div>
      `,
    });

    return {
      success: true,
      message: 'Test email sent successfully',
      messageId: info.messageId,
    };
  } catch (error) {
    log.error('Test email failed', { error: error.message, accountId });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * ============================================
 * WHATSAPP PROVIDER CONNECTIONS
 * ============================================
 */

/**
 * Test MSG91 WhatsApp connection
 */
async function testMSG91WhatsApp(credentials) {
  const { authKey } = credentials;

  try {
    // Use whatsapp-activation endpoint to get integrated numbers
    const response = await fetch('https://control.msg91.com/api/v5/whatsapp/whatsapp-activation/', {
      headers: {
        authkey: authKey,
        accept: 'application/json',
      },
    });

    const data = await response.json();

    if (data.status === 'success' && data.data?.length > 0) {
      return {
        success: true,
        message: 'MSG91 WhatsApp connected',
        integratedNumbers: data.data.map((d) => d.integrated_number),
      };
    } else {
      return {
        success: false,
        error: data.errors || 'No integrated WhatsApp numbers found',
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Test Gupshup WhatsApp connection
 */
async function testGupshupWhatsApp(credentials) {
  const { apiKey, appName } = credentials;

  try {
    const response = await fetch(`https://api.gupshup.io/sm/api/v1/template/list/${appName}`, {
      headers: { apikey: apiKey },
    });

    const data = await response.json();

    if (response.ok && data.status === 'success') {
      return {
        success: true,
        message: 'Gupshup WhatsApp connected',
      };
    } else {
      return {
        success: false,
        error: data.message || 'Invalid credentials',
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Test Meta Cloud API WhatsApp connection
 */
async function testMetaCloudWhatsApp(credentials) {
  const { accessToken, phoneNumberId } = credentials;

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}?access_token=${accessToken}`
    );

    const data = await response.json();

    if (response.ok && data.id) {
      return {
        success: true,
        message: 'Meta Cloud API connected',
        phoneNumber: data.display_phone_number,
      };
    } else {
      return {
        success: false,
        error: data.error?.message || 'Invalid credentials',
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Test Interakt WhatsApp connection
 */
async function testInteraktWhatsApp(credentials) {
  const { apiKey } = credentials;

  try {
    const response = await fetch('https://api.interakt.ai/v1/public/track/users/', {
      method: 'GET',
      headers: {
        Authorization: `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
      },
    });

    if (response.ok || response.status === 400) {
      // 400 means auth worked but no data
      return {
        success: true,
        message: 'Interakt WhatsApp connected',
      };
    } else {
      return {
        success: false,
        error: 'Invalid API key',
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Test Twilio WhatsApp connection
 */
async function testTwilioWhatsApp(credentials) {
  const { accountSid, authToken } = credentials;

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
      headers: {
        Authorization: `Basic ${Buffer.from(accountSid + ':' + authToken).toString('base64')}`,
      },
    });

    const data = await response.json();

    if (response.ok && data.sid) {
      return {
        success: true,
        message: 'Twilio WhatsApp connected',
        accountName: data.friendly_name,
      };
    } else {
      return {
        success: false,
        error: data.message || 'Invalid credentials',
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Connect WhatsApp account
 */
export async function connectWhatsAppAccount(tenantId, workspaceId, data) {
  const { provider: providerId, name, ...credentials } = data;

  const provider = getProviderById(CHANNEL_TYPES.WHATSAPP, providerId);
  if (!provider) {
    return { success: false, error: 'Invalid WhatsApp provider' };
  }

  // Validate required fields
  const validation = validateProviderCredentials(provider, credentials);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(', ') };
  }

  // Test connection based on provider
  let testResult;
  switch (providerId) {
    case 'msg91':
      testResult = await testMSG91WhatsApp(credentials);
      break;
    case 'gupshup':
      testResult = await testGupshupWhatsApp(credentials);
      break;
    case 'meta_cloud':
      testResult = await testMetaCloudWhatsApp(credentials);
      break;
    case 'interakt':
      testResult = await testInteraktWhatsApp(credentials);
      break;
    case 'twilio':
      testResult = await testTwilioWhatsApp(credentials);
      break;
    default:
      return { success: false, error: 'Provider not supported yet' };
  }

  if (!testResult.success) {
    return {
      success: false,
      error: 'Connection test failed',
      details: testResult.error,
    };
  }

  // Generate webhook URL
  const webhookId = crypto.randomUUID();
  const webhookUrl = `${process.env.API_URL || 'https://api.nexoraos.pro'}/api/v1/webhooks/whatsapp/${webhookId}`;

  // Save to database - match VPS schema (credentials as Json, no webhookUrl field)
  const account = await prisma.channelAccount.create({
    data: {
      tenantId,
      workspaceId,
      name: name || `WhatsApp - ${provider.name}`,
      type: 'WHATSAPP',
      provider: providerId,
      phoneNumber:
        credentials.integratedNumber || credentials.sourceNumber || credentials.phoneNumber,
      credentials: credentials, // Json type, not stringified
      providerConfig: { webhookUrl, webhookSecret: webhookId }, // Store webhook info here
      status: 'ACTIVE',
      healthStatus: 'HEALTHY',
      isConfigComplete: true,
      lastHealthCheck: new Date(),
    },
  });

  return {
    success: true,
    message: `WhatsApp connected via ${provider.name}`,
    account: {
      id: account.id,
      provider: provider.name,
      phoneNumber: account.phoneNumber,
    },
    webhookUrl,
    webhookInstructions: `Configure this webhook URL in your ${provider.name} dashboard to receive incoming messages.`,
  };
}

/**
 * Send test WhatsApp message
 */
export async function sendTestWhatsApp(
  accountId,
  toPhone,
  message = 'Test message from Nexora CRM'
) {
  const account = await prisma.channelAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const credentials = JSON.parse(account.credentials);

  try {
    switch (account.provider) {
      case 'msg91':
        return await sendMSG91WhatsApp(credentials, toPhone, message);
      case 'gupshup':
        return await sendGupshupWhatsApp(credentials, toPhone, message);
      case 'meta_cloud':
        return await sendMetaCloudWhatsApp(credentials, toPhone, message);
      default:
        return { success: false, error: 'Provider send not implemented' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// WhatsApp send helpers
async function sendMSG91WhatsApp(credentials, toPhone, message) {
  // MSG91 WhatsApp API - correct endpoint with query params
  const url = `https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/?integrated_number=${credentials.integratedNumber}&content_type=text`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authkey: credentials.authKey,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      recipient_number: toPhone.replace(/^\+/, ''), // Remove + if present
      text: message,
    }),
  });

  const data = await response.json();
  return {
    success: data.status === 'success',
    messageId: data.data?.message_uuid,
    error: data.errors || data.message,
  };
}

async function sendGupshupWhatsApp(credentials, toPhone, message) {
  const params = new URLSearchParams({
    channel: 'whatsapp',
    source: credentials.sourceNumber,
    destination: toPhone,
    message: JSON.stringify({ type: 'text', text: message }),
    'src.name': credentials.appName,
  });

  const response = await fetch('https://api.gupshup.io/sm/api/v1/msg', {
    method: 'POST',
    headers: {
      apikey: credentials.apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json();
  return {
    success: data.status === 'submitted',
    messageId: data.messageId,
    error: data.message,
  };
}

async function sendMetaCloudWhatsApp(credentials, toPhone, message) {
  const response = await fetch(
    `https://graph.facebook.com/v18.0/${credentials.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: toPhone,
        type: 'text',
        text: { body: message },
      }),
    }
  );

  const data = await response.json();
  return {
    success: response.ok,
    messageId: data.messages?.[0]?.id,
    error: data.error?.message,
  };
}

/**
 * ============================================
 * SMS PROVIDER CONNECTIONS
 * ============================================
 */

/**
 * Test Fast2SMS connection
 */
async function testFast2SMS(credentials) {
  const { apiKey } = credentials;
  return await fast2smsService.testConnection(apiKey);
}

/**
 * Test MSG91 SMS connection
 */
async function testMSG91SMS(credentials) {
  const { authKey } = credentials;

  try {
    const response = await fetch('https://api.msg91.com/api/v5/balance.json', {
      headers: { authkey: authKey },
    });

    const data = await response.json();

    if (response.ok && data.balance !== undefined) {
      return {
        success: true,
        message: 'MSG91 SMS connected',
        balance: data.balance,
      };
    } else {
      return {
        success: false,
        error: data.message || 'Invalid auth key',
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Test TextLocal connection
 */
async function testTextLocal(credentials) {
  const { apiKey } = credentials;

  try {
    const response = await fetch(`https://api.textlocal.in/balance/?apiKey=${apiKey}`);

    const data = await response.json();

    if (data.status === 'success') {
      return {
        success: true,
        message: 'TextLocal connected',
        balance: data.balance?.sms,
      };
    } else {
      return {
        success: false,
        error: data.errors?.[0]?.message || 'Invalid API key',
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Test 2Factor connection
 */
async function test2Factor(credentials) {
  const { apiKey } = credentials;

  try {
    const response = await fetch(`https://2factor.in/API/V1/${apiKey}/BAL/SMS`);
    const data = await response.json();

    if (data.Status === 'Success') {
      return {
        success: true,
        message: '2Factor connected',
        balance: data.Details,
      };
    } else {
      return {
        success: false,
        error: data.Details || 'Invalid API key',
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Connect SMS account
 */
export async function connectSMSAccount(tenantId, workspaceId, data) {
  const { provider: providerId, name, ...credentials } = data;

  const provider = getProviderById(CHANNEL_TYPES.SMS, providerId);
  if (!provider) {
    return { success: false, error: 'Invalid SMS provider' };
  }

  // Validate required fields
  const validation = validateProviderCredentials(provider, credentials);
  if (!validation.valid) {
    return { success: false, error: validation.errors.join(', ') };
  }

  // Test connection based on provider
  let testResult;
  switch (providerId) {
    case 'fast2sms':
      testResult = await testFast2SMS(credentials);
      break;
    case 'msg91_sms':
      testResult = await testMSG91SMS(credentials);
      break;
    case 'textlocal':
      testResult = await testTextLocal(credentials);
      break;
    case '2factor':
      testResult = await test2Factor(credentials);
      break;
    default:
      return { success: false, error: 'Provider not supported yet' };
  }

  if (!testResult.success) {
    return {
      success: false,
      error: 'Connection test failed',
      details: testResult.error,
    };
  }

  // Generate webhook URL for delivery reports
  const webhookId = crypto.randomUUID();
  const webhookUrl = `${process.env.API_URL || 'https://api.nexoraos.pro'}/api/v1/webhooks/sms/${webhookId}`;

  // Save to database - match VPS schema (credentials as Json, no webhookUrl field)
  const account = await prisma.channelAccount.create({
    data: {
      tenantId,
      workspaceId,
      name: name || `SMS - ${provider.name}`,
      type: 'SMS',
      provider: providerId,
      senderId: credentials.senderId,
      credentials: credentials, // Json type, not stringified
      providerConfig: {
        webhookUrl,
        webhookSecret: webhookId,
        dltEntityId: credentials.dltEntityId,
        balance: testResult.balance,
      },
      status: 'ACTIVE',
      healthStatus: 'HEALTHY',
      isConfigComplete: true,
      lastHealthCheck: new Date(),
    },
  });

  return {
    success: true,
    message: `SMS connected via ${provider.name}`,
    account: {
      id: account.id,
      provider: provider.name,
      senderId: account.senderId,
      balance: testResult.balance,
    },
    webhookUrl,
  };
}

/**
 * Send test SMS
 */
export async function sendTestSMS(accountId, toPhone, message = 'Test SMS from Nexora CRM') {
  const account = await prisma.channelAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    return { success: false, error: 'Account not found' };
  }

  const credentials = JSON.parse(account.credentials);

  try {
    switch (account.provider) {
      case 'fast2sms':
        return await fast2smsService.sendQuickSMS({
          phone: toPhone,
          message,
          apiKey: credentials.apiKey,
        });
      case 'msg91_sms':
        return await sendMSG91SMS(credentials, toPhone, message);
      case 'textlocal':
        return await sendTextLocalSMS(credentials, toPhone, message);
      case '2factor':
        return await send2FactorSMS(credentials, toPhone, message);
      default:
        return { success: false, error: 'Provider send not implemented' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// SMS send helpers
async function sendMSG91SMS(credentials, toPhone, message) {
  const response = await fetch('https://api.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: {
      authkey: credentials.authKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      flow_id: credentials.flowId,
      sender: credentials.senderId,
      mobiles: toPhone,
      VAR1: message,
    }),
  });

  const data = await response.json();
  return {
    success: data.type === 'success',
    requestId: data.request_id,
    error: data.message,
  };
}

async function sendTextLocalSMS(credentials, toPhone, message) {
  const params = new URLSearchParams({
    apiKey: credentials.apiKey,
    numbers: toPhone,
    message,
    sender: credentials.sender,
  });

  const response = await fetch(`https://api.textlocal.in/send/?${params.toString()}`);
  const data = await response.json();

  return {
    success: data.status === 'success',
    messageId: data.messages?.[0]?.id,
    error: data.errors?.[0]?.message,
  };
}

async function send2FactorSMS(credentials, toPhone, message) {
  const response = await fetch(
    `https://2factor.in/API/V1/${credentials.apiKey}/ADDON_SERVICES/SEND/TSMS`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        From: credentials.senderId,
        To: toPhone,
        Msg: message,
      }),
    }
  );

  const data = await response.json();
  return {
    success: data.Status === 'Success',
    sessionId: data.Details,
    error: data.Status !== 'Success' ? data.Details : null,
  };
}

/**
 * ============================================
 * UTILITY FUNCTIONS
 * ============================================
 */

/**
 * Generate OAuth URL for email providers
 */
async function generateOAuthUrl(provider, tenantId) {
  const redirectUri = `${process.env.APP_URL || 'https://nexoraos.pro'}/settings/channels/oauth/callback`;
  const state = Buffer.from(JSON.stringify({ tenantId, provider: provider.id })).toString('base64');

  if (provider.id === 'gmail') {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: provider.oauth.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });
    return `${provider.oauth.authUrl}?${params.toString()}`;
  }

  if (provider.id === 'microsoft') {
    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: provider.oauth.scopes.join(' '),
      state,
    });
    return `${provider.oauth.authUrl}?${params.toString()}`;
  }

  return null;
}

/**
 * Get all connected accounts for a tenant
 */
export async function getConnectedAccounts(tenantId, channelType = null) {
  const where = { tenantId, status: 'ACTIVE' };
  if (channelType) where.type = channelType;

  const accounts = await prisma.channelAccount.findMany({
    where,
    select: {
      id: true,
      name: true,
      type: true,
      provider: true,
      phoneNumber: true,
      senderId: true,
      status: true,
      healthStatus: true,
      lastHealthCheck: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  // Also get email accounts
  const emailAccounts = await prisma.emailAccount.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      provider: true,
      isVerified: true,
      lastSyncAt: true,
      createdAt: true,
    },
  });

  const formattedEmailAccounts = emailAccounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: 'EMAIL',
    provider: a.provider,
    email: a.email,
    status: a.isVerified ? 'ACTIVE' : 'PENDING',
    healthStatus: 'HEALTHY',
    lastHealthCheck: a.lastSyncAt,
    createdAt: a.createdAt,
  }));

  if (channelType === 'EMAIL') {
    return formattedEmailAccounts;
  }

  if (channelType) {
    return accounts;
  }

  return [...formattedEmailAccounts, ...accounts];
}

/**
 * Disconnect/delete a channel account
 */
export async function disconnectAccount(tenantId, accountId, channelType) {
  if (channelType === 'EMAIL') {
    await prisma.emailAccount.updateMany({
      where: { id: accountId, tenantId },
      data: { isActive: false },
    });
  } else {
    await prisma.channelAccount.updateMany({
      where: { id: accountId, tenantId },
      data: { status: 'INACTIVE' },
    });
  }

  return { success: true, message: 'Account disconnected' };
}

export const channelConnectionService = {
  // Email
  connectEmailAccount,
  sendTestEmail,
  testEmailSMTP,
  testEmailIMAP,

  // WhatsApp
  connectWhatsAppAccount,
  sendTestWhatsApp,

  // SMS
  connectSMSAccount,
  sendTestSMS,

  // Utility
  getConnectedAccounts,
  disconnectAccount,
};

export default channelConnectionService;
