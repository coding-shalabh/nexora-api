/**
 * Assignment Service
 *
 * Handles auto-assignment of conversations to agents based on rules.
 * Supports round-robin, least-busy, team-based, and user-specific assignment.
 */

import { prisma } from '@crm360/database'

class AssignmentService {
  /**
   * Auto-assign a conversation based on rules
   * @param {string} tenantId - Tenant ID
   * @param {string} conversationId - Conversation thread ID
   * @param {object} context - Additional context (channel, content, etc.)
   * @returns {object|null} - Assignment result or null if no matching rule
   */
  async autoAssignConversation(tenantId, conversationId, context = {}) {
    try {
      // Get all active rules ordered by priority
      const rules = await prisma.autoAssignmentRule.findMany({
        where: { tenantId, isActive: true },
        orderBy: { priority: 'desc' },
        include: { assignToTeam: true },
      })

      if (rules.length === 0) {
        return null
      }

      // Find the first matching rule
      for (const rule of rules) {
        if (this.matchesConditions(rule.conditions, context)) {
          // Increment matched count
          await prisma.autoAssignmentRule.update({
            where: { id: rule.id },
            data: { matchedCount: { increment: 1 } },
          })

          // Perform assignment based on type
          const assignee = await this.getAssignee(tenantId, rule)

          if (assignee) {
            // Update conversation with assignment
            await prisma.conversation.update({
              where: { id: conversationId },
              data: {
                assignedTo: assignee.userId ? { connect: { id: assignee.userId } } : undefined,
              },
            })

            // Increment assigned count
            await prisma.autoAssignmentRule.update({
              where: { id: rule.id },
              data: { assignedCount: { increment: 1 } },
            })

            return {
              ruleId: rule.id,
              ruleName: rule.name,
              assignedToId: assignee.userId,
              assignedToTeamId: rule.assignToTeamId,
              assignmentType: rule.assignToType,
            }
          }
        }
      }

      return null
    } catch (error) {
      console.error('[AssignmentService] autoAssignConversation error:', error)
      return null
    }
  }

  /**
   * Check if context matches rule conditions
   */
  matchesConditions(conditions, context) {
    if (!conditions) return true

    // Channel match
    if (conditions.channel && context.channel !== conditions.channel) {
      return false
    }

    // Priority match
    if (conditions.priority && context.priority !== conditions.priority) {
      return false
    }

    // Keywords match (case-insensitive)
    if (conditions.keywords?.length > 0 && context.content) {
      const contentLower = context.content.toLowerCase()
      const hasKeyword = conditions.keywords.some(
        keyword => contentLower.includes(keyword.toLowerCase())
      )
      if (!hasKeyword) {
        return false
      }
    }

    // Business hours match
    if (conditions.businessHours !== null && conditions.businessHours !== undefined) {
      const isBusinessHours = this.isBusinessHours()
      if (conditions.businessHours && !isBusinessHours) return false
      if (!conditions.businessHours && isBusinessHours) return false
    }

    return true
  }

  /**
   * Check if current time is within business hours
   * Default: Mon-Fri 9am-6pm IST
   */
  isBusinessHours() {
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istTime = new Date(now.getTime() + istOffset)

    const day = istTime.getUTCDay()
    const hour = istTime.getUTCHours()

    // Weekend check
    if (day === 0 || day === 6) return false

    // Business hours: 9am - 6pm
    return hour >= 9 && hour < 18
  }

  /**
   * Get assignee based on rule type
   */
  async getAssignee(tenantId, rule) {
    switch (rule.assignToType) {
      case 'USER':
        return await this.getSpecificUser(tenantId, rule.assignToUserId)

      case 'TEAM':
        // For team assignment, don't assign to individual - just set team
        return { userId: null, teamId: rule.assignToTeamId }

      case 'ROUND_ROBIN':
        return await this.getRoundRobinAssignee(tenantId, rule)

      case 'LEAST_BUSY':
        return await this.getLeastBusyAssignee(tenantId, rule)

      default:
        return null
    }
  }

