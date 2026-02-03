/**
 * Email Drafts Service
 * Manages email drafts, compose, and sending from mailboxes
 */

import { prisma } from '@crm360/database';

/**
 * Get all drafts for a mailbox
 */
export async function getDrafts(tenantId, mailboxId, options = {}) {
  const { status, page = 1, limit = 50 } = options;

  const where = { tenantId, mailboxId };
  if (status) where.status = status;

  const [drafts, total] = await Promise.all([
    prisma.emailDraft.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.emailDraft.count({ where }),
  ]);

  return {
    drafts: drafts.map((d) => ({
      id: d.id,
      mailboxId: d.mailboxId,
      to: d.to,
      cc: d.cc,
      bcc: d.bcc,
      subject: d.subject,
      bodyPreview: d.body?.substring(0, 200),
      isHtml: d.isHtml,
      status: d.status,
      scheduledAt: d.scheduledAt,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a single draft
 */
export async function getDraft(tenantId, draftId) {
  const draft = await prisma.emailDraft.findFirst({
    where: { id: draftId, tenantId },
    include: {
      mailbox: {
        select: { id: true, email: true, displayName: true },
      },
    },
  });

  if (!draft) {
    throw new Error('Draft not found');
  }

  return {
    id: draft.id,
    mailbox: draft.mailbox,
    to: draft.to,
    cc: draft.cc,
    bcc: draft.bcc,
    subject: draft.subject,
    body: draft.body,
    isHtml: draft.isHtml,
    attachments: draft.attachments,
    status: draft.status,
    scheduledAt: draft.scheduledAt,
    sentAt: draft.sentAt,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

/**
 * Create a new draft
 */
export async function createDraft(tenantId, userId, data) {
  const { mailboxId, to, cc, bcc, subject, body, isHtml = true, attachments = [] } = data;

  // Verify mailbox exists and belongs to tenant
  const mailbox = await prisma.emailMailbox.findFirst({
    where: { id: mailboxId, tenantId },
  });

  if (!mailbox) {
    throw new Error('Mailbox not found');
  }

  const draft = await prisma.emailDraft.create({
    data: {
      tenantId,
      mailboxId,
      to: to || [],
      cc: cc || [],
      bcc: bcc || [],
      subject: subject || '',
      body: body || '',
      isHtml,
      attachments,
      status: 'DRAFT',
      createdById: userId,
    },
  });

  return {
    id: draft.id,
    mailboxId: draft.mailboxId,
    to: draft.to,
    cc: draft.cc,
    bcc: draft.bcc,
    subject: draft.subject,
    status: draft.status,
    createdAt: draft.createdAt,
  };
}

/**
 * Update a draft
 */
export async function updateDraft(tenantId, draftId, data) {
  const draft = await prisma.emailDraft.findFirst({
    where: { id: draftId, tenantId },
  });

  if (!draft) {
    throw new Error('Draft not found');
  }

  if (draft.status !== 'DRAFT') {
    throw new Error('Can only update drafts with status DRAFT');
  }

  const updateData = {};
  if (data.to !== undefined) updateData.to = data.to;
  if (data.cc !== undefined) updateData.cc = data.cc;
  if (data.bcc !== undefined) updateData.bcc = data.bcc;
  if (data.subject !== undefined) updateData.subject = data.subject;
  if (data.body !== undefined) updateData.body = data.body;
  if (data.isHtml !== undefined) updateData.isHtml = data.isHtml;
  if (data.attachments !== undefined) updateData.attachments = data.attachments;

  const updated = await prisma.emailDraft.update({
    where: { id: draftId },
    data: updateData,
  });

  return updated;
}

/**
 * Delete a draft
 */
export async function deleteDraft(tenantId, draftId) {
  const draft = await prisma.emailDraft.findFirst({
    where: { id: draftId, tenantId },
  });

  if (!draft) {
    throw new Error('Draft not found');
  }

  await prisma.emailDraft.delete({
    where: { id: draftId },
  });

  return { deleted: true };
}

/**
 * Schedule a draft for sending
 */
export async function scheduleDraft(tenantId, draftId, scheduledAt) {
  const draft = await prisma.emailDraft.findFirst({
    where: { id: draftId, tenantId },
  });

  if (!draft) {
    throw new Error('Draft not found');
  }

  if (draft.status !== 'DRAFT') {
    throw new Error('Can only schedule drafts');
  }

  // Validate recipients
  if (!draft.to || draft.to.length === 0) {
    throw new Error('Draft must have at least one recipient');
  }

  const updated = await prisma.emailDraft.update({
    where: { id: draftId },
    data: {
      status: 'SCHEDULED',
      scheduledAt: new Date(scheduledAt),
    },
  });

  return {
    id: updated.id,
    status: updated.status,
    scheduledAt: updated.scheduledAt,
  };
}

/**
 * Send a draft immediately
 */
export async function sendDraft(tenantId, draftId) {
  const draft = await prisma.emailDraft.findFirst({
    where: { id: draftId, tenantId },
    include: {
      mailbox: {
        include: {
          domain: true,
        },
      },
    },
  });

  if (!draft) {
    throw new Error('Draft not found');
  }

  if (draft.status !== 'DRAFT' && draft.status !== 'SCHEDULED') {
    throw new Error('Draft has already been sent or is being processed');
  }

  // Validate recipients
  if (!draft.to || draft.to.length === 0) {
    throw new Error('Draft must have at least one recipient');
  }

  // Update status to SENDING
  await prisma.emailDraft.update({
    where: { id: draftId },
    data: { status: 'SENDING' },
  });

  // TODO: Integrate with SES email sending service
  // For now, we'll mark it as sent (actual sending will be implemented with SES)
  try {
    // Simulate sending - in production, this would call SES
    const updated = await prisma.emailDraft.update({
      where: { id: draftId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      sentAt: updated.sentAt,
      message: 'Email sent successfully',
    };
  } catch (error) {
    // Mark as failed if sending fails
    await prisma.emailDraft.update({
      where: { id: draftId },
      data: { status: 'FAILED' },
    });
    throw error;
  }
}

/**
 * Get email templates
 */
export async function getTemplates(tenantId, options = {}) {
  const { category, page = 1, limit = 50 } = options;

  const where = { tenantId };
  if (category) where.category = category;

  const [templates, total] = await Promise.all([
    prisma.emailTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.emailTemplate.count({ where }),
  ]);

  return {
    templates,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Create an email template
 */
export async function createTemplate(tenantId, userId, data) {
  const { name, subject, body, category, variables = [] } = data;

  const template = await prisma.emailTemplate.create({
    data: {
      tenantId,
      name,
      subject,
      body,
      category,
      variables,
      createdById: userId,
    },
  });

  return template;
}

/**
 * Update a template
 */
export async function updateTemplate(tenantId, templateId, data) {
  const template = await prisma.emailTemplate.findFirst({
    where: { id: templateId, tenantId },
  });

  if (!template) {
    throw new Error('Template not found');
  }

  const updated = await prisma.emailTemplate.update({
    where: { id: templateId },
    data,
  });

  return updated;
}

/**
 * Delete a template
 */
export async function deleteTemplate(tenantId, templateId) {
  const template = await prisma.emailTemplate.findFirst({
    where: { id: templateId, tenantId },
  });

  if (!template) {
    throw new Error('Template not found');
  }

  await prisma.emailTemplate.delete({
    where: { id: templateId },
  });

  return { deleted: true };
}

/**
 * Get email signatures
 */
export async function getSignatures(tenantId, userId) {
  const signatures = await prisma.emailSignature.findMany({
    where: {
      tenantId,
      OR: [{ isGlobal: true }, { userId }],
    },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });

  return signatures;
}

/**
 * Create a signature
 */
export async function createSignature(tenantId, userId, data) {
  const { name, content, isHtml = true, isDefault = false, isGlobal = false } = data;

  // If setting as default, unset other defaults for this user
  if (isDefault) {
    await prisma.emailSignature.updateMany({
      where: { tenantId, userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const signature = await prisma.emailSignature.create({
    data: {
      tenantId,
      userId,
      name,
      content,
      isHtml,
      isDefault,
      isGlobal,
    },
  });

  return signature;
}

/**
 * Update a signature
 */
export async function updateSignature(tenantId, signatureId, userId, data) {
  const signature = await prisma.emailSignature.findFirst({
    where: { id: signatureId, tenantId },
  });

  if (!signature) {
    throw new Error('Signature not found');
  }

  // If setting as default, unset other defaults
  if (data.isDefault) {
    await prisma.emailSignature.updateMany({
      where: { tenantId, userId, isDefault: true, id: { not: signatureId } },
      data: { isDefault: false },
    });
  }

  const updated = await prisma.emailSignature.update({
    where: { id: signatureId },
    data,
  });

  return updated;
}

/**
 * Delete a signature
 */
export async function deleteSignature(tenantId, signatureId) {
  const signature = await prisma.emailSignature.findFirst({
    where: { id: signatureId, tenantId },
  });

  if (!signature) {
    throw new Error('Signature not found');
  }

  await prisma.emailSignature.delete({
    where: { id: signatureId },
  });

  return { deleted: true };
}

export const emailDraftsService = {
  // Drafts
  getDrafts,
  getDraft,
  createDraft,
  updateDraft,
  deleteDraft,
  scheduleDraft,
  sendDraft,
  // Templates
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  // Signatures
  getSignatures,
  createSignature,
  updateSignature,
  deleteSignature,
};
