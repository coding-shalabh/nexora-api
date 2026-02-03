export { default as emailAccountsRouter } from './email-accounts.router.js';
export { emailAccountsService } from './email-accounts.service.js';
export { emailAccessRouter } from './email-access.routes.js';
export { default as sharedInboxesRouter } from './shared-inboxes.router.js';
export { sharedInboxesService } from './shared-inboxes.service.js';
export { emailSendRouter } from './email-send.router.js';
export { emailSendService } from '../../services/email-send.service.js';
export { default as bulkEmailRouter } from './bulk-email.router.js';
export { sesEmailService } from '../../services/ses-email.service.js';
export { default as emailDomainsRouter } from './email-domains.router.js';
export { sesDomainService } from '../../services/ses-domain.service.js';

// Email Mailbox Management
export { default as emailMailboxRouter } from './email-mailbox.router.js';
export { emailMailboxService } from './email-mailbox.service.js';

// Email Aliases & Forwarders
export { default as emailAliasRouter } from './email-alias.router.js';
export { emailAliasService } from './email-alias.service.js';

// Email Drafts, Templates & Signatures
export { default as emailDraftsRouter } from './email-drafts.router.js';
export { emailDraftsService } from './email-drafts.service.js';
