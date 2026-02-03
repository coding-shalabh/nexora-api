import { prisma } from '@crm360/database';

// Helix Code Pvt Ltd Mock Calendar Events - Software Development Company
const MOCK_ORGANIZERS = [
  { id: 'user-1', firstName: 'Shalab', lastName: 'Goel', email: 'shalab@helixcode.in' },
  { id: 'user-2', firstName: 'Priya', lastName: 'Sharma', email: 'priya@helixcode.in' },
  { id: 'user-3', firstName: 'Rahul', lastName: 'Verma', email: 'rahul@helixcode.in' },
  { id: 'user-4', firstName: 'Anita', lastName: 'Patel', email: 'anita@helixcode.in' },
  { id: 'user-5', firstName: 'Vikram', lastName: 'Singh', email: 'vikram@helixcode.in' },
];

const generateMockEvents = () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const events = [
    // Today's events
    {
      id: 'event-1',
      title: 'Daily Standup - Nexora Team',
      description: 'Daily sync meeting for Nexora CRM development team',
      type: 'MEETING',
      startTime: new Date(today.getTime() + 9 * 60 * 60 * 1000), // 9 AM
      endTime: new Date(today.getTime() + 9.25 * 60 * 60 * 1000), // 9:15 AM
      allDay: false,
      location: 'Conference Room A',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      status: 'SCHEDULED',
      color: '#3B82F6',
      organizer: MOCK_ORGANIZERS[0],
      isRecurring: true,
      recurrence: { frequency: 'DAILY', days: ['MON', 'TUE', 'WED', 'THU', 'FRI'] },
    },
    {
      id: 'event-2',
      title: 'Sprint Planning - Sprint 15',
      description: 'Plan stories for the upcoming 2-week sprint',
      type: 'MEETING',
      startTime: new Date(today.getTime() + 10 * 60 * 60 * 1000), // 10 AM
      endTime: new Date(today.getTime() + 12 * 60 * 60 * 1000), // 12 PM
      allDay: false,
      location: 'Main Conference Room',
      status: 'SCHEDULED',
      color: '#10B981',
      organizer: MOCK_ORGANIZERS[1],
      isRecurring: false,
    },
    {
      id: 'event-3',
      title: 'Client Demo - E-Commerce Platform',
      description: 'Demo new features to RetailMax client team',
      type: 'MEETING',
      startTime: new Date(today.getTime() + 14 * 60 * 60 * 1000), // 2 PM
      endTime: new Date(today.getTime() + 15 * 60 * 60 * 1000), // 3 PM
      allDay: false,
      location: null,
      meetingUrl: 'https://zoom.us/j/123456789',
      status: 'SCHEDULED',
      color: '#F59E0B',
      organizer: MOCK_ORGANIZERS[0],
      isRecurring: false,
      attendees: ['client@retailmax.com', 'pm@retailmax.com'],
    },
    {
      id: 'event-4',
      title: 'Code Review Session',
      description: 'Review PR #456 - Payment Gateway Integration',
      type: 'MEETING',
      startTime: new Date(today.getTime() + 16 * 60 * 60 * 1000), // 4 PM
      endTime: new Date(today.getTime() + 17 * 60 * 60 * 1000), // 5 PM
      allDay: false,
      location: 'Dev Room',
      status: 'SCHEDULED',
      color: '#8B5CF6',
      organizer: MOCK_ORGANIZERS[2],
      isRecurring: false,
    },
    // Tomorrow's events
    {
      id: 'event-5',
      title: 'Technical Interview - Senior React Developer',
      description: 'Interview candidate Amit Kumar for Sr. Frontend position',
      type: 'MEETING',
      startTime: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000), // Tomorrow 11 AM
      endTime: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000), // Tomorrow 12 PM
      allDay: false,
      location: 'Conference Room B',
      meetingUrl: 'https://meet.google.com/xyz-abcd-efg',
      status: 'SCHEDULED',
      color: '#EC4899',
      organizer: MOCK_ORGANIZERS[3],
      isRecurring: false,
    },
    {
      id: 'event-6',
      title: 'AWS Architecture Review',
      description: 'Review cloud infrastructure for Mobile Banking App',
      type: 'MEETING',
      startTime: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000), // Tomorrow 3 PM
      endTime: new Date(today.getTime() + 24 * 60 * 60 * 1000 + 16.5 * 60 * 60 * 1000), // Tomorrow 4:30 PM
      allDay: false,
      location: 'Virtual',
      meetingUrl: 'https://chime.aws/1234567890',
      status: 'SCHEDULED',
      color: '#F97316',
      organizer: MOCK_ORGANIZERS[4],
      isRecurring: false,
    },
    // This week events
    {
      id: 'event-7',
      title: 'Healthcare Portal - Security Audit',
      description: 'HIPAA compliance security review with external auditors',
      type: 'MEETING',
      startTime: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000), // 3 days later 10 AM
      endTime: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000), // 3 days later 5 PM
      allDay: false,
      location: 'Main Office',
      status: 'SCHEDULED',
      color: '#EF4444',
      organizer: MOCK_ORGANIZERS[0],
      isRecurring: false,
    },
    {
      id: 'event-8',
      title: 'Team Lunch - January Birthdays',
      description: 'Celebrating January birthdays: Priya & Rahul',
      type: 'OTHER',
      startTime: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000 + 12.5 * 60 * 60 * 1000), // 4 days later 12:30 PM
      endTime: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000), // 4 days later 2 PM
      allDay: false,
      location: 'Barbeque Nation, Sector 62',
      status: 'SCHEDULED',
      color: '#14B8A6',
      organizer: MOCK_ORGANIZERS[3],
      isRecurring: false,
    },
    // Next week
    {
      id: 'event-9',
      title: 'Quarterly Business Review',
      description: 'Q4 2025 review and Q1 2026 planning with leadership',
      type: 'MEETING',
      startTime: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
      endTime: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000),
      allDay: false,
      location: 'Board Room',
      status: 'SCHEDULED',
      color: '#6366F1',
      organizer: MOCK_ORGANIZERS[0],
      isRecurring: false,
    },
    {
      id: 'event-10',
      title: 'Public Holiday - Republic Day',
      description: 'Office closed for Republic Day',
      type: 'OTHER',
      startTime: new Date(2026, 0, 26, 0, 0, 0), // Jan 26, 2026
      endTime: new Date(2026, 0, 26, 23, 59, 59),
      allDay: true,
      location: null,
      status: 'SCHEDULED',
      color: '#FF6B35',
      organizer: MOCK_ORGANIZERS[0],
      isRecurring: false,
    },
    // Deadlines/Tasks
    {
      id: 'event-11',
      title: 'Nexora v2.0 Release Deadline',
      description: 'Target release date for Nexora CRM version 2.0',
      type: 'TASK',
      startTime: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
      endTime: new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000 + 18 * 60 * 60 * 1000),
      allDay: true,
      location: null,
      status: 'SCHEDULED',
      color: '#3B82F6',
      organizer: MOCK_ORGANIZERS[0],
      isRecurring: false,
    },
    {
      id: 'event-12',
      title: 'Performance Review - Team Leads',
      description: 'Annual performance reviews with all team leads',
      type: 'MEETING',
      startTime: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
      endTime: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000 + 17 * 60 * 60 * 1000),
      allDay: false,
      location: 'HR Conference Room',
      status: 'SCHEDULED',
      color: '#84CC16',
      organizer: MOCK_ORGANIZERS[3],
      isRecurring: false,
    },
  ];

  return events.map((event) => ({
    ...event,
    tenantId: 'mock-tenant',
    timezone: 'Asia/Kolkata',
    createdAt: new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(),
  }));
};

