/**
 * System Email Service
 * Handles all platform-level emails (verification, password reset, invitations)
 *
 * Super Admin Accounts:
 * - hello@72orionx.com (sending)
 * - admin@72orionx.com (reply-to)
 */

import nodemailer from 'nodemailer';
import { prisma } from '@crm360/database';
import crypto from 'crypto';

// Email configuration
const config = {
  from: process.env.SYSTEM_EMAIL_FROM || 'hello@72orionx.com',
  replyTo: process.env.SYSTEM_EMAIL_REPLY_TO || 'admin@72orionx.com',
  appName: process.env.APP_NAME || 'Nexora',
  appUrl: process.env.APP_URL || 'https://nexoraos.pro',
  apiUrl: process.env.API_URL || 'https://api.nexoraos.pro',
};

// Create transporter
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  // Check if we have SMTP credentials
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE !== 'false',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  } else if (process.env.SENDGRID_API_KEY) {
    // Use SendGrid
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 465,
      secure: true,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  } else if (process.env.RESEND_API_KEY) {
    // Use Resend
    transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    });
  } else {
    // Development: Use ethereal or console
    console.warn('[SystemEmail] No email provider configured, using console output');
    transporter = {
      sendMail: async (options) => {
        console.log('\n========== EMAIL (Dev Mode) ==========');
        console.log('To:', options.to);
        console.log('Subject:', options.subject);
        console.log('Preview URL: [Check console for HTML]');
        console.log('=======================================\n');
        return { messageId: `dev-${Date.now()}` };
      },
    };
  }

  return transporter;
}

/**
 * Generate email verification token
 */
export function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate password reset token
 */
export function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Base email template wrapper
 */
