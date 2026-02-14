/**
 * Settings API Router
 * Handles user profile, preferences, organization, roles, and security settings
 */

import { Router } from 'express';
import { z } from 'zod';
import { settingsService } from './settings.service.js';
import { authenticate, authorize } from '../../common/middleware/authenticate.js';
import { oauthService } from '../../services/oauth.service.js';

const router = Router();

// All settings routes require authentication
router.use(authenticate);

// =====================
// User Profile
// =====================

/**
 * Get current user profile
 */
router.get('/profile', async (req, res, next) => {
  try {
    const profile = await settingsService.getUserProfile(req.userId);
    res.json({ data: profile });
  } catch (error) {
    next(error);
  }
});

/**
 * Update user profile
 */
router.patch('/profile', async (req, res, next) => {
  try {
    const schema = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      phone: z.string().optional(),
      avatarUrl: z.string().url().optional(),
      settings: z.record(z.unknown()).optional(),
    });

    const data = schema.parse(req.body);
    const profile = await settingsService.updateUserProfile(req.userId, data);
    res.json({ data: profile });
  } catch (error) {
    next(error);
  }
});

/**
 * Change password
 */
router.post('/profile/password', async (req, res, next) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(12),
    });

    const { currentPassword, newPassword } = schema.parse(req.body);
    const result = await settingsService.updatePassword(req.userId, currentPassword, newPassword);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// =====================
// User Preferences
// =====================

/**
 * Get user preferences
 */
router.get('/preferences', async (req, res, next) => {
  try {
    const preferences = await settingsService.getUserPreferences(req.userId);
    res.json({ data: preferences });
  } catch (error) {
    next(error);
  }
});

/**
 * Update user preferences
 */
router.patch('/preferences', async (req, res, next) => {
  try {
    const preferences = await settingsService.updateUserPreferences(req.userId, req.body);
    res.json({ data: preferences });
  } catch (error) {
    next(error);
  }
});

// =====================
// Notification Settings
// =====================

/**
 * Get notification settings
 */
