/**
 * Uploads Router
 * Handles file uploads for images, logos, and other assets
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate, authorize } from '../../common/middleware/authenticate.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const router = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ============ ROOT ENDPOINT ============

/**
 * Get uploads overview
 * GET /uploads
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    // TODO: Get actual storage stats
    res.json({
      success: true,
      data: {
        available: true,
        storageUsed: 0,
        storageLimit: 10737418240, // 10GB
        totalFiles: 0,
        message: 'File upload service is available',
        endpoints: {
          upload: 'POST /uploads',
          files: 'GET /uploads/files',
          categories: 'GET /uploads/files/categories',
          stats: 'GET /uploads/files/stats',
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============ FILE LISTING & STATS ============

/**
 * Get files list
 * GET /files
 */
router.get('/files', authenticate, async (req, res, next) => {
  try {
    const params = z
      .object({
        page: z.coerce.number().min(1).default(1),
        limit: z.coerce.number().min(1).max(100).default(25),
        category: z.string().optional(),
        folder: z.string().optional(),
      })
      .parse(req.query);

    // TODO: Implement actual file listing from storage
    // For now, return empty array with proper structure
    res.json({
      success: true,
      data: [],
      meta: {
        total: 0,
        page: params.page,
        limit: params.limit,
        totalPages: 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get file categories
 * GET /files/categories
 */
router.get('/files/categories', authenticate, async (req, res, next) => {
  try {
    // Return standard file categories
    res.json({
      success: true,
      data: [
        { id: 'documents', name: 'Documents', extensions: ['.pdf', '.doc', '.docx', '.txt'] },
        { id: 'images', name: 'Images', extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'] },
        { id: 'spreadsheets', name: 'Spreadsheets', extensions: ['.xls', '.xlsx', '.csv'] },
        { id: 'presentations', name: 'Presentations', extensions: ['.ppt', '.pptx'] },
        { id: 'archives', name: 'Archives', extensions: ['.zip', '.rar', '.7z', '.tar'] },
        { id: 'other', name: 'Other', extensions: [] },
      ],
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get file storage stats
 * GET /files/stats
 */
router.get('/files/stats', authenticate, async (req, res, next) => {
  try {
    // TODO: Implement actual storage stats calculation
    // For now, return default values
    res.json({
      success: true,
      data: {
        totalFiles: 0,
        totalSize: 0,
        usedSpace: 0,
        availableSpace: 10737418240, // 10GB in bytes
        storageLimit: 10737418240,
        byCategory: {
          documents: 0,
          images: 0,
          spreadsheets: 0,
          presentations: 0,
          archives: 0,
          other: 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============ FILE UPLOAD ============

/**
 * General file upload endpoint
 * POST /uploads
 */
router.post('/', authenticate, async (req, res, next) => {
  try {
    const data = z
      .object({
        file: z.string(), // base64 encoded file
        filename: z.string(),
        category: z.string().optional(),
        folder: z.string().optional(),
      })
      .parse(req.body);

    // TODO: Implement actual file upload to storage
    // For now, return mock uploaded file
    const uploadedFile = {
      id: 'file_' + Date.now(),
      filename: data.filename,
      category: data.category || 'other',
      folder: data.folder || 'uploads',
      size: Math.floor(data.file.length * 0.75), // Approximate size from base64
      url: `/uploads/${data.folder || 'uploads'}/${data.filename}`,
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.userId,
      tenantId: req.tenantId,
    };

    res.status(201).json({
      success: true,
      data: uploadedFile,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Upload image from base64
 * POST /uploads/image
 */
router.post('/image', authenticate, async (req, res, next) => {
  try {
    const schema = z.object({
      image: z.string().min(1, 'Image data is required'),
      filename: z.string().optional(),
      folder: z.enum(['logos', 'avatars', 'attachments', 'general']).default('general'),
    });

    const { image, filename, folder } = schema.parse(req.body);
    const tenantId = req.tenantId;

    // Parse base64 image
    const matches = image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_IMAGE',
        message: 'Invalid base64 image format. Expected: data:image/[type];base64,[data]',
      });
    }

    const [, imageType, base64Data] = matches;
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate image size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: 'Image size must be less than 5MB',
      });
    }

    // Validate image type
    const allowedTypes = ['jpeg', 'jpg', 'png', 'gif', 'webp', 'svg+xml'];
    const normalizedType = imageType.toLowerCase();
    if (!allowedTypes.some((t) => normalizedType.includes(t))) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TYPE',
        message: 'Only JPEG, PNG, GIF, WebP, and SVG images are allowed',
      });
    }

    // Generate unique filename
    const ext = normalizedType.includes('svg') ? 'svg' : normalizedType.replace('jpeg', 'jpg');
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const sanitizedFilename = filename
      ? filename.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 50)
      : 'image';
    const finalFilename = `${tenantId}_${folder}_${sanitizedFilename}_${uniqueId}.${ext}`;

    // Create folder if needed
    const folderPath = path.join(UPLOADS_DIR, folder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Save file
    const filePath = path.join(folderPath, finalFilename);
    fs.writeFileSync(filePath, buffer);

    // Generate URL - use API_URL for uploads since files are stored on API server
    const baseUrl = process.env.API_URL || 'https://api.nexoraos.pro';
    const imageUrl = `${baseUrl}/uploads/${folder}/${finalFilename}`;

    res.status(201).json({
      success: true,
      data: {
        url: imageUrl,
        filename: finalFilename,
        size: buffer.length,
        type: `image/${imageType}`,
        folder,
      },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.errors[0]?.message || 'Invalid request data',
      });
    }
    next(error);
  }
});

/**
 * Upload logo specifically for organization branding
 * POST /uploads/logo
 */
router.post('/logo', authenticate, authorize('settings:update'), async (req, res, next) => {
  try {
    const schema = z.object({
      image: z.string().min(1, 'Image data is required'),
    });

    const { image } = schema.parse(req.body);
    const tenantId = req.tenantId;

    // Parse base64 image
    const matches = image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_IMAGE',
        message: 'Invalid base64 image format',
      });
    }

    const [, imageType, base64Data] = matches;
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate size (max 2MB for logos)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: 'Logo size must be less than 2MB',
      });
    }

    // Generate filename - handle svg+xml correctly
    const normalizedType = imageType.toLowerCase();
    const ext = normalizedType.includes('svg') ? 'svg' : normalizedType.replace('jpeg', 'jpg');
    const uniqueId = crypto.randomBytes(4).toString('hex');
    const finalFilename = `logo_${tenantId}_${uniqueId}.${ext}`;

    // Create logos folder
    const folderPath = path.join(UPLOADS_DIR, 'logos');
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Save file
    const filePath = path.join(folderPath, finalFilename);
    fs.writeFileSync(filePath, buffer);

    // Generate URL - use API_URL for uploads since files are stored on API server
    const baseUrl = process.env.API_URL || 'https://api.nexoraos.pro';
    const logoUrl = `${baseUrl}/uploads/logos/${finalFilename}`;

    res.status(201).json({
      success: true,
      data: {
        url: logoUrl,
        filename: finalFilename,
        size: buffer.length,
      },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.errors[0]?.message || 'Invalid request data',
      });
    }
    next(error);
  }
});

/**
 * Upload favicon specifically for organization branding
 * POST /uploads/favicon
 */
router.post('/favicon', authenticate, authorize('settings:update'), async (req, res, next) => {
  try {
    const schema = z.object({
      image: z.string().min(1, 'Image data is required'),
    });

    const { image } = schema.parse(req.body);
    const tenantId = req.tenantId;

    // Parse base64 image
    const matches = image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_IMAGE',
        message: 'Invalid base64 image format',
      });
    }

    const [, imageType, base64Data] = matches;
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate size (max 100KB for favicon)
    const MAX_SIZE = 100 * 1024;
    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({
        success: false,
        error: 'FILE_TOO_LARGE',
        message: 'Favicon size must be less than 100KB',
      });
    }

    // Validate type (ICO or PNG only)
    const normalizedType = imageType.toLowerCase();
    if (!['png', 'x-icon', 'vnd.microsoft.icon'].some((t) => normalizedType.includes(t))) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_TYPE',
        message: 'Only ICO and PNG formats are allowed for favicon',
      });
    }

    // Generate filename
    const ext = normalizedType.includes('icon') ? 'ico' : 'png';
    const uniqueId = crypto.randomBytes(4).toString('hex');
    const finalFilename = `favicon_${tenantId}_${uniqueId}.${ext}`;

    // Create favicons folder
    const folderPath = path.join(UPLOADS_DIR, 'favicons');
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    // Save file
    const filePath = path.join(folderPath, finalFilename);
    fs.writeFileSync(filePath, buffer);

    // Generate URL
    const baseUrl = process.env.API_URL || 'https://api.nexoraos.pro';
    const faviconUrl = `${baseUrl}/uploads/favicons/${finalFilename}`;

    res.status(201).json({
      success: true,
      data: {
        url: faviconUrl,
        filename: finalFilename,
        size: buffer.length,
      },
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: error.errors[0]?.message || 'Invalid request data',
      });
    }
    next(error);
  }
});

/**
 * Delete an uploaded file
 * DELETE /uploads/:folder/:filename
 */
router.delete('/:folder/:filename', authenticate, async (req, res, next) => {
  try {
    const { folder, filename } = req.params;
    const tenantId = req.tenantId;

    // Verify the file belongs to this tenant
    if (!filename.startsWith(tenantId) && !filename.startsWith(`logo_${tenantId}`)) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'You do not have permission to delete this file',
      });
    }

    const filePath = path.join(UPLOADS_DIR, folder, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'File not found',
      });
    }

    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
