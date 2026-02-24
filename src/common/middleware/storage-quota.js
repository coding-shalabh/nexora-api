/**
 * Storage Quota Middleware
 *
 * Enforces S3 storage limits based on tenant's subscription plan
 *
 * Plan Limits:
 * - free: 1GB
 * - starter: 10GB
 * - professional: 50GB
 * - enterprise: 250GB
 */

import { db } from '../../config/database.js';
import { logger } from '../logger.js';

// Storage limits in bytes
const STORAGE_LIMITS = {
  free: 1 * 1024 * 1024 * 1024, // 1GB
  starter: 10 * 1024 * 1024 * 1024, // 10GB
  professional: 50 * 1024 * 1024 * 1024, // 50GB
  enterprise: 250 * 1024 * 1024 * 1024, // 250GB
};

// Default limit if plan not found
const DEFAULT_LIMIT = STORAGE_LIMITS.free;

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Get tenant's current subscription and storage limit
 */
export async function getTenantStorageInfo(tenantId) {
  try {
    // Get tenant with active subscription
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        storageUsed: true,
        subscriptions: {
          where: {
            status: {
              in: ['ACTIVE', 'TRIALING'],
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: 1,
          include: {
            plan: {
              select: {
                name: true,
                storageGb: true,
              },
            },
          },
        },
      },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Get plan details
    const subscription = tenant.subscriptions[0];
    const planName = subscription?.plan?.name?.toLowerCase() || 'free';
    const planStorageGb = subscription?.plan?.storageGb || 1;

    // Calculate limit (use plan's storageGb or fallback to predefined limits)
    const limit = STORAGE_LIMITS[planName] || planStorageGb * 1024 * 1024 * 1024 || DEFAULT_LIMIT;

    return {
      tenantId: tenant.id,
      storageUsed: Number(tenant.storageUsed || 0),
      storageLimit: limit,
      planName,
      planStorageGb,
    };
  } catch (error) {
    logger.error('Error getting tenant storage info:', error);
    throw error;
  }
}

/**
 * Check if tenant has enough storage quota for file upload
 */
export async function checkStorageQuota(tenantId, fileSize) {
  try {
    const storageInfo = await getTenantStorageInfo(tenantId);

    const { storageUsed, storageLimit, planName } = storageInfo;
    const newTotal = storageUsed + fileSize;

    logger.info('Storage quota check:', {
      tenantId,
      planName,
      storageUsed: formatBytes(storageUsed),
      storageLimit: formatBytes(storageLimit),
      fileSize: formatBytes(fileSize),
      newTotal: formatBytes(newTotal),
      percentUsed: ((newTotal / storageLimit) * 100).toFixed(2) + '%',
    });

    if (newTotal > storageLimit) {
      const usedPercent = ((storageUsed / storageLimit) * 100).toFixed(1);
      throw new Error(
        `Storage quota exceeded. Current usage: ${formatBytes(storageUsed)} (${usedPercent}%) of ${formatBytes(storageLimit)} limit. Cannot upload ${formatBytes(fileSize)} file. Please upgrade your plan or delete old files.`
      );
    }

    return {
      allowed: true,
      storageUsed,
      storageLimit,
      newTotal,
      remaining: storageLimit - newTotal,
    };
  } catch (error) {
    logger.error('Storage quota check failed:', error);
    throw error;
  }
}

/**
 * Update tenant's storage usage after successful upload
 */
export async function incrementStorageUsage(tenantId, fileSize) {
  try {
    const updated = await db.tenant.update({
      where: { id: tenantId },
      data: {
        storageUsed: {
          increment: BigInt(fileSize),
        },
      },
      select: {
        id: true,
        storageUsed: true,
      },
    });

    logger.info('Storage usage updated:', {
      tenantId,
      fileSize: formatBytes(fileSize),
      newTotal: formatBytes(Number(updated.storageUsed)),
    });

    return updated;
  } catch (error) {
    logger.error('Error incrementing storage usage:', error);
    throw error;
  }
}

/**
 * Update tenant's storage usage after file deletion
 */
export async function decrementStorageUsage(tenantId, fileSize) {
  try {
    // Ensure we don't go below 0
    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { storageUsed: true },
    });

    const currentUsage = Number(tenant.storageUsed || 0);
    const newUsage = Math.max(0, currentUsage - fileSize);

    const updated = await db.tenant.update({
      where: { id: tenantId },
      data: {
        storageUsed: BigInt(newUsage),
      },
      select: {
        id: true,
        storageUsed: true,
      },
    });

    logger.info('Storage usage decreased:', {
      tenantId,
      fileSize: formatBytes(fileSize),
      newTotal: formatBytes(Number(updated.storageUsed)),
    });

    return updated;
  } catch (error) {
    logger.error('Error decrementing storage usage:', error);
    throw error;
  }
}

/**
 * Get storage usage statistics for tenant
 */
export async function getStorageStats(tenantId) {
  try {
    const storageInfo = await getTenantStorageInfo(tenantId);
    const { storageUsed, storageLimit, planName, planStorageGb } = storageInfo;

    const percentUsed = ((storageUsed / storageLimit) * 100).toFixed(2);
    const remaining = storageLimit - storageUsed;

    return {
      tenantId,
      plan: {
        name: planName,
        storageGb: planStorageGb,
      },
      usage: {
        used: storageUsed,
        usedFormatted: formatBytes(storageUsed),
        limit: storageLimit,
        limitFormatted: formatBytes(storageLimit),
        remaining,
        remainingFormatted: formatBytes(remaining),
        percentUsed: parseFloat(percentUsed),
      },
      warnings: {
        nearLimit: percentUsed >= 80,
        exceeded: storageUsed >= storageLimit,
      },
    };
  } catch (error) {
    logger.error('Error getting storage stats:', error);
    throw error;
  }
}

/**
 * Express middleware to check storage quota before file upload
 */
export function storageQuotaMiddleware(req, res, next) {
  // Skip if no file in request
  if (!req.file && !req.files) {
    return next();
  }

  const tenantId = req.tenantId || req.user?.tenantId;

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      error: 'Tenant ID not found in request',
    });
  }

  // Calculate total file size
  let totalFileSize = 0;

  if (req.file) {
    totalFileSize = req.file.size;
  } else if (req.files) {
    if (Array.isArray(req.files)) {
      totalFileSize = req.files.reduce((sum, file) => sum + file.size, 0);
    } else {
      // Handle multer fields object
      totalFileSize = Object.values(req.files)
        .flat()
        .reduce((sum, file) => sum + file.size, 0);
    }
  }

  if (totalFileSize === 0) {
    return next();
  }

  // Check quota
  checkStorageQuota(tenantId, totalFileSize)
    .then((result) => {
      // Attach storage info to request for later use
      req.storageQuota = result;
      next();
    })
    .catch((error) => {
      logger.warn('Storage quota exceeded:', {
        tenantId,
        fileSize: formatBytes(totalFileSize),
        error: error.message,
      });

      return res.status(413).json({
        success: false,
        error: error.message,
        code: 'STORAGE_QUOTA_EXCEEDED',
      });
    });
}

export default {
  checkStorageQuota,
  incrementStorageUsage,
  decrementStorageUsage,
  getStorageStats,
  getTenantStorageInfo,
  storageQuotaMiddleware,
  formatBytes,
  STORAGE_LIMITS,
};