function wrapEmailTemplate(content, preheader = '') {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.appName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background: #ffffff;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .logo {
      text-align: center;
      margin-bottom: 32px;
    }
    .logo img {
      height: 32px;
    }
    .logo-text {
      font-size: 24px;
      font-weight: 700;
      color: #6366f1;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #1a1a1a;
      margin: 0 0 16px 0;
    }
    p {
      margin: 0 0 16px 0;
      color: #4a4a4a;
    }
    .button {
      display: inline-block;
      background: #6366f1;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 500;
      margin: 16px 0;
    }
    .button:hover {
      background: #4f46e5;
    }
    .code {
      background: #f3f4f6;
      border-radius: 8px;
      padding: 16px;
      font-family: monospace;
      font-size: 24px;
      letter-spacing: 4px;
      text-align: center;
      color: #1a1a1a;
      margin: 16px 0;
    }
    .footer {
      text-align: center;
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid #e5e7eb;
      color: #9ca3af;
      font-size: 13px;
    }
    .footer a {
      color: #6366f1;
      text-decoration: none;
    }
    .preheader {
      display: none;
      max-height: 0;
      overflow: hidden;
    }
    .muted {
      color: #9ca3af;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="preheader">${preheader}</div>
  <div class="container">
    <div class="card">
      <div class="logo">
        <span class="logo-text">${config.appName}</span>
      </div>
      ${content}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${config.appName}. All rights reserved.</p>
      <p>
        <a href="${config.appUrl}">Visit our website</a> &bull;
        <a href="${config.appUrl}/help">Help Center</a>
      </p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * Send email verification
 */
export async function sendVerificationEmail(user, token) {
  const verifyUrl = `${config.appUrl}/verify-email?token=${token}`;

  const content = `
    <h1>Verify your email</h1>
    <p>Hi ${user.firstName || 'there'},</p>
    <p>Thanks for signing up for ${config.appName}! Please verify your email address to get started.</p>
    <p style="text-align: center;">
      <a href="${verifyUrl}" class="button">Verify Email Address</a>
    </p>
    <p class="muted">Or copy and paste this link into your browser:</p>
    <p class="muted" style="word-break: break-all;">${verifyUrl}</p>
    <p class="muted">This link expires in 24 hours.</p>
  `;

  const transport = getTransporter();
  const result = await transport.sendMail({
    from: `${config.appName} <${config.from}>`,
    replyTo: config.replyTo,
    to: user.email,
    subject: `Verify your ${config.appName} email`,
    html: wrapEmailTemplate(content, 'Please verify your email address'),
  });

  console.log(`[SystemEmail] Verification email sent to ${user.email}`);
  return result;
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(user, token) {
  const resetUrl = `${config.appUrl}/reset-password?token=${token}`;

  const content = `
    <h1>Reset your password</h1>
    <p>Hi ${user.firstName || 'there'},</p>
    <p>We received a request to reset your password. Click the button below to choose a new password.</p>
    <p style="text-align: center;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </p>
    <p class="muted">Or copy and paste this link into your browser:</p>
    <p class="muted" style="word-break: break-all;">${resetUrl}</p>
    <p class="muted">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
  `;

  const transport = getTransporter();
  const result = await transport.sendMail({
    from: `${config.appName} <${config.from}>`,
    replyTo: config.replyTo,
    to: user.email,
    subject: `Reset your ${config.appName} password`,
    html: wrapEmailTemplate(content, 'Reset your password'),
  });

  console.log(`[SystemEmail] Password reset email sent to ${user.email}`);
  return result;
}

/**
 * Send team invitation email
 */
export async function sendInvitationEmail(invitation) {
  const { email, firstName, inviterName, companyName, role, token } = invitation;
  const acceptUrl = `${config.appUrl}/accept-invite?token=${token}`;

  const content = `
    <h1>You're invited to join ${companyName}</h1>
    <p>Hi ${firstName || 'there'},</p>
    <p><strong>${inviterName}</strong> has invited you to join <strong>${companyName}</strong> on ${config.appName} as a <strong>${role}</strong>.</p>
    <p style="text-align: center;">
      <a href="${acceptUrl}" class="button">Accept Invitation</a>
    </p>
    <p class="muted">Or copy and paste this link into your browser:</p>
    <p class="muted" style="word-break: break-all;">${acceptUrl}</p>
    <p class="muted">This invitation expires in 7 days.</p>
  `;

  const transport = getTransporter();
  const result = await transport.sendMail({
    from: `${config.appName} <${config.from}>`,
    replyTo: config.replyTo,
    to: email,
    subject: `${inviterName} invited you to join ${companyName} on ${config.appName}`,
    html: wrapEmailTemplate(content, `Join ${companyName} on ${config.appName}`),
  });

  console.log(`[SystemEmail] Invitation email sent to ${email}`);
  return result;
}

/**
 * Send welcome email after verification
 */
export async function sendWelcomeEmail(user, companyName) {
  const loginUrl = `${config.appUrl}/login`;

  const content = `
    <h1>Welcome to ${config.appName}! 🎉</h1>
    <p>Hi ${user.firstName || 'there'},</p>
    <p>Your email has been verified and your account is ready. You're all set to start using ${config.appName} for <strong>${companyName}</strong>.</p>
    <p>Here's what you can do next:</p>
    <ul style="color: #4a4a4a; padding-left: 20px;">
      <li>Import your contacts and deals</li>
      <li>Connect your email and WhatsApp</li>
      <li>Set up your sales pipeline</li>
      <li>Invite your team members</li>
    </ul>
    <p style="text-align: center;">
      <a href="${loginUrl}" class="button">Go to Dashboard</a>
    </p>
    <p class="muted">Need help getting started? Check out our <a href="${config.appUrl}/help">Help Center</a>.</p>
  `;

  const transport = getTransporter();
  const result = await transport.sendMail({
    from: `${config.appName} <${config.from}>`,
    replyTo: config.replyTo,
    to: user.email,
    subject: `Welcome to ${config.appName}! 🎉`,
    html: wrapEmailTemplate(content, `Welcome to ${config.appName}`),
  });

  console.log(`[SystemEmail] Welcome email sent to ${user.email}`);
  return result;
}

/**
 * Send OTP code email
 */
export async function sendOTPEmail(user, code) {
  const content = `
    <h1>Your verification code</h1>
    <p>Hi ${user.firstName || 'there'},</p>
    <p>Use this code to verify your identity:</p>
    <div class="code">${code}</div>
    <p class="muted">This code expires in 10 minutes. If you didn't request this, please ignore this email.</p>
  `;

  const transport = getTransporter();
  const result = await transport.sendMail({
    from: `${config.appName} <${config.from}>`,
    replyTo: config.replyTo,
    to: user.email,
    subject: `Your ${config.appName} verification code: ${code}`,
    html: wrapEmailTemplate(content, `Your verification code is ${code}`),
  });

  console.log(`[SystemEmail] OTP email sent to ${user.email}`);
  return result;
}

/**
 * Send system notification email
 */
export async function sendNotificationEmail(
  to,
  subject,
  message,
  actionUrl = null,
  actionText = 'View Details'
) {
  let actionButton = '';
  if (actionUrl) {
    actionButton = `
      <p style="text-align: center;">
        <a href="${actionUrl}" class="button">${actionText}</a>
      </p>
    `;
  }

  const content = `
    <h1>${subject}</h1>
    <p>${message}</p>
    ${actionButton}
  `;

  const transport = getTransporter();
  const result = await transport.sendMail({
    from: `${config.appName} <${config.from}>`,
    replyTo: config.replyTo,
    to,
    subject: `[${config.appName}] ${subject}`,
    html: wrapEmailTemplate(content, message.substring(0, 100)),
  });

  console.log(`[SystemEmail] Notification email sent to ${to}`);
  return result;
}

/**
 * Send test email (for testing SMTP configuration)
 */
export async function sendTestEmail(to) {
  const content = `
    <h1>Test Email</h1>
    <p>This is a test email from ${config.appName}.</p>
    <p>If you received this email, your email configuration is working correctly! ✅</p>
    <p class="muted">Sent at: ${new Date().toISOString()}</p>
  `;

  const transport = getTransporter();
  const result = await transport.sendMail({
    from: `${config.appName} <${config.from}>`,
    replyTo: config.replyTo,
    to,
    subject: `[${config.appName}] Test Email`,
    html: wrapEmailTemplate(content, 'Test email from ' + config.appName),
  });

  console.log(`[SystemEmail] Test email sent to ${to}`);
  return result;
}

/**
 * Store verification token in database
 */
export async function createVerificationToken(userId) {
  const token = generateVerificationToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationToken: token,
      emailVerificationExpires: expiresAt,
    },
  });

  return token;
}

