// ==================== EMAIL PROVIDERS CONFIGURATION ====================
// Pre-configured settings for common email providers
// Used for auto-detection when user enters their email

export const EMAIL_PROVIDERS = {
  // ==================== GOOGLE ====================
  'gmail.com': {
    provider: 'GMAIL',
    name: 'Gmail',
    authType: 'oauth',
    icon: 'gmail',
    color: '#EA4335',
    oauth: {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    },
    imap: {
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
    },
    requiresAppPassword: true,
    requiresOAuth: false, // OAuth preferred but App Password works
    notes:
      'Use "Sign in with Google" for easiest setup. If using password, enable 2FA and create an App Password.',
    helpUrl: 'https://support.google.com/accounts/answer/185833',
  },
  'googlemail.com': {
    // Alias for gmail.com
    provider: 'GMAIL',
    name: 'Gmail',
    authType: 'oauth',
    icon: 'gmail',
    color: '#EA4335',
    oauth: {
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
    },
    imap: {
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
    },
    requiresAppPassword: true,
    requiresOAuth: false,
    notes: 'Use "Sign in with Google" for easiest setup.',
    helpUrl: 'https://support.google.com/accounts/answer/185833',
  },

  // ==================== MICROSOFT ====================
  'outlook.com': {
    provider: 'OUTLOOK',
    name: 'Outlook.com',
    authType: 'oauth',
    icon: 'outlook',
    color: '#0078D4',
    oauth: {
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scopes: [
        'openid',
        'email',
        'profile',
        'offline_access',
        'https://outlook.office.com/IMAP.AccessAsUser.All',
        'https://outlook.office.com/SMTP.Send',
      ],
    },
    imap: {
      host: 'outlook.office365.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      startTls: true,
    },
    requiresAppPassword: false,
    requiresOAuth: false,
    notes: 'Use "Sign in with Microsoft" for easiest setup.',
    helpUrl:
      'https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353',
  },
  'hotmail.com': {
    provider: 'OUTLOOK',
    name: 'Hotmail',
    authType: 'oauth',
    icon: 'outlook',
    color: '#0078D4',
    oauth: {
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scopes: [
        'openid',
        'email',
        'profile',
        'offline_access',
        'https://outlook.office.com/IMAP.AccessAsUser.All',
        'https://outlook.office.com/SMTP.Send',
      ],
    },
    imap: {
      host: 'outlook.office365.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      startTls: true,
    },
    requiresAppPassword: false,
    requiresOAuth: false,
    notes: 'Use "Sign in with Microsoft" for easiest setup.',
    helpUrl:
      'https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353',
  },
  'live.com': {
    provider: 'OUTLOOK',
    name: 'Live.com',
    authType: 'oauth',
    icon: 'outlook',
    color: '#0078D4',
    oauth: {
      authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      scopes: [
        'openid',
        'email',
        'profile',
        'offline_access',
        'https://outlook.office.com/IMAP.AccessAsUser.All',
        'https://outlook.office.com/SMTP.Send',
      ],
    },
    imap: {
      host: 'outlook.office365.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      startTls: true,
    },
    requiresAppPassword: false,
    requiresOAuth: false,
    notes: 'Use "Sign in with Microsoft" for easiest setup.',
    helpUrl:
      'https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings-8361e398-8af4-4e97-b147-6c6c4ac95353',
  },
  'msn.com': {
    provider: 'OUTLOOK',
    name: 'MSN',
    authType: 'oauth',
    icon: 'outlook',
    color: '#0078D4',
    imap: {
      host: 'outlook.office365.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      startTls: true,
    },
    requiresAppPassword: false,
    requiresOAuth: false,
  },

  // ==================== YAHOO ====================
  'yahoo.com': {
    provider: 'YAHOO',
    name: 'Yahoo Mail',
    authType: 'password',
    icon: 'yahoo',
    color: '#6001D2',
    imap: {
      host: 'imap.mail.yahoo.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.mail.yahoo.com',
      port: 465,
      secure: true,
    },
    requiresAppPassword: true,
    requiresOAuth: false,
    notes: 'Enable 2FA and generate an App Password from Yahoo Account Security.',
    helpUrl: 'https://help.yahoo.com/kb/generate-manage-third-party-passwords-sln15241.html',
  },
  'ymail.com': {
    provider: 'YAHOO',
    name: 'Yahoo Mail',
    authType: 'password',
    icon: 'yahoo',
    color: '#6001D2',
    imap: {
      host: 'imap.mail.yahoo.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.mail.yahoo.com',
      port: 465,
      secure: true,
    },
    requiresAppPassword: true,
    requiresOAuth: false,
    notes: 'Enable 2FA and generate an App Password.',
    helpUrl: 'https://help.yahoo.com/kb/generate-manage-third-party-passwords-sln15241.html',
  },

  // ==================== ZOHO ====================
  'zoho.com': {
    provider: 'ZOHO',
    name: 'Zoho Mail',
    authType: 'password',
    icon: 'zoho',
    color: '#F9B21D',
    imap: {
      host: 'imap.zoho.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
    },
    requiresAppPassword: true,
    requiresOAuth: false,
    notes: 'Generate an App Password from Zoho Account Security.',
    helpUrl: 'https://www.zoho.com/mail/help/imap-access.html',
  },
  'zohomail.com': {
    provider: 'ZOHO',
    name: 'Zoho Mail',
    authType: 'password',
    icon: 'zoho',
    color: '#F9B21D',
    imap: {
      host: 'imap.zoho.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.zoho.com',
      port: 465,
      secure: true,
    },
    requiresAppPassword: true,
    requiresOAuth: false,
    notes: 'Generate an App Password from Zoho Account Security.',
    helpUrl: 'https://www.zoho.com/mail/help/imap-access.html',
  },

  // ==================== APPLE ====================
  'icloud.com': {
    provider: 'ICLOUD',
    name: 'iCloud Mail',
    authType: 'password',
    icon: 'apple',
    color: '#000000',
    imap: {
      host: 'imap.mail.me.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.mail.me.com',
      port: 587,
      secure: false,
      startTls: true,
    },
    requiresAppPassword: true,
    requiresOAuth: false,
    notes: 'Generate an App-Specific Password from Apple ID settings.',
    helpUrl: 'https://support.apple.com/en-us/HT204397',
  },
  'me.com': {
    provider: 'ICLOUD',
    name: 'iCloud Mail',
    authType: 'password',
    icon: 'apple',
    color: '#000000',
    imap: {
      host: 'imap.mail.me.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.mail.me.com',
      port: 587,
      secure: false,
      startTls: true,
    },
    requiresAppPassword: true,
    requiresOAuth: false,
    notes: 'Generate an App-Specific Password from Apple ID settings.',
    helpUrl: 'https://support.apple.com/en-us/HT204397',
  },
  'mac.com': {
    provider: 'ICLOUD',
    name: 'iCloud Mail',
    authType: 'password',
    icon: 'apple',
    color: '#000000',
    imap: {
      host: 'imap.mail.me.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.mail.me.com',
      port: 587,
      secure: false,
      startTls: true,
    },
    requiresAppPassword: true,
    requiresOAuth: false,
  },

  // ==================== AOL ====================
  'aol.com': {
    provider: 'OTHER',
    name: 'AOL Mail',
    authType: 'password',
    icon: 'mail',
    color: '#31459B',
    imap: {
      host: 'imap.aol.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.aol.com',
      port: 465,
      secure: true,
    },
    requiresAppPassword: true,
    requiresOAuth: false,
    notes: 'Generate an App Password from AOL Account Security.',
    helpUrl: 'https://help.aol.com/articles/Create-and-manage-app-password',
  },

  // ==================== PROTON ====================
  'protonmail.com': {
    provider: 'OTHER',
    name: 'ProtonMail',
    authType: 'bridge',
    icon: 'proton',
    color: '#6D4AFF',
    imap: {
      host: '127.0.0.1',
      port: 1143,
      secure: false,
    },
    smtp: {
      host: '127.0.0.1',
      port: 1025,
      secure: false,
    },
    requiresAppPassword: false,
    requiresOAuth: false,
    requiresBridge: true,
    notes: 'Requires ProtonMail Bridge app to be installed and running.',
    helpUrl: 'https://proton.me/support/protonmail-bridge-install',
  },
  'proton.me': {
    provider: 'OTHER',
    name: 'Proton Mail',
    authType: 'bridge',
    icon: 'proton',
    color: '#6D4AFF',
    imap: {
      host: '127.0.0.1',
      port: 1143,
      secure: false,
    },
    smtp: {
      host: '127.0.0.1',
      port: 1025,
      secure: false,
    },
    requiresAppPassword: false,
    requiresOAuth: false,
    requiresBridge: true,
    notes: 'Requires ProtonMail Bridge app to be installed and running.',
    helpUrl: 'https://proton.me/support/protonmail-bridge-install',
  },

  // ==================== COMMON HOSTING PROVIDERS ====================
  // GoDaddy
  godaddy: {
    provider: 'OTHER',
    name: 'GoDaddy Email',
    authType: 'password',
    icon: 'mail',
    color: '#00A4A6',
    imap: {
      host: 'imap.secureserver.net',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtpout.secureserver.net',
      port: 465,
      secure: true,
    },
    requiresAppPassword: false,
    requiresOAuth: false,
    notes: 'Use your GoDaddy email password.',
    helpUrl: 'https://www.godaddy.com/help/server-and-port-settings-for-workspace-email-6949',
  },

  // Hostinger
  hostinger: {
    provider: 'HOSTINGER',
    name: 'Hostinger',
    authType: 'password',
    icon: 'mail',
    color: '#673DE6',
    imap: {
      host: 'imap.hostinger.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
    },
    requiresAppPassword: false,
    requiresOAuth: false,
    notes: 'Use your Hostinger email password.',
  },

  // Helix Code (Hostinger hosted)
  'helixcode.in': {
    provider: 'HOSTINGER',
    name: 'Helix Code',
    authType: 'password',
    icon: 'mail',
    color: '#673DE6',
    imap: {
      host: 'imap.hostinger.com',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
    },
    requiresAppPassword: false,
    requiresOAuth: false,
    notes: 'Use your Hostinger email password.',
  },

  // Bluehost
  bluehost: {
    provider: 'OTHER',
    name: 'Bluehost',
    authType: 'password',
    icon: 'mail',
    color: '#2962FF',
    imap: {
      host: 'mail.{domain}',
      port: 993,
      secure: true,
      useDomain: true,
    },
    smtp: {
      host: 'mail.{domain}',
      port: 465,
      secure: true,
      useDomain: true,
    },
    requiresAppPassword: false,
    requiresOAuth: false,
    notes: 'Use mail.yourdomain.com as the server.',
  },

  // Generic cPanel (default fallback)
  cpanel: {
    provider: 'IMAP',
    name: 'cPanel / Web Hosting',
    authType: 'password',
    icon: 'mail',
    color: '#FF6C2C',
    imap: {
      host: 'mail.{domain}',
      port: 993,
      secure: true,
      useDomain: true,
    },
    smtp: {
      host: 'mail.{domain}',
      port: 465,
      secure: true,
      useDomain: true,
    },
    requiresAppPassword: false,
    requiresOAuth: false,
    notes: 'Most web hosting uses mail.yourdomain.com for email.',
  },
};

