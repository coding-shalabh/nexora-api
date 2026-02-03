/**
 * Email Account Access Service
 * Enterprise-ready shared inbox management
 */

import { prisma } from '@crm360/database'

/**
 * Get all users/teams with access to an email account
 */
export async function getEmailAccountAccess(emailAccountId, tenantId) {
  // First verify the email account belongs to this tenant
  const emailAccount = await prisma.emailAccount.findFirst({
    where: { id: emailAccountId, tenantId }
  })

  if (!emailAccount) {
    throw new Error('Email account not found')
  }

  const accessList = await prisma.emailAccountAccess.findMany({
    where: { emailAccountId },
    orderBy: { grantedAt: 'desc' }
  })

  // Fetch user/team details for each access entry
  const enrichedAccess = await Promise.all(
    accessList.map(async (access) => {
      let entity = null
      let entityType = null

      if (access.userId) {
        entity = await prisma.user.findUnique({
          where: { id: access.userId },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
            status: true
          }
        })
        entityType = 'user'
      } else if (access.teamId) {
        entity = await prisma.team.findUnique({
          where: { id: access.teamId },
          select: {
            id: true,
            name: true,
            description: true
          }
        })
        entityType = 'team'
      }

      // Get granter info
      const granter = await prisma.user.findUnique({
        where: { id: access.grantedBy },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true
        }
      })

      return {
        id: access.id,
        entityType,
        entity,
        permission: access.permission,
        grantedBy: granter,
        grantedAt: access.grantedAt,
        expiresAt: access.expiresAt
      }
    })
  )

  return {
    emailAccount: {
      id: emailAccount.id,
      email: emailAccount.email,
      displayName: emailAccount.displayName,
      provider: emailAccount.provider
    },
    accessList: enrichedAccess.filter(a => a.entity !== null)
  }
}

/**
 * Grant access to a user
 */
export async function grantUserAccess(emailAccountId, userId, permission, grantedBy, tenantId, expiresAt = null) {
  // Verify email account belongs to tenant
  const emailAccount = await prisma.emailAccount.findFirst({
    where: { id: emailAccountId, tenantId }
  })

  if (!emailAccount) {
    throw new Error('Email account not found')
  }

  // Verify user belongs to same tenant
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId }
  })

  if (!user) {
    throw new Error('User not found')
  }

  // Check if access already exists
  const existingAccess = await prisma.emailAccountAccess.findFirst({
    where: { emailAccountId, userId }
  })

  if (existingAccess) {
    // Update existing access
    return await prisma.emailAccountAccess.update({
      where: { id: existingAccess.id },
      data: { permission, expiresAt }
    })
  }

  // Create new access
  return await prisma.emailAccountAccess.create({
    data: {
      emailAccountId,
      userId,
      permission,
      grantedBy,
      expiresAt
    }
  })
}

/**
 * Grant access to a team
 */
export async function grantTeamAccess(emailAccountId, teamId, permission, grantedBy, tenantId, expiresAt = null) {
  // Verify email account belongs to tenant
  const emailAccount = await prisma.emailAccount.findFirst({
    where: { id: emailAccountId, tenantId }
  })

  if (!emailAccount) {
    throw new Error('Email account not found')
  }

  // Verify team belongs to same tenant
  const team = await prisma.team.findFirst({
    where: { id: teamId, tenantId }
  })

  if (!team) {
    throw new Error('Team not found')
  }

  // Check if access already exists
  const existingAccess = await prisma.emailAccountAccess.findFirst({
    where: { emailAccountId, teamId }
  })

  if (existingAccess) {
    // Update existing access
    return await prisma.emailAccountAccess.update({
      where: { id: existingAccess.id },
      data: { permission, expiresAt }
    })
  }

  // Create new access
  return await prisma.emailAccountAccess.create({
    data: {
      emailAccountId,
      teamId,
      permission,
      grantedBy,
      expiresAt
    }
  })
}

/**
 * Revoke access
 */
export async function revokeAccess(accessId, tenantId) {
  // Verify access exists and belongs to tenant's email account
  const access = await prisma.emailAccountAccess.findUnique({
    where: { id: accessId }
  })

  if (!access) {
    throw new Error('Access not found')
  }

  // Verify email account belongs to tenant
  const emailAccount = await prisma.emailAccount.findFirst({
    where: { id: access.emailAccountId, tenantId }
  })

  if (!emailAccount) {
    throw new Error('Access not found')
  }

  await prisma.emailAccountAccess.delete({
    where: { id: accessId }
  })

  return { success: true }
}

/**
 * Update access permission
 */
