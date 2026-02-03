import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { prisma } from '@crm360/database';

// Initialize SES client
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Default from email
const DEFAULT_FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@helixcode.in';

/**
 * Send a single email via AWS SES
 */
export async function sendEmail({ to, from = DEFAULT_FROM_EMAIL, replyTo, subject, html, text }) {
  const toAddresses = Array.isArray(to) ? to : [to];

  const command = new SendEmailCommand({
    Source: from,
    Destination: {
      ToAddresses: toAddresses,
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8',
      },
      Body: {
        ...(html && {
          Html: {
            Data: html,
            Charset: 'UTF-8',
          },
        }),
        ...(text && {
          Text: {
            Data: text,
            Charset: 'UTF-8',
          },
        }),
      },
    },
    ...(replyTo && {
      ReplyToAddresses: Array.isArray(replyTo) ? replyTo : [replyTo],
    }),
  });

  const response = await sesClient.send(command);

  return {
    messageId: response.MessageId,
    success: true,
  };
}

/**
 * Send bulk emails via AWS SES (up to 50 per call)
 */
export async function sendBulkEmails({
  recipients, // Array of { email, variables }
  from = DEFAULT_FROM_EMAIL,
  subject,
  html,
  text,
}) {
  const results = [];
  const batchSize = 50; // SES limit

  // Process in batches
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);

    // Send each email in batch
    const batchPromises = batch.map(async (recipient) => {
      try {
        // Replace variables in content
        let personalizedHtml = html;
        let personalizedSubject = subject;

        if (recipient.variables) {
          Object.entries(recipient.variables).forEach(([key, value]) => {
            const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
            personalizedHtml = personalizedHtml.replace(regex, value || '');
            personalizedSubject = personalizedSubject.replace(regex, value || '');
          });
        }

        const result = await sendEmail({
          to: recipient.email,
          from,
          subject: personalizedSubject,
          html: personalizedHtml,
          text,
        });

        return {
          email: recipient.email,
          success: true,
          messageId: result.messageId,
        };
      } catch (error) {
        return {
          email: recipient.email,
          success: false,
          error: error.message,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Rate limiting: wait between batches (SES has 14 emails/sec limit by default)
    if (i + batchSize < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return {
    total: recipients.length,
    successful: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

/**
 * Get or create email credit balance for a tenant
 */
export async function getEmailCredits(tenantId) {
  let balance = await prisma.emailCreditBalance.findUnique({
    where: { tenantId },
  });

  // Create balance record if doesn't exist
  if (!balance) {
    balance = await prisma.emailCreditBalance.create({
      data: {
        tenantId,
        totalCredits: 0,
        usedCredits: 0,
        freeQuota: 500,
        freeUsedThisMonth: 0,
      },
    });
  }

  // Check if monthly reset is needed
  const now = new Date();
  const lastReset = balance.lastResetAt;
  if (!lastReset || isNewMonth(lastReset, now)) {
    balance = await prisma.emailCreditBalance.update({
      where: { tenantId },
      data: {
        freeUsedThisMonth: 0,
        lastResetAt: now,
      },
    });
  }

  const availableCredits = balance.totalCredits - balance.usedCredits;
  const freeRemaining = Math.max(0, balance.freeQuota - balance.freeUsedThisMonth);

  return {
    credits: availableCredits,
    usedThisMonth: balance.freeUsedThisMonth,
    freeQuota: balance.freeQuota,
    freeRemaining,
    totalAvailable: availableCredits + freeRemaining,
    totalPurchased: balance.totalCredits,
    totalUsed: balance.usedCredits,
    lastResetDate: balance.lastResetAt,
  };
}

/**
 * Deduct email credits for a tenant
 */
export async function deductEmailCredits(tenantId, count, metadata = {}) {
  const balance = await prisma.emailCreditBalance.findUnique({
    where: { tenantId },
  });

  if (!balance) {
    throw new Error('No credit balance found for tenant');
  }

  const availableCredits = balance.totalCredits - balance.usedCredits;
  const freeRemaining = Math.max(0, balance.freeQuota - balance.freeUsedThisMonth);

  // Check if within free quota first
  const freeToUse = Math.min(count, freeRemaining);
  const paidToUse = count - freeToUse;

  // Check if enough paid credits
  if (paidToUse > availableCredits) {
    throw new Error(`Insufficient email credits. Need ${paidToUse}, have ${availableCredits}`);
  }

  // Update balance
  await prisma.emailCreditBalance.update({
    where: { tenantId },
    data: {
      usedCredits: balance.usedCredits + paidToUse,
      freeUsedThisMonth: balance.freeUsedThisMonth + freeToUse,
    },
  });

  // Log usage
  await prisma.emailUsageLog.create({
    data: {
      tenantId,
      userId: metadata.userId,
      campaignId: metadata.campaignId,
      emailsSent: count,
      creditsUsed: paidToUse,
      freeCreditsUsed: freeToUse,
      subject: metadata.subject,
      fromEmail: metadata.from,
      metadata: metadata.extra ? metadata.extra : undefined,
    },
  });

  return {
    creditsUsed: paidToUse,
    freeUsed: freeToUse,
    remainingCredits: availableCredits - paidToUse,
    remainingFreeQuota: freeRemaining - freeToUse,
  };
}

/**
 * Add email credits to a tenant (purchase)
 */
export async function addEmailCredits(tenantId, count, options = {}) {
  const {
    userId,
    planId,
    paymentId,
    paymentMethod,
    type = 'PURCHASE',
    notes,
    amountPaid = 0,
    currency = 'INR',
  } = options;

  // Get or create balance
  let balance = await prisma.emailCreditBalance.findUnique({
    where: { tenantId },
  });

  if (!balance) {
    balance = await prisma.emailCreditBalance.create({
      data: {
        tenantId,
        totalCredits: 0,
        usedCredits: 0,
        freeQuota: 500,
        freeUsedThisMonth: 0,
      },
    });
  }

  // Update balance
  await prisma.emailCreditBalance.update({
    where: { tenantId },
    data: {
      totalCredits: balance.totalCredits + count,
    },
  });

  // Create purchase record
  const purchase = await prisma.emailCreditPurchase.create({
    data: {
      tenantId,
      userId: userId || 'system',
      planId,
      credits: count,
      amountPaid,
      currency,
      paymentMethod,
      paymentId,
      type,
      notes,
      status: 'COMPLETED',
    },
  });

  return {
    added: count,
    newBalance: balance.totalCredits + count,
    purchaseId: purchase.id,
  };
}

/**
 * Get all email credit plans
 */
export async function getEmailPlans() {
  return prisma.emailCreditPlan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

/**
 * Get purchase history for a tenant
 */
export async function getPurchaseHistory(tenantId, options = {}) {
  const { page = 1, limit = 20 } = options;

  const [purchases, total] = await Promise.all([
    prisma.emailCreditPurchase.findMany({
      where: { tenantId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.emailCreditPurchase.count({ where: { tenantId } }),
  ]);

  return {
    purchases,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get usage history for a tenant
 */
export async function getUsageHistory(tenantId, options = {}) {
  const { page = 1, limit = 20, startDate, endDate } = options;

  const where = { tenantId };
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) where.createdAt.lte = new Date(endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.emailUsageLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.emailUsageLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get usage summary for a tenant
 */
export async function getUsageSummary(tenantId, period = 'month') {
  const now = new Date();
  let startDate;

  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const logs = await prisma.emailUsageLog.findMany({
    where: {
      tenantId,
      createdAt: { gte: startDate },
    },
  });

  return {
    period,
    startDate,
    endDate: now,
    totalSent: logs.reduce((sum, l) => sum + l.emailsSent, 0),
    totalFailed: logs.reduce((sum, l) => sum + l.emailsFailed, 0),
    creditsUsed: logs.reduce((sum, l) => sum + l.creditsUsed, 0),
    freeCreditsUsed: logs.reduce((sum, l) => sum + l.freeCreditsUsed, 0),
    campaigns: logs.filter((l) => l.campaignId).length,
  };
}

/**
 * Reset monthly free quota for all tenants (cron job)
 */
export async function resetMonthlyQuotas() {
  const result = await prisma.emailCreditBalance.updateMany({
    data: {
      freeUsedThisMonth: 0,
      lastResetAt: new Date(),
    },
  });

  return { reset: result.count };
}

/**
 * Send campaign email with tracking
 */
export async function sendCampaignEmail({
  tenantId,
  userId,
  campaignId,
  recipients,
  from,
  subject,
  html,
  trackOpens = true,
  trackClicks = true,
}) {
  // Check credits first
  const credits = await getEmailCredits(tenantId);
  const totalNeeded = recipients.length;

  if (totalNeeded > credits.totalAvailable) {
    throw new Error(
      `Insufficient credits. Need ${totalNeeded}, available ${credits.totalAvailable}`
    );
  }

  // Add tracking to HTML if enabled
  let trackedHtml = html;

  if (trackOpens || trackClicks) {
    const apiUrl = process.env.API_URL || 'https://api.nexoraos.pro';
    // TODO: Add tracking pixel and link rewriting
  }

  // Send emails
  const result = await sendBulkEmails({
    recipients,
    from,
    subject,
    html: trackedHtml,
  });

  // Deduct credits for successful sends
  if (result.successful > 0) {
    await deductEmailCredits(tenantId, result.successful, {
      userId,
      campaignId,
      subject,
      from,
    });
  }

  return result;
}

// Helper function to check if it's a new month
function isNewMonth(lastDate, currentDate) {
  return (
    lastDate.getMonth() !== currentDate.getMonth() ||
    lastDate.getFullYear() !== currentDate.getFullYear()
  );
}

export const sesEmailService = {
  sendEmail,
  sendBulkEmails,
  getEmailCredits,
  deductEmailCredits,
  addEmailCredits,
  getEmailPlans,
  getPurchaseHistory,
  getUsageHistory,
  getUsageSummary,
  resetMonthlyQuotas,
  sendCampaignEmail,
};
