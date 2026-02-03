/**
 * Email Sending Service
 * Handles sending emails with open/click tracking
 * Supports both SMTP and Resend API (for platforms that block SMTP)
 */

import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { prisma } from '@crm360/database';
import { v4 as uuidv4 } from 'uuid';
import { emailAccountsService } from '../modules/email/email-accounts.service.js';

// Configuration
const config = {
  appUrl: process.env.APP_URL || 'https://nexoraos.pro',
  apiUrl: process.env.API_URL || 'https://api.nexoraos.pro',
  trackingDomain: process.env.TRACKING_DOMAIN || 'https://api.nexoraos.pro',
  resendApiKey: process.env.RESEND_API_KEY,
  useResend: process.env.EMAIL_PROVIDER === 'resend' || !!process.env.RESEND_API_KEY,
  // SMTP Relay configuration (for platforms that block SMTP)
  smtpRelayUrl: process.env.SMTP_RELAY_URL || 'https://email.72orionx.com',
  smtpRelayApiKey: process.env.SMTP_RELAY_API_KEY || 'nexora-smtp-relay-secret-2026',
  useSmtpRelay: process.env.EMAIL_PROVIDER === 'relay' || !!process.env.SMTP_RELAY_URL,
};

// Initialize Resend client if API key is available
const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

/**
 * Get SMTP transporter for an email account using decrypted credentials
 */
async function getTransporter(accountId) {
  if (!accountId) {
    throw new Error('Email account ID is required');
  }

  // Get decrypted credentials from the email accounts service
  const credentials = await emailAccountsService.getCredentials(accountId);

  if (!credentials) {
    throw new Error('Could not retrieve email account credentials');
  }

  // Build SMTP config from credentials
  let smtpConfig;

  if (credentials.type === 'oauth') {
    // OAuth-based SMTP (Gmail, Outlook)
    smtpConfig = {
      host: credentials.provider === 'GOOGLE' ? 'smtp.gmail.com' : 'smtp.office365.com',
      port: 587,
      secure: false, // Use STARTTLS
      auth: {
        type: 'OAuth2',
        user: credentials.email,
        accessToken: credentials.accessToken,
      },
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000,
      socketTimeout: 60000,
    };
  } else {
    // Password-based SMTP (IMAP)
    // Try port 587 with STARTTLS if port 465 is blocked
    const useStartTLS = credentials.smtp.port === 465 || credentials.smtp.secure === true;
    smtpConfig = {
      host: credentials.smtp.host,
      port: useStartTLS ? 587 : credentials.smtp.port || 587,
      secure: false, // Use STARTTLS instead of implicit TLS (often works better on cloud)
      auth: {
        user: credentials.email,
        pass: credentials.password,
      },
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000,
      socketTimeout: 60000,
      tls: {
        rejectUnauthorized: false, // Allow self-signed certs
      },
    };
  }

  return nodemailer.createTransport(smtpConfig);
}

/**
 * Generate tracking pixel HTML
 */
