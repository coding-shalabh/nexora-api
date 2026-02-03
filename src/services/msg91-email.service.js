/**
 * MSG91 Email Service
 * Email sending via MSG91 API - Cost-effective for Indian market
 * Docs: https://docs.msg91.com/reference/send-email
 *
 * Pricing: ~₹2,000 for 100K emails (cheaper than Resend for high volume)
 *
 * IMPORTANT: MSG91 Email requires:
 * 1. Verified domain with DKIM records
 * 2. Approved email template
 */

import { logger } from '../common/logger.js';

// MSG91 uses control.msg91.com for email API (not api.msg91.com)
const MSG91_EMAIL_URL = 'https://control.msg91.com/api/v5/email';
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;

/**
 * Get headers for MSG91 Email API
 */
function getHeaders() {
  return {
    accept: 'application/json',
    'Content-Type': 'application/json',
    authkey: MSG91_AUTH_KEY,
  };
}

/**
 * Send a single email via MSG91
 * Requires a template_id - MSG91 works with pre-approved templates
 */
export async function sendEmail({
  from,
  fromName,
  to,
  domain,
  templateId,
  variables,
  replyTo,
  cc,
  bcc,
  attachments,
}) {
  try {
    if (!MSG91_AUTH_KEY) {
      throw new Error('MSG91_AUTH_KEY not configured');
    }

    if (!templateId) {
      throw new Error(
        'templateId is required for MSG91 email - create template in MSG91 dashboard first'
      );
    }

    if (!domain) {
      throw new Error('domain is required - use your verified MSG91 domain');
    }

    // Build recipients array - MSG91 format
    const toArray = Array.isArray(to) ? to : [to];
    const recipients = [
      {
        to: toArray.map((email) =>
          typeof email === 'object' ? email : { email, name: email.split('@')[0] }
        ),
        variables: variables || {},
      },
    ];

    // Add CC if provided
    if (cc) {
      const ccArray = Array.isArray(cc) ? cc : [cc];
      recipients[0].cc = ccArray.map((email) =>
        typeof email === 'object' ? email : { email, name: email.split('@')[0] }
      );
    }

    // Add BCC if provided
    if (bcc) {
      const bccArray = Array.isArray(bcc) ? bcc : [bcc];
      recipients[0].bcc = bccArray.map((email) =>
        typeof email === 'object' ? email : { email, name: email.split('@')[0] }
      );
    }

    const payload = {
      recipients,
      from: {
        email: from || `noreply@${domain}`,
        name: fromName || 'Nexora',
      },
      domain,
      template_id: templateId,
    };

    // Reply-to
    if (replyTo) {
      payload.reply_to = [{ email: replyTo }];
    }

    // Attachments - MSG91 supports file path URLs or base64
    if (attachments && attachments.length > 0) {
      payload.attachments = attachments.map((att) => ({
        fileName: att.filename,
        filePath: att.url || att.filePath, // URL to file
        ...(att.content && { fileData: att.content }), // or base64
      }));
    }

    const response = await fetch(`${MSG91_EMAIL_URL}/send`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (
      response.ok &&
      (data.message === 'success' || data.status === 'success' || data.request_id)
    ) {
      logger.info('Email sent via MSG91', {
        requestId: data.request_id,
        to: toArray,
      });

      return {
        success: true,
        emailId: data.request_id,
        message: 'Email sent successfully',
      };
    } else {
      logger.error('MSG91 Email API error', { status: response.status, error: data });
      return {
        success: false,
        error: data.message || data.msg || 'Failed to send email',
        code: data.code || 'SEND_FAILED',
      };
    }
  } catch (error) {
    logger.error('MSG91 email send error', { error: error.message });
    return {
      success: false,
      error: error.message,
      code: 'MSG91_ERROR',
    };
  }
}

/**
 * Send batch emails
 */
export async function sendBatchEmails(emails) {
  try {
    if (!MSG91_AUTH_KEY) {
      throw new Error('MSG91_AUTH_KEY not configured');
    }

    const results = [];
    const errors = [];

    for (const email of emails) {
      const result = await sendEmail(email);
      if (result.success) {
        results.push({ to: email.to, emailId: result.emailId });
      } else {
        errors.push({ to: email.to, error: result.error });
      }
    }

    if (errors.length === 0) {
      logger.info('Batch emails sent via MSG91', { count: results.length });
      return {
        success: true,
        data: results,
        message: `${results.length} emails sent successfully`,
      };
    } else if (results.length > 0) {
      return {
        success: true,
        data: results,
        errors,
        message: `${results.length} sent, ${errors.length} failed`,
      };
    } else {
      return {
        success: false,
        errors,
        error: 'All emails failed to send',
      };
    }
  } catch (error) {
    logger.error('MSG91 batch email error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get email logs/status
 */
export async function getEmailLogs(filters = {}) {
  try {
    if (!MSG91_AUTH_KEY) {
      throw new Error('MSG91_AUTH_KEY not configured');
    }

    const params = new URLSearchParams();
    if (filters.startDate) params.append('start_date', filters.startDate);
    if (filters.endDate) params.append('end_date', filters.endDate);
    if (filters.templateId) params.append('template_id', filters.templateId);
    if (filters.email) params.append('email', filters.email);

    const response = await fetch(`${MSG91_EMAIL_URL}/logs?${params.toString()}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        logs: data.data || data.logs || [],
        total: data.total,
      };
    } else {
      return {
        success: false,
        error: data.message || 'Failed to get email logs',
      };
    }
  } catch (error) {
    logger.error('MSG91 email logs error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get email templates from MSG91
 */
export async function getEmailTemplates() {
  try {
    if (!MSG91_AUTH_KEY) {
      throw new Error('MSG91_AUTH_KEY not configured');
    }

    const response = await fetch(`${MSG91_EMAIL_URL}/templates`, {
      method: 'GET',
      headers: getHeaders(),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        templates: data.data || data.templates || [],
      };
    } else {
      return {
        success: false,
        error: data.message || 'Failed to get templates',
      };
    }
  } catch (error) {
    logger.error('MSG91 email templates error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get verified domains
 */
export async function getDomains() {
  try {
    if (!MSG91_AUTH_KEY) {
      throw new Error('MSG91_AUTH_KEY not configured');
    }

    const response = await fetch(`${MSG91_EMAIL_URL}/domains`, {
      method: 'GET',
      headers: getHeaders(),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        domains: data.data || data.domains || [],
      };
    } else {
      return {
        success: false,
        error: data.message || 'Failed to get domains',
      };
    }
  } catch (error) {
    logger.error('MSG91 email domains error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Add a domain for verification
 */
export async function addDomain(domainName) {
  try {
    if (!MSG91_AUTH_KEY) {
      throw new Error('MSG91_AUTH_KEY not configured');
    }

    const response = await fetch(`${MSG91_EMAIL_URL}/domains`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ domain: domainName }),
    });

    const data = await response.json();

    if (response.ok && (data.status === 'success' || data.records)) {
      return {
        success: true,
        domain: data.domain || domainName,
        dnsRecords: data.records || data.dns_records,
        message: 'Domain added. Please add the DNS records (SPF, DKIM, DMARC) to verify.',
      };
    } else {
      return {
        success: false,
        error: data.message || 'Failed to add domain',
      };
    }
  } catch (error) {
    logger.error('MSG91 add domain error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verify domain DNS records
 */
export async function verifyDomain(domainName) {
  try {
    if (!MSG91_AUTH_KEY) {
      throw new Error('MSG91_AUTH_KEY not configured');
    }

    const response = await fetch(
      `${MSG91_EMAIL_URL}/domains/${encodeURIComponent(domainName)}/verify`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );

    const data = await response.json();

    if (response.ok && (data.status === 'success' || data.verified)) {
      return {
        success: true,
        verified: data.verified || true,
        status: data.status,
        message: 'Domain verification initiated',
      };
    } else {
      return {
        success: false,
        error: data.message || 'Failed to verify domain',
      };
    }
  } catch (error) {
    logger.error('MSG91 verify domain error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Test API connection
 */
export async function testConnection() {
  try {
    if (!MSG91_AUTH_KEY) {
      return {
        success: false,
        error: 'MSG91_AUTH_KEY not configured',
      };
    }

    // Test by fetching domains
    const response = await fetch(`${MSG91_EMAIL_URL}/domains`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        message: 'MSG91 Email connection successful',
        domainsCount: data.data?.length || data.domains?.length || 0,
      };
    } else {
      const data = await response.json();
      return {
        success: false,
        error: data.message || 'Connection failed',
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Export as service object
export const msg91EmailService = {
  sendEmail,
  sendBatchEmails,
  getEmailLogs,
  getEmailTemplates,
  getDomains,
  addDomain,
  verifyDomain,
  testConnection,
};

export default msg91EmailService;
