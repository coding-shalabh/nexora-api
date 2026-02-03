/**
 * System Mailer
 * Handles transactional emails (password reset, email verification, etc.)
 */

import nodemailer from 'nodemailer';

// Create transporter (lazy initialization with runtime env check)
let transporter = null;

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST || 'smtp.hostinger.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE !== 'false', // true by default for port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD, // Support both variable names
    },
  };
}

function getFromEmail() {
  return (
    process.env.SMTP_FROM ||
    process.env.SMTP_FROM_EMAIL ||
    process.env.SMTP_USER ||
    'adminio@72orionx.com'
  );
}

function getFromName() {
  return process.env.SMTP_FROM_NAME || '72Orionx';
}

function getAppUrl() {
  return process.env.APP_URL || 'http://localhost:3000';
}

function getTransporter() {
  // Always re-read config to pick up runtime env changes
  const config = getSmtpConfig();

  // Log what we're seeing for debugging
  console.log('[Mailer] SMTP Config:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user ? `${config.auth.user.substring(0, 5)}...` : 'NOT SET',
    pass: config.auth.pass ? '***SET***' : 'NOT SET',
  });

  // Check if SMTP is configured
  if (!config.auth.user || !config.auth.pass) {
    console.warn('[Mailer] SMTP not configured. Emails will be logged to console.');
    return null;
  }

  // Create new transporter with current config
  transporter = nodemailer.createTransport(config);
  return transporter;
}

/**
 * Send an email
 */
export async function sendEmail({ to, subject, html, text }) {
  const transport = getTransporter();
  const fromName = getFromName();
  const fromEmail = getFromEmail();

  const emailData = {
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
  };

  // If no transporter, log to console (development mode)
  if (!transport) {
    console.log('\n========== EMAIL (SMTP NOT CONFIGURED) ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${text || html}`);
    console.log('=================================================\n');
    return { success: true, messageId: 'console-' + Date.now() };
  }

  try {
    const info = await transport.sendMail(emailData);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Mailer] Failed to send email:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail({ email, resetToken, firstName }) {
  const appUrl = getAppUrl();
  const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
  const name = firstName || 'there';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Nexora CRM</h1>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #1f2937; margin-top: 0;">Reset Your Password</h2>

        <p>Hi ${name},</p>

        <p>We received a request to reset your password. Click the button below to create a new password:</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Reset Password</a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">This link will expire in 1 hour for security reasons.</p>

        <p style="color: #6b7280; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="color: #6366f1; font-size: 12px; word-break: break-all; margin-top: 5px;">${resetUrl}</p>
      </div>

      <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} 72Orionx. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  const text = `
Hi ${name},

We received a request to reset your password.

Click this link to reset your password:
${resetUrl}

This link will expire in 1 hour for security reasons.

If you didn't request a password reset, you can safely ignore this email.

- The 72Orionx Team
  `;

  return sendEmail({
    to: email,
    subject: 'Reset Your Password - Nexora CRM',
    html,
    text,
  });
}

/**
 * Send email verification email
 */
export async function sendEmailVerificationEmail({ email, verificationToken, firstName }) {
  const appUrl = getAppUrl();
  const verifyUrl = `${appUrl}/verify-email?token=${verificationToken}`;
  const name = firstName || 'there';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Verify Your Email</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 28px;">Nexora CRM</h1>
      </div>

      <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
        <h2 style="color: #1f2937; margin-top: 0;">Verify Your Email Address</h2>

        <p>Hi ${name},</p>

        <p>Welcome to Nexora CRM! Please verify your email address by clicking the button below:</p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">Verify Email</a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">This link will expire in 24 hours.</p>

        <p style="color: #6b7280; font-size: 14px;">If you didn't create an account with Nexora CRM, you can safely ignore this email.</p>

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

        <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">If the button doesn't work, copy and paste this link into your browser:</p>
        <p style="color: #6366f1; font-size: 12px; word-break: break-all; margin-top: 5px;">${verifyUrl}</p>
      </div>

      <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
        <p>&copy; ${new Date().getFullYear()} 72Orionx. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;

  const text = `
Hi ${name},

Welcome to Nexora CRM!

Please verify your email address by clicking this link:
${verifyUrl}

This link will expire in 24 hours.

If you didn't create an account with Nexora CRM, you can safely ignore this email.

- The 72Orionx Team
  `;

  return sendEmail({
    to: email,
    subject: 'Verify Your Email - Nexora CRM',
    html,
    text,
  });
}

export default {
  sendEmail,
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
};
