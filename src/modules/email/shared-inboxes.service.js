/**
 * Shared Inbox Service
 * Manage shared inboxes for team email collaboration
 */

import { prisma } from '@crm360/database';

/**
 * Get all shared inboxes for a tenant
 */
export async function getSharedInboxes(tenantId) {
  // TODO: Shared Inboxes feature not yet implemented - SharedInbox model doesn't exist or is incomplete
  // Return empty data with proper structure
  return [];
}

/**
 * Get a single shared inbox by ID
 */
export async function getSharedInbox(tenantId, id) {
  const inbox = await prisma.sharedInbox.findFirst({
    where: { id, tenantId },
    include: {
      members: true,
    },
  });

  if (!inbox) {
    return null;
  }

  // Fetch member details
  const memberIds = inbox.members.map((m) => m.userId);
  const users =
    memberIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: memberIds } },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            status: true,
          },
        })
      : [];

  const membersWithDetails = inbox.members.map((member) => ({
    ...member,
    user: users.find((u) => u.id === member.userId) || null,
  }));

  return {
    ...inbox,
    members: membersWithDetails,
    memberCount: inbox.members.length,
  };
}

/**
 * Create a new shared inbox
 */
export async function createSharedInbox(tenantId, data) {
  const { name, email, inboundType, smtpProvider, autoAssign, assignmentType, signature } = data;

  // Check if inbox with same email already exists
  const existing = await prisma.sharedInbox.findFirst({
    where: { tenantId, email },
  });

  if (existing) {
    throw new Error('A shared inbox with this email already exists');
  }

  // Generate forwarding address if using forwarding inbound type
  let forwardingAddress = null;
  if (inboundType === 'forwarding') {
    const randomId = Math.random().toString(36).substring(2, 10);
    forwardingAddress = `inbox-${randomId}@mail.nexora.com`;
  }

  const inbox = await prisma.sharedInbox.create({
    data: {
      tenantId,
      name,
      email,
      inboundType: inboundType || 'forwarding',
      forwardingAddress,
      smtpProvider,
      autoAssign: autoAssign || false,
      assignmentType: assignmentType || 'round_robin',
      signature,
      status: 'active',
    },
  });

  return inbox;
}

/**
 * Update a shared inbox
 */
export async function updateSharedInbox(tenantId, id, data) {
  // Verify inbox belongs to tenant
  const existing = await prisma.sharedInbox.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    throw new Error('Shared inbox not found');
  }

  // If email is being changed, check for duplicates
  if (data.email && data.email !== existing.email) {
    const duplicate = await prisma.sharedInbox.findFirst({
      where: { tenantId, email: data.email, NOT: { id } },
    });
    if (duplicate) {
      throw new Error('A shared inbox with this email already exists');
    }
  }

  const inbox = await prisma.sharedInbox.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email,
      inboundType: data.inboundType,
      smtpProvider: data.smtpProvider,
      autoAssign: data.autoAssign,
      assignmentType: data.assignmentType,
      signature: data.signature,
      status: data.status,
    },
  });

  return inbox;
}

/**
 * Delete a shared inbox
 */
export async function deleteSharedInbox(tenantId, id) {
  // Verify inbox belongs to tenant
  const existing = await prisma.sharedInbox.findFirst({
    where: { id, tenantId },
  });

  if (!existing) {
    throw new Error('Shared inbox not found');
  }

  // Delete inbox (members will be cascade deleted)
  await prisma.sharedInbox.delete({
    where: { id },
  });

  return { success: true };
}

/**
 * Get members of a shared inbox
 */
export async function getInboxMembers(tenantId, inboxId) {
  // Verify inbox belongs to tenant
  const inbox = await prisma.sharedInbox.findFirst({
    where: { id: inboxId, tenantId },
  });

  if (!inbox) {
    throw new Error('Shared inbox not found');
  }

  const members = await prisma.sharedInboxMember.findMany({
    where: { sharedInboxId: inboxId },
    orderBy: { createdAt: 'asc' },
  });

  // Fetch user details
  const userIds = members.map((m) => m.userId);
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            status: true,
          },
        })
      : [];

  return members.map((member) => ({
    ...member,
    user: users.find((u) => u.id === member.userId) || null,
  }));
}

