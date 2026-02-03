/**
 * Email Send Router
 * API endpoints for sending emails and tracking
 */

import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../common/middleware/authenticate.js';
import {
  sendEmail,
  trackEmailOpen,
  trackEmailClick,
  getEmail,
  getEmails,
  getEmailAnalytics,
  deleteEmail,
} from '../../services/email-send.service.js';

const router = Router();

// 1x1 transparent GIF for tracking pixel
const TRACKING_PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

// Validation schemas
// Attachment schema (base64 encoded files)
const attachmentSchema = z.object({
  filename: z.string(),
  content: z.string(), // base64 encoded content
  contentType: z.string(),
  size: z.number().optional(),
});

const sendEmailSchema = z.object({
  accountId: z.string().optional(),
  fromName: z.string().optional(),
  to: z.union([z.string().email(), z.array(z.string().email())]),
  cc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  bcc: z.union([z.string().email(), z.array(z.string().email())]).optional(),
  replyTo: z.string().email().optional(),
  subject: z.string().min(1),
  bodyHtml: z.string().optional(),
  bodyText: z.string().optional(),
  trackOpens: z.boolean().default(true),
  trackClicks: z.boolean().default(true),
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
  attachments: z.array(attachmentSchema).optional(),
});

/**
 * POST /api/v1/email/send
 * Send an email
 */
router.post('/send', authenticate, async (req, res, next) => {
  try {
    const data = sendEmailSchema.parse(req.body);

    const result = await sendEmail({
      tenantId: req.user.tenantId,
      createdById: req.user.userId,
      ...data,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/email/list
 * Get list of emails
 */
router.get('/list', authenticate, async (req, res, next) => {
  try {
    const { page, limit, status, direction, contactId, dealId, search } = req.query;

    const result = await getEmails(req.user.tenantId, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 25,
      status,
      direction,
      contactId,
      dealId,
      search,
    });

    res.json({
      success: true,
      data: result.emails,
      meta: result.meta,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/email/analytics
 * Get email analytics
 */
router.get('/analytics', authenticate, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    const result = await getEmailAnalytics(req.user.tenantId, {
      startDate,
      endDate,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/email/:id
 * Get single email with tracking details
 */
router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const email = await getEmail(req.user.tenantId, req.params.id);

    if (!email) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Email not found' },
      });
    }

    res.json({
      success: true,
      data: email,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/email/:id
 * Delete an email
 */
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    await deleteEmail(req.user.tenantId, req.params.id);

    res.json({
      success: true,
      message: 'Email deleted',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/email/track/open/:trackingId
 * Track email open (returns 1x1 transparent GIF)
 */
router.get('/track/open/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;

    // Track the open event
    await trackEmailOpen(trackingId, {
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  } catch (error) {
    console.error('[EmailTrack] Open tracking error:', error.message);
  }

  // Always return the tracking pixel
  res.set({
    'Content-Type': 'image/gif',
    'Content-Length': TRACKING_PIXEL.length,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
  res.send(TRACKING_PIXEL);
});

/**
 * GET /api/v1/email/track/click/:trackingId
 * Track email click and redirect to original URL
 */
router.get('/track/click/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { url } = req.query;

    if (!url) {
      return res.status(400).send('Missing URL parameter');
    }

    const decodedUrl = decodeURIComponent(url);

    // Track the click event
    await trackEmailClick(trackingId, decodedUrl, {
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
    });

    // Redirect to the original URL
    res.redirect(302, decodedUrl);
  } catch (error) {
    console.error('[EmailTrack] Click tracking error:', error.message);

    // Try to redirect anyway
    const { url } = req.query;
    if (url) {
      res.redirect(302, decodeURIComponent(url));
    } else {
      res.status(500).send('Tracking error');
    }
  }
});

export { router as emailSendRouter };
