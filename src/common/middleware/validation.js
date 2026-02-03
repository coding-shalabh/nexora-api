/**
 * Request Validation Middleware
 * Comprehensive request validation using Zod schemas with security features
 */

import { z } from 'zod';

// Common dangerous patterns for security
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b.*\b(FROM|INTO|TABLE|DATABASE)\b)/gi,
  /(\bUNION\b.*\bSELECT\b)/gi,
  /(--.*)$/gm,
  /(\/\*[\s\S]*?\*\/)/g,
  /(\bOR\b\s+\d+\s*=\s*\d+)/gi,
  /(\bAND\b\s+\d+\s*=\s*\d+)/gi,
];

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /<iframe\b/gi,
  /<embed\b/gi,
  /<object\b/gi,
];

/**
 * Check if string contains potential SQL injection
 */
function hasSQLInjection(str) {
  if (typeof str !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some((pattern) => pattern.test(str));
}

/**
 * Check if string contains potential XSS
 */
function hasXSS(str) {
  if (typeof str !== 'string') return false;
  return XSS_PATTERNS.some((pattern) => pattern.test(str));
}

/**
 * Recursively check object for dangerous patterns
 */
function checkForDangerousPatterns(obj, path = '') {
  const issues = [];

  if (typeof obj === 'string') {
    if (hasSQLInjection(obj)) {
      issues.push({
        path: path || 'value',
        type: 'SQL_INJECTION',
        message: 'Potential SQL injection detected',
      });
    }
    if (hasXSS(obj)) {
      issues.push({ path: path || 'value', type: 'XSS', message: 'Potential XSS detected' });
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      issues.push(...checkForDangerousPatterns(item, `${path}[${index}]`));
    });
  } else if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach((key) => {
      issues.push(...checkForDangerousPatterns(obj[key], path ? `${path}.${key}` : key));
    });
  }

  return issues;
}

/**
 * Sanitize string by escaping HTML entities
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Recursively sanitize object strings
 */
function sanitizeObject(obj) {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    Object.keys(obj).forEach((key) => {
      sanitized[key] = sanitizeObject(obj[key]);
    });
    return sanitized;
  }
  return obj;
}

/**
 * Validate request parts against Zod schemas
 * @param {Object} schemas - Object containing Zod schemas for body, query, params
 * @param {Object} options - Validation options
 * @returns {Function} Express middleware
 */
export function validateRequest(schemas, options = {}) {
  const { sanitize = false, checkSecurity = true, stripUnknown = true } = options;

  return async (req, res, next) => {
    try {
      const errors = [];

      // Security check for dangerous patterns
      if (checkSecurity) {
        const bodyIssues = checkForDangerousPatterns(req.body, 'body');
        const queryIssues = checkForDangerousPatterns(req.query, 'query');
        const paramsIssues = checkForDangerousPatterns(req.params, 'params');

        const securityIssues = [...bodyIssues, ...queryIssues, ...paramsIssues];
        if (securityIssues.length > 0) {
          return res.status(400).json({
            success: false,
            error: 'SECURITY_VIOLATION',
            message: 'Request contains potentially dangerous content',
            details: securityIssues,
          });
        }
      }

      // Validate body
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) {
          errors.push(
            ...result.error.errors.map((e) => ({
              location: 'body',
              path: e.path.join('.'),
              message: e.message,
              code: e.code,
            }))
          );
        } else {
          req.body = sanitize ? sanitizeObject(result.data) : result.data;
        }
      }

      // Validate query parameters
      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) {
          errors.push(
            ...result.error.errors.map((e) => ({
              location: 'query',
              path: e.path.join('.'),
              message: e.message,
              code: e.code,
            }))
          );
        } else {
          req.query = sanitize ? sanitizeObject(result.data) : result.data;
        }
      }

      // Validate URL params
      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) {
          errors.push(
            ...result.error.errors.map((e) => ({
              location: 'params',
              path: e.path.join('.'),
              message: e.message,
              code: e.code,
            }))
          );
        } else {
          req.params = sanitize ? sanitizeObject(result.data) : result.data;
        }
      }

      // Validate headers if schema provided
      if (schemas.headers) {
        const result = schemas.headers.safeParse(req.headers);
        if (!result.success) {
          errors.push(
            ...result.error.errors.map((e) => ({
              location: 'headers',
              path: e.path.join('.'),
              message: e.message,
              code: e.code,
            }))
          );
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: errors,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Content-Type validation middleware
 */
export function validateContentType(allowedTypes = ['application/json']) {
  return (req, res, next) => {
    // Skip for GET, HEAD, OPTIONS, DELETE (typically no body)
    if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(req.method)) {
      return next();
    }

    const contentType = req.headers['content-type'];

    // If no body, skip validation
    if (!req.body || Object.keys(req.body).length === 0) {
      return next();
    }

    if (!contentType) {
      return res.status(415).json({
        success: false,
        error: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Content-Type header is required',
      });
    }

    const isValid = allowedTypes.some((type) =>
      contentType.toLowerCase().includes(type.toLowerCase())
    );

    if (!isValid) {
      return res.status(415).json({
        success: false,
        error: 'UNSUPPORTED_MEDIA_TYPE',
        message: `Content-Type must be one of: ${allowedTypes.join(', ')}`,
        received: contentType,
      });
    }

    next();
  };
}

/**
 * Request body size validation middleware
 */
export function validateBodySize(maxSizeBytes = 1048576) {
  // Default 1MB
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > maxSizeBytes) {
      return res.status(413).json({
        success: false,
        error: 'PAYLOAD_TOO_LARGE',
        message: `Request body exceeds maximum size of ${Math.round(maxSizeBytes / 1024)}KB`,
        maxSize: maxSizeBytes,
        receivedSize: contentLength,
      });
    }

    next();
  };
}

