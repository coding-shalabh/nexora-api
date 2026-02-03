/**
 * CRM360 Tracker SDK
 * Comprehensive website visitor tracking similar to Hotjar/FullStory
 */

import { record } from 'rrweb';

// Types
interface TrackerConfig {
  apiKey: string;
  apiEndpoint?: string;
  sessionTimeout?: number; // minutes
  captureClicks?: boolean;
  captureScrolls?: boolean;
  captureFormInteractions?: boolean;
  capturePageViews?: boolean;
  captureMouseMovement?: boolean;
  enableRecording?: boolean;
  recordingOptions?: {
    maskAllInputs?: boolean;
    maskTextSelector?: string;
    blockSelector?: string;
  };
  debug?: boolean;
}

interface SessionData {
  sessionId: string;
  visitorId: string;
  startedAt: number;
  lastActiveAt: number;
  pageViewCount: number;
  eventCount: number;
}

interface PageViewData {
  url: string;
  path: string;
  title: string;
  referrer: string;
  timestamp: number;
  scrollDepth: number;
  timeOnPage: number;
  loadTime: number;
}

interface EventData {
  type: string;
  name: string;
  category?: string;
  targetSelector?: string;
  targetText?: string;
  targetHref?: string;
  pageX?: number;
  pageY?: number;
  value?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

interface DeviceInfo {
  userAgent: string;
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  screenWidth: number;
  screenHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  language: string;
  timezone: string;
}

interface UTMParams {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

// Utility functions
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function setCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let browserVersion = '';
  let os = 'Unknown';
  let osVersion = '';
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';

  // Detect browser
  if (ua.includes('Firefox/')) {
    browser = 'Firefox';
    browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] || '';
  } else if (ua.includes('Chrome/')) {
    browser = 'Chrome';
    browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || '';
  } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari';
    browserVersion = ua.match(/Version\/(\d+)/)?.[1] || '';
  } else if (ua.includes('Edge/') || ua.includes('Edg/')) {
    browser = 'Edge';
    browserVersion = ua.match(/Edg?\/(\d+)/)?.[1] || '';
  }

  // Detect OS
  if (ua.includes('Windows')) {
    os = 'Windows';
    osVersion = ua.match(/Windows NT (\d+\.\d+)/)?.[1] || '';
  } else if (ua.includes('Mac OS X')) {
    os = 'macOS';
    osVersion = ua.match(/Mac OS X (\d+[._]\d+)/)?.[1]?.replace('_', '.') || '';
  } else if (ua.includes('Linux')) {
    os = 'Linux';
  } else if (ua.includes('Android')) {
    os = 'Android';
    osVersion = ua.match(/Android (\d+)/)?.[1] || '';
  } else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) {
    os = 'iOS';
    osVersion = ua.match(/OS (\d+)/)?.[1] || '';
  }

  // Detect device type
  if (/Mobi|Android/i.test(ua) && !/iPad/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/iPad|Tablet/i.test(ua)) {
    deviceType = 'tablet';
  }

  return {
    userAgent: ua,
    browser,
    browserVersion,
    os,
    osVersion,
    deviceType,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    language: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

function getUTMParams(): UTMParams {
  const params = new URLSearchParams(window.location.search);
  return {
    utmSource: params.get('utm_source') || undefined,
    utmMedium: params.get('utm_medium') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
    utmTerm: params.get('utm_term') || undefined,
    utmContent: params.get('utm_content') || undefined,
  };
}

function getCSSSelector(element: Element): string {
  if (element.id) return `#${element.id}`;

  let path = '';
  let current: Element | null = element;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.className) {
      const classes = current.className.split(' ').filter(c => c).slice(0, 2);
      if (classes.length) selector += '.' + classes.join('.');
    }

    path = path ? `${selector} > ${path}` : selector;
    current = current.parentElement;
  }

  return path;
}

function getElementText(element: Element): string {
  const text = element.textContent?.trim() || '';
  return text.length > 100 ? text.substring(0, 100) + '...' : text;
}

// Main Tracker Class
class CRM360Tracker {
  private config: TrackerConfig;
  private session: SessionData | null = null;
  private currentPageView: PageViewData | null = null;
  private pageViewStartTime: number = 0;
  private maxScrollDepth: number = 0;
  private eventQueue: EventData[] = [];
  private recordingEvents: unknown[] = [];
  private stopRecording: (() => void) | null = null;
  private flushInterval: number | null = null;
  private initialized: boolean = false;

