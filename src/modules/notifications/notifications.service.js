/**
 * Notifications Service
 * Handles notification creation and real-time delivery
 */

import { prisma } from '@crm360/database';
import { getIO } from '../../common/websocket/socket.service.js';

/**
 * Create a notification and emit via WebSocket
 */
export async function createNotification({
  tenantId,
  userId,
  type,
  title,
  message,
  data = null,
  expiresAt = null,
}) {
  const notification = await prisma.notification.create({
    data: {
      tenantId,
      userId,
      type,
      title,
      message,
      data,
      expiresAt,
    },
  });

  // Emit to user's socket room
  try {
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit('notification:new', notification);
    }
  } catch (error) {
    console.error('Failed to emit notification:', error);
  }

  return notification;
}

/**
 * Create notifications for multiple users
 */
export async function createBulkNotifications({
  tenantId,
  userIds,
  type,
  title,
  message,
  data = null,
}) {
  const notifications = await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      tenantId,
      userId,
      type,
      title,
      message,
      data,
    })),
  });

  // Emit to each user's socket room
  try {
    const io = getIO();
    if (io) {
      userIds.forEach((userId) => {
        io.to(`user:${userId}`).emit('notification:new', {
          type,
          title,
          message,
          data,
          createdAt: new Date(),
        });
      });
    }
  } catch (error) {
    console.error('Failed to emit bulk notifications:', error);
  }

  return notifications;
}

/**
 * Delete old notifications (cleanup job)
 */
export async function cleanupExpiredNotifications() {
  const result = await prisma.notification.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        {
          createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30 days old
          read: true,
        },
      ],
    },
  });
  return result.count;
}

export const notificationService = {
  createNotification,
  createBulkNotifications,
  cleanupExpiredNotifications,
};
