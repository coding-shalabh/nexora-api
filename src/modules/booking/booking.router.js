/**
 * Booking Router - Public booking pages and calendar availability
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { bookingService } from '../../services/booking.service.js';
import { requireAuth, requirePermission } from '../../middleware/auth.middleware.js';

const router = new Hono();

// Validation schemas
const createBookingPageSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(100),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  meetingDuration: z.number().min(15).max(480).optional(),
  bufferTimeBefore: z.number().min(0).max(120).optional(),
  bufferTimeAfter: z.number().min(0).max(120).optional(),
  timezone: z.string().optional(),
  workingHours: z.record(z.any()).optional(),
  connectedPlatform: z.enum(['google', 'microsoft', 'zoom']).optional(),
  checkCalendarBusy: z.boolean().optional(),
  sendReminders: z.boolean().optional(),
  reminderTimings: z.array(z.number()).optional(),
  requireApproval: z.boolean().optional(),
  customFields: z.array(z.any()).optional(),
  confirmationMessage: z.string().optional(),
  redirectUrl: z.string().url().optional(),
});

const createBookingSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  selectedSlot: z.object({
    start: z.string(),
    end: z.string(),
  }),
  notes: z.string().optional(),
  customFields: z.record(z.any()).optional(),
});

// Protected routes (require authentication)

/**
 * POST /booking-pages - Create a new booking page
 */
router.post(
  '/booking-pages',
  requireAuth,
  requirePermission('settings:manage'),
  async (req, res, next) => {
    try {
      const data = createBookingPageSchema.parse(await req.json());
      const { id: userId } = req.user;

      const bookingPage = await bookingService.createBookingPage(req.tenantId, userId, data);

      res.status(201).json({
        success: true,
        data: bookingPage,
        message: 'Booking page created successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /booking-pages - Get all booking pages for the authenticated user
 */
router.get('/booking-pages', requireAuth, async (req, res, next) => {
  try {
    const { id: userId } = req.user;
    const bookingPages = await bookingService.getBookingPages(req.tenantId, userId);

    res.json({ success: true, data: bookingPages });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /booking-pages/:id/bookings - Get bookings for a specific booking page
 */
router.get('/booking-pages/:id/bookings', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, startDate, endDate } = req.query;

    const bookings = await bookingService.getBookings(req.tenantId, id, {
      status,
      startDate,
      endDate,
    });

    res.json({ success: true, data: bookings });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /bookings/:id/approve - Approve a pending booking
 */
router.post(
  '/bookings/:id/approve',
  requireAuth,
  requirePermission('crm:activities:create'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const result = await bookingService.approveBooking(req.tenantId, id);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /bookings/:id/reject - Reject a pending booking
 */
router.post(
  '/bookings/:id/reject',
  requireAuth,
  requirePermission('crm:activities:create'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { reason } = await req.json();

      const result = await bookingService.rejectBooking(req.tenantId, id, reason);

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /bookings/:id - Cancel a booking
 */
router.delete('/bookings/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await bookingService.cancelBooking(id);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Public routes (no authentication required)

/**
 * GET /book/:slug - Get booking page details (public)
 */
router.get('/book/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const bookingPage = await bookingService.getBookingPageBySlug(slug);

    res.json({ success: true, data: bookingPage });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /book/:slug/availability - Get available time slots (public)
 */
router.get('/book/:slug/availability', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'startDate and endDate are required',
      });
    }

    const availableSlots = await bookingService.getAvailableSlots(slug, startDate, endDate);

    res.json({ success: true, data: availableSlots });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /book/:slug - Create a booking (public)
 */
router.post('/book/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const data = createBookingSchema.parse(await req.json());

    const booking = await bookingService.createBooking(slug, data);

    res.status(201).json({
      success: true,
      data: booking,
      message:
        booking.status === 'PENDING'
          ? 'Booking request submitted and awaiting approval'
          : 'Booking confirmed successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