router.get('/notifications', async (req, res, next) => {
  try {
    const settings = await settingsService.getNotificationSettings(req.userId);
    res.json({ data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * Update notification settings
 */
router.patch('/notifications', async (req, res, next) => {
  try {
    const settings = await settingsService.updateNotificationSettings(req.userId, req.body);
    res.json({ data: settings });
  } catch (error) {
    next(error);
  }
});

// =====================
// Organization Settings
// =====================

/**
 * Get organization settings
 */
router.get(
  '/organization',
  authorize('settings:update', 'settings:read'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const settings = await settingsService.getOrganizationSettings(tenantId);
      res.json({ data: settings });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update organization settings
 */
router.patch('/organization', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    // Transform empty strings to undefined for optional URL/email fields
    const emptyToUndefined = z.literal('').transform(() => undefined);

    const schema = z.object({
      name: z.string().min(1).optional(),
      logoUrl: z.string().url().nullable().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional().or(emptyToUndefined),
      website: z.string().url().optional().or(emptyToUndefined),
      timezone: z.string().optional(),
      currency: z.string().optional(),
      locale: z.string().optional(),
      industry: z.string().optional(),
      size: z.string().optional(),
      settings: z.record(z.unknown()).optional(),
    });

    const data = schema.parse(req.body);
    const settings = await settingsService.updateOrganizationSettings(tenantId, data);
    res.json({ data: settings });
  } catch (error) {
    next(error);
  }
});

// =====================
// Teams
// =====================

/**
 * Get teams
 */
router.get('/teams', authorize('settings:update', 'settings:read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const teams = await settingsService.getTeams(tenantId);
    res.json({ data: teams });
  } catch (error) {
    next(error);
  }
});

/**
 * Create team
 */
router.post('/teams', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const schema = z.object({
      name: z.string().min(1),
      color: z.string().optional(),
      description: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const team = await settingsService.createTeam(tenantId, data);
    res.status(201).json({ data: team });
  } catch (error) {
    next(error);
  }
});

/**
 * Update team
 */
router.patch('/teams/:teamId', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { teamId } = req.params;
    const team = await settingsService.updateTeam(tenantId, teamId, req.body);
    res.json({ data: team });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete team
 */
router.delete('/teams/:teamId', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { teamId } = req.params;
    await settingsService.deleteTeam(tenantId, teamId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Get team members
 */
router.get(
  '/teams/:teamId/members',
  authorize('settings:update', 'settings:read'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { teamId } = req.params;
      const members = await settingsService.getTeamMembers(tenantId, teamId);
      res.json({ success: true, data: members });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Add team member
 */
router.post('/teams/:teamId/members', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { teamId } = req.params;
    const schema = z.object({
      userId: z.string(),
      role: z.enum(['LEADER', 'MEMBER']).default('MEMBER'),
    });

    const data = schema.parse(req.body);
    const member = await settingsService.addTeamMember(tenantId, teamId, data);
    res.status(201).json({ success: true, data: member });
  } catch (error) {
    next(error);
  }
});

/**
 * Update team member role
 */
router.patch(
  '/teams/:teamId/members/:userId',
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { teamId, userId } = req.params;
      const schema = z.object({
        role: z.enum(['LEADER', 'MEMBER']),
      });

      const data = schema.parse(req.body);
      const member = await settingsService.updateTeamMember(tenantId, teamId, userId, data);
      res.json({ success: true, data: member });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Remove team member
 */
router.delete(
  '/teams/:teamId/members/:userId',
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { teamId, userId } = req.params;
      await settingsService.removeTeamMember(tenantId, teamId, userId);
      res.json({ success: true, message: 'Member removed from team' });
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// Roles & Permissions
// =====================

/**
 * Get roles
 */
router.get('/roles', authorize('settings:update', 'settings:read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const roles = await settingsService.getRoles(tenantId);
    res.json({ data: roles });
  } catch (error) {
    next(error);
  }
});

/**
 * Create role
 */
router.post('/roles', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      permissions: z.record(z.unknown()).optional(),
    });

    const data = schema.parse(req.body);
    const role = await settingsService.createRole(tenantId, data);
    res.status(201).json({ data: role });
  } catch (error) {
    next(error);
  }
});

/**
 * Update role
 */
router.patch('/roles/:roleId', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { roleId } = req.params;
    const role = await settingsService.updateRole(tenantId, roleId, req.body);
    res.json({ data: role });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete role
 */
router.delete('/roles/:roleId', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { roleId } = req.params;
    await settingsService.deleteRole(tenantId, roleId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// =====================
// API Keys
// =====================

/**
 * Get API keys
 */
router.get('/api-keys', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const keys = await settingsService.getApiKeys(tenantId);
    res.json(keys);
  } catch (error) {
    next(error);
  }
});

/**
 * Create API key
 */
router.post('/api-keys', authorize('settings:update'), async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const schema = z.object({
      name: z.string().min(1),
      prefix: z.string().optional(),
      scopes: z.array(z.string()).optional(),
      expiresAt: z.string().datetime().optional(),
    });

    const data = schema.parse(req.body);
    const apiKey = await settingsService.createApiKey(tenantId, userId, data);
    res.status(201).json({ data: apiKey });
  } catch (error) {
    next(error);
  }
});

/**
 * Revoke API key
 */
router.delete('/api-keys/:keyId', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { keyId } = req.params;
    await settingsService.revokeApiKey(tenantId, keyId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// =====================
// Audit Logs
// =====================

/**
 * Get audit logs
 */
router.get('/audit-logs', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { limit, offset, category, status, startDate, endDate } = req.query;

    const result = await settingsService.getAuditLogs(tenantId, {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      category,
      status,
      startDate,
      endDate,
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// =====================
// Sessions
// =====================

/**
 * Get active sessions
 */
router.get('/sessions', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const sessions = await settingsService.getActiveSessions(tenantId, userId);
    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

/**
 * Get all active sessions (admin only)
 */
router.get('/sessions/all', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const sessions = await settingsService.getActiveSessions(tenantId);
    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

/**
 * Revoke session
 */
router.delete('/sessions/:sessionId', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { sessionId } = req.params;
    const currentSessionId = req.session?.id;
    await settingsService.revokeSession(tenantId, sessionId, currentSessionId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Revoke all other sessions
 */
router.post('/sessions/revoke-all', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const currentSessionId = req.session?.id;
    await settingsService.revokeAllOtherSessions(tenantId, userId, currentSessionId);
    res.json({ data: { success: true } });
  } catch (error) {
    next(error);
  }
});

// =====================
// Security Settings
// =====================

/**
 * Get security settings
 */
router.get('/security', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const settings = await settingsService.getSecuritySettings(tenantId);
    res.json({ data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * Update security settings
 */
router.patch('/security', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const settings = await settingsService.updateSecuritySettings(tenantId, req.body);
    res.json({ data: settings });
  } catch (error) {
    next(error);
  }
});

// =====================
// Webhooks
// =====================

/**
 * Get webhooks
 */
router.get('/webhooks', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const webhooks = await settingsService.getWebhooks(tenantId);
    res.json(webhooks);
  } catch (error) {
    next(error);
  }
});

/**
 * Create webhook
 */
router.post('/webhooks', authorize('settings:update'), async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const schema = z.object({
      name: z.string().min(1),
      url: z.string().url(),
      events: z.array(z.string()).min(1),
    });

    const data = schema.parse(req.body);
    const webhook = await settingsService.createWebhook(tenantId, userId, data);
    res.status(201).json({ data: webhook });
  } catch (error) {
    next(error);
  }
});

/**
 * Update webhook
 */
router.patch('/webhooks/:webhookId', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { webhookId } = req.params;
    const schema = z.object({
      name: z.string().min(1).optional(),
      url: z.string().url().optional(),
      events: z.array(z.string()).optional(),
      status: z.enum(['ACTIVE', 'PAUSED']).optional(),
    });

    const data = schema.parse(req.body);
    const webhook = await settingsService.updateWebhook(tenantId, webhookId, data);
    res.json({ data: webhook });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete webhook
 */
router.delete('/webhooks/:webhookId', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { webhookId } = req.params;
    await settingsService.deleteWebhook(tenantId, webhookId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Test webhook
 */
router.post('/webhooks/:webhookId/test', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { webhookId } = req.params;
    const { event } = req.body;
    const result = await settingsService.testWebhook(tenantId, webhookId, event);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Get webhook delivery logs
 */
router.get('/webhooks/:webhookId/logs', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { webhookId } = req.params;
    const { limit } = req.query;
    const logs = await settingsService.getWebhookDeliveryLogs(tenantId, webhookId, {
      limit: limit ? parseInt(limit) : 50,
    });
    res.json({ data: logs });
  } catch (error) {
    next(error);
  }
});

// =====================
// Integrations
// =====================

/**
 * Get integrations
 */
router.get('/integrations', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const integrations = await settingsService.getIntegrations(tenantId);
    res.json(integrations);
  } catch (error) {
    next(error);
  }
});

/**
 * Create/connect integration
 */
router.post('/integrations', authorize('settings:update'), async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const schema = z.object({
      type: z.string().min(1),
      name: z.string().min(1),
      provider: z.string().min(1).optional(),
      config: z.record(z.unknown()).optional(),
    });

    const data = schema.parse(req.body);
    const integration = await settingsService.createIntegration(tenantId, userId, data);
    res.status(201).json({ data: integration });
  } catch (error) {
    next(error);
  }
});

/**
 * Update integration
 */
router.patch(
  '/integrations/:integrationId',
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { integrationId } = req.params;
      const schema = z.object({
        name: z.string().min(1).optional(),
        status: z.enum(['CONNECTED', 'DISCONNECTED', 'ERROR']).optional(),
        config: z.record(z.unknown()).optional(),
      });

      const data = schema.parse(req.body);
      const integration = await settingsService.updateIntegration(tenantId, integrationId, data);
      res.json({ data: integration });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Delete/disconnect integration
 */
router.delete(
  '/integrations/:integrationId',
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { integrationId } = req.params;
      await settingsService.deleteIntegration(tenantId, integrationId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Sync integration
 */
router.post(
  '/integrations/:integrationId/sync',
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { integrationId } = req.params;
      const result = await settingsService.syncIntegration(tenantId, integrationId);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// Users Management
// =====================

/**
 * Get pending invitations
 */
router.get('/users/invitations', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const invitations = await settingsService.getPendingInvitations(tenantId);
    res.json({ success: true, data: invitations });
  } catch (error) {
    next(error);
  }
});

/**
 * Revoke invitation
 */
router.delete('/users/:userId/invitation', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { userId } = req.params;
    const result = await settingsService.revokeInvitation(tenantId, userId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * Get users list
 */
router.get('/users', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        search: z.string().optional(),
        status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
      })
      .parse(req.query);

    const result = await settingsService.getUsers(tenantId, params);
    res.json({ success: true, data: result.users, meta: result.meta });
  } catch (error) {
    next(error);
  }
});

/**
 * Get single user
 */
router.get('/users/:userId', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { userId } = req.params;
    const user = await settingsService.getUser(tenantId, userId);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

/**
 * Invite user
 */
router.post('/users/invite', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const schema = z.object({
      email: z.string().email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      roleId: z.string().uuid().optional(),
    });

    const data = schema.parse(req.body);
    const user = await settingsService.inviteUser(tenantId, data);
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

/**
 * Update user
 */
router.patch('/users/:userId', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { userId } = req.params;
    const schema = z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      displayName: z.string().optional(),
      phone: z.string().optional(),
      status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
      roleId: z.string().uuid().optional(),
    });

    const data = schema.parse(req.body);
    const user = await settingsService.updateUser(tenantId, userId, data);
    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete user
 */
router.delete('/users/:userId', authorize('settings:update'), async (req, res, next) => {
  try {
    const { tenantId, id: currentUserId } = req.user;
    const { userId } = req.params;
    await settingsService.deleteUser(tenantId, userId, currentUserId);
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * Resend invitation
 */
router.post(
  '/users/:userId/resend-invitation',
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { userId } = req.params;
      const result = await settingsService.resendInvitation(tenantId, userId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// Subscription
// =====================

/**
 * Get current subscription
 */
router.get('/subscription', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const subscription = await settingsService.getSubscription(tenantId);
    res.json({ success: true, data: subscription });
  } catch (error) {
    next(error);
  }
});

/**
 * Get available plans
 */
router.get('/subscription/plans', authorize('settings:update'), async (req, res, next) => {
  try {
    const plans = await settingsService.getAvailablePlans();
    res.json({ success: true, data: plans });
  } catch (error) {
    next(error);
  }
});

/**
 * Change plan
 */
router.post('/subscription/change-plan', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const schema = z.object({
      planId: z.string(),
      billingCycle: z.enum(['MONTHLY', 'YEARLY']).optional(),
    });

    const { planId, billingCycle } = schema.parse(req.body);
    const subscription = await settingsService.changePlan(tenantId, planId, billingCycle);
    res.json({ success: true, data: subscription });
  } catch (error) {
    next(error);
  }
});

/**
 * Cancel subscription
 */
router.post('/subscription/cancel', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const result = await settingsService.cancelSubscription(tenantId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// =====================
// Compliance / Opt-outs
// =====================

/**
 * Get opt-outs
 */
router.get('/compliance/optouts', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        channel: z.string().optional(),
        search: z.string().optional(),
      })
      .parse(req.query);

    const result = await settingsService.getOptOuts(tenantId, params);
    res.json({ success: true, data: result.optOuts, meta: result.meta });
  } catch (error) {
    next(error);
  }
});

/**
 * Add opt-out
 */
router.post('/compliance/optouts', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const schema = z.object({
      identifier: z.string().min(1),
      channel: z.string(),
      reason: z.string().optional(),
      source: z.string().optional(),
    });

    const data = schema.parse(req.body);
    const optOut = await settingsService.addOptOut(tenantId, data);
    res.status(201).json({ success: true, data: optOut });
  } catch (error) {
    next(error);
  }
});

/**
 * Remove opt-out
 */
router.delete('/compliance/optouts/:id', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;
    await settingsService.removeOptOut(tenantId, id);
    res.json({ success: true, message: 'Opt-out removed' });
  } catch (error) {
    next(error);
  }
});

/**
 * Get contact consents
 */
router.get(
  '/compliance/consents/:contactId',
  authorize('settings:update', 'settings:read'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { contactId } = req.params;
      const consents = await settingsService.getConsents(tenantId, contactId);
      res.json({ success: true, data: consents });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Update contact consent
 */
router.put(
  '/compliance/consents/:contactId',
  authorize('settings:update'),
  async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      const { contactId } = req.params;
      const schema = z.object({
        channel: z.string(),
        type: z.string(),
        status: z.enum(['GRANTED', 'REVOKED', 'PENDING']),
        method: z.string().optional(),
      });

      const data = schema.parse(req.body);
      const consent = await settingsService.updateConsent(tenantId, contactId, data);
      res.json({ success: true, data: consent });
    } catch (error) {
      next(error);
    }
  }
);

// =====================
// Email Settings
// =====================

/**
 * Get email settings
 */
router.get('/email', authorize('settings:update', 'settings:read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const settings = await settingsService.getEmailSettings(tenantId);
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * Update email settings
 */
router.patch('/email', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const schema = z.object({
      primaryEmail: z.string().email().optional(),
      primaryEmailName: z.string().optional(),
      supportEmail: z.string().email().optional(),
      supportEmailName: z.string().optional(),
      replyToEmail: z.string().email().optional(),
      replyToName: z.string().optional(),
      defaultFromEmail: z.string().email().optional(),
      defaultFromName: z.string().optional(),
      signature: z.string().optional(),
      signatureHtml: z.string().optional(),
      footerText: z.string().optional(),
      footerHtml: z.string().optional(),
      unsubscribeText: z.string().optional(),
      trackOpens: z.boolean().optional(),
      trackClicks: z.boolean().optional(),
      includeLogo: z.boolean().optional(),
    });

    const data = schema.parse(req.body);
    const settings = await settingsService.updateEmailSettings(tenantId, data);
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * Test email configuration
 */
router.post('/email/test', authorize('settings:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const schema = z.object({
      toEmail: z.string().email(),
      type: z.enum(['primary', 'support']).optional(),
    });

    const { toEmail, type } = schema.parse(req.body);
    const result = await settingsService.testEmailSettings(tenantId, toEmail, type);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// =====================
// Signatures
// =====================

/**
 * Get user signatures
 */
router.get('/signatures', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const signatures = await settingsService.getSignatures(tenantId, userId);
    res.json({ success: true, data: signatures });
  } catch (error) {
    next(error);
  }
});

/**
 * Create signature
 */
router.post('/signatures', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const schema = z.object({
      name: z.string().min(1),
      content: z.string().min(1),
      channel: z.enum(['all', 'email', 'whatsapp']).default('all'),
      signatureType: z.enum(['text', 'with_links', 'with_logo']).default('text'),
      logoUrl: z
        .string()
        .transform((val) => (val === '' ? null : val))
        .nullable()
        .optional(),
      links: z.record(z.string()).optional().nullable(),
      isActive: z.boolean().default(true),
    });

    const data = schema.parse(req.body);
    const signature = await settingsService.createSignature(tenantId, userId, data);
    res.status(201).json({ success: true, data: signature });
  } catch (error) {
    next(error);
  }
});

