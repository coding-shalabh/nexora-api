import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { pinoHttp } from 'pino-http';
import { logger } from './common/logger.js';
import { config } from './config/index.js';
import { errorHandler } from './common/middleware/error-handler.js';
import { rateLimiter } from './common/middleware/rate-limiter.js';
import { tenantMiddleware } from './common/middleware/tenant.js';
import { demoTenantMiddleware } from './common/middleware/demo-tenant.js';

// Module routers
import { authRouter } from './modules/auth/auth.router.js';
import { tenantRouter } from './modules/tenant/tenant.router.js';
import { crmRouter } from './modules/crm/crm.router.js';
import { inboxRouter } from './modules/inbox/inbox.router.js';
import { pipelineRouter } from './modules/pipeline/pipeline.router.js';
import { ticketsRouter } from './modules/tickets/tickets.router.js';
import { kbRouter } from './modules/knowledge-base/kb.router.js';
import { surveysRouter } from './modules/surveys/surveys.router.js';
import { billingRouter } from './modules/billing/billing.router.js';
import { walletRouter } from './modules/wallet/wallet.router.js';
import { automationRouter } from './modules/automation/automation.router.js';
import { analyticsRouter } from './modules/analytics/analytics.router.js';
import settingsRouter from './modules/settings/settings.router.js';
import integrationsRouter from './modules/integrations/integrations.router.js';
import { projectsRouter } from './modules/projects/projects.router.js';
import { tasksRouter } from './modules/tasks/tasks.router.js';
import { calendarRouter } from './modules/calendar/calendar.router.js';
import { trackingRouter } from './modules/tracking/tracking.router.js';
import { msg91TestRouter } from './modules/test/msg91-test.router.js';
import { whatsAppRouter } from './modules/whatsapp/whatsapp.router.js';
import { whatsAppService } from './common/providers/whatsapp/index.js';
import {
  emailAccountsRouter,
  sharedInboxesRouter,
  emailSendRouter,
  bulkEmailRouter,
  emailDomainsRouter,
  emailMailboxRouter,
  emailAliasRouter,
  emailDraftsRouter,
} from './modules/email/index.js';
import emailRouter from './modules/email/email.router.js';
import { onboardingRouter } from './modules/onboarding/index.js';
import channelsRouter from './modules/channels/channels.router.js';
import { webhooksRouter } from './modules/channels/index.js';
import { dialerRouter } from './modules/dialer/index.js';
import templatesRouter from './modules/templates/templates.router.js';
import broadcastRouter from './modules/broadcasts/broadcast.router.js';
import campaignsRouter from './modules/campaigns/campaigns.router.js';
import segmentsRouter from './modules/segments/segments.router.js';
import sequencesRouter from './modules/sequences/sequences.router.js';
import utilsRouter from './modules/utils/utils.router.js';
import { superAdminRouter } from './modules/super-admin/index.js';
import smsRouter from './modules/sms/sms.router.js';
import channelConnectRouter from './modules/channel-connect/channel-connect.router.js';
import { productsRouter } from './modules/products/products.router.js';
import { quotesRouter } from './modules/quotes/quotes.router.js';
import { systemRouter } from './modules/system/system.router.js';
import { resendRouter } from './modules/resend/index.js';
import { msg91EmailRouter } from './modules/msg91-email/index.js';
import { emailServiceRouter } from './modules/email-service/index.js';
import uploadsRouter from './modules/uploads/uploads.router.js';
import filesRouter from './modules/files/files.router.js';
import { notificationsRouter } from './modules/notifications/index.js';
import { dashboardRouter } from './modules/dashboard/index.js';
import { telecmiRouter } from './modules/telecmi/telecmi.router.js';
import { oauthRouter } from './modules/oauth/oauth.router.js';
import testRouter from './modules/test/test.router.js';
import { hrRouter } from './modules/hr/index.js';
import { commerceRouter } from './modules/commerce/index.js';
import { salesRouter } from './modules/sales/index.js';
import aiAssistantRouter from './modules/ai-assistant/ai-assistant.router.js';
import bookingRouter from './modules/booking/booking.router.js';
import eSignatureRouter from './modules/e-signature/e-signature.router.js';
import path from 'path';