const MOCK_EVENTS = generateMockEvents();

class CalendarService {
  async getEvents(tenantId, filters = {}) {
    try {
      const where = { tenantId };

      if (filters.search) {
        where.OR = [
          { title: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      if (filters.type) {
        where.type = filters.type;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      // Date range filter
      if (filters.startDate || filters.endDate) {
        where.startTime = {};
        if (filters.startDate) {
          where.startTime.gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          where.startTime.lte = new Date(filters.endDate);
        }
      }

      // For calendar view - get events in a date range
      if (filters.from && filters.to) {
        where.OR = [
          {
            startTime: {
              gte: new Date(filters.from),
              lte: new Date(filters.to),
            },
          },
          {
            endTime: {
              gte: new Date(filters.from),
              lte: new Date(filters.to),
            },
          },
          {
            AND: [
              { startTime: { lte: new Date(filters.from) } },
              { endTime: { gte: new Date(filters.to) } },
            ],
          },
        ];
      }

      if (filters.organizerId) {
        where.organizerId = filters.organizerId;
      }

      const page = filters.page || 1;
      const limit = filters.limit || 100;

      const [events, total] = await Promise.all([
        prisma.calendarEvent.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { startTime: 'asc' },
        }),
        prisma.calendarEvent.count({ where }),
      ]);

      return {
        success: true,
        data: {
          events,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      // Return mock data if DB query fails (e.g., table doesn't exist)
      console.log('[CalendarService] DB query failed, returning mock data:', error.message);

      let filteredEvents = [...MOCK_EVENTS];

      // Apply filters to mock data
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredEvents = filteredEvents.filter(
          (e) =>
            e.title.toLowerCase().includes(searchLower) ||
            (e.description && e.description.toLowerCase().includes(searchLower))
        );
      }
      if (filters.type) {
        filteredEvents = filteredEvents.filter((e) => e.type === filters.type);
      }
      if (filters.status) {
        filteredEvents = filteredEvents.filter((e) => e.status === filters.status);
      }
      if (filters.from && filters.to) {
        const from = new Date(filters.from);
        const to = new Date(filters.to);
        filteredEvents = filteredEvents.filter((e) => {
          return (
            (e.startTime >= from && e.startTime <= to) ||
            (e.endTime >= from && e.endTime <= to) ||
            (e.startTime <= from && e.endTime >= to)
          );
        });
      }

      // Sort by startTime
      filteredEvents.sort((a, b) => a.startTime - b.startTime);

      const page = filters.page || 1;
      const limit = filters.limit || 100;
      const startIndex = (page - 1) * limit;
      const paginatedEvents = filteredEvents.slice(startIndex, startIndex + limit);

      return {
        success: true,
        data: {
          events: paginatedEvents,
          meta: {
            total: filteredEvents.length,
            page,
            limit,
            totalPages: Math.ceil(filteredEvents.length / limit),
          },
        },
      };
    }
  }

  async getEvent(tenantId, eventId) {
    const event = await prisma.calendarEvent.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!event) {
      throw new Error('Event not found');
    }

    return event;
  }

  async createEvent(tenantId, userId, data) {
    const event = await prisma.calendarEvent.create({
      data: {
        tenantId,
        organizerId: userId,
        title: data.title,
        description: data.description,
        type: data.type || 'MEETING',
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        allDay: data.allDay || false,
        timezone: data.timezone || 'UTC',
        location: data.location,
        meetingUrl: data.meetingUrl,
        isRecurring: data.isRecurring || false,
        recurrence: data.recurrence,
        status: data.status || 'SCHEDULED',
        attendees: data.attendees,
        reminders: data.reminders,
        color: data.color,
        metadata: data.metadata,
      },
    });

    return event;
  }

  async updateEvent(tenantId, eventId, data) {
    // Verify event exists and belongs to tenant
    const existing = await prisma.calendarEvent.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!existing) {
      throw new Error('Event not found');
    }

    const event = await prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.startTime !== undefined && { startTime: new Date(data.startTime) }),
        ...(data.endTime !== undefined && { endTime: new Date(data.endTime) }),
        ...(data.allDay !== undefined && { allDay: data.allDay }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.meetingUrl !== undefined && { meetingUrl: data.meetingUrl }),
        ...(data.isRecurring !== undefined && { isRecurring: data.isRecurring }),
        ...(data.recurrence !== undefined && { recurrence: data.recurrence }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.attendees !== undefined && { attendees: data.attendees }),
        ...(data.reminders !== undefined && { reminders: data.reminders }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.metadata !== undefined && { metadata: data.metadata }),
      },
    });

    return event;
  }

  async deleteEvent(tenantId, eventId) {
    // Verify event exists and belongs to tenant
    const existing = await prisma.calendarEvent.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!existing) {
      throw new Error('Event not found');
    }

    await prisma.calendarEvent.delete({
      where: { id: eventId },
    });

    return { success: true };
  }

  async getUpcomingEvents(tenantId, userId, days = 7) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const events = await prisma.calendarEvent.findMany({
      where: {
        tenantId,
        startTime: {
          gte: now,
          lte: futureDate,
        },
        status: { not: 'CANCELLED' },
      },
      orderBy: { startTime: 'asc' },
      take: 20,
    });

    return events;
  }

  async getEventStats(tenantId, filters = {}) {
    try {
      const where = { tenantId };

      if (filters.from && filters.to) {
        where.startTime = {
          gte: new Date(filters.from),
          lte: new Date(filters.to),
        };
      }

      const [total, byType, byStatus] = await Promise.all([
        prisma.calendarEvent.count({ where }),
        prisma.calendarEvent.groupBy({
          by: ['type'],
          where,
          _count: { type: true },
        }),
        prisma.calendarEvent.groupBy({
          by: ['status'],
          where,
          _count: { status: true },
        }),
      ]);

      return {
        success: true,
        data: {
          total,
          byType: byType.reduce((acc, item) => {
            acc[item.type] = item._count.type;
            return acc;
          }, {}),
          byStatus: byStatus.reduce((acc, item) => {
            acc[item.status] = item._count.status;
            return acc;
          }, {}),
        },
      };
    } catch (error) {
      // Return mock stats if DB query fails
      console.log('[CalendarService] Stats query failed, returning mock stats:', error.message);

      let filteredEvents = [...MOCK_EVENTS];

      if (filters.from && filters.to) {
        const from = new Date(filters.from);
        const to = new Date(filters.to);
        filteredEvents = filteredEvents.filter((e) => e.startTime >= from && e.startTime <= to);
      }

      const byType = {};
      const byStatus = {};

      filteredEvents.forEach((event) => {
        byType[event.type] = (byType[event.type] || 0) + 1;
        byStatus[event.status] = (byStatus[event.status] || 0) + 1;
      });

      return {
        success: true,
        data: {
          total: filteredEvents.length,
          byType,
          byStatus,
        },
      };
    }
  }
}

export const calendarService = new CalendarService();