/**
 * Update signature
 */
router.patch('/signatures/:id', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { id } = req.params;
    const schema = z.object({
      name: z.string().min(1).optional(),
      content: z.string().min(1).optional(),
      channel: z.enum(['all', 'email', 'whatsapp']).optional(),
      signatureType: z.enum(['text', 'with_links', 'with_logo']).optional(),
      logoUrl: z
        .string()
        .transform((val) => (val === '' ? null : val))
        .nullable()
        .optional(),
      links: z.record(z.string()).optional().nullable(),
      isActive: z.boolean().optional(),
    });

    const data = schema.parse(req.body);
    const signature = await settingsService.updateSignature(tenantId, userId, id, data);
    res.json({ success: true, data: signature });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete signature
 */
router.delete('/signatures/:id', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { id } = req.params;
    await settingsService.deleteSignature(tenantId, userId, id);
    res.json({ success: true, message: 'Signature deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * Set default signature
 */
router.patch('/signatures/:id/default', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { id } = req.params;
    const schema = z.object({
      channel: z.enum(['all', 'email', 'whatsapp']).optional(),
    });

    const { channel } = schema.parse(req.body);
    const signature = await settingsService.setDefaultSignature(tenantId, userId, id, channel);
    res.json({ success: true, data: signature });
  } catch (error) {
    next(error);
  }
});

// =====================
// OAuth Connected Accounts
// =====================

/**
 * Get user's connected accounts
 */
router.get('/connected-accounts', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const accounts = await oauthService.getConnectedAccounts(tenantId, userId);
    res.json({ data: accounts });
  } catch (error) {
    next(error);
  }
});

/**
 * OAuth callback - Exchange authorization code for tokens
 */
router.post('/oauth/callback', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const schema = z.object({
      platform: z.enum(['google', 'microsoft', 'zoom']),
      code: z.string(),
      redirect_uri: z.string().url(),
    });

    const { platform, code, redirect_uri } = schema.parse(req.body);

    const account = await oauthService.connectAccount(
      tenantId,
      userId,
      platform,
      code,
      redirect_uri
    );

    res.json({ data: account });
  } catch (error) {
    next(error);
  }
});

/**
 * Disconnect OAuth account
 */
router.delete('/connected-accounts/:platform', async (req, res, next) => {
  try {
    const { tenantId, id: userId } = req.user;
    const { platform } = req.params;

    await oauthService.disconnectAccount(tenantId, userId, platform);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * Refresh OAuth token manually (usually auto-refreshed)
 */
router.post('/connected-accounts/:platform/refresh', async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const { platform } = req.params;

    const account = await prisma.connectedAccount.findUnique({
      where: { userId_platform: { userId, platform } },
    });

    if (!account) {
      return res.status(404).json({ error: `No ${platform} account connected` });
    }

    const newToken = await oauthService.refreshToken(account);
    res.json({ success: true, message: 'Token refreshed successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
