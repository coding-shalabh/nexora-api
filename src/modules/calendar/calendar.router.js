import { Router } from 'express';
import { z } from 'zod';
import { calendarService } from './calendar.service.js';
import { validate } from '../../common/middleware/validate.js';

const router = Router();

// Validation schemas
const createEventSchema = z.object({
  body: z.object({
    title: z.string().min(1, 'Title is required').max(500),
    description: z.string().optional().nullable(),
    type: z.enum(['MEETING', 'CALL', 'TASK', 'REMINDER', 'DEADLINE', 'OTHER']).optional(),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    allDay: z.boolean().optional(),
    timezone: z.string().optional(),
    location: z.string().optional().nullable(),
    meetingUrl: z.string().url().optional().nullable(),
    isRecurring: z.boolean().optional(),
    recurrence: z.any().optional().nullable(),
    status: z.enum(['SCHEDULED', 'CONFIRMED', 'TENTATIVE', 'CANCELLED']).optional(),
    attendees: z.array(z.any()).optional().nullable(),
    reminders: z.array(z.any()).optional().nullable(),
    color: z.string().optional().nullable(),
    metadata: z.record(z.any()).optional().nullable(),
  }),
});

const updateEventSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().optional().nullable(),
    type: z.enum(['MEETING', 'CALL', 'TASK', 'REMINDER', 'DEADLINE', 'OTHER']).optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    allDay: z.boolean().optional(),
    timezone: z.string().optional(),
    location: z.string().optional().nullable(),
    meetingUrl: z.string().url().optional().nullable(),
    isRecurring: z.boolean().optional(),
    recurrence: z.any().optional().nullable(),
    status: z.enum(['SCHEDULED', 'CONFIRMED', 'TENTATIVE', 'CANCELLED']).optional(),
    attendees: z.array(z.any()).optional().nullable(),
    reminders: z.array(z.any()).optional().nullable(),
    color: z.string().optional().nullable(),
    metadata: z.record(z.any()).optional().nullable(),
  }),
});

// GET /calendar - List events
router.get('/', async (req, res) => {
  try {
    const { tenantId } = req;
    const filters = {
      search: req.query.search,
      type: req.query.type,
      status: req.query.status,
      from: req.query.from,
      to: req.query.to,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      organizerId: req.query.organizerId,
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 100,
    };

    const result = await calendarService.getEvents(tenantId, filters);
    res.json(result);
  } catch (error) {
    console.error('Failed to get events:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// GET /calendar/upcoming - Get upcoming events
router.get('/upcoming', async (req, res) => {
  try {
    const { tenantId, userId } = req;
    const days = parseInt(req.query.days) || 7;

    const events = await calendarService.getUpcomingEvents(tenantId, userId, days);
    res.json({ events });
  } catch (error) {
    console.error('Failed to get upcoming events:', error);
    res.status(500).json({ error: 'Failed to get upcoming events' });
  }
});

// GET /calendar/stats - Get event statistics
router.get('/stats', async (req, res) => {
  try {
    const { tenantId } = req;
    const filters = {
      from: req.query.from,
      to: req.query.to,
    };

    const stats = await calendarService.getEventStats(tenantId, filters);
    res.json(stats);
  } catch (error) {
    console.error('Failed to get event stats:', error);
    res.status(500).json({ error: 'Failed to get event stats' });
  }
});

// GET /calendar/:id - Get single event
router.get('/:id', async (req, res) => {
  try {
    const { tenantId } = req;
    const event = await calendarService.getEvent(tenantId, req.params.id);
    res.json(event);
  } catch (error) {
    console.error('Failed to get event:', error);
    if (error.message === 'Event not found') {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(500).json({ error: 'Failed to get event' });
  }
});

// POST /calendar - Create event
router.post('/', validate(createEventSchema), async (req, res) => {
  try {
    const { tenantId, userId } = req;
    const event = await calendarService.createEvent(tenantId, userId, req.body);
    res.status(201).json(event);
  } catch (error) {
    console.error('Failed to create event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// PATCH /calendar/:id - Update event
router.patch('/:id', validate(updateEventSchema), async (req, res) => {
  try {
    const { tenantId } = req;
    const event = await calendarService.updateEvent(tenantId, req.params.id, req.body);
    res.json(event);
  } catch (error) {
    console.error('Failed to update event:', error);
    if (error.message === 'Event not found') {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /calendar/:id - Delete event
router.delete('/:id', async (req, res) => {
  try {
    const { tenantId } = req;
    await calendarService.deleteEvent(tenantId, req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete event:', error);
    if (error.message === 'Event not found') {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

export { router as calendarRouter };
