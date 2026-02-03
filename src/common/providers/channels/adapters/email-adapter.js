/**
 * Email Channel Adapter
 * Implements Email via Gmail/Microsoft 365 OAuth or SMTP
 */

import {
  BaseChannelAdapter,
  ChannelCapabilities,
  ChannelEventTypes,
  NormalizedMessage,
} from '../base-adapter.js';
import { rateLimiter } from '../rate-limiter.js';
import { usageMeter } from '../usage-meter.js';
import { prisma } from '@crm360/database';
import nodemailer from 'nodemailer';

const GOOGLE_API_BASE = 'https://www.googleapis.com/gmail/v1';
const MICROSOFT_GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

export class EmailAdapter extends BaseChannelAdapter {
  constructor(channelAccount) {
    super(channelAccount);
    this.emailAddress = channelAccount.identifier;
    this.provider = channelAccount.credentials?.provider; // 'gmail' | 'microsoft' | 'smtp'
    this.accessToken = channelAccount.credentials?.accessToken;
    this.refreshToken = channelAccount.credentials?.refreshToken;
    this.smtpConfig = channelAccount.credentials?.smtp;
    this.imapConfig = channelAccount.credentials?.imap;
  }

  getChannelType() {
    return 'EMAIL';
  }

  getCapabilities() {
    return [
      ChannelCapabilities.TEXT,
      ChannelCapabilities.RICH_TEXT,
      ChannelCapabilities.IMAGES,
      ChannelCapabilities.DOCUMENTS,
      ChannelCapabilities.TEMPLATES,
      ChannelCapabilities.DELIVERY_RECEIPTS,
      ChannelCapabilities.READ_RECEIPTS,
      ChannelCapabilities.REPLIES,
    ];
  }

