/**
 * WebSocket Service using Socket.io
 * Provides real-time messaging capabilities for the inbox
 */

import { Server } from 'socket.io';
import { logger } from '../logger.js';
import { verifyToken } from '../utils/jwt.js';
import { prisma } from '@crm360/database';

let io = null;

/**
 * Per-socket event rate limiter.
 * Tracks event counts per socket per sliding window.
 */
function createSocketRateLimiter(maxEvents = 30, windowMs = 10000) {
  const counters = new WeakMap();

  return function checkRate(socket) {
    const now = Date.now();
    let entry = counters.get(socket);
    if (!entry || now - entry.windowStart > windowMs) {
      entry = { windowStart: now, count: 0 };
      counters.set(socket, entry);
    }
    entry.count++;
    return entry.count > maxEvents;
  };
}

/**
 * Initialize Socket.io server
 * @param {http.Server} httpServer - The HTTP server instance
 */
export function initializeSocketIO(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      // Verify JWT token
      const decoded = await verifyToken(token);
      if (!decoded) {
        return next(new Error('Invalid token'));
      }

      // Attach user info to socket
      socket.userId = decoded.userId;
      socket.tenantId = decoded.tenantId;
      socket.workspaceId = decoded.workspaceId;

      next();
    } catch (error) {
      logger.error({ error: error.message }, 'Socket authentication failed');
      next(new Error('Authentication failed'));
    }
  });

  // Per-socket rate limiter: max 30 events per 10s
  const isRateLimited = createSocketRateLimiter(30, 10000);

  // Connection handler
  io.on('connection', (socket) => {
    logger.info(
      {
        socketId: socket.id,
        userId: socket.userId,
        tenantId: socket.tenantId,
      },
      'Client connected to WebSocket'
    );

    // Rate-limit middleware for all incoming events
    socket.use(([event, ...args], next) => {
      if (isRateLimited(socket)) {
        logger.warn({ socketId: socket.id, event }, 'Socket event rate limited');
        return next(new Error('Rate limit exceeded'));
      }
      next();
    });

    // Join tenant room for receiving tenant-wide broadcasts
    socket.join(`tenant:${socket.tenantId}`);

    // Join user room for user-specific messages
    socket.join(`user:${socket.userId}`);

    // Handle joining specific conversation room (with tenant verification)
    socket.on('join:conversation', async (conversationId) => {
      try {
        // Verify the conversation belongs to this user's tenant
        const conversation = await prisma.conversation.findFirst({
          where: { id: conversationId, tenantId: socket.tenantId },
          select: { id: true },
        });
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }
        socket.join(`conversation:${conversationId}`);
        logger.debug(
          {
            socketId: socket.id,
            conversationId,
          },
          'Client joined conversation room'
        );
      } catch (err) {
        logger.error({ err, conversationId }, 'Failed to join conversation room');
      }
    });

    // Handle leaving conversation room
    socket.on('leave:conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
      logger.debug(
        {
          socketId: socket.id,
          conversationId,
        },
        'Client left conversation room'
      );
    });

    // Handle typing indicators
    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        userId: socket.userId,
        isTyping: true,
      });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:update', {
        conversationId,
        userId: socket.userId,
        isTyping: false,
      });
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      logger.info(
        {
          socketId: socket.id,
          userId: socket.userId,
          reason,
        },
        'Client disconnected from WebSocket'
      );
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error(
        {
          socketId: socket.id,
          error: error.message,
        },
        'Socket error'
      );
    });
  });

  logger.info('Socket.io initialized');
  return io;
}

/**
 * Get the Socket.io instance
 */
export function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initializeSocketIO first.');
  }
  return io;
}

/**
 * Emit event to a specific tenant
 */
export function emitToTenant(tenantId, event, data) {
  if (!io) return;
  io.to(`tenant:${tenantId}`).emit(event, data);
}

/**
 * Emit event to a specific user
 */
export function emitToUser(userId, event, data) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, data);
}

/**
 * Emit event to a specific conversation room
 */
export function emitToConversation(conversationId, event, data) {
  if (!io) return;
  io.to(`conversation:${conversationId}`).emit(event, data);
}

/**
 * Broadcast new message to relevant rooms
 */
export function broadcastNewMessage(message) {
  if (!io) return;

  const { tenantId, threadId, ...messageData } = message;

  logger.info(
    {
      conversationId: threadId,
      messageId: message.id,
      content: messageData.content,
      direction: messageData.direction,
    },
    'Broadcasting new message via WebSocket'
  );

  // Emit to conversation room (users viewing this conversation)
  io.to(`conversation:${threadId}`).emit('message:new', {
    conversationId: threadId,
    message: messageData,
  });

  // Emit to tenant room (for updating conversation list, unread counts, etc.)
  io.to(`tenant:${tenantId}`).emit('conversation:updated', {
    conversationId: threadId,
    lastMessage: messageData,
  });
}

/**
 * Broadcast message status update
 */
export function broadcastMessageStatus(
  tenantId,
  messageId,
  conversationId,
  status,
  failureReason = null
) {
  if (!io) return;

  const payload = {
    messageId,
    conversationId,
    status,
    failureReason,
  };

  // Emit to conversation room (users viewing this conversation)
  io.to(`conversation:${conversationId}`).emit('message:status', payload);

  logger.debug(
    {
      messageId,
      conversationId,
      status,
      failureReason,
    },
    'Message status broadcast via WebSocket'
  );
}

/**
 * Broadcast conversation update (new conversation, status change, etc.)
 */
export function broadcastConversationUpdate(tenantId, conversation) {
  if (!io) return;

  io.to(`tenant:${tenantId}`).emit('conversation:updated', {
    conversation,
  });
}

export default {
  initializeSocketIO,
  getIO,
  emitToTenant,
  emitToUser,
  emitToConversation,
  broadcastNewMessage,
  broadcastMessageStatus,
  broadcastConversationUpdate,
};