function generateTrackingPixel(trackingId) {
  const pixelUrl = `${config.trackingDomain}/api/v1/email/track/open/${trackingId}`;
  return `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
}

/**
 * Rewrite links for click tracking
 */
function rewriteLinksForTracking(html, trackingId) {
  if (!html) return html;

  // Match all href attributes
  const linkRegex = /href=["']([^"']+)["']/gi;

  return html.replace(linkRegex, (match, url) => {
    // Skip tracking for certain URLs
    if (
      url.startsWith('mailto:') ||
      url.startsWith('tel:') ||
      url.startsWith('#') ||
      url.includes('unsubscribe')
    ) {
      return match;
    }

    // Encode the original URL
    const encodedUrl = encodeURIComponent(url);
    const trackingUrl = `${config.trackingDomain}/api/v1/email/track/click/${trackingId}?url=${encodedUrl}`;

    return `href="${trackingUrl}"`;
  });
}

/**
 * Process merge tags in email content
 * Supports: {{firstName}}, {{lastName}}, {{email}}, {{company}}, etc.
 */
function processMergeTags(content, contact = {}, customData = {}) {
  if (!content) return content;

  // Handle null contact
  contact = contact || {};

  const data = {
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    email: contact.email || '',
    phone: contact.phone || '',
    company: contact.company?.name || contact.companyName || '',
    jobTitle: contact.jobTitle || '',
    ...customData,
  };

  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? data[key] : match;
  });
}

/**
 * Send an email with tracking
 */
export async function sendEmail({
  tenantId,
  accountId,
  fromEmail,
  fromName,
  to,
  cc,
  bcc,
  replyTo,
  subject,
  bodyHtml,
  bodyText,
  trackOpens = true,
  trackClicks = true,
  contactId,
  dealId,
  scheduledAt,
  attachments = [],
  metadata = {},
  createdById,
}) {
  // Generate tracking ID
  const trackingId = uuidv4();

  // Get email account
  let emailAccount = null;
  if (accountId) {
    emailAccount = await prisma.emailAccount.findFirst({
      where: { id: accountId, tenantId },
    });
  } else if (fromEmail) {
    emailAccount = await prisma.emailAccount.findFirst({
      where: { email: fromEmail, tenantId },
    });
  }

  if (!emailAccount) {
    throw new Error('No email account found. Please connect an email account first.');
  }

  // Get contact for merge tags
  let contact = null;
  if (contactId) {
    contact = await prisma.contact.findFirst({
      where: { id: contactId, tenantId },
      include: { company: true },
    });
  }

  // Process merge tags
  const processedSubject = processMergeTags(subject, contact, metadata);
  let processedHtml = processMergeTags(bodyHtml, contact, metadata);
  const processedText = processMergeTags(bodyText, contact, metadata);

  // Add tracking to HTML
  if (processedHtml) {
    // Rewrite links for click tracking
    if (trackClicks) {
      processedHtml = rewriteLinksForTracking(processedHtml, trackingId);
    }

    // Add tracking pixel for open tracking
    if (trackOpens) {
      const pixel = generateTrackingPixel(trackingId);
      // Insert before closing body tag or at the end
      if (processedHtml.includes('</body>')) {
        processedHtml = processedHtml.replace('</body>', `${pixel}</body>`);
      } else {
        processedHtml = processedHtml + pixel;
      }
    }
  }

  // Normalize recipients
  const toEmails = Array.isArray(to) ? to : [to];
  const ccEmails = cc ? (Array.isArray(cc) ? cc : [cc]) : [];
  const bccEmails = bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : [];

  // Create email record
  const email = await prisma.email.create({
    data: {
      tenantId,
      accountId: emailAccount.id,
      accountType: 'personal',
      fromEmail: emailAccount.email,
      fromName: fromName || emailAccount.displayName || emailAccount.email,
      toEmails: JSON.stringify(toEmails),
      ccEmails: ccEmails.length > 0 ? JSON.stringify(ccEmails) : null,
      bccEmails: bccEmails.length > 0 ? JSON.stringify(bccEmails) : null,
      replyTo: replyTo || emailAccount.replyTo,
      subject: processedSubject,
      bodyText: processedText,
      bodyHtml: processedHtml,
      status: scheduledAt ? 'SCHEDULED' : 'QUEUED',
      direction: 'OUTBOUND',
      scheduledAt,
      trackOpens,
      trackClicks,
      trackingId,
      contactId,
      dealId,
      hasAttachments: attachments.length > 0,
      metadata,
      createdById,
    },
  });

  // If scheduled, return early
  if (scheduledAt && new Date(scheduledAt) > new Date()) {
    return {
      success: true,
      emailId: email.id,
      trackingId,
      status: 'SCHEDULED',
      scheduledAt,
    };
  }

  // Update status to SENDING
  await prisma.email.update({
    where: { id: email.id },
    data: { status: 'SENDING' },
  });

  const fromAddress =
    `${fromName || emailAccount.displayName || ''} <${emailAccount.email}>`.trim();

  // Try Resend first if configured
  if (config.useResend && resend) {
    try {
      const result = await sendViaResend({
        from: fromAddress,
        to: toEmails,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        bcc: bccEmails.length > 0 ? bccEmails : undefined,
        replyTo: replyTo || emailAccount.replyTo,
        subject: processedSubject,
        text: processedText,
        html: processedHtml,
      });

      // Update status to SENT
      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          messageId: result.id,
        },
      });

      console.log(`[EmailSend] Email sent via Resend: ${email.id} to ${toEmails.join(', ')}`);

      return {
        success: true,
        emailId: email.id,
        messageId: result.id,
        trackingId,
        status: 'SENT',
        provider: 'resend',
      };
    } catch (resendError) {
      console.error(`[EmailSend] Resend failed for ${email.id}:`, resendError.message);
      // Fall through to SMTP relay or direct SMTP
    }
  }

  // Get credentials for relay/SMTP
  const credentials = await emailAccountsService.getCredentials(emailAccount.id);

  // Try SMTP Relay if configured (for Railway and other SMTP-blocked platforms)
  if (config.useSmtpRelay && credentials.type === 'password') {
    try {
      const result = await sendViaRelay({
        smtpHost: credentials.smtp.host,
        smtpPort: credentials.smtp.port || 465,
        smtpSecure: credentials.smtp.secure !== false,
        smtpUser: credentials.email,
        smtpPassword: credentials.password,
        from: fromAddress,
        to: toEmails,
        cc: ccEmails.length > 0 ? ccEmails : undefined,
        bcc: bccEmails.length > 0 ? bccEmails : undefined,
        replyTo: replyTo || emailAccount.replyTo,
        subject: processedSubject,
        text: processedText,
        html: processedHtml,
      });

      // Update status to SENT
      await prisma.email.update({
        where: { id: email.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          messageId: result.id,
        },
      });

      console.log(`[EmailSend] Email sent via SMTP Relay: ${email.id} to ${toEmails.join(', ')}`);

      return {
        success: true,
        emailId: email.id,
        messageId: result.id,
        trackingId,
        status: 'SENT',
        provider: 'smtp-relay',
      };
    } catch (relayError) {
      console.error(`[EmailSend] SMTP Relay failed for ${email.id}:`, relayError.message);
      // Fall through to direct SMTP
    }
  }

  // Try direct SMTP (works on VPS/self-hosted, blocked on Railway)
  try {
    const transporter = await getTransporter(emailAccount.id);

    const mailOptions = {
      from: fromAddress,
      to: toEmails.join(', '),
      cc: ccEmails.length > 0 ? ccEmails.join(', ') : undefined,
      bcc: bccEmails.length > 0 ? bccEmails.join(', ') : undefined,
      replyTo: replyTo || emailAccount.replyTo,
      subject: processedSubject,
      text: processedText,
      html: processedHtml,
      attachments: attachments.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
        cid: att.contentId,
      })),
    };

    // Send email via SMTP
    const info = await transporter.sendMail(mailOptions);

    // Update status to SENT
    await prisma.email.update({
      where: { id: email.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        messageId: info.messageId,
      },
    });

    console.log(`[EmailSend] Email sent via SMTP: ${email.id} to ${toEmails.join(', ')}`);

    return {
      success: true,
      emailId: email.id,
      messageId: info.messageId,
      trackingId,
      status: 'SENT',
      provider: 'smtp',
    };
  } catch (error) {
    console.error(`[EmailSend] SMTP failed for ${email.id}:`, error.message);

    // Update status to FAILED
    await prisma.email.update({
      where: { id: email.id },
      data: {
        status: 'FAILED',
        errorMessage: error.message,
      },
    });

    throw error;
  }
}

/**
 * Send email via Resend API
 */
async function sendViaResend({ from, to, cc, bcc, replyTo, subject, text, html }) {
  if (!resend) {
    throw new Error('Resend API key not configured');
  }

  const result = await resend.emails.send({
    from,
    to: Array.isArray(to) ? to : [to],
    cc,
    bcc,
    reply_to: replyTo,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(result.error.message || 'Resend API error');
  }

  return result.data;
}

/**
 * Send email via SMTP Relay (VPS proxy)
 */
async function sendViaRelay({
  smtpHost,
  smtpPort,
  smtpSecure,
  smtpUser,
  smtpPassword,
  from,
  to,
  cc,
  bcc,
  replyTo,
  subject,
  text,
  html,
}) {
  const response = await fetch(`${config.smtpRelayUrl}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.smtpRelayApiKey,
    },
    body: JSON.stringify({
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPassword,
      from,
      to: Array.isArray(to) ? to : [to],
      cc,
      bcc,
      replyTo,
      subject,
      text,
      html,
    }),
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error || 'SMTP Relay error');
  }

  return { id: result.messageId };
}