  constructor(config: TrackerConfig) {
    this.config = {
      apiEndpoint: 'https://api.crm360.com/v1/tracking',
      sessionTimeout: 30,
      captureClicks: true,
      captureScrolls: true,
      captureFormInteractions: true,
      capturePageViews: true,
      captureMouseMovement: false,
      enableRecording: false,
      debug: false,
      ...config,
    };
  }

  /**
   * Initialize the tracker
   */
  init(): void {
    if (this.initialized) {
      this.log('Tracker already initialized');
      return;
    }

    this.log('Initializing CRM360 Tracker');

    // Get or create session
    this.initSession();

    // Set up event listeners
    this.setupEventListeners();

    // Track initial page view
    if (this.config.capturePageViews) {
      this.trackPageView();
    }

    // Start session recording if enabled
    if (this.config.enableRecording) {
      this.startRecording();
    }

    // Set up periodic flush
    this.flushInterval = window.setInterval(() => this.flush(), 10000);

    // Flush on page unload
    window.addEventListener('beforeunload', () => this.flush(true));

    this.initialized = true;
    this.log('Tracker initialized', this.session);
  }

  /**
   * Initialize or restore session
   */
  private initSession(): void {
    const visitorId = getCookie('crm360_visitor') || generateId();
    setCookie('crm360_visitor', visitorId, 365);

    const existingSession = getCookie('crm360_session');
    const sessionTimeout = (this.config.sessionTimeout || 30) * 60 * 1000;

    if (existingSession) {
      try {
        const parsed = JSON.parse(existingSession);
        if (Date.now() - parsed.lastActiveAt < sessionTimeout) {
          this.session = parsed;
          this.session!.lastActiveAt = Date.now();
          this.saveSession();
          this.log('Restored existing session');
          return;
        }
      } catch (e) {
        this.log('Failed to parse existing session');
      }
    }

    // Create new session
    this.session = {
      sessionId: generateId(),
      visitorId,
      startedAt: Date.now(),
      lastActiveAt: Date.now(),
      pageViewCount: 0,
      eventCount: 0,
    };

    this.saveSession();
    this.sendSessionStart();
    this.log('Created new session');
  }

  /**
   * Save session to cookie
   */
  private saveSession(): void {
    if (this.session) {
      setCookie('crm360_session', JSON.stringify(this.session), 1);
    }
  }

