import { prisma } from '@crm360/database';
import { NotFoundError, UnauthorizedError } from '@crm360/shared';

class TrackingService {
  /**
   * Validate API key and get tracking script
   */
  async validateApiKey(apiKey) {
    const trackingScript = await prisma.trackingScript.findUnique({
      where: { apiKey },
    });

    if (!trackingScript || !trackingScript.isActive) {
      throw new UnauthorizedError('Invalid or inactive API key');
    }

    return trackingScript;
  }

  /**
   * Create or get tracking script
   */
  async createTrackingScript(tenantId, data) {
    return prisma.trackingScript.create({
      data: {
        tenantId,
        name: data.name,
        domain: data.domain,
        settings: data.settings || {},
        isActive: true,
      },
    });
  }

  /**
   * Get tracking scripts for tenant
   */
  async getTrackingScripts(tenantId) {
    return prisma.trackingScript.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Start a new visitor session
   */
  async startSession(trackingScript, data) {
    const session = await prisma.visitorSession.create({
      data: {
        tenantId: trackingScript.tenantId,
        trackingScript: { connect: { id: trackingScript.id } },
        visitorId: data.visitorId,
        clientSessionId: data.sessionId, // Store client's session ID for linking events
        startedAt: new Date(data.timestamp),
        lastActiveAt: new Date(data.timestamp),

        // Device info
        userAgent: data.device?.userAgent,
        browser: data.device?.browser,
        browserVersion: data.device?.browserVersion,
        os: data.device?.os,
        osVersion: data.device?.osVersion,
        deviceType: data.device?.deviceType,
        screenWidth: data.device?.screenWidth,
        screenHeight: data.device?.screenHeight,
        viewportWidth: data.device?.viewportWidth,
        viewportHeight: data.device?.viewportHeight,

        // UTM params
        utmSource: data.utm?.utmSource,
        utmMedium: data.utm?.utmMedium,
        utmCampaign: data.utm?.utmCampaign,
        utmTerm: data.utm?.utmTerm,
        utmContent: data.utm?.utmContent,

        // Referrer
        referrer: data.referrer,
        referrerDomain: data.referrer ? this.extractDomain(data.referrer) : null,
        entryPage: data.entryPage,
      },
    });

    // Try to enrich with IP data asynchronously
    this.enrichSessionWithIP(session.id, data.ipAddress);

    return session;
  }

  /**
   * Track page view
   */
  async trackPageView(trackingScript, data) {
    // Get session by client session ID
    let session = await prisma.visitorSession.findFirst({
      where: {
        tenantId: trackingScript.tenantId,
        clientSessionId: data.sessionId,
      },
    });

    if (!session) {
      // Session might have expired or not created yet
      return null;
    }

    const pageView = await prisma.pageView.create({
      data: {
        tenantId: trackingScript.tenantId,
        trackingScript: { connect: { id: trackingScript.id } },
        session: { connect: { id: session.id } },
        ...(session.contactId && { contact: { connect: { id: session.contactId } } }),
        url: data.url,
        path: data.path,
        title: data.title,
        referrer: data.referrer,
        timestamp: new Date(data.timestamp),
        loadTime: data.loadTime,
      },
    });

    // Update session
    await prisma.visitorSession.update({
      where: { id: session.id },
      data: {
        pageViewCount: { increment: 1 },
        lastActiveAt: new Date(),
        bounced: false,
      },
    });

    return pageView;
  }

  /**
   * Track page leave (update time on page and scroll depth)
   */
  async trackPageLeave(trackingScript, data) {
    // First, find the session by clientSessionId
    const session = await prisma.visitorSession.findFirst({
      where: {
        tenantId: trackingScript.tenantId,
        clientSessionId: data.sessionId,
      },
    });

    if (!session) return null;

    // Find the most recent page view for this session and URL
    const pageView = await prisma.pageView.findFirst({
      where: {
        tenantId: trackingScript.tenantId,
        sessionId: session.id,
        path: data.path,
      },
      orderBy: { timestamp: 'desc' },
    });

    if (pageView) {
      await prisma.pageView.update({
        where: { id: pageView.id },
        data: {
          timeOnPage: data.timeOnPage,
          scrollDepth: data.scrollDepth,
        },
      });
    }

    // Update session exit page
    await prisma.visitorSession.update({
      where: { id: session.id },
      data: {
        exitPage: data.url,
        lastActiveAt: new Date(),
      },
    });

    return pageView;
  }

  /**
   * Track batch of events
   */
  async trackEvents(trackingScript, data) {
    const events = data.events || [];

    if (events.length === 0) return [];

    // Find session by clientSessionId
    const session = await prisma.visitorSession.findFirst({
      where: {
        tenantId: trackingScript.tenantId,
        clientSessionId: data.sessionId,
      },
    });

    if (!session) return [];

    const createdEvents = await prisma.visitorEvent.createMany({
      data: events.map((event) => ({
        tenantId: trackingScript.tenantId,
        trackingScriptId: trackingScript.id,
        sessionId: session.id,
        contactId: session?.contactId,
        eventType: event.type,
        eventName: event.name,
        category: event.category,
        targetSelector: event.targetSelector,
        targetText: event.targetText?.substring(0, 500),
        targetHref: event.targetHref,
        pageX: event.pageX,
        pageY: event.pageY,
        value: event.value?.substring(0, 1000),
        metadata: event.metadata,
        timestamp: new Date(event.timestamp),
      })),
    });

    // Update session event count
    await prisma.visitorSession.update({
      where: { id: session.id },
      data: {
        eventCount: { increment: events.length },
        engaged: true,
        lastActiveAt: new Date(),
      },
    });

    return createdEvents;
  }

  /**
   * Track form submission
   */
  async trackFormSubmit(trackingScript, data) {
    // Find session by clientSessionId
    const session = await prisma.visitorSession.findFirst({
      where: {
        tenantId: trackingScript.tenantId,
        clientSessionId: data.sessionId,
      },
    });

    if (!session) return null;

    return prisma.formSubmission.create({
      data: {
        tenantId: trackingScript.tenantId,
        sessionId: session.id,
        contactId: session?.contactId,
        formId: data.formId,
        formName: data.formId,
        formUrl: data.formAction,
        fields: data.fields || {},
        submittedAt: new Date(data.timestamp),
        successful: true,
      },
    });
  }

  /**
   * Identify visitor (link to CRM contact)
   */
  async identifyVisitor(trackingScript, data) {
    // Find session by clientSessionId
    const session = await prisma.visitorSession.findFirst({
      where: {
        tenantId: trackingScript.tenantId,
        clientSessionId: data.sessionId,
      },
    });

    if (!session) return { identified: false, contactId: null };

    // Try to find contact by email or userId
    let contact = null;

    if (data.traits?.email) {
      contact = await prisma.contact.findFirst({
        where: {
          tenantId: trackingScript.tenantId,
          email: data.traits.email,
        },
      });
    }

    // Update session with contact info
    if (contact) {
      await prisma.visitorSession.update({
        where: { id: session.id },
        data: {
          contactId: contact.id,
          companyId: contact.companyId,
          isIdentified: true,
          identifiedAt: new Date(),
        },
      });

      // Update all events and page views for this session
      await prisma.pageView.updateMany({
        where: { sessionId: session.id },
        data: { contactId: contact.id },
      });

      await prisma.visitorEvent.updateMany({
        where: { sessionId: session.id },
        data: { contactId: contact.id },
      });

      // Update contact analytics
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          pageViews: { increment: 1 },
          lastActivityAt: new Date(),
        },
      });
    }

    return { identified: !!contact, contactId: contact?.id };
  }

  /**
   * Store session recording events
   */
  async storeRecordingEvents(trackingScript, data) {
    // Find session by clientSessionId
    const session = await prisma.visitorSession.findFirst({
      where: {
        tenantId: trackingScript.tenantId,
        clientSessionId: data.sessionId,
      },
    });

    if (!session) return null;

    // Find or create recording for this session
    let recording = await prisma.sessionRecording.findFirst({
      where: {
        sessionId: session.id,
        status: 'recording',
      },
    });

    if (!recording) {
      recording = await prisma.sessionRecording.create({
        data: {
          tenantId: trackingScript.tenantId,
          sessionId: session.id,
          startedAt: new Date(),
          eventsData: data.events,
          eventCount: data.events.length,
          status: 'recording',
        },
      });
    } else {
      // Append events (merge with existing)
      const existingEvents = recording.eventsData || [];
      const mergedEvents = [...existingEvents, ...data.events];

      await prisma.sessionRecording.update({
        where: { id: recording.id },
        data: {
          eventsData: mergedEvents,
          eventCount: mergedEvents.length,
        },
      });
    }

    return recording;
  }

  /**
   * Get session by ID
   */
  async getSession(tenantId, sessionId) {
    return prisma.visitorSession.findFirst({
      where: { tenantId, id: sessionId },
      include: {
        pageViews: { orderBy: { timestamp: 'desc' }, take: 50 },
        events: { orderBy: { timestamp: 'desc' }, take: 100 },
        recordings: { orderBy: { startedAt: 'desc' }, take: 1 },
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        company: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Get sessions for tenant
   */
  async getSessions(tenantId, filters = {}) {
    const where = { tenantId };

    if (filters.contactId) where.contactId = filters.contactId;
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.isIdentified !== undefined) where.isIdentified = filters.isIdentified;

    const [sessions, total] = await Promise.all([
      prisma.visitorSession.findMany({
        where,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          company: { select: { id: true, name: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: filters.limit || 25,
        skip: ((filters.page || 1) - 1) * (filters.limit || 25),
      }),
      prisma.visitorSession.count({ where }),
    ]);

    return {
      sessions,
      meta: {
        total,
        page: filters.page || 1,
        limit: filters.limit || 25,
        totalPages: Math.ceil(total / (filters.limit || 25)),
      },
    };
  }

  /**
   * Get session recording for playback
   */
  async getSessionRecording(tenantId, sessionId) {
    return prisma.sessionRecording.findFirst({
      where: {
        tenantId,
        sessionId,
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  /**
   * Helper: Extract domain from URL
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }

  /**
   * Helper: Enrich session with IP geolocation data
   */
  async enrichSessionWithIP(sessionId, ipAddress) {
    if (!ipAddress) return;

    try {
      // Call IP lookup API (ipapi.is)
      const response = await fetch(`https://api.ipapi.is/?q=${ipAddress}`);
      const data = await response.json();

      if (data && !data.error) {
        await prisma.visitorSession.update({
          where: { id: sessionId },
          data: {
            ipAddress,
            country: data.location?.country,
            countryCode: data.location?.country_code,
            region: data.location?.state,
            city: data.location?.city,
            postalCode: data.location?.zip,
            latitude: data.location?.latitude,
            longitude: data.location?.longitude,
            timezone: data.location?.timezone,
            isp: data.asn?.name,
            organization: data.company?.name,
          },
        });
      }
    } catch (e) {
      console.error('Failed to enrich session with IP data:', e);
    }
  }

  // ============ Link Tracking ============

  /**
   * Create a tracked short link
   */
  async createLink(tenantId, data) {
    const shortCode = data.shortCode || this.generateShortCode();

    return prisma.linkTracker.create({
      data: {
        tenantId,
        trackingScriptId: data.trackingScriptId,
        shortCode,
        originalUrl: data.originalUrl,
        name: data.name,
        description: data.description,
        campaign: data.campaign,
        source: data.source,
        medium: data.medium,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        maxClicks: data.maxClicks,
      },
    });
  }

  /**
   * Get link by short code
   */
  async getLinkByCode(shortCode) {
    return prisma.linkTracker.findUnique({
      where: { shortCode },
    });
  }

  /**
   * Track link click
   */
  async trackLinkClick(link, data) {
    // Record the click
    await prisma.linkClick.create({
      data: {
        tenantId: link.tenantId,
        linkTrackerId: link.id,
        sessionId: data.sessionId,
        contactId: data.contactId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        referrer: data.referrer,
        country: data.country,
        city: data.city,
        deviceType: data.deviceType,
        browser: data.browser,
        os: data.os,
      },
    });

    // Update link stats
    await prisma.linkTracker.update({
      where: { id: link.id },
      data: {
        clickCount: { increment: 1 },
        lastClickedAt: new Date(),
      },
    });

    return link.originalUrl;
  }

  /**
   * Generate short code
   */
  generateShortCode() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 7; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // ============ Analytics Aggregation ============

  /**
   * Get date range based on period
   */
  getDateRange(period = '7d') {
    const now = new Date();
    let startDate;

    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate: now };
  }

  /**
   * Get analytics overview
   */
  async getAnalyticsOverview(tenantId, period = '7d') {
    const { startDate, endDate } = this.getDateRange(period);

    const [sessions, previousSessions, pageViews, uniqueVisitors] = await Promise.all([
      // Current period sessions
      prisma.visitorSession.count({
        where: {
          tenantId,
          startedAt: { gte: startDate, lte: endDate },
        },
      }),
      // Previous period for comparison (same length)
      prisma.visitorSession.count({
        where: {
          tenantId,
          startedAt: {
            gte: new Date(startDate.getTime() - (endDate.getTime() - startDate.getTime())),
            lt: startDate,
          },
        },
      }),
      // Page views
      prisma.pageView.count({
        where: {
          tenantId,
          timestamp: { gte: startDate, lte: endDate },
        },
      }),
      // Unique visitors
      prisma.visitorSession.groupBy({
        by: ['visitorId'],
        where: {
          tenantId,
          startedAt: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    // Calculate average session duration
    const allSessions = await prisma.visitorSession.findMany({
      where: {
        tenantId,
        startedAt: { gte: startDate, lte: endDate },
      },
      select: {
        startedAt: true,
        lastActiveAt: true,
      },
    });

    // Filter out sessions without lastActiveAt
    const sessionsWithDuration = allSessions.filter((s) => s.lastActiveAt != null);

    let avgDuration = 0;
    if (sessionsWithDuration.length > 0) {
      const totalDuration = sessionsWithDuration.reduce((sum, session) => {
        const duration =
          new Date(session.lastActiveAt).getTime() - new Date(session.startedAt).getTime();
        return sum + duration;
      }, 0);
      avgDuration = Math.round(totalDuration / sessionsWithDuration.length / 1000); // in seconds
    }

    // Calculate bounce rate
    const bouncedSessions = await prisma.visitorSession.count({
      where: {
        tenantId,
        startedAt: { gte: startDate, lte: endDate },
        pageViewCount: { lte: 1 },
      },
    });
    const bounceRate = sessions > 0 ? Math.round((bouncedSessions / sessions) * 100) : 0;

    // Calculate change percentage
    const sessionsChange =
      previousSessions > 0
        ? Math.round(((sessions - previousSessions) / previousSessions) * 100)
        : 0;

    return {
      visitors: uniqueVisitors.length,
      sessions,
      pageViews,
      avgDuration,
      bounceRate,
      changes: {
        sessions: sessionsChange,
      },
    };
  }

  /**
   * Get visitors over time
   */
  async getVisitorsOverTime(tenantId, period = '7d') {
    const { startDate, endDate } = this.getDateRange(period);

    // Get sessions grouped by day
    const sessions = await prisma.visitorSession.findMany({
      where: {
        tenantId,
        startedAt: { gte: startDate, lte: endDate },
      },
      select: {
        startedAt: true,
        visitorId: true,
        pageViewCount: true,
      },
    });

    // Group by date
    const groupedData = {};
    sessions.forEach((session) => {
      const date = new Date(session.startedAt).toISOString().split('T')[0];
      if (!groupedData[date]) {
        groupedData[date] = {
          date,
          sessions: 0,
          visitors: new Set(),
          pageViews: 0,
        };
      }
      groupedData[date].sessions++;
      groupedData[date].visitors.add(session.visitorId);
      groupedData[date].pageViews += session.pageViewCount || 0;
    });

    // Convert to array and sort by date
    const result = Object.values(groupedData)
      .map((day) => ({
        date: day.date,
        sessions: day.sessions,
        visitors: day.visitors.size,
        pageViews: day.pageViews,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return result;
  }

  /**
   * Get top pages
   */
  async getTopPages(tenantId, period = '7d', limit = 20) {
    const { startDate, endDate } = this.getDateRange(period);

    const pageViews = await prisma.pageView.groupBy({
      by: ['path', 'title'],
      where: {
        tenantId,
        timestamp: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      _avg: { timeOnPage: true, scrollDepth: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    // Get unique visitors per page
    const pagesWithVisitors = await Promise.all(
      pageViews.map(async (page) => {
        const uniqueVisitors = await prisma.pageView.groupBy({
          by: ['sessionId'],
          where: {
            tenantId,
            path: page.path,
            timestamp: { gte: startDate, lte: endDate },
          },
        });

        return {
          path: page.path,
          title: page.title || page.path,
          views: page._count.id,
          uniqueVisitors: uniqueVisitors.length,
          avgTimeOnPage: Math.round(page._avg.timeOnPage || 0),
          avgScrollDepth: Math.round(page._avg.scrollDepth || 0),
        };
      })
    );

    return pagesWithVisitors;
  }

  /**
   * Get traffic sources breakdown
   */
  async getTrafficSources(tenantId, period = '7d') {
    const { startDate, endDate } = this.getDateRange(period);

    const sessions = await prisma.visitorSession.findMany({
      where: {
        tenantId,
        startedAt: { gte: startDate, lte: endDate },
      },
      select: {
        referrer: true,
        referrerDomain: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
      },
    });

    // Categorize traffic sources
    const sources = {
      direct: 0,
      organic: 0,
      referral: 0,
      social: 0,
      paid: 0,
      email: 0,
    };

    const socialDomains = [
      'facebook.com',
      'twitter.com',
      'linkedin.com',
      'instagram.com',
      't.co',
      'youtube.com',
    ];
    const searchDomains = ['google.com', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com'];

    sessions.forEach((session) => {
      // Check UTM parameters first
      if (
        session.utmMedium === 'cpc' ||
        session.utmMedium === 'ppc' ||
        session.utmMedium === 'paid'
      ) {
        sources.paid++;
      } else if (session.utmMedium === 'email') {
        sources.email++;
      } else if (session.utmMedium === 'social') {
        sources.social++;
      } else if (!session.referrer) {
        sources.direct++;
      } else if (session.referrerDomain) {
        if (socialDomains.some((d) => session.referrerDomain.includes(d))) {
          sources.social++;
        } else if (searchDomains.some((d) => session.referrerDomain.includes(d))) {
          sources.organic++;
        } else {
          sources.referral++;
        }
      } else {
        sources.direct++;
      }
    });

    // Get top referrers
    const referrerGroups = await prisma.visitorSession.groupBy({
      by: ['referrerDomain'],
      where: {
        tenantId,
        startedAt: { gte: startDate, lte: endDate },
        referrerDomain: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Get top campaigns
    const campaigns = await prisma.visitorSession.groupBy({
      by: ['utmCampaign', 'utmSource', 'utmMedium'],
      where: {
        tenantId,
        startedAt: { gte: startDate, lte: endDate },
        utmCampaign: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    return {
      breakdown: sources,
      total: sessions.length,
      topReferrers: referrerGroups.map((r) => ({
        domain: r.referrerDomain,
        sessions: r._count.id,
      })),
      topCampaigns: campaigns.map((c) => ({
        campaign: c.utmCampaign,
        source: c.utmSource,
        medium: c.utmMedium,
        sessions: c._count.id,
      })),
    };
  }

  /**
   * Get live visitors (active in last 5 minutes)
   */
  async getLiveVisitors(tenantId) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const liveSessions = await prisma.visitorSession.findMany({
      where: {
        tenantId,
        lastActiveAt: { gte: fiveMinutesAgo },
      },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, email: true } },
        pageViews: {
          orderBy: { timestamp: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return {
      count: liveSessions.length,
      sessions: liveSessions.map((session) => ({
        id: session.id,
        visitorId: session.visitorId,
        currentPage: session.pageViews[0]?.path || session.entryPage,
        pageTitle: session.pageViews[0]?.title,
        location:
          session.city && session.country
            ? `${session.city}, ${session.country}`
            : session.country || 'Unknown',
        device: session.deviceType || 'desktop',
        browser: session.browser,
        startedAt: session.startedAt,
        lastActiveAt: session.lastActiveAt,
        pageViewCount: session.pageViewCount,
        isIdentified: session.isIdentified,
        contact: session.contact,
      })),
    };
  }

  /**
   * Get form analytics
   */
  async getFormAnalytics(tenantId, period = '7d') {
    const { startDate, endDate } = this.getDateRange(period);

    // Get form submissions grouped by form ID
    const forms = await prisma.formSubmission.groupBy({
      by: ['formId', 'formName'],
      where: {
        tenantId,
        submittedAt: { gte: startDate, lte: endDate },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Get total page views for conversion rate
    const totalPageViews = await prisma.pageView.count({
      where: {
        tenantId,
        timestamp: { gte: startDate, lte: endDate },
      },
    });

    return {
      forms: forms.map((form) => ({
        formId: form.formId,
        formName: form.formName || form.formId,
        submissions: form._count.id,
        conversionRate:
          totalPageViews > 0 ? Math.round((form._count.id / totalPageViews) * 10000) / 100 : 0,
      })),
      totalSubmissions: forms.reduce((sum, f) => sum + f._count.id, 0),
    };
  }

  /**
   * Get device breakdown
   */
  async getDeviceBreakdown(tenantId, period = '7d') {
    const { startDate, endDate } = this.getDateRange(period);

    const [devices, browsers, os] = await Promise.all([
      // Device type
      prisma.visitorSession.groupBy({
        by: ['deviceType'],
        where: {
          tenantId,
          startedAt: { gte: startDate, lte: endDate },
        },
        _count: { id: true },
      }),
      // Browser
      prisma.visitorSession.groupBy({
        by: ['browser'],
        where: {
          tenantId,
          startedAt: { gte: startDate, lte: endDate },
          browser: { not: null },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      // OS
      prisma.visitorSession.groupBy({
        by: ['os'],
        where: {
          tenantId,
          startedAt: { gte: startDate, lte: endDate },
          os: { not: null },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ]);

    return {
      devices: devices.map((d) => ({
        type: d.deviceType || 'desktop',
        count: d._count.id,
      })),
      browsers: browsers.map((b) => ({
        name: b.browser,
        count: b._count.id,
      })),
      operatingSystems: os.map((o) => ({
        name: o.os,
        count: o._count.id,
      })),
    };
  }

  /**
   * Get geographic breakdown
   */
  async getGeographicBreakdown(tenantId, period = '7d') {
    const { startDate, endDate } = this.getDateRange(period);

    const [countries, cities] = await Promise.all([
      prisma.visitorSession.groupBy({
        by: ['country', 'countryCode'],
        where: {
          tenantId,
          startedAt: { gte: startDate, lte: endDate },
          country: { not: null },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.visitorSession.groupBy({
        by: ['city', 'country'],
        where: {
          tenantId,
          startedAt: { gte: startDate, lte: endDate },
          city: { not: null },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      countries: countries.map((c) => ({
        country: c.country,
        code: c.countryCode,
        sessions: c._count.id,
      })),
      cities: cities.map((c) => ({
        city: c.city,
        country: c.country,
        sessions: c._count.id,
      })),
    };
  }

  /**
   * Update tracking script settings
   */
  async updateTrackingScript(tenantId, scriptId, data) {
    const script = await prisma.trackingScript.findFirst({
      where: { tenantId, id: scriptId },
    });

    if (!script) {
      throw new NotFoundError('Tracking script not found');
    }

    return prisma.trackingScript.update({
      where: { id: scriptId },
      data: {
        name: data.name,
        domain: data.domain,
        settings: data.settings,
        isActive: data.isActive,
      },
    });
  }

  /**
   * Delete (deactivate) tracking script
   */
  async deleteTrackingScript(tenantId, scriptId) {
    const script = await prisma.trackingScript.findFirst({
      where: { tenantId, id: scriptId },
    });

    if (!script) {
      throw new NotFoundError('Tracking script not found');
    }

    return prisma.trackingScript.update({
      where: { id: scriptId },
      data: { isActive: false },
    });
  }

  /**
   * Regenerate API key for tracking script
   */
  async regenerateApiKey(tenantId, scriptId) {
    const script = await prisma.trackingScript.findFirst({
      where: { tenantId, id: scriptId },
    });

    if (!script) {
      throw new NotFoundError('Tracking script not found');
    }

    // Generate new API key with prefix
    const newApiKey = `nxa_${this.generateShortCode()}${this.generateShortCode()}`;

    return prisma.trackingScript.update({
      where: { id: scriptId },
      data: { apiKey: newApiKey },
    });
  }
}

export const trackingService = new TrackingService();
