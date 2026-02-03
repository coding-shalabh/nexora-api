/**
 * Resend Email Service
 * Modern email sending via Resend API
 * Docs: https://resend.com/docs
 */

import { logger } from '../common/logger.js';

const RESEND_API_URL = 'https://api.resend.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

/**
 * Send a single email via Resend
 */
export async function sendEmail({
  from,
  to,
  subject,
  html,
  text,
  replyTo,
  cc,
  bcc,
  attachments,
  tags,
}) {
  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const payload = {
      from: from || 'Nexora <noreply@nexoraos.pro>',
      to: Array.isArray(to) ? to : [to],
      subject,
    };

    // Add content (prefer HTML)
    if (html) payload.html = html;
    if (text) payload.text = text;

    // Optional fields
    if (replyTo) payload.reply_to = replyTo;
    if (cc) payload.cc = Array.isArray(cc) ? cc : [cc];
    if (bcc) payload.bcc = Array.isArray(bcc) ? bcc : [bcc];
    if (tags) payload.tags = tags;

    // Attachments format: [{ filename, content (base64) }]
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments.map((att) => ({
        filename: att.filename,
        content: att.content, // base64 encoded
      }));
    }

    const response = await fetch(`${RESEND_API_URL}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error('Resend API error', { status: response.status, error: data });
      return {
        success: false,
        error: data.message || 'Failed to send email',
        code: data.name || 'SEND_FAILED',
      };
    }

    logger.info('Email sent via Resend', { emailId: data.id, to });

    return {
      success: true,
      emailId: data.id,
      message: 'Email sent successfully',
    };
  } catch (error) {
    logger.error('Resend send error', { error: error.message });
    return {
      success: false,
      error: error.message,
      code: 'RESEND_ERROR',
    };
  }
}

/**
 * Send batch emails (up to 100 at once)
 */
export async function sendBatchEmails(emails) {
  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    if (emails.length > 100) {
      throw new Error('Batch limit is 100 emails');
    }

    const response = await fetch(`${RESEND_API_URL}/emails/batch`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emails),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error('Resend batch API error', { status: response.status, error: data });
      return {
        success: false,
        error: data.message || 'Failed to send batch emails',
      };
    }

    logger.info('Batch emails sent via Resend', { count: emails.length });

    return {
      success: true,
      data: data.data,
      message: `${emails.length} emails queued successfully`,
    };
  } catch (error) {
    logger.error('Resend batch error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get email status by ID
 */
export async function getEmailStatus(emailId) {
  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const response = await fetch(`${RESEND_API_URL}/emails/${emailId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Failed to get email status',
      };
    }

    return {
      success: true,
      data: {
        id: data.id,
        from: data.from,
        to: data.to,
        subject: data.subject,
        status: data.last_event, // delivered, bounced, complained, etc.
        createdAt: data.created_at,
      },
    };
  } catch (error) {
    logger.error('Resend status error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * List domains
 */
export async function listDomains() {
  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const response = await fetch(`${RESEND_API_URL}/domains`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Failed to list domains',
      };
    }

    return {
      success: true,
      domains: data.data || [],
    };
  } catch (error) {
    logger.error('Resend list domains error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Add a domain for sending
 */
export async function addDomain(domain, region = 'us-east-1') {
  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const response = await fetch(`${RESEND_API_URL}/domains`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain, region }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Failed to add domain',
      };
    }

    return {
      success: true,
      domain: data,
      dnsRecords: data.records, // DNS records to add
    };
  } catch (error) {
    logger.error('Resend add domain error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verify domain DNS
 */
export async function verifyDomain(domainId) {
  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const response = await fetch(`${RESEND_API_URL}/domains/${domainId}/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Failed to verify domain',
      };
    }

    return {
      success: true,
      status: data.status,
      message: 'Domain verification initiated',
    };
  } catch (error) {
    logger.error('Resend verify domain error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get API key info / test connection
 */
export async function testConnection() {
  try {
    if (!RESEND_API_KEY) {
      return {
        success: false,
        error: 'RESEND_API_KEY not configured',
      };
    }

    const response = await fetch(`${RESEND_API_URL}/domains`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
    });

    if (!response.ok) {
      const data = await response.json();
      return {
        success: false,
        error: data.message || 'Connection failed',
      };
    }

    const data = await response.json();

    return {
      success: true,
      message: 'Resend connection successful',
      domainsCount: data.data?.length || 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Export as service object
export const resendService = {
  sendEmail,
  sendBatchEmails,
  getEmailStatus,
  listDomains,
  addDomain,
  verifyDomain,
  testConnection,
};

export default resendService;
