/**
 * Email Account Access Routes
 * Enterprise-ready shared inbox management API
 */

import { Router } from 'express'
import { z } from 'zod'
import {
  getEmailAccountAccess,
  grantUserAccess,
  grantTeamAccess,
  revokeAccess,
  updateAccessPermission,
  getUserAccessibleEmailAccounts,
  checkUserAccess
} from './email-access.service.js'

const router = Router()

// Validation schemas
const grantUserAccessSchema = z.object({
  userId: z.string().min(1),
  permission: z.enum(['READ_ONLY', 'READ_REPLY', 'FULL_ACCESS']).default('READ_REPLY'),
  expiresAt: z.string().datetime().optional().nullable()
})

const grantTeamAccessSchema = z.object({
  teamId: z.string().min(1),
  permission: z.enum(['READ_ONLY', 'READ_REPLY', 'FULL_ACCESS']).default('READ_REPLY'),
  expiresAt: z.string().datetime().optional().nullable()
})

const updatePermissionSchema = z.object({
  permission: z.enum(['READ_ONLY', 'READ_REPLY', 'FULL_ACCESS'])
})

/**
 * GET /email-accounts/accessible
 * Get all email accounts the current user has access to (including shared)
 */
router.get('/accessible', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user

    const accounts = await getUserAccessibleEmailAccounts(userId, tenantId)

    res.json({
      success: true,
      data: accounts
    })
  } catch (error) {
    console.error('Error getting accessible accounts:', error)
    next(error)
  }
})

/**
 * GET /email-accounts/:id/access
 * Get all users/teams with access to an email account
 */
router.get('/:id/access', async (req, res, next) => {
  try {
    const tenantId = req.tenantId
    const emailAccountId = req.params.id

    const result = await getEmailAccountAccess(emailAccountId, tenantId)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error getting email access:', error)
    if (error.message === 'Email account not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Email account not found'
      })
    }
    next(error)
  }
})

/**
 * POST /email-accounts/:id/access/user
 * Grant access to a user
 */
router.post('/:id/access/user', async (req, res, next) => {
  try {
    const { tenantId, id: granterId } = req.user
    const emailAccountId = req.params.id
    const { userId, permission, expiresAt } = grantUserAccessSchema.parse(req.body)

    const result = await grantUserAccess(
      emailAccountId,
      userId,
      permission,
      granterId,
      tenantId,
      expiresAt ? new Date(expiresAt) : null
    )

    res.status(201).json({
      success: true,
      data: result,
      message: 'User access granted successfully'
    })
  } catch (error) {
    console.error('Error granting user access:', error)
    if (error.message?.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message
      })
    }
    next(error)
  }
})

/**
 * POST /email-accounts/:id/access/team
 * Grant access to a team
 */
router.post('/:id/access/team', async (req, res, next) => {
  try {
    const { tenantId, id: granterId } = req.user
    const emailAccountId = req.params.id
    const { teamId, permission, expiresAt } = grantTeamAccessSchema.parse(req.body)

    const result = await grantTeamAccess(
      emailAccountId,
      teamId,
      permission,
      granterId,
      tenantId,
      expiresAt ? new Date(expiresAt) : null
    )

    res.status(201).json({
      success: true,
      data: result,
      message: 'Team access granted successfully'
    })
  } catch (error) {
    console.error('Error granting team access:', error)
    if (error.message?.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: error.message
      })
    }
    next(error)
  }
})

/**
 * PATCH /email-accounts/access/:accessId
 * Update access permission
 */
router.patch('/access/:accessId', async (req, res, next) => {
  try {
    const tenantId = req.tenantId
    const accessId = req.params.accessId
    const { permission } = updatePermissionSchema.parse(req.body)

    const result = await updateAccessPermission(accessId, permission, tenantId)

    res.json({
      success: true,
      data: result,
      message: 'Permission updated successfully'
    })
  } catch (error) {
    console.error('Error updating permission:', error)
    if (error.message === 'Access not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Access not found'
      })
    }
    next(error)
  }
})

/**
 * DELETE /email-accounts/access/:accessId
 * Revoke access
 */
router.delete('/access/:accessId', async (req, res, next) => {
  try {
    const tenantId = req.tenantId
    const accessId = req.params.accessId

    await revokeAccess(accessId, tenantId)

    res.json({
      success: true,
      message: 'Access revoked successfully'
    })
  } catch (error) {
    console.error('Error revoking access:', error)
    if (error.message === 'Access not found') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Access not found'
      })
    }
    next(error)
  }
})

/**
 * GET /email-accounts/:id/check-access
 * Check if current user has access to an email account
 */
router.get('/:id/check-access', async (req, res, next) => {
  try {
    const { id: userId } = req.user
    const emailAccountId = req.params.id
    const requiredPermission = req.query.permission || 'READ_ONLY'

    const result = await checkUserAccess(userId, emailAccountId, requiredPermission)

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error checking access:', error)
    next(error)
  }
})

export { router as emailAccessRouter }
export default router
