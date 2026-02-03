import { HTTP_STATUS } from '../constants/index.js';

// ==================== Base Error ====================

export class AppError extends Error {
  constructor(
    message,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    isOperational = true,
    details = undefined
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      type: `https://api.crm360.io/errors/${this.code.toLowerCase().replace(/_/g, '-')}`,
      title: this.code,
      status: this.statusCode,
      detail: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}

// ==================== HTTP Errors ====================

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details = undefined) {
    super(message, 400, 'BAD_REQUEST', true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED', true);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN', true);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = 'Resource', id = undefined) {
    const message = id ? `${resource} with ID '${id}' not found` : `${resource} not found`;
    super(message, 404, 'NOT_FOUND', true, { resource, id });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details = undefined) {
    super(message, 409, 'CONFLICT', true, details);
  }
}

export class ValidationError extends AppError {
  constructor(errors, message = 'Validation failed') {
    super(message, 422, 'VALIDATION_ERROR', true, { errors });
    this.errors = errors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      errors: this.errors,
    };
  }
}

export class TooManyRequestsError extends AppError {
  constructor(retryAfter = 60) {
    super(`Rate limit exceeded. Retry after ${retryAfter} seconds`, 429, 'RATE_LIMIT_EXCEEDED', true, { retryAfter });
    this.retryAfter = retryAfter;
  }
}

export class InternalError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, 'INTERNAL_ERROR', false);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE', true);
  }
}

// ==================== Domain Errors ====================

export class DuplicateError extends ConflictError {
  constructor(resource, field, value) {
    super(`${resource} with ${field} '${value}' already exists`, { resource, field, value });
  }
}

export class InsufficientBalanceError extends AppError {
  constructor(required, available) {
    super(`Insufficient balance. Required: ${required}, Available: ${available}`, 400, 'INSUFFICIENT_BALANCE', true, { required, available });
  }
}

export class MessageWindowExpiredError extends AppError {
  constructor() {
    super('WhatsApp 24-hour messaging window has expired. Use a template message.', 400, 'MESSAGE_WINDOW_EXPIRED', true);
  }
}

export class TemplateNotApprovedError extends AppError {
  constructor(templateId) {
    super(`Template '${templateId}' is not approved`, 400, 'TEMPLATE_NOT_APPROVED', true, { templateId });
  }
}

export class SLABreachedError extends AppError {
  constructor(ticketId, slaType) {
    super(`SLA ${slaType} breached for ticket '${ticketId}'`, 400, 'SLA_BREACHED', true, { ticketId, slaType });
  }
}

export class WebhookDeliveryError extends AppError {
  constructor(webhookId, error) {
    super(`Webhook delivery failed: ${error}`, 400, 'WEBHOOK_DELIVERY_FAILED', true, { webhookId, error });
  }
}

// ==================== Type Guards ====================

export function isAppError(error) {
  return error instanceof AppError;
}

export function isOperationalError(error) {
  if (isAppError(error)) {
    return error.isOperational;
  }
  return false;
}
