/**
 * AWS SES Email Service
 * Handles email sending via Amazon SES
 */

import { SendEmailCommand, SendTemplatedEmailCommand } from '@aws-sdk/client-ses';
import { sesClient, sesConfig } from '../config/aws.js';
import { logger } from '../common/logger.js';

export class SESService {
  /**
   * Send a simple email
   * @param {string} to - Recipient email
   * @param {string} subject - Email subject
   * @param {string} body - Email body (HTML or text)
   * @param {Object} options - Additional options
   */
  static async sendEmail(to, subject, body, options = {}) {
    try {
      const command = new SendEmailCommand({
        Source: options.from || `${sesConfig.fromName} <${sesConfig.fromEmail}>`,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to],
          CcAddresses: options.cc || [],
          BccAddresses: options.bcc || [],
        },
        Message: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: options.isHtml
            ? {
                Html: {
                  Data: body,
                  Charset: 'UTF-8',
                },
              }
            : {
                Text: {
                  Data: body,
                  Charset: 'UTF-8',
                },
              },
        },
        ConfigurationSetName: sesConfig.configurationSet,
        ReplyToAddresses: options.replyTo ? [options.replyTo] : [],
        Tags: options.tags || [],
      });

      const response = await sesClient.send(command);

      logger.info(
        {
          to,
          subject,
          messageId: response.MessageId,
        },
        'Email sent via SES'
      );

      return {
        messageId: response.MessageId,
        success: true,
      };
    } catch (error) {
      logger.error({ error, to, subject }, 'SES email send failed');
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send templated email using SES templates
   * @param {string} to - Recipient email
   * @param {string} templateName - SES template name
   * @param {Object} templateData - Template variables
   * @param {Object} options - Additional options
   */
  static async sendTemplatedEmail(to, templateName, templateData, options = {}) {
    try {
      const command = new SendTemplatedEmailCommand({
        Source: options.from || `${sesConfig.fromName} <${sesConfig.fromEmail}>`,
        Destination: {
          ToAddresses: Array.isArray(to) ? to : [to],
        },
        Template: templateName,
        TemplateData: JSON.stringify(templateData),
        ConfigurationSetName: sesConfig.configurationSet,
        Tags: options.tags || [],
      });

      const response = await sesClient.send(command);

      logger.info(
        {
          to,
          templateName,
          messageId: response.MessageId,
        },
        'Templated email sent via SES'
      );

      return {
        messageId: response.MessageId,
        success: true,
      };
    } catch (error) {
      logger.error({ error, to, templateName }, 'SES templated email send failed');
      throw new Error(`Failed to send templated email: ${error.message}`);
    }
  }

  /**
   * Send verification email (common use case)
   * @param {string} to - Recipient email
   * @param {string} verificationLink - Email verification link
   * @param {string} userName - User's name
   */
  static async sendVerificationEmail(to, verificationLink, userName) {
    const subject = 'Verify your Nexora account';
    const body = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #4F46E5;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Welcome to Nexora, ${userName}!</h2>
            <p>Thank you for signing up. Please verify your email address to get started.</p>
            <a href="${verificationLink}" class="button">Verify Email</a>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #4F46E5;">${verificationLink}</p>
            <div class="footer">
              <p>If you didn't create this account, please ignore this email.</p>
              <p>&copy; ${new Date().getFullYear()} Nexora OS. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(to, subject, body, { isHtml: true });
  }

  /**
   * Send password reset email
   * @param {string} to - Recipient email
   * @param {string} resetLink - Password reset link
   * @param {string} userName - User's name
   */
  static async sendPasswordResetEmail(to, resetLink, userName) {
    const subject = 'Reset your Nexora password';
    const body = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #4F46E5;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Reset your password</h2>
            <p>Hi ${userName},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <a href="${resetLink}" class="button">Reset Password</a>
            <p>Or copy and paste this link in your browser:</p>
            <p style="word-break: break-all; color: #4F46E5;">${resetLink}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <div class="footer">
              <p>If you didn't request a password reset, please ignore this email.</p>
              <p>&copy; ${new Date().getFullYear()} Nexora OS. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(to, subject, body, { isHtml: true });
  }

  /**
   * Send welcome email after successful signup
   * @param {string} to - Recipient email
   * @param {string} userName - User's name
   * @param {string} tenantDomain - Tenant's custom domain
   */
  static async sendWelcomeEmail(to, userName, tenantDomain) {
    const subject = 'Welcome to Nexora!';
    const body = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #4F46E5;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
            }
            .footer { margin-top: 30px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Welcome to Nexora, ${userName}!</h2>
            <p>Your account has been successfully created. You can now access your workspace at:</p>
            <p><strong>https://${tenantDomain}</strong></p>
            <a href="https://${tenantDomain}" class="button">Go to Dashboard</a>
            <h3>Next Steps:</h3>
            <ul>
              <li>Complete your profile setup</li>
              <li>Invite your team members</li>
              <li>Configure your CRM pipelines</li>
              <li>Connect your communication channels</li>
            </ul>
            <div class="footer">
              <p>Need help getting started? Contact us at support@nexoraos.pro</p>
              <p>&copy; ${new Date().getFullYear()} Nexora OS. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail(to, subject, body, { isHtml: true });
  }

  /**
   * Send bulk emails (with rate limiting consideration)
   * @param {Array} emails - Array of {to, subject, body} objects
   * @param {Object} options - Send options
   */
  static async sendBulkEmails(emails, options = {}) {
    const results = [];
    const batchSize = options.batchSize || 10; // SES rate limit: 14 emails/sec
    const delay = options.delay || 1000; // 1 second delay between batches

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map((email) => this.sendEmail(email.to, email.subject, email.body, email.options))
      );

      results.push(...batchResults);

      // Delay between batches to respect rate limits
      if (i + batchSize < emails.length) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    logger.info(
      {
        total: emails.length,
        successful,
        failed,
      },
      'Bulk email send completed'
    );

    return {
      total: emails.length,
      successful,
      failed,
      results,
    };
  }
}

export default SESService;