/**
 * Verify email token
 */
export async function verifyEmailToken(token) {
  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerificationExpires: { gt: new Date() },
    },
  });

  if (!user) {
    return { success: false, error: 'Invalid or expired verification token' };
  }

  // Mark email as verified
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    },
  });

  return { success: true, user };
}

/**
 * Create password reset token
 */
export async function createPasswordResetToken(email) {
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    // Don't reveal if email exists
    return { success: true };
  }

  const token = generateResetToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: token,
      passwordResetExpires: expiresAt,
    },
  });

  // Send the email
  await sendPasswordResetEmail(user, token);

  return { success: true };
}

/**
 * Verify password reset token
 */
export async function verifyPasswordResetToken(token) {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: { gt: new Date() },
    },
  });

  if (!user) {
    return { success: false, error: 'Invalid or expired reset token' };
  }

  return { success: true, user };
}

/**
 * Reset password with token
 */
export async function resetPasswordWithToken(token, newPassword) {
  const { success, user, error } = await verifyPasswordResetToken(token);

  if (!success) {
    return { success: false, error };
  }

  // Hash password would be done by auth service
  // This just clears the token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  return { success: true, userId: user.id };
}

export const systemEmailService = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendInvitationEmail,
  sendWelcomeEmail,
  sendOTPEmail,
  sendNotificationEmail,
  sendTestEmail,
  createVerificationToken,
  verifyEmailToken,
  createPasswordResetToken,
  verifyPasswordResetToken,
  resetPasswordWithToken,
  generateVerificationToken,
  generateResetToken,
};

export default systemEmailService;