/**
 * Add a member to a shared inbox
 */
export async function addInboxMember(tenantId, inboxId, data) {
  const { userId, role, canSend, canAssign, receiveNotifications } = data;

  // Verify inbox belongs to tenant
  const inbox = await prisma.sharedInbox.findFirst({
    where: { id: inboxId, tenantId },
  });

  if (!inbox) {
    throw new Error('Shared inbox not found');
  }

  // Verify user belongs to tenant
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Check if already a member
  const existingMember = await prisma.sharedInboxMember.findFirst({
    where: { sharedInboxId: inboxId, userId },
  });

  if (existingMember) {
    throw new Error('User is already a member of this inbox');
  }

  const member = await prisma.sharedInboxMember.create({
    data: {
      sharedInboxId: inboxId,
      userId,
      role: role || 'member',
      canSend: canSend !== undefined ? canSend : true,
      canAssign: canAssign !== undefined ? canAssign : false,
      receiveNotifications: receiveNotifications !== undefined ? receiveNotifications : true,
    },
  });

  // Return with user details
  return {
    ...member,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      status: user.status,
    },
  };
}

/**
 * Update a member's permissions in a shared inbox
 */
export async function updateInboxMember(tenantId, inboxId, userId, data) {
  // Verify inbox belongs to tenant
  const inbox = await prisma.sharedInbox.findFirst({
    where: { id: inboxId, tenantId },
  });

  if (!inbox) {
    throw new Error('Shared inbox not found');
  }

  // Find existing member
  const existingMember = await prisma.sharedInboxMember.findFirst({
    where: { sharedInboxId: inboxId, userId },
  });

  if (!existingMember) {
    throw new Error('Member not found');
  }

  const member = await prisma.sharedInboxMember.update({
    where: { id: existingMember.id },
    data: {
      role: data.role,
      canSend: data.canSend,
      canAssign: data.canAssign,
      receiveNotifications: data.receiveNotifications,
    },
  });

  // Fetch user details
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      status: true,
    },
  });

  return {
    ...member,
    user,
  };
}

/**
 * Remove a member from a shared inbox
 */
export async function removeInboxMember(tenantId, inboxId, userId) {
  // Verify inbox belongs to tenant
  const inbox = await prisma.sharedInbox.findFirst({
    where: { id: inboxId, tenantId },
  });

  if (!inbox) {
    throw new Error('Shared inbox not found');
  }

  // Find existing member
  const existingMember = await prisma.sharedInboxMember.findFirst({
    where: { sharedInboxId: inboxId, userId },
  });

  if (!existingMember) {
    throw new Error('Member not found');
  }

  await prisma.sharedInboxMember.delete({
    where: { id: existingMember.id },
  });

  return { success: true };
}

/**
 * Get shared inboxes a user is a member of
 */
export async function getUserSharedInboxes(tenantId, userId) {
  const memberships = await prisma.sharedInboxMember.findMany({
    where: { userId },
    include: {
      sharedInbox: true,
    },
  });

  // Filter to only inboxes belonging to tenant
  return memberships
    .filter((m) => m.sharedInbox.tenantId === tenantId)
    .map((m) => ({
      ...m.sharedInbox,
      membership: {
        role: m.role,
        canSend: m.canSend,
        canAssign: m.canAssign,
        receiveNotifications: m.receiveNotifications,
      },
    }));
}

export const sharedInboxesService = {
  getSharedInboxes,
  getSharedInbox,
  createSharedInbox,
  updateSharedInbox,
  deleteSharedInbox,
  getInboxMembers,
  addInboxMember,
  updateInboxMember,
  removeInboxMember,
  getUserSharedInboxes,
};

export default sharedInboxesService;
