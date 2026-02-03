/**
 * Dialer Service
 * Business logic for voice calls and power dialer functionality
 */

import { prisma } from '@crm360/database';
import { NotFoundError, ValidationError } from '@crm360/shared';
import { logger } from '../../common/logger.js';
import { channelRegistry } from '../../common/providers/channels/index.js';
import { eventBus, createEvent } from '../../common/events/event-bus.js';

class DialerService {
  constructor() {
    this.logger = logger.child({ service: 'DialerService' });
    this.activeCalls = new Map(); // In-memory active calls tracker
    this.callQueues = new Map(); // Power dialer queues per user
  }

  // =====================
  // Call Management
  // =====================

  /**
   * Initiate an outbound call
   */
  async initiateCall({
    tenantId,
    workspaceId,
    userId,
    channelAccountId,
    toNumber,
    contactId,
    leadId,
    dealId,
    metadata = {},
  }) {
    // Get voice channel adapter
    const adapter = await channelRegistry.getAdapter(channelAccountId);

    // Check channel account is voice type
    const channelAccount = await prisma.channelAccount.findFirst({
      where: { id: channelAccountId, tenantId, channelType: 'VOICE' },
    });

    if (!channelAccount) {
      throw new NotFoundError('Voice channel account not found');
    }

    // Get user's phone/extension for agent leg
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.phone) {
      throw new ValidationError('User does not have a phone number configured');
    }

    // Create call record
    const call = await prisma.callSession.create({
      data: {
        tenantId,
        workspaceId,
        channelAccountId,
        userId,
        contactId,
        leadId,
        dealId,
        direction: 'OUTBOUND',
        fromNumber: channelAccount.identifier,
        toNumber,
        status: 'INITIATING',
        metadata,
      },
    });

