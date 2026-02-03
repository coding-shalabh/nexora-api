/**
 * White-Label Email Service
 * Manages tenant domains, templates, and email sending via Resend
 */

import { prisma } from '@crm360/database';
import { logger } from '../common/logger.js';
import { resendService } from './resend.service.js';

// ==================== DOMAIN MANAGEMENT ====================

/**
 * Add a domain for a tenant
 * Note: Domain must be verified in Resend dashboard first
 */
export async function addDomain(tenantId, domainName) {
  try {
    // Check if domain already exists for tenant
    const existing = await prisma.emailDomain.findUnique({
      where: { tenantId_domain: { tenantId, domain: domainName } },
    });

    if (existing) {
      return {
        success: false,
        error: 'Domain already exists',
        code: 'DOMAIN_EXISTS',
      };
    }

    // Try to add domain to Resend (may fail if API key doesn't have permission)
    let resendResult = null;
    let dnsRecords = null;
    let providerId = null;

    try {
      resendResult = await resendService.addDomain(domainName);
      if (resendResult.success) {
        dnsRecords = resendResult.dnsRecords;
        providerId = resendResult.domain?.id;
      }
    } catch (providerError) {
      // Provider API may not support domain management - continue with local storage
      logger.warn('Resend domain API not available, storing locally', {
        error: providerError.message,
      });
    }

    // If Resend API failed, provide standard DNS records for manual setup
    if (!dnsRecords) {
      dnsRecords = [
        {
          type: 'MX',
          name: `send.${domainName}`,
          value: 'feedback-smtp.us-east-1.amazonses.com',
          priority: 10,
          status: 'pending',
          note: 'Add this MX record in your DNS provider',
        },
        {
          type: 'TXT',
          name: domainName,
          value: 'v=spf1 include:amazonses.com ~all',
          status: 'pending',
          note: 'Add this SPF record in your DNS provider',
        },
        {
          type: 'TXT',
          name: `resend._domainkey.${domainName}`,
          value: '(DKIM value - verify in Resend dashboard)',
          status: 'pending',
          note: 'Get DKIM value from Resend dashboard: resend.com/domains',
        },
      ];
    }

    // Save domain to database
    const domain = await prisma.emailDomain.create({
      data: {
        tenantId,
        domain: domainName,
        status: 'PENDING',
        provider: 'resend',
        providerId,
        dnsRecords,
      },
    });

    logger.info('Domain added', { tenantId, domain: domainName });

    return {
      success: true,
      domain,
      dnsRecords,
      message: resendResult?.success
        ? 'Domain added. Please add the DNS records to verify.'
        : 'Domain added. Please verify this domain in Resend dashboard (resend.com/domains) and add DNS records.',
    };
  } catch (error) {
    logger.error('Add domain error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Verify domain DNS records
 * Can be triggered manually or via Resend API
 */
export async function verifyDomain(tenantId, domainId, manualVerify = false) {
  try {
    const domain = await prisma.emailDomain.findFirst({
      where: { id: domainId, tenantId },
    });

    if (!domain) {
      return {
        success: false,
        error: 'Domain not found',
        code: 'NOT_FOUND',
      };
    }

    let verified = false;
    let message = '';

    // If manual verification requested (user confirms they set up DNS in Resend)
    if (manualVerify) {
      verified = true;
      message =
        'Domain marked as verified. Make sure DNS records are properly configured in Resend dashboard.';
    } else if (domain.providerId) {
      // Try to verify with Resend API
      try {
        const resendResult = await resendService.verifyDomain(domain.providerId);
        verified = resendResult.success;
        message = resendResult.success
          ? 'Domain verified successfully'
          : 'Verification in progress. DNS records may take up to 48 hours to propagate.';
      } catch (apiError) {
        message =
          'Unable to verify via API. Please verify in Resend dashboard and use manual verification.';
      }
    } else {
      // No provider ID - ask user to manually verify
      message =
        'Please verify this domain in Resend dashboard (resend.com/domains), then use manual verification.';
    }

    // Update domain status
    const updatedDomain = await prisma.emailDomain.update({
      where: { id: domainId },
      data: {
        status: verified ? 'VERIFIED' : 'VERIFYING',
        lastCheckedAt: new Date(),
        verifiedAt: verified ? new Date() : null,
      },
    });

    return {
      success: verified,
      domain: updatedDomain,
      message,
    };
  } catch (error) {
    logger.error('Verify domain error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * List tenant domains
 */
export async function listDomains(tenantId) {
  try {
    const domains = await prisma.emailDomain.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      domains,
    };
  } catch (error) {
    logger.error('List domains error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get domain by ID
 */
export async function getDomain(tenantId, domainId) {
  try {
    const domain = await prisma.emailDomain.findFirst({
      where: { id: domainId, tenantId },
      include: {
        templates: { select: { id: true, name: true } },
        _count: { select: { emailLogs: true } },
      },
    });

    if (!domain) {
      return {
        success: false,
        error: 'Domain not found',
        code: 'NOT_FOUND',
      };
    }

    return {
      success: true,
      domain,
    };
  } catch (error) {
    logger.error('Get domain error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Delete domain
 */
export async function deleteDomain(tenantId, domainId) {
  try {
    const domain = await prisma.emailDomain.findFirst({
      where: { id: domainId, tenantId },
    });

    if (!domain) {
      return {
        success: false,
        error: 'Domain not found',
        code: 'NOT_FOUND',
      };
    }

    // Delete from database (templates will have domainId set to null)
    await prisma.emailDomain.delete({
      where: { id: domainId },
    });

    logger.info('Domain deleted', { tenantId, domain: domain.domain });

    return {
      success: true,
      message: 'Domain deleted',
    };
  } catch (error) {
    logger.error('Delete domain error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Set default domain
 */
export async function setDefaultDomain(tenantId, domainId) {
  try {
    // Unset any existing default
    await prisma.emailDomain.updateMany({
      where: { tenantId, isDefault: true },
      data: { isDefault: false },
    });

    // Set new default
    const domain = await prisma.emailDomain.update({
      where: { id: domainId },
      data: { isDefault: true },
    });

    return {
      success: true,
      domain,
    };
  } catch (error) {
    logger.error('Set default domain error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

// ==================== TEMPLATE MANAGEMENT ====================

/**
 * Create email template
 */
export async function createTemplate(tenantId, data) {
  try {
    const { name, subject, htmlContent, textContent, jsonContent, variables, category, domainId } =
      data;

    // Check for duplicate name
    const existing = await prisma.emailTemplate.findUnique({
      where: { tenantId_name: { tenantId, name } },
    });

    if (existing) {
      return {
        success: false,
        error: 'Template with this name already exists',
        code: 'DUPLICATE_NAME',
      };
    }

    const template = await prisma.emailTemplate.create({
      data: {
        tenantId,
        name,
        subject,
        htmlContent,
        textContent,
        jsonContent,
        variables,
        category,
        domainId,
        createdById: data.createdById,
      },
    });

    logger.info('Template created', { tenantId, templateId: template.id });

    return {
      success: true,
      template,
    };
  } catch (error) {
    logger.error('Create template error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Update email template
 */
export async function updateTemplate(tenantId, templateId, data) {
  try {
    const template = await prisma.emailTemplate.findFirst({
      where: { id: templateId, tenantId },
    });

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
        code: 'NOT_FOUND',
      };
    }

    // Check for duplicate name if name is being changed
    if (data.name && data.name !== template.name) {
      const existing = await prisma.emailTemplate.findUnique({
        where: { tenantId_name: { tenantId, name: data.name } },
      });

      if (existing) {
        return {
          success: false,
          error: 'Template with this name already exists',
          code: 'DUPLICATE_NAME',
        };
      }
    }

    const updated = await prisma.emailTemplate.update({
      where: { id: templateId },
      data: {
        name: data.name,
        subject: data.subject,
        htmlContent: data.htmlContent,
        textContent: data.textContent,
        jsonContent: data.jsonContent,
        variables: data.variables,
        category: data.category,
        domainId: data.domainId,
        isActive: data.isActive,
      },
    });

    return {
      success: true,
      template: updated,
    };
  } catch (error) {
    logger.error('Update template error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * List templates
 */
export async function listTemplates(tenantId, filters = {}) {
  try {
    const where = { tenantId };

    if (filters.category) where.category = filters.category;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.domainId) where.domainId = filters.domainId;

    const templates = await prisma.emailTemplate.findMany({
      where,
      include: {
        domain: { select: { id: true, domain: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      templates,
    };
  } catch (error) {
    logger.error('List templates error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get template by ID
 */
export async function getTemplate(tenantId, templateId) {
  try {
    const template = await prisma.emailTemplate.findFirst({
      where: { id: templateId, tenantId },
      include: {
        domain: { select: { id: true, domain: true, status: true } },
      },
    });

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
        code: 'NOT_FOUND',
      };
    }

    return {
      success: true,
      template,
    };
  } catch (error) {
    logger.error('Get template error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Delete template
 */
export async function deleteTemplate(tenantId, templateId) {
  try {
    const template = await prisma.emailTemplate.findFirst({
      where: { id: templateId, tenantId },
    });

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
        code: 'NOT_FOUND',
      };
    }

    await prisma.emailTemplate.delete({
      where: { id: templateId },
    });

    return {
      success: true,
      message: 'Template deleted',
    };
  } catch (error) {
    logger.error('Delete template error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

// ==================== EMAIL SENDING ====================

/**
 * Replace template variables with actual values
 */
function replaceVariables(content, variables) {
  if (!content || !variables) return content;

  let result = content;
  for (const [key, value] of Object.entries(variables)) {
    // Support both {{key}} and {key} syntax
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value || '');
  }
  return result;
}

/**
 * Send email using tenant's template and domain
 * @param {string} tenantId - Tenant ID
 * @param {object} data - Email data
 * @param {string} data.templateId - Template ID
 * @param {string} data.to - Recipient email
 * @param {object} data.variables - Template variables
 * @param {boolean} data.useTestDomain - Use Resend test domain (onboarding@resend.dev)
 */
export async function sendEmail(tenantId, data) {
  try {
    const { templateId, to, variables, contactId, fromName, replyTo, cc, bcc, useTestDomain } =
      data;

    // Get template
    const template = await prisma.emailTemplate.findFirst({
      where: { id: templateId, tenantId },
      include: { domain: true },
    });

    if (!template) {
      return {
        success: false,
        error: 'Template not found',
        code: 'TEMPLATE_NOT_FOUND',
      };
    }

    // Get domain (from template or default)
    let domain = template.domain;
    let fromEmail;
    let usingTestDomain = false;

    if (useTestDomain) {
      // Use Resend's test domain for testing
      fromEmail = 'onboarding@resend.dev';
      usingTestDomain = true;
    } else {
      if (!domain) {
        domain = await prisma.emailDomain.findFirst({
          where: { tenantId, isDefault: true, status: 'VERIFIED' },
        });
      }

      if (!domain || domain.status !== 'VERIFIED') {
        return {
          success: false,
          error:
            'No verified sending domain. Please verify a domain first, or use useTestDomain:true for testing.',
          code: 'NO_VERIFIED_DOMAIN',
        };
      }

      fromEmail = `${fromName || 'noreply'}@${domain.domain}`;
    }

    // Replace variables in content
    const htmlContent = replaceVariables(template.htmlContent, variables);
    const textContent = replaceVariables(template.textContent, variables);
    const subject = replaceVariables(template.subject, variables);

    // Create email log entry
    const emailLog = await prisma.emailLog.create({
      data: {
        tenantId,
        domainId: domain?.id || null,
        templateId: template.id,
        contactId,
        provider: 'resend',
        fromEmail,
        fromName: fromName || template.name,
        toEmail: to,
        subject,
        status: 'QUEUED',
        htmlContent,
        variables,
        metadata: usingTestDomain ? { testMode: true } : null,
      },
    });

    // Send via Resend
    const result = await resendService.sendEmail({
      from: usingTestDomain
        ? 'Nexora <onboarding@resend.dev>'
        : `${fromName || template.name} <${fromEmail}>`,
      to,
      subject,
      html: htmlContent,
      text: textContent,
      replyTo,
      cc,
      bcc,
    });

    // Update email log with result
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        providerEmailId: result.emailId,
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        failedAt: result.success ? null : new Date(),
        errorMessage: result.error,
        errorCode: result.code,
      },
    });

    // Update template stats
    if (result.success) {
      await prisma.emailTemplate.update({
        where: { id: template.id },
        data: { sentCount: { increment: 1 } },
      });
    }

    if (result.success) {
      logger.info('Email sent', {
        tenantId,
        emailLogId: emailLog.id,
        templateId,
        to,
      });

      return {
        success: true,
        emailId: emailLog.id,
        providerEmailId: result.emailId,
        message: 'Email sent successfully',
      };
    } else {
      return {
        success: false,
        error: result.error,
        code: result.code,
      };
    }
  } catch (error) {
    logger.error('Send email error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send email without template (raw HTML)
 */
export async function sendRawEmail(tenantId, data) {
  try {
    const {
      to,
      subject,
      html,
      text,
      domainId,
      contactId,
      fromName,
      replyTo,
      cc,
      bcc,
      useTestDomain,
    } = data;

    // Get domain
    let domain;
    let fromEmail;
    let usingTestDomain = false;

    if (useTestDomain) {
      // Use Resend's test domain for testing
      fromEmail = 'onboarding@resend.dev';
      usingTestDomain = true;
    } else {
      if (domainId) {
        domain = await prisma.emailDomain.findFirst({
          where: { id: domainId, tenantId, status: 'VERIFIED' },
        });
      } else {
        domain = await prisma.emailDomain.findFirst({
          where: { tenantId, isDefault: true, status: 'VERIFIED' },
        });
      }

      if (!domain) {
        return {
          success: false,
          error:
            'No verified sending domain. Please verify a domain first, or use useTestDomain:true for testing.',
          code: 'NO_VERIFIED_DOMAIN',
        };
      }

      fromEmail = `${fromName || 'noreply'}@${domain.domain}`;
    }

    // Create email log entry
    const emailLog = await prisma.emailLog.create({
      data: {
        tenantId,
        domainId: domain?.id || null,
        contactId,
        provider: 'resend',
        fromEmail,
        fromName: fromName || 'Nexora',
        toEmail: to,
        subject,
        status: 'QUEUED',
        htmlContent: html,
        metadata: usingTestDomain ? { testMode: true } : null,
      },
    });

    // Send via Resend
    const result = await resendService.sendEmail({
      from: usingTestDomain
        ? 'Nexora <onboarding@resend.dev>'
        : `${fromName || 'Nexora'} <${fromEmail}>`,
      to,
      subject,
      html,
      text,
      replyTo,
      cc,
      bcc,
    });

    // Update email log with result
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        providerEmailId: result.emailId,
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        failedAt: result.success ? null : new Date(),
        errorMessage: result.error,
        errorCode: result.code,
      },
    });

    if (result.success) {
      return {
        success: true,
        emailId: emailLog.id,
        providerEmailId: result.emailId,
        message: 'Email sent successfully',
      };
    } else {
      return {
        success: false,
        error: result.error,
        code: result.code,
      };
    }
  } catch (error) {
    logger.error('Send raw email error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get email logs
 */
export async function getEmailLogs(tenantId, filters = {}) {
  try {
    const where = { tenantId };

    if (filters.status) where.status = filters.status;
    if (filters.templateId) where.templateId = filters.templateId;
    if (filters.domainId) where.domainId = filters.domainId;
    if (filters.contactId) where.contactId = filters.contactId;

    const [logs, total] = await Promise.all([
      prisma.emailLog.findMany({
        where,
        include: {
          template: { select: { id: true, name: true } },
          domain: { select: { id: true, domain: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: filters.skip || 0,
        take: filters.limit || 50,
      }),
      prisma.emailLog.count({ where }),
    ]);

    return {
      success: true,
      logs,
      total,
      page: Math.floor((filters.skip || 0) / (filters.limit || 50)) + 1,
      pageSize: filters.limit || 50,
    };
  } catch (error) {
    logger.error('Get email logs error', { error: error.message });
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Update email status from webhook
 */
export async function updateEmailStatus(providerEmailId, status, metadata = {}) {
  try {
    const statusMap = {
      delivered: 'DELIVERED',
      opened: 'OPENED',
      clicked: 'CLICKED',
      bounced: 'BOUNCED',
      complained: 'SPAM',
    };

    const dbStatus = statusMap[status] || status.toUpperCase();

    const updateData = {
      status: dbStatus,
      metadata: { ...metadata, lastEvent: status, lastEventAt: new Date().toISOString() },
    };

    // Set timestamp based on status
    if (status === 'delivered') updateData.deliveredAt = new Date();
    if (status === 'opened') updateData.openedAt = new Date();
    if (status === 'clicked') updateData.clickedAt = new Date();
    if (status === 'bounced') updateData.bouncedAt = new Date();

    await prisma.emailLog.updateMany({
      where: { providerEmailId },
      data: updateData,
    });

    // Update template stats
    if (status === 'opened' || status === 'clicked' || status === 'bounced') {
      const emailLog = await prisma.emailLog.findFirst({
        where: { providerEmailId },
        select: { templateId: true },
      });

      if (emailLog?.templateId) {
        const statField =
          status === 'opened' ? 'openCount' : status === 'clicked' ? 'clickCount' : 'bounceCount';
        await prisma.emailTemplate.update({
          where: { id: emailLog.templateId },
          data: { [statField]: { increment: 1 } },
        });
      }
    }

    return { success: true };
  } catch (error) {
    logger.error('Update email status error', { error: error.message });
    return { success: false, error: error.message };
  }
}

// Export as service object
export const emailService = {
  // Domain management
  addDomain,
  verifyDomain,
  listDomains,
  getDomain,
  deleteDomain,
  setDefaultDomain,
  // Template management
  createTemplate,
  updateTemplate,
  listTemplates,
  getTemplate,
  deleteTemplate,
  // Email sending
  sendEmail,
  sendRawEmail,
  getEmailLogs,
  updateEmailStatus,
};

export default emailService;
