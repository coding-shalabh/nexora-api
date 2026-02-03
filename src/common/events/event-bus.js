import { EventEmitter } from 'events';
import { logger } from '../logger.js';

class EventBus extends EventEmitter {
  static instance;

  constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance() {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  publish(event) {
    logger.debug({ event }, `Publishing event: ${event.type}`);

    // Emit the specific event type
    this.emit(event.type, event);

    // Also emit a generic 'event' for cross-cutting concerns
    this.emit('event', event);
  }

  subscribe(eventType, handler) {
    this.on(eventType, async (event) => {
      try {
        await handler(event);
      } catch (error) {
        logger.error({ error, event }, `Error handling event: ${eventType}`);
      }
    });
  }

  subscribeAll(handler) {
    this.on('event', async (event) => {
      try {
        await handler(event);
      } catch (error) {
        logger.error({ error, event }, 'Error in global event handler');
      }
    });
  }
}

export const eventBus = EventBus.getInstance();

// Helper function to create events
export function createEvent(type, tenantId, payload, metadata) {
  return {
    type,
    tenantId,
    timestamp: new Date(),
    payload,
    metadata,
  };
}

// Common event types
export const EventTypes = {
  // Contact events
  CONTACT_CREATED: 'contact.created',
  CONTACT_UPDATED: 'contact.updated',
  CONTACT_DELETED: 'contact.deleted',

  // Company events
  COMPANY_CREATED: 'company.created',
  COMPANY_UPDATED: 'company.updated',
  COMPANY_DELETED: 'company.deleted',

  // Conversation events
  CONVERSATION_STARTED: 'conversation.started',
  CONVERSATION_ASSIGNED: 'conversation.assigned',
  CONVERSATION_RESOLVED: 'conversation.resolved',
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_SENT: 'message.sent',

  // Lead events
  LEAD_CREATED: 'lead.created',
  LEAD_UPDATED: 'lead.updated',
  LEAD_DELETED: 'lead.deleted',
  LEAD_QUALIFIED: 'lead.qualified',
  LEAD_CONVERTED: 'lead.converted',

  // Segment events
  SEGMENT_CREATED: 'segment.created',
  SEGMENT_UPDATED: 'segment.updated',
  SEGMENT_DELETED: 'segment.deleted',

  // Deal events
  DEAL_CREATED: 'deal.created',
  DEAL_STAGE_CHANGED: 'deal.stage_changed',
  DEAL_WON: 'deal.won',
  DEAL_LOST: 'deal.lost',

  // Ticket events
  TICKET_CREATED: 'ticket.created',
  TICKET_ASSIGNED: 'ticket.assigned',
  TICKET_RESOLVED: 'ticket.resolved',
  TICKET_SLA_WARNING: 'ticket.sla_warning',
  TICKET_SLA_BREACHED: 'ticket.sla_breached',

  // Billing events
  QUOTE_CREATED: 'quote.created',
  QUOTE_SENT: 'quote.sent',
  QUOTE_ACCEPTED: 'quote.accepted',
  INVOICE_CREATED: 'invoice.created',
  INVOICE_SENT: 'invoice.sent',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_OVERDUE: 'invoice.overdue',

  // Wallet events
  WALLET_CREDITED: 'wallet.credited',
  WALLET_DEBITED: 'wallet.debited',
  WALLET_LOW_BALANCE: 'wallet.low_balance',

  // Automation events
  WORKFLOW_TRIGGERED: 'workflow.triggered',
  WORKFLOW_COMPLETED: 'workflow.completed',
  WORKFLOW_FAILED: 'workflow.failed',
};