  /**
   * Get specific user if online
   */
  async getSpecificUser(tenantId, userId) {
    if (!userId) return null

    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
        status: 'ACTIVE',
        isOnline: true,
      },
    })

    return user ? { userId: user.id } : null
  }

  /**
   * Round-robin assignment to online team members
   */
  async getRoundRobinAssignee(tenantId, rule) {
    if (!rule.assignToTeamId) return null

    // Get team members who are online
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: rule.assignToTeamId },
      include: {
        user: {
          where: {
            status: 'ACTIVE',
            isOnline: true,
          },
        },
      },
    })

    const onlineMembers = teamMembers
      .filter(m => m.user)
      .map(m => m.userId)

    if (onlineMembers.length === 0) return null

    // Get or initialize round-robin config
    const config = rule.roundRobinConfig || { lastAssignedIndex: -1 }
    const nextIndex = (config.lastAssignedIndex + 1) % onlineMembers.length
    const selectedUserId = onlineMembers[nextIndex]

    // Update round-robin index
    await prisma.autoAssignmentRule.update({
      where: { id: rule.id },
      data: {
        roundRobinConfig: {
          ...config,
          lastAssignedIndex: nextIndex,
        },
      },
    })

    return { userId: selectedUserId }
  }

  /**
   * Assign to team member with least active conversations
   */
  async getLeastBusyAssignee(tenantId, rule) {
    if (!rule.assignToTeamId) return null

    // Get team members who are online
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: rule.assignToTeamId },
      include: {
        user: {
          where: {
            status: 'ACTIVE',
            isOnline: true,
          },
        },
      },
    })

    const onlineUserIds = teamMembers
      .filter(m => m.user)
      .map(m => m.userId)

    if (onlineUserIds.length === 0) return null

    // Count open conversations for each online member
    const conversationCounts = await prisma.conversation.groupBy({
      by: ['assignedToId'],
      where: {
        tenantId,
        assignedToId: { in: onlineUserIds },
        status: { in: ['OPEN', 'PENDING'] },
      },
      _count: { id: true },
    })

    // Build count map
    const countMap = new Map()
    onlineUserIds.forEach(id => countMap.set(id, 0))
    conversationCounts.forEach(c => {
      if (c.assignedToId) {
        countMap.set(c.assignedToId, c._count.id)
      }
    })

    // Find user with least conversations
    let leastBusyUserId = onlineUserIds[0]
    let minCount = countMap.get(leastBusyUserId)

    onlineUserIds.forEach(id => {
      const count = countMap.get(id)
      if (count < minCount) {
        minCount = count
        leastBusyUserId = id
      }
    })

    return { userId: leastBusyUserId }
  }

  /**
   * Update agent online status
   */
  async updateAgentStatus(userId, isOnline) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        isOnline,
        lastSeenAt: new Date(),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        isOnline: true,
        lastSeenAt: true,
      },
    })
  }

  /**
   * Update agent last seen (heartbeat)
   */
  async updateLastSeen(userId) {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        lastSeenAt: new Date(),
      },
    })
  }

  /**
   * Get online agents for a tenant
   */
  async getOnlineAgents(tenantId) {
    return await prisma.user.findMany({
      where: {
        tenantId,
        isOnline: true,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isOnline: true,
        lastSeenAt: true,
      },
      orderBy: { firstName: 'asc' },
    })
  }

  /**
   * Get all agents with their status
   */
  async getAgentsWithStatus(tenantId) {
    const agents = await prisma.user.findMany({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isOnline: true,
        lastSeenAt: true,
        _count: {
          select: {
            assignedConversations: {
              where: { status: { in: ['OPEN', 'PENDING'] } },
            },
          },
        },
      },
      orderBy: [{ isOnline: 'desc' }, { firstName: 'asc' }],
    })

    return agents.map(agent => ({
      id: agent.id,
      firstName: agent.firstName,
      lastName: agent.lastName,
      avatarUrl: agent.avatarUrl,
      isOnline: agent.isOnline,
      lastSeenAt: agent.lastSeenAt,
      activeConversations: agent._count.assignedConversations,
    }))
  }

  /**
   * Mark offline agents as offline (if lastSeenAt > threshold)
   * Run this periodically via a cron job
   */
  async markInactiveAgentsOffline(thresholdMinutes = 5) {
    const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000)

    return await prisma.user.updateMany({
      where: {
        isOnline: true,
        lastSeenAt: { lt: threshold },
      },
      data: {
        isOnline: false,
      },
    })
  }
}

export const assignmentService = new AssignmentService()