// Extract domain from email
export function getEmailDomain(email) {
  const parts = email.split('@');
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

// Get provider config by email
export function getProviderByEmail(email) {
  const domain = getEmailDomain(email);
  if (!domain) return null;

  return EMAIL_PROVIDERS[domain] || null;
}

// Get provider config by domain
export function getProviderByDomain(domain) {
  return EMAIL_PROVIDERS[domain.toLowerCase()] || null;
}

// Check if domain supports OAuth
export function supportsOAuth(email) {
  const provider = getProviderByEmail(email);
  return provider?.authType === 'oauth' && provider?.oauth;
}

// Check if domain requires App Password
export function requiresAppPassword(email) {
  const provider = getProviderByEmail(email);
  return provider?.requiresAppPassword || false;
}

// Get default IMAP/SMTP settings for a domain (fallback)
export function getDefaultSettings(email) {
  const domain = getEmailDomain(email);
  if (!domain) return null;

  // Try known providers first
  const provider = getProviderByEmail(email);
  if (provider) {
    return {
      provider: provider.provider,
      name: provider.name,
      imap: provider.imap,
      smtp: provider.smtp,
      notes: provider.notes,
      helpUrl: provider.helpUrl,
    };
  }

  // Fallback to generic cPanel-style settings
  return {
    provider: 'IMAP',
    name: 'Email',
    imap: {
      host: `mail.${domain}`,
      port: 993,
      secure: true,
    },
    smtp: {
      host: `mail.${domain}`,
      port: 465,
      secure: true,
    },
    notes: "Using standard mail server settings. Contact your email provider if these don't work.",
  };
}

// Google OAuth configuration
export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/google',
  scopes: [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
  ],
};

// Microsoft OAuth configuration
export const MICROSOFT_OAUTH_CONFIG = {
  clientId: process.env.MICROSOFT_CLIENT_ID,
  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  redirectUri:
    process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/microsoft',
  tenantId: 'common', // 'common' allows both personal and work accounts
  scopes: [
    'openid',
    'email',
    'profile',
    'offline_access',
    'https://outlook.office.com/IMAP.AccessAsUser.All',
    'https://outlook.office.com/SMTP.Send',
  ],
};

export default EMAIL_PROVIDERS;
