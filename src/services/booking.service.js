/**
 * Booking Service - Handle public booking pages and calendar availability
 */

import { prisma } from '@crm360/database';
import { oauthService } from './oauth.service.js';
import { calendarService } from './calendar.service.js';
import { scheduleMeetingReminder } from '../jobs/meeting-reminders.job.js';
import axios from 'axios';

export const bookingService = {
  /**
   * Create a public booking page
   */
  async createBookingPage(tenantId, userId, data) {
    const bookingPage = await prisma.bookingPage.create({
      data: {
        tenantId,
        userId,
        slug: data.slug,
        title: data.title,
        description: data.description,
        isActive: data.isActive ?? true,
        meetingDuration: data.meetingDuration || 30,
        bufferTimeBefore: data.bufferTimeBefore || 0,
        bufferTimeAfter: data.bufferTimeAfter || 0,
        timezone: data.timezone || 'UTC',
        workingHours: data.workingHours || {
          monday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
          tuesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
          wednesday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
          thursday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
          friday: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] },
          saturday: { enabled: false, slots: [] },
          sunday: { enabled: false, slots: [] },
        },
        connectedPlatform: data.connectedPlatform,
        checkCalendarBusy: data.checkCalendarBusy ?? true,
        sendReminders: data.sendReminders ?? true,
        reminderTimings: data.reminderTimings || [1440, 60], // 24h and 1h before
        requireApproval: data.requireApproval ?? false,
        customFields: data.customFields || [],
        confirmationMessage: data.confirmationMessage,
        redirectUrl: data.redirectUrl,
      },
    });

    return bookingPage;
  },

  /**
   * Get booking page by slug (public endpoint)
   */
  async getBookingPageBySlug(slug) {
    const bookingPage = await prisma.bookingPage.findFirst({
      where: { slug, isActive: true },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    if (!bookingPage) {
      throw new Error('Booking page not found or inactive');
    }

    return bookingPage;
  },

  /**
   * Get available time slots for a booking page
   */
  async getAvailableSlots(slug, startDate, endDate) {
    const bookingPage = await this.getBookingPageBySlug(slug);
    const {
      userId,
      meetingDuration,
      bufferTimeBefore,
      bufferTimeAfter,
      timezone,
      workingHours,
      connectedPlatform,
      checkCalendarBusy,
    } = bookingPage;

    // Get existing bookings in this date range
    const existingBookings = await prisma.bookingSlot.findMany({
      where: {
        bookingPageId: bookingPage.id,
        startTime: { gte: new Date(startDate) },
        endTime: { lte: new Date(endDate) },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      select: { startTime: true, endTime: true },
    });

    // Get user's calendar busy times if calendar checking is enabled
    let calendarBusyTimes = [];
    if (checkCalendarBusy && connectedPlatform) {
      try {
        calendarBusyTimes = await this.getCalendarBusyTimes(
          userId,
          connectedPlatform,
          startDate,
          endDate
        );
      } catch (error) {
        console.error('Failed to fetch calendar busy times:', error.message);
        // Continue without calendar checking if it fails
      }
    }

    // Generate available slots based on working hours
    const availableSlots = this.generateAvailableSlots(
      startDate,
      endDate,
      workingHours,
      meetingDuration,
      bufferTimeBefore,
      bufferTimeAfter,
      timezone,
      existingBookings,
      calendarBusyTimes
    );

    return availableSlots;
  },

  /**
   * Get busy times from user's connected calendar
   */
  async getCalendarBusyTimes(userId, platform, startDate, endDate) {
    const accessToken = await oauthService.getAccessToken(userId, platform);

    if (platform === 'google') {
      return await this.getGoogleBusyTimes(accessToken, startDate, endDate);
    } else if (platform === 'microsoft') {
      return await this.getMicrosoftBusyTimes(accessToken, startDate, endDate);
    }

    return [];
  },

  /**
   * Get busy times from Google Calendar
   */
  async getGoogleBusyTimes(accessToken, startDate, endDate) {
    try {
      const response = await axios.post(
        'https://www.googleapis.com/calendar/v3/freeBusy',
        {
          timeMin: new Date(startDate).toISOString(),
          timeMax: new Date(endDate).toISOString(),
          items: [{ id: 'primary' }],
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const busyTimes = response.data.calendars.primary.busy || [];
      return busyTimes.map((slot) => ({
        start: new Date(slot.start),
        end: new Date(slot.end),
      }));
    } catch (error) {
      console.error('Google Calendar free/busy error:', error.response?.data || error.message);
      throw new Error('Failed to check Google Calendar availability');
    }
  },

  /**
   * Get busy times from Microsoft Calendar
   */
  async getMicrosoftBusyTimes(accessToken, startDate, endDate) {
    try {
      const response = await axios.post(
        'https://graph.microsoft.com/v1.0/me/calendar/getSchedule',
        {
          schedules: ['user@example.com'],
          startTime: { dateTime: new Date(startDate).toISOString(), timeZone: 'UTC' },
          endTime: { dateTime: new Date(endDate).toISOString(), timeZone: 'UTC' },
        },
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      const busyTimes = response.data.value[0]?.scheduleItems || [];
      return busyTimes
        .filter((item) => item.status === 'busy')
        .map((slot) => ({
          start: new Date(slot.start.dateTime),
          end: new Date(slot.end.dateTime),
        }));
    } catch (error) {
      console.error('Microsoft Calendar free/busy error:', error.response?.data || error.message);
      throw new Error('Failed to check Microsoft Calendar availability');
    }
  },

  /**
   * Generate available time slots based on working hours and busy times
   */
  generateAvailableSlots(
    startDate,
    endDate,
    workingHours,
    duration,
    bufferBefore,
    bufferAfter,
    timezone,
    existingBookings,
    calendarBusy
  ) {
    const slots = [];
    const daysOfWeek = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ];

    let currentDate = new Date(startDate);
    const endDateTime = new Date(endDate);

    while (currentDate <= endDateTime) {
      const dayName = daysOfWeek[currentDate.getDay()];
      const dayConfig = workingHours[dayName];

      if (dayConfig?.enabled) {
        for (const slot of dayConfig.slots) {
          const [startHour, startMinute] = slot.start.split(':').map(Number);
          const [endHour, endMinute] = slot.end.split(':').map(Number);

          const slotStart = new Date(currentDate);
          slotStart.setHours(startHour, startMinute, 0, 0);

          const slotEnd = new Date(currentDate);
          slotEnd.setHours(endHour, endMinute, 0, 0);

          // Generate time slots within working hours
          let timeSlot = new Date(slotStart);
          while (timeSlot < slotEnd) {
            const slotEndTime = new Date(timeSlot.getTime() + duration * 60000);

            if (slotEndTime <= slotEnd) {
              // Check if slot conflicts with existing bookings
              const conflictsWithBooking = existingBookings.some((booking) => {
                const bookingStart = new Date(booking.startTime).getTime() - bufferBefore * 60000;
                const bookingEnd = new Date(booking.endTime).getTime() + bufferAfter * 60000;
                return timeSlot.getTime() < bookingEnd && slotEndTime.getTime() > bookingStart;
              });

              // Check if slot conflicts with calendar busy times
              const conflictsWithCalendar = calendarBusy.some((busy) => {
                return (
                  timeSlot.getTime() < busy.end.getTime() &&
                  slotEndTime.getTime() > busy.start.getTime()
                );
              });

              if (!conflictsWithBooking && !conflictsWithCalendar) {
                slots.push({
                  start: new Date(timeSlot),
                  end: new Date(slotEndTime),
                  available: true,
                });
              }
            }

            timeSlot = new Date(timeSlot.getTime() + duration * 60000);
          }
        }
      }

      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
    }

    return slots;
  },

  /**
   * Create a booking (customer books a slot)
   */
  async createBooking(slug, data) {
    const bookingPage = await this.getBookingPageBySlug(slug);

    // Check if slot is still available
    const { start, end } = data.selectedSlot;
    const conflictingBooking = await prisma.bookingSlot.findFirst({
      where: {
        bookingPageId: bookingPage.id,
        startTime: { lt: new Date(end) },
        endTime: { gt: new Date(start) },
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    if (conflictingBooking) {
      throw new Error('This time slot is no longer available');
    }

    // Create the booking
    const booking = await prisma.bookingSlot.create({
      data: {
        tenantId: bookingPage.tenantId,
        bookingPageId: bookingPage.id,
        hostUserId: bookingPage.userId,
        guestName: data.name,
        guestEmail: data.email,
        guestPhone: data.phone,
        startTime: new Date(start),
        endTime: new Date(end),
        status: bookingPage.requireApproval ? 'PENDING' : 'CONFIRMED',
        notes: data.notes,
        customFieldValues: data.customFields || {},
      },
    });

    // If auto-confirmed and calendar platform is connected, create calendar event
    if (!bookingPage.requireApproval && bookingPage.connectedPlatform) {
      try {
        await this.createCalendarEventForBooking(booking, bookingPage);
      } catch (error) {
        console.error('Failed to create calendar event:', error.message);
        // Continue even if calendar creation fails
      }
    }

    // Schedule reminders if enabled
    if (bookingPage.sendReminders) {
      await this.scheduleReminders(booking, bookingPage);
    }

    return booking;
  },

  /**
   * Create calendar event for a booking
   */
  async createCalendarEventForBooking(booking, bookingPage) {
    const accessToken = await oauthService.getAccessToken(
      bookingPage.userId,
      bookingPage.connectedPlatform
    );

    const meetingData = {
      accessToken,
      title: `${bookingPage.title} - ${booking.guestName}`,
      description: `Meeting with ${booking.guestName} (${booking.guestEmail})${booking.notes ? `\n\nNotes: ${booking.notes}` : ''}`,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      attendees: [booking.guestEmail],
      timezone: bookingPage.timezone,
    };

    let calendarResult;
    if (bookingPage.connectedPlatform === 'google') {
      calendarResult = await calendarService.createGoogleMeetEvent(meetingData);
    } else if (bookingPage.connectedPlatform === 'microsoft') {
      calendarResult = await calendarService.createTeamsMeeting(meetingData);
    } else if (bookingPage.connectedPlatform === 'zoom') {
      calendarResult = await calendarService.createZoomMeeting(meetingData);
    }

    // Update booking with calendar event details
    await prisma.bookingSlot.update({
      where: { id: booking.id },
      data: {
        calendarEventId: calendarResult.eventId,
        meetingLink: calendarResult.meetingLink,
        platform: calendarResult.platform,
      },
    });

    return calendarResult;
  },

  /**
   * Schedule meeting reminders
   */
  async scheduleReminders(booking, bookingPage) {
    const reminders = [];

    for (const minutesBefore of bookingPage.reminderTimings) {
      const sendAt = new Date(booking.startTime.getTime() - minutesBefore * 60000);

      // Only schedule if sendAt is in the future
      if (sendAt > new Date()) {
        reminders.push({
          tenantId: bookingPage.tenantId,
          bookingSlotId: booking.id,
          recipientEmail: booking.guestEmail,
          recipientPhone: booking.guestPhone,
          meetingTitle: bookingPage.title,
          meetingTime: booking.startTime,
          meetingLink: booking.meetingLink,
          sendAt,
          status: 'PENDING',
          sendEmail: true,
          sendSms: booking.guestPhone ? true : false,
        });
      }
    }

    if (reminders.length > 0) {
      const createdReminders = await prisma.$transaction(
        reminders.map((reminder) => prisma.meetingReminder.create({ data: reminder }))
      );

      // Schedule background jobs for each reminder
      for (const reminder of createdReminders) {
        await scheduleMeetingReminder(reminder.id, reminder.sendAt);
      }
    }
  },

  /**
   * Approve a booking (host approves)
   */
  async approveBooking(tenantId, bookingId) {
    const booking = await prisma.bookingSlot.findFirst({
      where: { id: bookingId, tenantId },
      include: { bookingPage: true },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.status !== 'PENDING') {
      throw new Error('Only pending bookings can be approved');
    }

    // Update booking status
    await prisma.bookingSlot.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED' },
    });

    // Create calendar event
    if (booking.bookingPage.connectedPlatform) {
      await this.createCalendarEventForBooking(booking, booking.bookingPage);
    }

    return { success: true, message: 'Booking approved' };
  },

  /**
   * Reject a booking
   */
  async rejectBooking(tenantId, bookingId, reason) {
    await prisma.bookingSlot.updateMany({
      where: { id: bookingId, tenantId },
      data: { status: 'REJECTED', rejectionReason: reason },
    });

    return { success: true, message: 'Booking rejected' };
  },

  /**
   * Cancel a booking (by guest or host)
   */
  async cancelBooking(bookingId) {
    const booking = await prisma.bookingSlot.findUnique({
      where: { id: bookingId },
      include: { bookingPage: true },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Cancel calendar event if it exists
    if (booking.calendarEventId && booking.bookingPage.connectedPlatform) {
      try {
        const accessToken = await oauthService.getAccessToken(
          booking.bookingPage.userId,
          booking.bookingPage.connectedPlatform
        );
        // TODO: Implement calendar event deletion in calendar.service.js
      } catch (error) {
        console.error('Failed to cancel calendar event:', error.message);
      }
    }

    // Update booking status
    await prisma.bookingSlot.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });

    // Cancel pending reminders
    await prisma.meetingReminder.updateMany({
      where: { bookingSlotId: bookingId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });

    return { success: true, message: 'Booking cancelled' };
  },

  /**
   * Get all booking pages for a user
   */
  async getBookingPages(tenantId, userId) {
    const bookingPages = await prisma.bookingPage.findMany({
      where: { tenantId, userId },
      include: {
        _count: {
          select: { bookings: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookingPages;
  },

  /**
   * Get bookings for a booking page
   */
  async getBookings(tenantId, bookingPageId, filters = {}) {
    const where = {
      tenantId,
      bookingPageId,
      ...(filters.status && { status: filters.status }),
      ...(filters.startDate && { startTime: { gte: new Date(filters.startDate) } }),
      ...(filters.endDate && { endTime: { lte: new Date(filters.endDate) } }),
    };

    const bookings = await prisma.bookingSlot.findMany({
      where,
      include: {
        bookingPage: { select: { title: true, slug: true } },
        host: { select: { name: true, email: true } },
      },
      orderBy: { startTime: 'desc' },
    });

    return bookings;
  },
};