export async function createServer() {
  const app = express();

  // Trust proxy for rate limiting behind reverse proxy
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet());
  // CORS configuration - restrict to known origins
  const allowedOrigins = [
    'https://nexoraos.pro',
    'https://www.nexoraos.pro',
    'https://api.nexoraos.pro',
    'https://72orionx.com',
    'https://www.72orionx.com',
    // Development - localhost ports 3000-3010
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:3004',
    'http://localhost:3005',
    'http://localhost:3006',
    'http://localhost:3007',
    'http://localhost:3008',
    'http://localhost:3009',
    'http://localhost:3010',
    'http://localhost:4000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
  ];

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn({ origin }, 'CORS blocked request from unknown origin');
          callback(null, false);
        }
      },
      credentials: true,
    })
  );

  // Request parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());

  // Logging
  app.use(pinoHttp({ logger }));

  // Rate limiting
  app.use(rateLimiter);

  // Health check (before auth)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Static files for uploads (public access) with CORS headers for cross-origin access
  app.use(
    '/uploads',
    (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      next();
    },
    express.static(path.join(process.cwd(), 'public', 'uploads'))
  );

  // API versioning prefix
  const apiV1 = express.Router();

  // Super Admin routes (separate auth system)
  apiV1.use('/super-admin', superAdminRouter);

  // Public routes (no auth required)
  apiV1.use('/system', systemRouter); // System info and health endpoints
  apiV1.use('/auth', authRouter);
  apiV1.use('/onboarding', onboardingRouter); // Onboarding flow (public - uses its own token)
  apiV1.use('/tracking', trackingRouter); // Mixed public/protected - has its own auth handling
  apiV1.use('/test/msg91', msg91TestRouter); // MSG91 API testing (no auth for testing)
  apiV1.use('/webhooks', webhooksRouter); // Channel webhooks (public - MSG91/Exotel calls these)
  apiV1.use('/utils', utilsRouter); // Utility endpoints (link previews, etc.)
  apiV1.use('/e-signature/sign', eSignatureRouter); // Public signing endpoints (no auth)
  apiV1.use('/email', tenantMiddleware, emailRouter); // Email main router (includes send, track, domains, aliases, drafts, bulk, mailbox)

  // WhatsApp webhook (public - MSG91 calls this)
  apiV1.post('/whatsapp/webhook/:id', async (req, res) => {
    try {
      const { id } = req.params;
      res.status(200).json({ success: true });
      whatsAppService.processWebhook(id, req.body).catch((error) => {
        console.error('WhatsApp webhook error:', error);
      });
    } catch (error) {
      res.status(200).json({ success: false });
    }
  });

  // Demo tenant middleware (overrides tenant ID in demo mode)
  apiV1.use(demoTenantMiddleware);

  // Protected routes (auth + tenant required)
  apiV1.use('/tenants', tenantRouter);
  apiV1.use('/crm', tenantMiddleware, crmRouter);
  apiV1.use('/inbox', tenantMiddleware, inboxRouter);
  apiV1.use('/pipeline', tenantMiddleware, pipelineRouter);
  apiV1.use('/tickets', tenantMiddleware, ticketsRouter);
  apiV1.use('/kb', tenantMiddleware, kbRouter);
  apiV1.use('/surveys', tenantMiddleware, surveysRouter);
  apiV1.use('/billing', tenantMiddleware, billingRouter);
  apiV1.use('/wallet', tenantMiddleware, walletRouter);
  apiV1.use('/automation', tenantMiddleware, automationRouter);
  apiV1.use('/analytics', tenantMiddleware, analyticsRouter);
  apiV1.use('/settings', tenantMiddleware, settingsRouter);
  apiV1.use('/integrations', tenantMiddleware, integrationsRouter);
  apiV1.use('/projects', tenantMiddleware, projectsRouter);
  apiV1.use('/tasks', tenantMiddleware, tasksRouter);
  apiV1.use('/calendar', tenantMiddleware, calendarRouter);
  apiV1.use('/whatsapp', tenantMiddleware, whatsAppRouter);
  apiV1.use('/email-accounts', tenantMiddleware, emailAccountsRouter);
  apiV1.use('/shared-inboxes', tenantMiddleware, sharedInboxesRouter);
  apiV1.use('/bulk-email', tenantMiddleware, bulkEmailRouter);
  apiV1.use('/email-domains', tenantMiddleware, emailDomainsRouter);
  apiV1.use('/email-mailboxes', tenantMiddleware, emailMailboxRouter);
  apiV1.use('/email-aliases', tenantMiddleware, emailAliasRouter);
  apiV1.use('/email-compose', tenantMiddleware, emailDraftsRouter);
  apiV1.use('/channels', tenantMiddleware, channelsRouter);
  apiV1.use('/dialer', tenantMiddleware, dialerRouter);
  apiV1.use('/templates', tenantMiddleware, templatesRouter);
  apiV1.use('/broadcasts', tenantMiddleware, broadcastRouter);
  apiV1.use('/campaigns', tenantMiddleware, campaignsRouter);
  apiV1.use('/segments', tenantMiddleware, segmentsRouter);
  apiV1.use('/sequences', tenantMiddleware, sequencesRouter);
  apiV1.use('/sms', tenantMiddleware, smsRouter);
  apiV1.use('/products', tenantMiddleware, productsRouter);
  apiV1.use('/quotes', tenantMiddleware, quotesRouter);
  apiV1.use('/resend', tenantMiddleware, resendRouter);
  apiV1.use('/msg91-email', tenantMiddleware, msg91EmailRouter);
  apiV1.use('/email-service', tenantMiddleware, emailServiceRouter);
  apiV1.use('/channel-connect', tenantMiddleware, channelConnectRouter);
  apiV1.use('/uploads', tenantMiddleware, uploadsRouter);
  apiV1.use('/files', tenantMiddleware, filesRouter);
  apiV1.use('/notifications', tenantMiddleware, notificationsRouter);
  apiV1.use('/dashboard', tenantMiddleware, dashboardRouter);
  apiV1.use('/telecmi', tenantMiddleware, telecmiRouter);
  apiV1.use('/oauth', tenantMiddleware, oauthRouter);
  apiV1.use('/hr', tenantMiddleware, hrRouter);
  apiV1.use('/commerce', tenantMiddleware, commerceRouter);
  apiV1.use('/sales', tenantMiddleware, salesRouter);
  apiV1.use('/ai-assistant', tenantMiddleware, aiAssistantRouter);
  apiV1.use('/e-signature/requests', tenantMiddleware, eSignatureRouter); // Protected signature request management
  apiV1.use('/', bookingRouter); // Booking pages (mixed public/protected - handles auth internally)
  apiV1.use('/test', testRouter);

  // SMS webhook (public - Fast2SMS delivery reports)
  apiV1.post('/sms/webhook/delivery', smsRouter);

  // Resend webhook (public - delivery events)
  apiV1.post('/resend/webhook', resendRouter);

  // MSG91 email webhook (public - delivery events)
  apiV1.post('/msg91-email/webhook', msg91EmailRouter);

  // Email service webhook (public - Resend delivery events)
  apiV1.post('/email-service/webhook', emailServiceRouter);

  // Mount API v1
  app.use('/api/v1', apiV1);

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found',
      },
    });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