/**
 * Track email open event
 */
export async function trackEmailOpen(trackingId, { ipAddress, userAgent }) {
  const email = await prisma.email.findUnique({
    where: { trackingId },
  });

  if (!email) {
    console.warn(`[EmailTrack] Email not found for tracking ID: ${trackingId}`);
    return null;
  }

  // Create tracking event
  await prisma.emailTrackingEvent.create({
    data: {
      emailId: email.id,
      eventType: 'open',
      ipAddress,
      userAgent,
    },
  });

  // Update email stats
  const now = new Date();
  await prisma.email.update({
    where: { id: email.id },
    data: {
      opensCount: { increment: 1 },
      lastOpenedAt: now,
      firstOpenedAt: email.firstOpenedAt || now,
      status: email.status === 'SENT' || email.status === 'DELIVERED' ? 'OPENED' : email.status,
    },
  });

  console.log(`[EmailTrack] Open tracked for email: ${email.id}`);
  return email;
}

/**
 * Track email click event
 */
export async function trackEmailClick(trackingId, url, { ipAddress, userAgent }) {
  const email = await prisma.email.findUnique({
    where: { trackingId },
  });

  if (!email) {
    console.warn(`[EmailTrack] Email not found for tracking ID: ${trackingId}`);
    return null;
  }

  // Create tracking event
  await prisma.emailTrackingEvent.create({
    data: {
      emailId: email.id,
      eventType: 'click',
      eventData: { url },
      ipAddress,
      userAgent,
    },
  });

  // Update email stats
  await prisma.email.update({
    where: { id: email.id },
    data: {
      clicksCount: { increment: 1 },
      status: email.status === 'OPENED' ? 'CLICKED' : email.status,
    },
  });

  console.log(`[EmailTrack] Click tracked for email: ${email.id}, URL: ${url}`);
  return email;
}

