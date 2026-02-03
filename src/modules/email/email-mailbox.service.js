/**
 * Email Mailbox Service
 * Manages email mailboxes (user@domain.com) for custom domains
 */

import { prisma } from '@crm360/database';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Get all mailboxes for a tenant
 */
export async function getMailboxes(tenantId, options = {}) {
  const { domainId, status, page = 1, limit = 50 } = options;

  const where = { tenantId };
  if (domainId) where.domainId = domainId;
  if (status) where.status = status;

  const [mailboxes, total] = await Promise.all([
    prisma.emailMailbox.findMany({
      where,
      include: {
        aliases: { where: { isActive: true } },
        _count: { select: { aliases: true, drafts: true, folders: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.emailMailbox.count({ where }),
  ]);

  // Get domain info for each mailbox
  const domainIds = [...new Set(mailboxes.map((m) => m.domainId))];
  const domains = await prisma.tenantEmailDomain.findMany({
    where: { id: { in: domainIds } },
    select: { id: true, domain: true, status: true },
  });
  const domainMap = Object.fromEntries(domains.map((d) => [d.id, d]));

  return {
    mailboxes: mailboxes.map((m) => ({
      id: m.id,
      email: m.email,
      localPart: m.localPart,
      displayName: m.displayName,
      status: m.status,
      quotaBytes: Number(m.quotaBytes),
      usedBytes: Number(m.usedBytes),
      usedPercent: Math.round((Number(m.usedBytes) / Number(m.quotaBytes)) * 100),
      domain: domainMap[m.domainId],
      autoResponderEnabled: m.autoResponderEnabled,
      forwardingEnabled: m.forwardingEnabled,
      forwardingAddress: m.forwardingAddress,
      isCatchAll: m.isCatchAll,
      aliasCount: m._count.aliases,
      userId: m.userId,
      createdAt: m.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a single mailbox
 */
export async function getMailbox(tenantId, mailboxId) {
  const mailbox = await prisma.emailMailbox.findFirst({
    where: { id: mailboxId, tenantId },
    include: {
      aliases: true,
      folders: { orderBy: { sortOrder: 'asc' } },
    },
  });

  if (!mailbox) {
    throw new Error('Mailbox not found');
  }

  // Get domain info
  const domain = await prisma.tenantEmailDomain.findUnique({
    where: { id: mailbox.domainId },
  });

  return {
    id: mailbox.id,
    email: mailbox.email,
    localPart: mailbox.localPart,
    displayName: mailbox.displayName,
    status: mailbox.status,
    quotaBytes: Number(mailbox.quotaBytes),
    usedBytes: Number(mailbox.usedBytes),
    domain: domain ? { id: domain.id, domain: domain.domain, status: domain.status } : null,
    autoResponder: {
      enabled: mailbox.autoResponderEnabled,
      subject: mailbox.autoResponderSubject,
      message: mailbox.autoResponderMessage,
      startAt: mailbox.autoResponderStartAt,
      endAt: mailbox.autoResponderEndAt,
    },
    forwarding: {
      enabled: mailbox.forwardingEnabled,
      address: mailbox.forwardingAddress,
      keepCopy: mailbox.forwardingKeepCopy,
    },
    isCatchAll: mailbox.isCatchAll,
    aliases: mailbox.aliases,
    folders: mailbox.folders,
    userId: mailbox.userId,
    createdAt: mailbox.createdAt,
  };
}

/**
 * Create a new mailbox
 */
export async function createMailbox(tenantId, userId, data) {
  const { domainId, localPart, displayName, password, quotaGB = 5 } = data;

  // Verify domain exists and is verified
  const domain = await prisma.tenantEmailDomain.findFirst({
    where: { id: domainId, tenantId },
  });

  if (!domain) {
    throw new Error('Domain not found');
  }

  if (domain.status !== 'VERIFIED') {
    throw new Error('Domain must be verified before creating mailboxes');
  }

  // Normalize local part
  const normalizedLocalPart = localPart.toLowerCase().trim();
  const email = `${normalizedLocalPart}@${domain.domain}`;

  // Check if email already exists
  const existing = await prisma.emailMailbox.findFirst({
    where: { tenantId, email },
  });

  if (existing) {
    throw new Error('Email address already exists');
  }

  // Check if alias/forwarder uses this email
  const aliasExists = await prisma.emailAlias.findFirst({
    where: { tenantId, email },
  });
  const forwarderExists = await prisma.emailForwarder.findFirst({
    where: { tenantId, email },
  });

  if (aliasExists || forwarderExists) {
    throw new Error('Email address is already used as an alias or forwarder');
  }

  // Hash password if provided
  let hashedPassword = null;
  if (password) {
    hashedPassword = await bcrypt.hash(password, 12);
  }

  // Create mailbox
  const mailbox = await prisma.emailMailbox.create({
    data: {
      tenantId,
      domainId,
      localPart: normalizedLocalPart,
      email,
      displayName: displayName || normalizedLocalPart,
      password: hashedPassword,
      quotaBytes: BigInt(quotaGB * 1024 * 1024 * 1024), // Convert GB to bytes
      createdById: userId,
    },
  });

  // Create default folders
  await prisma.emailFolder.createMany({
    data: [
      { tenantId, mailboxId: mailbox.id, name: 'Inbox', isSystem: true, sortOrder: 0 },
      { tenantId, mailboxId: mailbox.id, name: 'Sent', isSystem: true, sortOrder: 1 },
      { tenantId, mailboxId: mailbox.id, name: 'Drafts', isSystem: true, sortOrder: 2 },
      { tenantId, mailboxId: mailbox.id, name: 'Spam', isSystem: true, sortOrder: 3 },
      { tenantId, mailboxId: mailbox.id, name: 'Trash', isSystem: true, sortOrder: 4 },
    ],
  });

  return {
    id: mailbox.id,
    email: mailbox.email,
    displayName: mailbox.displayName,
    status: mailbox.status,
    domain: { id: domain.id, domain: domain.domain },
  };
}

/**
 * Update a mailbox
 */
export async function updateMailbox(tenantId, mailboxId, data) {
  const mailbox = await prisma.emailMailbox.findFirst({
    where: { id: mailboxId, tenantId },
  });

  if (!mailbox) {
    throw new Error('Mailbox not found');
  }

  const updateData = {};

  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.quotaGB !== undefined) updateData.quotaBytes = BigInt(data.quotaGB * 1024 * 1024 * 1024);
  if (data.userId !== undefined) updateData.userId = data.userId;

  // Password update
  if (data.password) {
    updateData.password = await bcrypt.hash(data.password, 12);
  }

  const updated = await prisma.emailMailbox.update({
    where: { id: mailboxId },
    data: updateData,
  });

  return updated;
}

/**
 * Update auto-responder settings
 */
export async function updateAutoResponder(tenantId, mailboxId, data) {
  const mailbox = await prisma.emailMailbox.findFirst({
    where: { id: mailboxId, tenantId },
  });

  if (!mailbox) {
    throw new Error('Mailbox not found');
  }

  const updated = await prisma.emailMailbox.update({
    where: { id: mailboxId },
    data: {
      autoResponderEnabled: data.enabled ?? mailbox.autoResponderEnabled,
      autoResponderSubject: data.subject ?? mailbox.autoResponderSubject,
      autoResponderMessage: data.message ?? mailbox.autoResponderMessage,
      autoResponderStartAt: data.startAt ? new Date(data.startAt) : mailbox.autoResponderStartAt,
      autoResponderEndAt: data.endAt ? new Date(data.endAt) : mailbox.autoResponderEndAt,
    },
  });

  return {
    enabled: updated.autoResponderEnabled,
    subject: updated.autoResponderSubject,
    message: updated.autoResponderMessage,
    startAt: updated.autoResponderStartAt,
    endAt: updated.autoResponderEndAt,
  };
}

/**
 * Update forwarding settings
 */
export async function updateForwarding(tenantId, mailboxId, data) {
  const mailbox = await prisma.emailMailbox.findFirst({
    where: { id: mailboxId, tenantId },
  });

  if (!mailbox) {
    throw new Error('Mailbox not found');
  }

  const updated = await prisma.emailMailbox.update({
    where: { id: mailboxId },
    data: {
      forwardingEnabled: data.enabled ?? mailbox.forwardingEnabled,
      forwardingAddress: data.address ?? mailbox.forwardingAddress,
      forwardingKeepCopy: data.keepCopy ?? mailbox.forwardingKeepCopy,
    },
  });

  return {
    enabled: updated.forwardingEnabled,
    address: updated.forwardingAddress,
    keepCopy: updated.forwardingKeepCopy,
  };
}

/**
 * Set catch-all mailbox for a domain
 */
export async function setCatchAll(tenantId, mailboxId, enabled) {
  const mailbox = await prisma.emailMailbox.findFirst({
    where: { id: mailboxId, tenantId },
  });

  if (!mailbox) {
    throw new Error('Mailbox not found');
  }

  // If enabling, disable other catch-all for the same domain
  if (enabled) {
    await prisma.emailMailbox.updateMany({
      where: { tenantId, domainId: mailbox.domainId, isCatchAll: true },
      data: { isCatchAll: false },
    });
  }

  const updated = await prisma.emailMailbox.update({
    where: { id: mailboxId },
    data: { isCatchAll: enabled },
  });

  return { isCatchAll: updated.isCatchAll };
}

/**
 * Delete a mailbox
 */
export async function deleteMailbox(tenantId, mailboxId) {
  const mailbox = await prisma.emailMailbox.findFirst({
    where: { id: mailboxId, tenantId },
  });

  if (!mailbox) {
    throw new Error('Mailbox not found');
  }

  // Delete related records (cascades will handle aliases, folders)
  await prisma.emailMailbox.delete({
    where: { id: mailboxId },
  });

  return { deleted: true, email: mailbox.email };
}

/**
 * Generate IMAP/SMTP credentials
 */
export async function generateCredentials(tenantId, mailboxId) {
  const mailbox = await prisma.emailMailbox.findFirst({
    where: { id: mailboxId, tenantId },
  });

  if (!mailbox) {
    throw new Error('Mailbox not found');
  }

  // Generate a new password
  const newPassword = crypto.randomBytes(16).toString('base64').slice(0, 20);
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.emailMailbox.update({
    where: { id: mailboxId },
    data: { password: hashedPassword },
  });

  return {
    email: mailbox.email,
    password: newPassword,
    imap: {
      host: 'imap.mail.nexora.io',
      port: 993,
      secure: true,
    },
    smtp: {
      host: 'smtp.mail.nexora.io',
      port: 587,
      secure: false,
    },
  };
}

export const emailMailboxService = {
  getMailboxes,
  getMailbox,
  createMailbox,
  updateMailbox,
  updateAutoResponder,
  updateForwarding,
  setCatchAll,
  deleteMailbox,
  generateCredentials,
};
