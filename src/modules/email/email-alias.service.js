/**
 * Email Alias & Forwarder Service
 * Manages email aliases and forwarders for custom domains
 */

import { prisma } from '@crm360/database';

// ==================== ALIASES ====================

/**
 * Get all aliases for a tenant
 */
export async function getAliases(tenantId, options = {}) {
  const { mailboxId, domainId, page = 1, limit = 50 } = options;

  const where = { tenantId };
  if (mailboxId) where.mailboxId = mailboxId;
  if (domainId) where.domainId = domainId;

  const [aliases, total] = await Promise.all([
    prisma.emailAlias.findMany({
      where,
      include: {
        mailbox: {
          select: { id: true, email: true, displayName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.emailAlias.count({ where }),
  ]);

  // Get domain info
  const domainIds = [...new Set(aliases.map((a) => a.domainId))];
  const domains = await prisma.tenantEmailDomain.findMany({
    where: { id: { in: domainIds } },
    select: { id: true, domain: true },
  });
  const domainMap = Object.fromEntries(domains.map((d) => [d.id, d]));

  return {
    aliases: aliases.map((a) => ({
      id: a.id,
      email: a.email,
      localPart: a.localPart,
      domain: domainMap[a.domainId],
      targetMailbox: a.mailbox,
      isActive: a.isActive,
      createdAt: a.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Create a new alias
 */
export async function createAlias(tenantId, userId, data) {
  const { mailboxId, domainId, localPart } = data;

  // Verify mailbox exists
  const mailbox = await prisma.emailMailbox.findFirst({
    where: { id: mailboxId, tenantId },
  });

  if (!mailbox) {
    throw new Error('Target mailbox not found');
  }

  // Get domain
  const domain = await prisma.tenantEmailDomain.findFirst({
    where: { id: domainId, tenantId },
  });

  if (!domain) {
    throw new Error('Domain not found');
  }

  if (domain.status !== 'VERIFIED') {
    throw new Error('Domain must be verified before creating aliases');
  }

  // Normalize and create email
  const normalizedLocalPart = localPart.toLowerCase().trim();
  const email = `${normalizedLocalPart}@${domain.domain}`;

  // Check if email already exists
  const existingMailbox = await prisma.emailMailbox.findFirst({
    where: { tenantId, email },
  });
  const existingAlias = await prisma.emailAlias.findFirst({
    where: { tenantId, email },
  });
  const existingForwarder = await prisma.emailForwarder.findFirst({
    where: { tenantId, email },
  });

  if (existingMailbox || existingAlias || existingForwarder) {
    throw new Error('Email address already exists');
  }

  const alias = await prisma.emailAlias.create({
    data: {
      tenantId,
      mailboxId,
      domainId,
      localPart: normalizedLocalPart,
      email,
      createdById: userId,
    },
    include: {
      mailbox: {
        select: { id: true, email: true, displayName: true },
      },
    },
  });

  return {
    id: alias.id,
    email: alias.email,
    targetMailbox: alias.mailbox,
    domain: { id: domain.id, domain: domain.domain },
  };
}

/**
 * Update an alias
 */
export async function updateAlias(tenantId, aliasId, data) {
  const alias = await prisma.emailAlias.findFirst({
    where: { id: aliasId, tenantId },
  });

  if (!alias) {
    throw new Error('Alias not found');
  }

  const updateData = {};
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.mailboxId) {
    // Verify new mailbox exists
    const mailbox = await prisma.emailMailbox.findFirst({
      where: { id: data.mailboxId, tenantId },
    });
    if (!mailbox) {
      throw new Error('Target mailbox not found');
    }
    updateData.mailboxId = data.mailboxId;
  }

  const updated = await prisma.emailAlias.update({
    where: { id: aliasId },
    data: updateData,
    include: {
      mailbox: {
        select: { id: true, email: true, displayName: true },
      },
    },
  });

  return updated;
}

/**
 * Delete an alias
 */
export async function deleteAlias(tenantId, aliasId) {
  const alias = await prisma.emailAlias.findFirst({
    where: { id: aliasId, tenantId },
  });

  if (!alias) {
    throw new Error('Alias not found');
  }

  await prisma.emailAlias.delete({
    where: { id: aliasId },
  });

  return { deleted: true, email: alias.email };
}

// ==================== FORWARDERS ====================

/**
 * Get all forwarders for a tenant
 */
export async function getForwarders(tenantId, options = {}) {
  const { domainId, page = 1, limit = 50 } = options;

  const where = { tenantId };
  if (domainId) where.domainId = domainId;

  const [forwarders, total] = await Promise.all([
    prisma.emailForwarder.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.emailForwarder.count({ where }),
  ]);

  // Get domain info
  const domainIds = [...new Set(forwarders.map((f) => f.domainId))];
  const domains = await prisma.tenantEmailDomain.findMany({
    where: { id: { in: domainIds } },
    select: { id: true, domain: true },
  });
  const domainMap = Object.fromEntries(domains.map((d) => [d.id, d]));

  return {
    forwarders: forwarders.map((f) => ({
      id: f.id,
      email: f.email,
      localPart: f.localPart,
      domain: domainMap[f.domainId],
      forwardTo: f.forwardTo,
      keepCopy: f.keepCopy,
      isActive: f.isActive,
      createdAt: f.createdAt,
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Create a new forwarder
 */
export async function createForwarder(tenantId, userId, data) {
  const { domainId, localPart, forwardTo, keepCopy = false } = data;

  // Get domain
  const domain = await prisma.tenantEmailDomain.findFirst({
    where: { id: domainId, tenantId },
  });

  if (!domain) {
    throw new Error('Domain not found');
  }

  if (domain.status !== 'VERIFIED') {
    throw new Error('Domain must be verified before creating forwarders');
  }

  // Normalize and create email
  const normalizedLocalPart = localPart.toLowerCase().trim();
  const email = `${normalizedLocalPart}@${domain.domain}`;

  // Check if email already exists
  const existingMailbox = await prisma.emailMailbox.findFirst({
    where: { tenantId, email },
  });
  const existingAlias = await prisma.emailAlias.findFirst({
    where: { tenantId, email },
  });
  const existingForwarder = await prisma.emailForwarder.findFirst({
    where: { tenantId, email },
  });

  if (existingMailbox || existingAlias || existingForwarder) {
    throw new Error('Email address already exists');
  }

  // Validate forward-to addresses
  const validForwardTo = forwardTo.filter((email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  });

  if (validForwardTo.length === 0) {
    throw new Error('At least one valid forward-to address is required');
  }

  const forwarder = await prisma.emailForwarder.create({
    data: {
      tenantId,
      domainId,
      localPart: normalizedLocalPart,
      email,
      forwardTo: validForwardTo,
      keepCopy,
      createdById: userId,
    },
  });

  return {
    id: forwarder.id,
    email: forwarder.email,
    forwardTo: forwarder.forwardTo,
    keepCopy: forwarder.keepCopy,
    domain: { id: domain.id, domain: domain.domain },
  };
}

/**
 * Update a forwarder
 */
export async function updateForwarder(tenantId, forwarderId, data) {
  const forwarder = await prisma.emailForwarder.findFirst({
    where: { id: forwarderId, tenantId },
  });

  if (!forwarder) {
    throw new Error('Forwarder not found');
  }

  const updateData = {};
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.keepCopy !== undefined) updateData.keepCopy = data.keepCopy;
  if (data.forwardTo) {
    const validForwardTo = data.forwardTo.filter((email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    });
    if (validForwardTo.length === 0) {
      throw new Error('At least one valid forward-to address is required');
    }
    updateData.forwardTo = validForwardTo;
  }

  const updated = await prisma.emailForwarder.update({
    where: { id: forwarderId },
    data: updateData,
  });

  return updated;
}

/**
 * Delete a forwarder
 */
export async function deleteForwarder(tenantId, forwarderId) {
  const forwarder = await prisma.emailForwarder.findFirst({
    where: { id: forwarderId, tenantId },
  });

  if (!forwarder) {
    throw new Error('Forwarder not found');
  }

  await prisma.emailForwarder.delete({
    where: { id: forwarderId },
  });

  return { deleted: true, email: forwarder.email };
}

export const emailAliasService = {
  // Aliases
  getAliases,
  createAlias,
  updateAlias,
  deleteAlias,
  // Forwarders
  getForwarders,
  createForwarder,
  updateForwarder,
  deleteForwarder,
};
