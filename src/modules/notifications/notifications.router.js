/**
 * Notifications Router
 * Handles notification CRUD operations
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import { prisma } from '@crm360/database';

const router = Router();

/**
 * Get user notifications
 * GET /notifications
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    // Notifications table doesn't exist in VPS production database yet
    // Return empty data to prevent 500 errors
    res.json({
      success: true,
      data: [],
      meta: {
        total: 0,
        unreadCount: 0,
        limit: parseInt(limit),
        offset: parseInt(offset),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get unread count
 * GET /notifications/unread-count
 */
router.get('/unread-count', authenticate, async (req, res, next) => {
  try {
    // Notifications table doesn't exist in VPS production database yet
    res.json({
      success: true,
      data: { count: 0 },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Mark notification as read
 * PATCH /notifications/:id/read
 */
router.patch('/:id/read', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req;
    const userId = req.user.id;
    const { id } = req.params;

    const notification = await prisma.notification.updateMany({
      where: { id, tenantId, userId },
      data: { read: true, readAt: new Date() },
    });

    if (notification.count === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Mark all notifications as read
 * PATCH /notifications/read-all
 */
router.patch('/read-all', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req;
    const userId = req.user.id;

    await prisma.notification.updateMany({
      where: { tenantId, userId, read: false },
      data: { read: true, readAt: new Date() },
    });

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a notification
 * DELETE /notifications/:id
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req;
    const userId = req.user.id;
    const { id } = req.params;

    const notification = await prisma.notification.deleteMany({
      where: { id, tenantId, userId },
    });

    if (notification.count === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Clear all notifications
 * DELETE /notifications
 */
router.delete('/', authenticate, async (req, res, next) => {
  try {
    const { tenantId } = req;
    const userId = req.user.id;

    await prisma.notification.deleteMany({
      where: { tenantId, userId },
    });

    res.json({
      success: true,
      message: 'All notifications cleared',
    });
  } catch (error) {
    next(error);
  }
});

export { router as notificationsRouter };