/**
 * Get email by ID with tracking stats
 */
export async function getEmail(tenantId, emailId) {
  const email = await prisma.email.findFirst({
    where: { id: emailId, tenantId },
    include: {
      attachments: true,
      trackingEvents: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!email) {
    return null;
  }

  // Parse JSON fields
  return {
    ...email,
    toEmails: JSON.parse(email.toEmails),
    ccEmails: email.ccEmails ? JSON.parse(email.ccEmails) : [],
    bccEmails: email.bccEmails ? JSON.parse(email.bccEmails) : [],
  };
}

/**
 * Get emails for a tenant
 */
export async function getEmails(
  tenantId,
  { page = 1, limit = 25, status, direction, contactId, dealId, search } = {}
) {
  const where = { tenantId };

  if (status) where.status = status;
  if (direction) where.direction = direction;
  if (contactId) where.contactId = contactId;
  if (dealId) where.dealId = dealId;
  if (search) {
    where.OR = [
      { subject: { contains: search, mode: 'insensitive' } },
      { toEmails: { contains: search, mode: 'insensitive' } },
      { fromEmail: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [emails, total] = await Promise.all([
    prisma.email.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        fromEmail: true,
        fromName: true,
        toEmails: true,
        subject: true,
        status: true,
        direction: true,
        sentAt: true,
        receivedAt: true,
        createdAt: true,
        opensCount: true,
        clicksCount: true,
        trackOpens: true,
        trackClicks: true,
        contactId: true,
        dealId: true,
      },
    }),
    prisma.email.count({ where }),
  ]);

  return {
    emails: emails.map((e) => ({
      ...e,
      toEmails: JSON.parse(e.toEmails),
    })),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get email analytics for a tenant
 */
export async function getEmailAnalytics(tenantId, { startDate, endDate } = {}) {
  const where = { tenantId, direction: 'OUTBOUND' };

  if (startDate) {
    where.createdAt = { gte: new Date(startDate) };
  }
  if (endDate) {
    where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
  }

  const [totalSent, delivered, opened, clicked, bounced, failed] = await Promise.all([
    prisma.email.count({
      where: { ...where, status: { in: ['SENT', 'DELIVERED', 'OPENED', 'CLICKED'] } },
    }),
    prisma.email.count({ where: { ...where, status: { in: ['DELIVERED', 'OPENED', 'CLICKED'] } } }),
    prisma.email.count({ where: { ...where, status: { in: ['OPENED', 'CLICKED'] } } }),
    prisma.email.count({ where: { ...where, status: 'CLICKED' } }),
    prisma.email.count({ where: { ...where, status: 'BOUNCED' } }),
    prisma.email.count({ where: { ...where, status: 'FAILED' } }),
  ]);

  const openRate = totalSent > 0 ? Math.round((opened / totalSent) * 100) : 0;
  const clickRate = opened > 0 ? Math.round((clicked / opened) * 100) : 0;
  const bounceRate = totalSent > 0 ? Math.round((bounced / totalSent) * 100) : 0;

  return {
    totalSent,
    delivered,
    opened,
    clicked,
    bounced,
    failed,
    openRate,
    clickRate,
    bounceRate,
  };
}

/**
 * Delete an email
 */
export async function deleteEmail(tenantId, emailId) {
  const email = await prisma.email.findFirst({
    where: { id: emailId, tenantId },
  });

  if (!email) {
    throw new Error('Email not found');
  }

  await prisma.email.delete({
    where: { id: emailId },
  });

  return { success: true };
}

export const emailSendService = {
  sendEmail,
  trackEmailOpen,
  trackEmailClick,
  getEmail,
  getEmails,
  getEmailAnalytics,
  deleteEmail,
  processMergeTags,
};

export default emailSendService;