export async function updateAccessPermission(accessId, permission, tenantId) {
  const access = await prisma.emailAccountAccess.findUnique({
    where: { id: accessId }
  })

  if (!access) {
    throw new Error('Access not found')
  }

  // Verify email account belongs to tenant
  const emailAccount = await prisma.emailAccount.findFirst({
    where: { id: access.emailAccountId, tenantId }
  })

  if (!emailAccount) {
    throw new Error('Access not found')
  }

  return await prisma.emailAccountAccess.update({
    where: { id: accessId },
    data: { permission }
  })
}

/**
 * Get all email accounts a user has access to
 */
export async function getUserAccessibleEmailAccounts(userId, tenantId) {
  // Get user's team memberships
  const teamMemberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true }
  })
  const teamIds = teamMemberships.map(tm => tm.teamId)

  // Get direct user access
  const userAccess = await prisma.emailAccountAccess.findMany({
    where: {
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    }
  })

  // Get team access
  const teamAccess = teamIds.length > 0
    ? await prisma.emailAccountAccess.findMany({
        where: {
          teamId: { in: teamIds },
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        }
      })
    : []

  // Combine and deduplicate
  const accessMap = new Map()

  // User access takes priority
  userAccess.forEach(a => {
    accessMap.set(a.emailAccountId, {
      permission: a.permission,
      source: 'user'
    })
  })

  // Add team access if not already present
  teamAccess.forEach(a => {
    if (!accessMap.has(a.emailAccountId)) {
      accessMap.set(a.emailAccountId, {
        permission: a.permission,
        source: 'team'
      })
    }
  })

  // Fetch email account details
  const accountIds = Array.from(accessMap.keys())

  if (accountIds.length === 0) {
    // Return user's own email accounts
    const ownAccounts = await prisma.emailAccount.findMany({
      where: { userId, tenantId, status: 'ACTIVE' },
      select: {
        id: true,
        email: true,
        displayName: true,
        provider: true,
        status: true,
        isDefault: true,
        lastSyncAt: true
      }
    })
    return ownAccounts.map(acc => ({
      ...acc,
      permission: 'FULL_ACCESS',
      source: 'owner'
    }))
  }

  const emailAccounts = await prisma.emailAccount.findMany({
    where: {
      id: { in: accountIds },
      tenantId,
      status: 'ACTIVE'
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      provider: true,
      status: true,
      isDefault: true,
      lastSyncAt: true
    }
  })

  // Also get user's own accounts
  const ownAccounts = await prisma.emailAccount.findMany({
    where: { userId, tenantId, status: 'ACTIVE' },
    select: {
      id: true,
      email: true,
      displayName: true,
      provider: true,
      status: true,
      isDefault: true,
      lastSyncAt: true
    }
  })

  // Combine and return
  const result = ownAccounts.map(acc => ({
    ...acc,
    permission: 'FULL_ACCESS',
    source: 'owner'
  }))

  emailAccounts.forEach(acc => {
    if (!result.find(r => r.id === acc.id)) {
      const access = accessMap.get(acc.id)
      result.push({
        ...acc,
        permission: access.permission,
        source: access.source
      })
    }
  })

  return result
}

/**
 * Check if user has access to an email account
 */
export async function checkUserAccess(userId, emailAccountId, requiredPermission = 'READ_ONLY') {
  // Check if user owns the account
  const ownAccount = await prisma.emailAccount.findFirst({
    where: { id: emailAccountId, userId }
  })

  if (ownAccount) {
    return { hasAccess: true, permission: 'FULL_ACCESS', source: 'owner' }
  }

  // Check direct access
  const directAccess = await prisma.emailAccountAccess.findFirst({
    where: {
      emailAccountId,
      userId,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } }
      ]
    }
  })

  if (directAccess) {
    const hasPermission = checkPermissionLevel(directAccess.permission, requiredPermission)
    return {
      hasAccess: hasPermission,
      permission: directAccess.permission,
      source: 'user'
    }
  }

  // Check team access
  const teamMemberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true }
  })
  const teamIds = teamMemberships.map(tm => tm.teamId)

  if (teamIds.length > 0) {
    const teamAccess = await prisma.emailAccountAccess.findFirst({
      where: {
        emailAccountId,
        teamId: { in: teamIds },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      }
    })

    if (teamAccess) {
      const hasPermission = checkPermissionLevel(teamAccess.permission, requiredPermission)
      return {
        hasAccess: hasPermission,
        permission: teamAccess.permission,
        source: 'team'
      }
    }
  }

  return { hasAccess: false, permission: null, source: null }
}

/**
 * Helper: Check if permission level is sufficient
 */
function checkPermissionLevel(userPermission, requiredPermission) {
  const levels = {
    'READ_ONLY': 1,
    'READ_REPLY': 2,
    'FULL_ACCESS': 3
  }

  return levels[userPermission] >= levels[requiredPermission]
}

export default {
  getEmailAccountAccess,
  grantUserAccess,
  grantTeamAccess,
  revokeAccess,
  updateAccessPermission,
  getUserAccessibleEmailAccounts,
  checkUserAccess
}