  /**
   * Send session start event
   */
  private sendSessionStart(): void {
    const deviceInfo = getDeviceInfo();
    const utmParams = getUTMParams();

    this.send('session.start', {
      sessionId: this.session!.sessionId,
      visitorId: this.session!.visitorId,
      device: deviceInfo,
      utm: utmParams,
      referrer: document.referrer,
      entryPage: window.location.href,
      timestamp: Date.now(),
    });
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Click tracking
    if (this.config.captureClicks) {
      document.addEventListener('click', this.handleClick.bind(this), true);
    }

    // Scroll tracking
    if (this.config.captureScrolls) {
      window.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
    }

    // Form interaction tracking
    if (this.config.captureFormInteractions) {
      document.addEventListener('focus', this.handleFormFocus.bind(this), true);
      document.addEventListener('blur', this.handleFormBlur.bind(this), true);
      document.addEventListener('submit', this.handleFormSubmit.bind(this), true);
    }

    // Visibility change (tab switch)
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));

    // History change (SPA navigation)
    window.addEventListener('popstate', () => this.trackPageView());

    // Intercept pushState/replaceState for SPA
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = (...args) => {
      originalPushState.apply(history, args);
      setTimeout(() => this.trackPageView(), 0);
    };

    history.replaceState = (...args) => {
      originalReplaceState.apply(history, args);
      setTimeout(() => this.trackPageView(), 0);
    };
  }

  /**
   * Handle click events
   */
  private handleClick(e: MouseEvent): void {
    const target = e.target as Element;
    if (!target) return;

    const event: EventData = {
      type: 'click',
      name: this.getClickEventName(target),
      targetSelector: getCSSSelector(target),
      targetText: getElementText(target),
      targetHref: (target as HTMLAnchorElement).href || undefined,
      pageX: e.pageX,
      pageY: e.pageY,
      timestamp: Date.now(),
    };

    this.trackEvent(event);
  }

  /**
   * Get meaningful click event name
   */
  private getClickEventName(element: Element): string {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'a') return 'link_click';
    if (tagName === 'button') return 'button_click';
    if (tagName === 'input') {
      const type = (element as HTMLInputElement).type;
      if (type === 'submit') return 'form_submit_click';
      if (type === 'checkbox') return 'checkbox_click';
      if (type === 'radio') return 'radio_click';
    }
    if (element.closest('nav')) return 'nav_click';
    if (element.closest('form')) return 'form_element_click';

    return 'element_click';
  }

  /**
   * Handle scroll events
   */
  private handleScroll(): void {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollPercent = Math.round((scrollTop / docHeight) * 100);

    if (scrollPercent > this.maxScrollDepth) {
      this.maxScrollDepth = scrollPercent;
    }
  }

  /**
   * Handle form field focus
   */
  private handleFormFocus(e: FocusEvent): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (!this.isFormElement(target)) return;

    this.trackEvent({
      type: 'form_field',
      name: 'field_focus',
      targetSelector: getCSSSelector(target),
      metadata: {
        fieldName: target.name || target.id,
        fieldType: target.type || target.tagName.toLowerCase(),
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle form field blur
   */
  private handleFormBlur(e: FocusEvent): void {
    const target = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    if (!this.isFormElement(target)) return;

    // Don't track sensitive field values
    const sensitiveTypes = ['password', 'credit-card', 'ssn'];
    const isSensitive = sensitiveTypes.includes(target.type) ||
                       target.name?.toLowerCase().includes('password') ||
                       target.name?.toLowerCase().includes('card');

    this.trackEvent({
      type: 'form_field',
      name: 'field_complete',
      targetSelector: getCSSSelector(target),
      value: isSensitive ? '[REDACTED]' : (target.value?.length > 0 ? '[FILLED]' : '[EMPTY]'),
      metadata: {
        fieldName: target.name || target.id,
        fieldType: target.type || target.tagName.toLowerCase(),
        hasValue: target.value?.length > 0,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle form submission
   */
  private handleFormSubmit(e: Event): void {
    const form = e.target as HTMLFormElement;
    if (!form) return;

    const formData: Record<string, string> = {};
    const inputs = form.querySelectorAll('input, select, textarea');

    inputs.forEach((input) => {
      const el = input as HTMLInputElement;
      const name = el.name || el.id;
      if (name && !this.isSensitiveField(el)) {
        formData[name] = el.type === 'checkbox' || el.type === 'radio'
          ? (el.checked ? 'checked' : 'unchecked')
          : (el.value ? '[FILLED]' : '[EMPTY]');
      }
    });

    this.send('form.submit', {
      sessionId: this.session!.sessionId,
      formId: form.id || form.name,
      formAction: form.action,
      fields: formData,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if element is a form element
   */
  private isFormElement(el: Element): boolean {
    return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
  }

  /**
   * Check if field is sensitive
   */
  private isSensitiveField(el: HTMLInputElement): boolean {
    const sensitivePatterns = ['password', 'card', 'cvv', 'ssn', 'credit', 'secret', 'token'];
    const name = (el.name || el.id || '').toLowerCase();
    return el.type === 'password' || sensitivePatterns.some(p => name.includes(p));
  }

  /**
   * Handle visibility change
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'hidden') {
      this.flush(true);
    }
  }

  /**
   * Track page view
   */
  trackPageView(): void {
    // End previous page view
    if (this.currentPageView) {
      this.endPageView();
    }

    this.pageViewStartTime = Date.now();
    this.maxScrollDepth = 0;

    const loadTime = performance.timing
      ? performance.timing.loadEventEnd - performance.timing.navigationStart
      : 0;

    this.currentPageView = {
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      timestamp: Date.now(),
      scrollDepth: 0,
      timeOnPage: 0,
      loadTime: loadTime > 0 ? loadTime : 0,
    };

    this.session!.pageViewCount++;
    this.saveSession();

    this.send('page.view', {
      sessionId: this.session!.sessionId,
      ...this.currentPageView,
    });

    this.log('Page view tracked', this.currentPageView);
  }

  /**
   * End current page view
   */
  private endPageView(): void {
    if (!this.currentPageView) return;

    const timeOnPage = Math.round((Date.now() - this.pageViewStartTime) / 1000);

    this.send('page.leave', {
      sessionId: this.session!.sessionId,
      url: this.currentPageView.url,
      path: this.currentPageView.path,
      scrollDepth: this.maxScrollDepth,
      timeOnPage,
      timestamp: Date.now(),
    });
  }

  /**
   * Track custom event
   */
  trackEvent(event: Partial<EventData>): void {
    const fullEvent: EventData = {
      type: event.type || 'custom',
      name: event.name || 'custom_event',
      ...event,
      timestamp: event.timestamp || Date.now(),
    };

    this.eventQueue.push(fullEvent);
    this.session!.eventCount++;
    this.session!.lastActiveAt = Date.now();
    this.saveSession();

    this.log('Event tracked', fullEvent);
  }

  /**
   * Track custom event (public API)
   */
  track(eventName: string, properties?: Record<string, unknown>): void {
    this.trackEvent({
      type: 'custom',
      name: eventName,
      metadata: properties,
    });
  }

  /**
   * Identify user
   */
  identify(userId: string, traits?: Record<string, unknown>): void {
    this.send('user.identify', {
      sessionId: this.session!.sessionId,
      visitorId: this.session!.visitorId,
      userId,
      traits,
      timestamp: Date.now(),
    });

    this.log('User identified', { userId, traits });
  }

  /**
   * Start session recording
   */
  private startRecording(): void {
    if (this.stopRecording) return;

    try {
      const stopFn = record({
        emit: (event) => {
          this.recordingEvents.push(event);

          // Flush recording events every 100 events
          if (this.recordingEvents.length >= 100) {
            this.flushRecording();
          }
        },
        maskAllInputs: this.config.recordingOptions?.maskAllInputs ?? true,
        maskTextSelector: this.config.recordingOptions?.maskTextSelector,
        blockSelector: this.config.recordingOptions?.blockSelector,
      });

      if (stopFn) {
        this.stopRecording = stopFn;
      }

      this.log('Session recording started');
    } catch (e) {
      this.log('Failed to start recording', e);
    }
  }

  /**
   * Flush recording events
   */
  private flushRecording(): void {
    if (this.recordingEvents.length === 0) return;

    this.send('recording.events', {
      sessionId: this.session!.sessionId,
      events: this.recordingEvents,
      timestamp: Date.now(),
    });

    this.recordingEvents = [];
  }

  /**
   * Flush queued events
   */
  flush(isUnload: boolean = false): void {
    // Flush page events
    if (this.eventQueue.length > 0) {
      this.send('events.batch', {
        sessionId: this.session!.sessionId,
        events: this.eventQueue,
      }, isUnload);

      this.eventQueue = [];
    }

    // Flush recording events
    if (this.recordingEvents.length > 0) {
      this.flushRecording();
    }
  }

  /**
   * Send data to API
   */
  private send(eventType: string, data: unknown, useBeacon: boolean = false): void {
    const payload = {
      apiKey: this.config.apiKey,
      type: eventType,
      data,
    };

    const endpoint = this.config.apiEndpoint!;

    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, JSON.stringify(payload));
    } else {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch((e) => this.log('Failed to send event', e));
    }
  }

  /**
   * Log debug message
   */
  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[CRM360 Tracker]', ...args);
    }
  }

  /**
   * Destroy tracker
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    if (this.stopRecording) {
      this.stopRecording();
    }
    this.flush(true);
    this.initialized = false;
    this.log('Tracker destroyed');
  }
}

// Global instance
let trackerInstance: CRM360Tracker | null = null;

// Factory function
export function createTracker(config: TrackerConfig): CRM360Tracker {
  if (trackerInstance) {
    return trackerInstance;
  }
  trackerInstance = new CRM360Tracker(config);
  return trackerInstance;
}

// Auto-init from script tag data attributes
if (typeof window !== 'undefined') {
  const script = document.currentScript as HTMLScriptElement;
  if (script) {
    const apiKey = script.getAttribute('data-api-key');
    const apiEndpoint = script.getAttribute('data-endpoint');
    const enableRecording = script.getAttribute('data-recording') === 'true';
    const debug = script.getAttribute('data-debug') === 'true';

    if (apiKey) {
      const tracker = createTracker({
        apiKey,
        apiEndpoint: apiEndpoint || undefined,
        enableRecording,
        debug,
      });

      // Initialize when DOM is ready
      if (document.readyState === 'complete') {
        tracker.init();
      } else {
        window.addEventListener('DOMContentLoaded', () => tracker.init());
      }

      // Expose globally
      (window as any).crm360 = tracker;
    }
  }
}

export { CRM360Tracker };
export type { TrackerConfig, SessionData, EventData, DeviceInfo };