/**
 * Required fields validation middleware
 */
export function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter((field) => {
      const value = req.body[field];
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'MISSING_REQUIRED_FIELDS',
        message: `Missing required fields: ${missing.join(', ')}`,
        missingFields: missing,
      });
    }

    next();
  };
}

/**
 * Validate ID parameter is a valid CUID/UUID
 */
export function validateIdParam(paramName = 'id') {
  return (req, res, next) => {
    const id = req.params[paramName];

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_ID',
        message: `Missing ${paramName} parameter`,
      });
    }

    // Accept CUIDs (starts with c, 25 chars) or UUIDs
    const cuidPattern = /^c[a-z0-9]{24}$/;
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!cuidPattern.test(id) && !uuidPattern.test(id)) {
      // Also accept simple alphanumeric IDs for backwards compatibility
      const simpleIdPattern = /^[a-zA-Z0-9_-]{1,50}$/;
      if (!simpleIdPattern.test(id)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_ID',
          message: `Invalid ${paramName} format`,
        });
      }
    }

    next();
  };
}

/**
 * Common validation schemas for CRM domain
 */
export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),

  // Search with pagination
  searchWithPagination: z.object({
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().positive().max(100).optional().default(20),
    search: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  }),

  // MongoDB/CUID ID
  id: z.string().min(1),

  // UUID
  uuid: z.string().uuid(),

  // CUID
  cuid: z.string().regex(/^c[a-z0-9]{24}$/, 'Invalid CUID format'),

  // Email
  email: z.string().email().toLowerCase(),

  // Optional email that treats empty string as undefined
  optionalEmail: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val))
    .pipe(z.string().email().optional()),

  // Phone number (E.164 format)
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),

  // Optional phone
  optionalPhone: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val))
    .pipe(
      z
        .string()
        .regex(/^\+?[1-9]\d{1,14}$/)
        .optional()
    ),

  // Date range
  dateRange: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),

  // ISO date string
  isoDate: z.string().datetime(),

  // Optional ISO date
  optionalIsoDate: z.string().datetime().optional(),

  // URL
  url: z.string().url(),

  // Optional URL
  optionalUrl: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val))
    .pipe(z.string().url().optional()),

  // Positive integer
  positiveInt: z.coerce.number().int().positive(),

  // Non-negative integer
  nonNegativeInt: z.coerce.number().int().nonnegative(),

  // Currency amount (2 decimal places)
  currency: z.coerce.number().multipleOf(0.01),

  // Percentage (0-100)
  percentage: z.coerce.number().min(0).max(100),

  // Tags array
  tags: z.array(z.string().min(1).max(50)).optional(),

  // Custom fields object
  customFields: z.record(z.unknown()).optional(),

  // Hex color
  hexColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),

  // Contact status
  contactStatus: z.enum(['ACTIVE', 'INACTIVE', 'BLOCKED', 'UNSUBSCRIBED']),

  // Lifecycle stage
  lifecycleStage: z.enum([
    'SUBSCRIBER',
    'LEAD',
    'MQL',
    'SQL',
    'OPPORTUNITY',
    'CUSTOMER',
    'EVANGELIST',
    'OTHER',
  ]),

  // Lead status
  leadStatus: z.enum([
    'NEW',
    'OPEN',
    'IN_PROGRESS',
    'OPEN_DEAL',
    'UNQUALIFIED',
    'ATTEMPTED_TO_CONTACT',
    'CONNECTED',
    'BAD_TIMING',
  ]),

  // Deal stage
  dealStage: z.enum(['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST']),

  // Priority
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),

  // Rating
  rating: z.enum(['HOT', 'WARM', 'COLD']),

  // Activity type
  activityType: z.enum(['CALL', 'MEETING', 'TASK', 'NOTE', 'EMAIL']),

  // Channel type
  channelType: z.enum(['WHATSAPP', 'EMAIL', 'SMS', 'VOICE']),

  // Ticket status
  ticketStatus: z.enum(['OPEN', 'IN_PROGRESS', 'PENDING', 'RESOLVED', 'CLOSED']),

  // Ticket priority
  ticketPriority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),

  // Invoice status
  invoiceStatus: z.enum([
    'DRAFT',
    'SENT',
    'PAID',
    'PARTIALLY_PAID',
    'OVERDUE',
    'CANCELLED',
    'VOID',
  ]),

  // Payment method
  paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'OTHER']),

  // Boolean from string
  booleanString: z
    .union([z.boolean(), z.string()])
    .transform((val) => (typeof val === 'string' ? val === 'true' : val)),
};

/**
 * Create a partial version of a schema (all fields optional)
 */
export function makePartial(schema) {
  return schema.partial();
}

/**
 * Create a schema that requires at least one field from a list
 */
export function requireAtLeastOne(schema, fields) {
  return schema.refine(
    (data) => fields.some((field) => data[field] !== undefined && data[field] !== null),
    {
      message: `At least one of the following fields is required: ${fields.join(', ')}`,
    }
  );
}

/**
 * Create a conditional required field schema
 */
export function conditionalRequired(schema, condition, requiredFields) {
  return schema.superRefine((data, ctx) => {
    if (condition(data)) {
      requiredFields.forEach((field) => {
        if (data[field] === undefined || data[field] === null || data[field] === '') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${field} is required when ${condition.name || 'condition is met'}`,
            path: [field],
          });
        }
      });
    }
  });
}

export default {
  validateRequest,
  validateContentType,
  validateBodySize,
  requireFields,
  validateIdParam,
  commonSchemas,
  makePartial,
  requireAtLeastOne,
  conditionalRequired,
  sanitizeString,
  sanitizeObject,
  checkForDangerousPatterns,
};