  async sendMessage(message) {
    // Check rate limit
    const rateCheck = await rateLimiter.checkLimit(
      this.channelAccount.id,
      'EMAIL',
      'message'
    );

    if (!rateCheck.allowed) {
      return {
        success: false,
        error: 'RATE_LIMITED',
        retryAfter: rateCheck.retryAfter,
      };
    }

    // Check balance
    const balanceCheck = await usageMeter.checkBalance(
      this.tenantId,
      this.workspaceId,
      'EMAIL',
      this.getEventType(message)
    );

    if (!balanceCheck.sufficient) {
      return {
        success: false,
        error: 'INSUFFICIENT_BALANCE',
        details: balanceCheck,
      };
    }

    // Check opt-out status
    const optedOut = await this.checkOptOut(message.metadata.recipient);
    if (optedOut) {
      return {
        success: false,
        error: 'RECIPIENT_OPTED_OUT',
      };
    }

    try {
      let result;

      switch (this.provider) {
        case 'gmail':
          result = await this.sendViaGmail(message);
          break;
        case 'microsoft':
          result = await this.sendViaMicrosoft(message);
          break;
        case 'smtp':
        default:
          result = await this.sendViaSMTP(message);
          break;
      }

      if (result.success) {
        await rateLimiter.recordAction(this.channelAccount.id, 'EMAIL', 'message');

        await usageMeter.recordUsage({
          tenantId: this.tenantId,
          workspaceId: this.workspaceId,
          channelAccountId: this.channelAccount.id,
          channelType: 'EMAIL',
          eventType: this.getEventType(message),
          messageEventId: message.id,
          direction: 'OUTBOUND',
        });

        this.emitEvent(ChannelEventTypes.MESSAGE_SENT, {
          messageId: message.id,
          externalId: result.externalId,
        });
      } else {
        this.emitEvent(ChannelEventTypes.MESSAGE_FAILED, {
          messageId: message.id,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      this.log('error', 'Failed to send email', { error: error.message });

      this.emitEvent(ChannelEventTypes.MESSAGE_FAILED, {
        messageId: message.id,
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
      };
    }
  }

  async sendViaGmail(message) {
    await this.ensureValidToken();

    const raw = this.buildMimeMessage(message);

    const response = await fetch(`${GOOGLE_API_BASE}/users/me/messages/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    });

    const data = await response.json();

    if (response.ok && data.id) {
      return {
        success: true,
        externalId: data.id,
      };
    } else {
      return {
        success: false,
        error: data.error?.message || 'Failed to send via Gmail',
        errorCode: data.error?.code,
      };
    }
  }

  async sendViaMicrosoft(message) {
    await this.ensureValidToken();

    const emailPayload = {
      message: {
        subject: message.content.subject,
        body: {
          contentType: message.content.isHtml ? 'HTML' : 'Text',
          content: message.content.body,
        },
        toRecipients: [
          {
            emailAddress: {
              address: message.metadata.recipient,
              name: message.metadata.recipientName,
            },
          },
        ],
        from: {
          emailAddress: {
            address: this.emailAddress,
            name: message.metadata.senderName,
          },
        },
      },
      saveToSentItems: true,
    };

    // Add attachments if present
    if (message.content.attachments?.length > 0) {
      emailPayload.message.attachments = message.content.attachments.map(att => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: att.filename,
        contentType: att.mimeType,
        contentBytes: att.base64Content,
      }));
    }

    // Add reply headers if this is a reply
    if (message.metadata.inReplyTo) {
      emailPayload.message.internetMessageHeaders = [
        { name: 'In-Reply-To', value: message.metadata.inReplyTo },
        { name: 'References', value: message.metadata.references || message.metadata.inReplyTo },
      ];
    }

    const response = await fetch(`${MICROSOFT_GRAPH_BASE}/me/sendMail`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (response.ok) {
      return {
        success: true,
        externalId: response.headers.get('x-ms-request-id'),
      };
    } else {
      const data = await response.json();
      return {
        success: false,
        error: data.error?.message || 'Failed to send via Microsoft',
        errorCode: data.error?.code,
      };
    }
  }

  async sendViaSMTP(message) {
    const transporter = nodemailer.createTransport({
      host: this.smtpConfig.host,
      port: this.smtpConfig.port,
      secure: this.smtpConfig.secure,
      auth: {
        user: this.smtpConfig.username,
        pass: this.smtpConfig.password,
      },
    });

    const mailOptions = {
      from: {
        name: message.metadata.senderName || this.emailAddress,
        address: this.emailAddress,
      },
      to: message.metadata.recipient,
      subject: message.content.subject,
      text: message.content.isHtml ? undefined : message.content.body,
      html: message.content.isHtml ? message.content.body : undefined,
      attachments: message.content.attachments?.map(att => ({
        filename: att.filename,
        content: att.buffer || Buffer.from(att.base64Content, 'base64'),
        contentType: att.mimeType,
      })),
    };

    // Add reply headers
    if (message.metadata.inReplyTo) {
      mailOptions.inReplyTo = message.metadata.inReplyTo;
      mailOptions.references = message.metadata.references;
    }

    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      externalId: info.messageId,
    };
  }

  async sendTemplate(templateId, variables, recipient) {
    const rateCheck = await rateLimiter.checkLimit(
      this.channelAccount.id,
      'EMAIL',
      'template'
    );

    if (!rateCheck.allowed) {
      return {
        success: false,
        error: 'RATE_LIMITED',
        retryAfter: rateCheck.retryAfter,
      };
    }

    try {
      // Get template
      const template = await prisma.template.findUnique({
        where: { id: templateId },
      });

      if (!template || template.status !== 'APPROVED') {
        return {
          success: false,
          error: 'TEMPLATE_NOT_FOUND_OR_NOT_APPROVED',
        };
      }

      // Substitute variables
      let content = template.content;
      let subject = template.metadata?.subject || '';

      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        content = content.replace(regex, value);
        subject = subject.replace(regex, value);
      }

      // Get signature if enabled
      let signature = '';
      if (template.metadata?.includeSignature) {
        const sig = await prisma.emailSignature.findFirst({
          where: {
            channelAccountId: this.channelAccount.id,
            isDefault: true,
          },
        });
        if (sig) {
          signature = sig.htmlContent || sig.textContent;
        }
      }

      const message = new NormalizedMessage({
        channelType: 'EMAIL',
        channelAccountId: this.channelAccount.id,
        direction: 'OUTBOUND',
        contentType: 'TEXT',
        content: {
          subject,
          body: content + signature,
          isHtml: template.metadata?.isHtml ?? true,
        },
        metadata: {
          recipient,
          templateId,
        },
      });

      return this.sendMessage(message);
    } catch (error) {
      this.log('error', 'Failed to send email template', { error: error.message });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async parseInboundWebhook(payload) {
    // Parse webhook based on provider
    // This would be called by email sync/webhook handler
    const { messageId, from, subject, body, receivedAt, headers, attachments } = payload;

    return new NormalizedMessage({
      externalId: messageId,
      channelType: 'EMAIL',
      channelAccountId: this.channelAccount.id,
      direction: 'INBOUND',
      contentType: 'TEXT',
      content: {
        subject,
        body,
        isHtml: body.includes('<html') || body.includes('<body'),
        attachments,
      },
      metadata: {
        from,
        inReplyTo: headers?.['in-reply-to'],
        references: headers?.['references'],
      },
      sentAt: new Date(receivedAt),
    });
  }

  async parseStatusWebhook(payload) {
    // Email status updates (delivery/read receipts)
    const { messageId, status, timestamp } = payload;

    return {
      messageId,
      status: status.toUpperCase(),
      timestamp: new Date(timestamp),
    };
  }

  async validateCredentials() {
    try {
      switch (this.provider) {
        case 'gmail':
          await this.ensureValidToken();
          const gmailResponse = await fetch(`${GOOGLE_API_BASE}/users/me/profile`, {
            headers: { 'Authorization': `Bearer ${this.accessToken}` },
          });
          return { valid: gmailResponse.ok };

        case 'microsoft':
          await this.ensureValidToken();
          const msResponse = await fetch(`${MICROSOFT_GRAPH_BASE}/me`, {
            headers: { 'Authorization': `Bearer ${this.accessToken}` },
          });
          return { valid: msResponse.ok };

        case 'smtp':
          const transporter = nodemailer.createTransport({
            host: this.smtpConfig.host,
            port: this.smtpConfig.port,
            secure: this.smtpConfig.secure,
            auth: {
              user: this.smtpConfig.username,
              pass: this.smtpConfig.password,
            },
          });
          await transporter.verify();
          return { valid: true };

        default:
          return { valid: false, error: 'Unknown provider' };
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async getHealthStatus() {
    try {
      const validation = await this.validateCredentials();
      const rateLimitStatus = await rateLimiter.getStatus(this.channelAccount.id, 'EMAIL');

      return {
        healthy: validation.valid,
        details: {
          credentials: validation,
          rateLimits: rateLimitStatus,
          emailAddress: this.emailAddress,
          provider: this.provider,
          tokenExpiry: this.channelAccount.tokenExpiresAt,
        },
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  async refreshTokens() {
    if (this.provider === 'gmail') {
      return this.refreshGmailTokens();
    } else if (this.provider === 'microsoft') {
      return this.refreshMicrosoftTokens();
    }
    return { success: true }; // SMTP doesn't need token refresh
  }

  async refreshGmailTokens() {
    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        // Update stored credentials
        await prisma.channelAccount.update({
          where: { id: this.channelAccount.id },
          data: {
            credentials: {
              ...this.channelAccount.credentials,
              accessToken: data.access_token,
            },
            tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
          },
        });

        this.accessToken = data.access_token;

        return { success: true, newTokens: { accessToken: data.access_token } };
      }

      return { success: false, error: data.error_description };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async refreshMicrosoftTokens() {
    try {
      const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
          scope: 'https://graph.microsoft.com/.default',
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        await prisma.channelAccount.update({
          where: { id: this.channelAccount.id },
          data: {
            credentials: {
              ...this.channelAccount.credentials,
              accessToken: data.access_token,
              refreshToken: data.refresh_token || this.refreshToken,
            },
            tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
          },
        });

        this.accessToken = data.access_token;
        if (data.refresh_token) {
          this.refreshToken = data.refresh_token;
        }

        return { success: true, newTokens: { accessToken: data.access_token } };
      }

      return { success: false, error: data.error_description };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async estimateCost(message) {
    const eventType = this.getEventType(message);
    return usageMeter.getCostEstimate('EMAIL', eventType);
  }

  async uploadMedia(buffer, mimeType) {
    // For email, attachments are included inline
    return {
      mediaId: `inline:${Date.now()}`,
      base64Content: buffer.toString('base64'),
    };
  }

  async downloadMedia(mediaId) {
    // Would fetch attachment from email provider
    throw new Error('Not implemented - use message attachments directly');
  }

  // Private helper methods

  async ensureValidToken() {
    if (this.provider === 'smtp') return;

    const tokenExpiry = this.channelAccount.tokenExpiresAt;
    if (tokenExpiry && new Date(tokenExpiry) < new Date(Date.now() + 300000)) {
      // Token expires in less than 5 minutes, refresh it
      const result = await this.refreshTokens();
      if (!result.success) {
        throw new Error(`Token refresh failed: ${result.error}`);
      }
    }
  }

  buildMimeMessage(message) {
    const boundary = `boundary_${Date.now()}`;
    const lines = [
      `From: ${message.metadata.senderName || ''} <${this.emailAddress}>`,
      `To: ${message.metadata.recipient}`,
      `Subject: ${message.content.subject}`,
      `MIME-Version: 1.0`,
    ];

    if (message.content.attachments?.length > 0) {
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      lines.push('');
      lines.push(`--${boundary}`);
    }

    if (message.content.isHtml) {
      lines.push('Content-Type: text/html; charset=utf-8');
    } else {
      lines.push('Content-Type: text/plain; charset=utf-8');
    }
    lines.push('');
    lines.push(message.content.body);

    if (message.content.attachments?.length > 0) {
      for (const att of message.content.attachments) {
        lines.push(`--${boundary}`);
        lines.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
        lines.push('Content-Transfer-Encoding: base64');
        lines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
        lines.push('');
        lines.push(att.base64Content);
      }
      lines.push(`--${boundary}--`);
    }

    const raw = lines.join('\r\n');
    return Buffer.from(raw).toString('base64url');
  }

  async checkOptOut(email) {
    const optOut = await prisma.optOut.findFirst({
      where: {
        channelType: 'EMAIL',
        identifier: email,
        isActive: true,
      },
    });

    return !!optOut;
  }

  getEventType(message) {
    if (message.metadata.category === 'MARKETING') {
      return 'EMAIL_MARKETING';
    }
    if (message.metadata.category === 'BULK') {
      return 'EMAIL_BULK';
    }
    return 'EMAIL_TRANSACTIONAL';
  }
}

/**
 * Factory function for Email adapter
 */
export function createEmailAdapter(channelAccount) {
  return new EmailAdapter(channelAccount);
}