    try {
      // Initiate call via voice adapter
      const result = await adapter.initiateCall({
        from: channelAccount.identifier,
        to: toNumber,
        agentNumber: user.phone,
        callbackUrl: `${process.env.API_URL}/webhooks/voice/${channelAccountId}/status`,
        statusCallback: `${process.env.API_URL}/webhooks/voice/${channelAccountId}/status`,
        customField: JSON.stringify({
          callId: call.id,
          contactId,
          leadId,
          dealId,
        }),
      });

      // Update call with external ID
      await prisma.callSession.update({
        where: { id: call.id },
        data: {
          externalId: result.callSid,
          status: 'RINGING',
        },
      });

      // Track active call
      this.activeCalls.set(call.id, {
        ...call,
        externalId: result.callSid,
        status: 'RINGING',
      });

      this.logger.info({ callId: call.id }, 'Call initiated');

      return {
        callId: call.id,
        externalId: result.callSid,
        status: 'RINGING',
      };
    } catch (error) {
      await prisma.callSession.update({
        where: { id: call.id },
        data: {
          status: 'FAILED',
          endedAt: new Date(),
          errorMessage: error.message,
        },
      });
      throw error;
    }
  }

  /**
   * End an active call
   */
  async endCall(tenantId, callId) {
    const call = await prisma.callSession.findFirst({
      where: { id: callId, tenantId },
      include: { channelAccount: true },
    });

    if (!call) {
      throw new NotFoundError('Call not found');
    }

    if (!['RINGING', 'IN_PROGRESS'].includes(call.status)) {
      throw new ValidationError('Call is not active');
    }

    const adapter = await channelRegistry.getAdapter(call.channelAccountId);
    await adapter.endCall(call.externalId);

    await prisma.callSession.update({
      where: { id: callId },
      data: {
        status: 'COMPLETED',
        endedAt: new Date(),
      },
    });

    this.activeCalls.delete(callId);

    return { status: 'ended' };
  }

  /**
   * Transfer call to another number/agent
   */
  async transferCall(tenantId, callId, transferTo) {
    const call = await prisma.callSession.findFirst({
      where: { id: callId, tenantId, status: 'IN_PROGRESS' },
      include: { channelAccount: true },
    });

    if (!call) {
      throw new NotFoundError('Active call not found');
    }

    const adapter = await channelRegistry.getAdapter(call.channelAccountId);
    await adapter.transferCall(call.externalId, transferTo);

    await prisma.callSession.update({
      where: { id: callId },
      data: {
        metadata: {
          ...call.metadata,
          transferredTo: transferTo,
          transferredAt: new Date().toISOString(),
        },
      },
    });

    return { status: 'transferred' };
  }

  /**
   * Put call on hold
   */
  async holdCall(tenantId, callId) {
    const call = await prisma.callSession.findFirst({
      where: { id: callId, tenantId, status: 'IN_PROGRESS' },
    });

    if (!call) {
      throw new NotFoundError('Active call not found');
    }

    const adapter = await channelRegistry.getAdapter(call.channelAccountId);
    await adapter.holdCall(call.externalId);

    await prisma.callSession.update({
      where: { id: callId },
      data: { status: 'ON_HOLD' },
    });

    return { status: 'on_hold' };
  }

  /**
   * Resume call from hold
   */
  async resumeCall(tenantId, callId) {
    const call = await prisma.callSession.findFirst({
      where: { id: callId, tenantId, status: 'ON_HOLD' },
    });

    if (!call) {
      throw new NotFoundError('Call on hold not found');
    }

    const adapter = await channelRegistry.getAdapter(call.channelAccountId);
    await adapter.resumeCall(call.externalId);

    await prisma.callSession.update({
      where: { id: callId },
      data: { status: 'IN_PROGRESS' },
    });

    return { status: 'in_progress' };
  }

  /**
   * Process call status webhook
   */
  async processCallStatus(callId, status, duration, recordingUrl) {
    const call = await prisma.callSession.findUnique({ where: { id: callId } });

    if (!call) {
      this.logger.warn({ callId }, 'Call not found for status update');
      return;
    }

    const updateData = { status };

    if (['COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY'].includes(status)) {
      updateData.endedAt = new Date();
      updateData.duration = duration;
      this.activeCalls.delete(callId);
    }

    if (recordingUrl) {
      updateData.recordingUrl = recordingUrl;
    }

    if (status === 'IN_PROGRESS' && !call.answeredAt) {
      updateData.answeredAt = new Date();
    }

    await prisma.callSession.update({
      where: { id: callId },
      data: updateData,
    });

    // Emit event for real-time updates
    eventBus.emit(
      createEvent('CALL_STATUS_UPDATED', {
        callId,
        status,
        userId: call.userId,
      })
    );

    // If using power dialer, advance to next call
    if (this.callQueues.has(call.userId)) {
      await this.advancePowerDialer(call.userId);
    }
  }

  // =====================
  // Call Logs & History
  // =====================

  /**
   * Get call logs
   */
  async getCallLogs(tenantId, filters = {}) {
    const {
      userId,
      contactId,
      direction,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = filters;

    this.logger.info({ tenantId, userId, filters }, 'getCallLogs called');

    const where = { tenantId };
    if (userId) where.userId = userId;
    if (contactId) where.contactId = contactId;
    if (direction) where.direction = direction;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [calls, total] = await Promise.all([
      prisma.callSession.findMany({
        where,
        include: {
          contact: {
            select: { id: true, firstName: true, lastName: true, displayName: true, phone: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.callSession.count({ where }),
    ]);

    return {
      calls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get active calls for a user
   */
  async getActiveCalls(tenantId, userId) {
    const calls = await prisma.callSession.findMany({
      where: {
        tenantId,
        userId,
        status: { in: ['RINGING', 'IN_PROGRESS', 'ON_HOLD'] },
      },
      include: {
        contact: {
          select: { id: true, firstName: true, lastName: true, displayName: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return calls;
  }

  /**
   * Get call statistics
   */
  async getCallStats(tenantId, userId, period = 'today') {
    const now = new Date();
    let startDate;

    switch (period) {
      case 'today':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
    }

    const where = {
      tenantId,
      userId,
      createdAt: { gte: startDate },
    };

    const [totalCalls, completedCalls, missedCalls, avgDuration] = await Promise.all([
      prisma.callSession.count({ where }),
      prisma.callSession.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.callSession.count({
        where: { ...where, status: { in: ['NO_ANSWER', 'BUSY', 'FAILED'] } },
      }),
      prisma.callSession.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _avg: { duration: true },
      }),
    ]);

    return {
      totalCalls,
      completedCalls,
      missedCalls,
      avgDuration: Math.round(avgDuration._avg.duration || 0),
      successRate: totalCalls > 0 ? ((completedCalls / totalCalls) * 100).toFixed(1) : 0,
    };
  }

  // =====================
  // Power Dialer
  // =====================

  /**
   * Start power dialer session
   */
  async startPowerDialer({
    tenantId,
    workspaceId,
    userId,
    channelAccountId,
    contacts,
    settings = {},
  }) {
    // Validate channel
    const channelAccount = await prisma.channelAccount.findFirst({
      where: { id: channelAccountId, tenantId, channelType: 'VOICE', isEnabled: true },
    });

    if (!channelAccount) {
      throw new NotFoundError('Voice channel not found or not enabled');
    }

    // Create dialer session
    const session = {
      id: `pd_${Date.now()}`,
      tenantId,
      workspaceId,
      userId,
      channelAccountId,
      contacts: contacts.map((c, index) => ({
        ...c,
        index,
        status: 'PENDING',
      })),
      currentIndex: 0,
      settings: {
        pauseBetweenCalls: settings.pauseBetweenCalls || 3000,
        maxAttempts: settings.maxAttempts || 3,
        dropVoicemail: settings.dropVoicemail || false,
        voicemailMessage: settings.voicemailMessage || null,
      },
      status: 'ACTIVE',
      startedAt: new Date(),
      stats: {
        total: contacts.length,
        completed: 0,
        connected: 0,
        noAnswer: 0,
        busy: 0,
        failed: 0,
      },
    };

    this.callQueues.set(userId, session);

    this.logger.info(
      { sessionId: session.id, contactCount: contacts.length },
      'Power dialer started'
    );

    // Start first call
    await this.dialNextContact(userId);

    return {
      sessionId: session.id,
      totalContacts: contacts.length,
      status: 'ACTIVE',
    };
  }

  /**
   * Dial next contact in power dialer queue
   */
  async dialNextContact(userId) {
    const session = this.callQueues.get(userId);
    if (!session || session.status !== 'ACTIVE') return;

    // Find next pending contact
    const nextContact = session.contacts.find((c) => c.status === 'PENDING');

    if (!nextContact) {
      // All contacts processed
      session.status = 'COMPLETED';
      session.completedAt = new Date();
      this.logger.info({ sessionId: session.id }, 'Power dialer completed');
      return;
    }

    try {
      const result = await this.initiateCall({
        tenantId: session.tenantId,
        workspaceId: session.workspaceId,
        userId,
        channelAccountId: session.channelAccountId,
        toNumber: nextContact.phone,
        contactId: nextContact.contactId,
        leadId: nextContact.leadId,
        metadata: {
          powerDialerSession: session.id,
          contactIndex: nextContact.index,
        },
      });

      nextContact.status = 'CALLING';
      nextContact.callId = result.callId;
      session.currentIndex = nextContact.index;
    } catch (error) {
      nextContact.status = 'FAILED';
      nextContact.error = error.message;
      session.stats.failed++;

      // Try next contact
      setTimeout(() => this.dialNextContact(userId), session.settings.pauseBetweenCalls);
    }
  }

  /**
   * Advance power dialer after call ends
   */
  async advancePowerDialer(userId) {
    const session = this.callQueues.get(userId);
    if (!session || session.status !== 'ACTIVE') return;

    // Wait before next call
    setTimeout(() => this.dialNextContact(userId), session.settings.pauseBetweenCalls);
  }

  /**
   * Pause power dialer
   */
  pausePowerDialer(userId) {
    const session = this.callQueues.get(userId);
    if (!session) throw new NotFoundError('No active power dialer session');

    session.status = 'PAUSED';
    return { status: 'paused' };
  }

  /**
   * Resume power dialer
   */
  async resumePowerDialer(userId) {
    const session = this.callQueues.get(userId);
    if (!session) throw new NotFoundError('No power dialer session found');

    session.status = 'ACTIVE';
    await this.dialNextContact(userId);
    return { status: 'resumed' };
  }

  /**
   * Stop power dialer
   */
  stopPowerDialer(userId) {
    const session = this.callQueues.get(userId);
    if (!session) throw new NotFoundError('No power dialer session found');

    session.status = 'STOPPED';
    session.completedAt = new Date();
    this.callQueues.delete(userId);

    return { status: 'stopped', stats: session.stats };
  }

  /**
   * Get power dialer status
   */
  getPowerDialerStatus(userId) {
    const session = this.callQueues.get(userId);
    if (!session) return null;

    return {
      sessionId: session.id,
      status: session.status,
      currentIndex: session.currentIndex,
      totalContacts: session.contacts.length,
      stats: session.stats,
      currentContact: session.contacts[session.currentIndex],
    };
  }

  // =====================
  // Call Recordings
  // =====================

  /**
   * Get call recording URL
   */
  async getRecording(tenantId, callId) {
    const call = await prisma.callSession.findFirst({
      where: { id: callId, tenantId },
    });

    if (!call) {
      throw new NotFoundError('Call not found');
    }

    if (!call.recordingUrl) {
      throw new NotFoundError('No recording available for this call');
    }

    return { recordingUrl: call.recordingUrl };
  }

  /**
   * Add note to call
   */
  async addCallNote(tenantId, callId, userId, note) {
    const call = await prisma.callSession.findFirst({
      where: { id: callId, tenantId },
    });

    if (!call) {
      throw new NotFoundError('Call not found');
    }

    const notes = call.notes || [];
    notes.push({
      id: `n_${Date.now()}`,
      userId,
      content: note,
      createdAt: new Date().toISOString(),
    });

    await prisma.callSession.update({
      where: { id: callId },
      data: { notes },
    });

    return { success: true };
  }

  /**
   * Set call outcome/disposition
   */
  async setCallDisposition(tenantId, callId, disposition, notes) {
    const call = await prisma.callSession.findFirst({
      where: { id: callId, tenantId },
    });

    if (!call) {
      throw new NotFoundError('Call not found');
    }

    await prisma.callSession.update({
      where: { id: callId },
      data: {
        disposition,
        metadata: {
          ...call.metadata,
          dispositionNotes: notes,
          dispositionSetAt: new Date().toISOString(),
        },
      },
    });

    return { success: true };
  }

  // =====================
  // WebRTC Call Logging
  // =====================

  /**
   * Create a WebRTC call record
   * Used to log calls made via PIOPIY SDK
   */
  async createWebRTCCallRecord({
    tenantId,
    workspaceId,
    userId,
    toNumber,
    contactId,
    direction = 'OUTBOUND',
  }) {
    // Find contact by phone if not provided
    let resolvedContactId = contactId;
    if (!resolvedContactId) {
      const contact = await prisma.contact.findFirst({
        where: {
          tenantId,
          phone: { contains: toNumber.replace(/[^0-9]/g, '').slice(-10) },
        },
      });
      resolvedContactId = contact?.id;
    }

    const call = await prisma.callSession.create({
      data: {
        tenantId,
        userId,
        contactId: resolvedContactId,
        direction,
        phone: toNumber,
        fromNumber: 'WebRTC',
        toNumber,
        status: 'RINGING',
        initiatedAt: new Date(),
        metadata: {
          source: 'webrtc',
          provider: 'telecmi',
        },
      },
    });

    this.logger.info({ callId: call.id, toNumber }, 'WebRTC call record created');

    return {
      callId: call.id,
      status: 'RINGING',
    };
  }

  /**
   * Update a WebRTC call record
   * Used to update status when call is answered or ended
   */
  async updateWebRTCCallRecord(tenantId, callId, { status, duration, endedAt }) {
    const call = await prisma.callSession.findFirst({
      where: { id: callId, tenantId },
    });

    if (!call) {
      this.logger.warn({ callId }, 'WebRTC call record not found for update');
      return { success: false, error: 'Call not found' };
    }

    const updateData = {};

    if (status) {
      updateData.status = status;
    }

    if (status === 'IN_PROGRESS' && !call.answeredAt) {
      updateData.answeredAt = new Date();
    }

    if (['COMPLETED', 'FAILED', 'NO_ANSWER', 'BUSY', 'CANCELLED'].includes(status)) {
      updateData.endedAt = endedAt ? new Date(endedAt) : new Date();
      if (duration !== undefined) {
        updateData.duration = duration;
      }
    }

    await prisma.callSession.update({
      where: { id: callId },
      data: updateData,
    });

    this.logger.info({ callId, status, duration }, 'WebRTC call record updated');

    return { success: true };
  }

  /**
   * Cleanup stale call records
   * Removes or marks as failed calls that are in INITIATING/RINGING status for too long
   */
  async cleanupStaleCalls(tenantId, maxAgeMinutes = 30) {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);

    // Find stale calls first
    const staleCalls = await prisma.callSession.findMany({
      where: {
        tenantId,
        status: { in: ['INITIATING', 'RINGING'] },
        createdAt: { lt: cutoffTime },
      },
      select: { id: true },
    });

    if (staleCalls.length === 0) {
      return { cleaned: 0 };
    }

    // Update them with proper status
    const result = await prisma.callSession.updateMany({
      where: {
        id: { in: staleCalls.map((c) => c.id) },
      },
      data: {
        status: 'FAILED',
        endedAt: new Date(),
      },
    });

    this.logger.info({ tenantId, count: result.count }, 'Cleaned up stale call records');

    return { cleaned: result.count };
  }
}

export const dialerService = new DialerService();
