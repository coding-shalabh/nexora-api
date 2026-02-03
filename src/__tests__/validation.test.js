/**
 * Request Validation Middleware Unit Tests
 *
 * Tests for comprehensive request validation with security features
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import {
  validateRequest,
  validateContentType,
  validateBodySize,
  requireFields,
  validateIdParam,
  commonSchemas,
  makePartial,
  requireAtLeastOne,
  conditionalRequired,
} from '../common/middleware/validation.js';
import validationModule from '../common/middleware/validation.js';

describe('Request Validation Middleware', () => {
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
      headers: {},
      method: 'POST',
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    nextFn = vi.fn();
  });

  describe('validateRequest', () => {
    const bodySchema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
    });

    const querySchema = z.object({
      page: z.coerce.number().positive().optional(),
      limit: z.coerce.number().positive().max(100).optional(),
    });

    it('should validate valid request body', async () => {
      mockReq.body = { name: 'John', email: 'john@example.com' };
      const middleware = validateRequest({ body: bodySchema });

      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject invalid request body', async () => {
      mockReq.body = { name: '', email: 'invalid' };
      const middleware = validateRequest({ body: bodySchema });

      await middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'VALIDATION_ERROR',
          details: expect.arrayContaining([
            expect.objectContaining({ location: 'body', path: 'name' }),
            expect.objectContaining({ location: 'body', path: 'email' }),
          ]),
        })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should validate query parameters', async () => {
      mockReq.query = { page: '2', limit: '50' };
      const middleware = validateRequest({ query: querySchema });

      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
      expect(mockReq.query.page).toBe(2);
      expect(mockReq.query.limit).toBe(50);
    });

    it('should reject invalid query parameters', async () => {
      mockReq.query = { page: '-1', limit: '200' };
      const middleware = validateRequest({ query: querySchema });

      await middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'VALIDATION_ERROR',
          details: expect.arrayContaining([expect.objectContaining({ location: 'query' })]),
        })
      );
    });

    it('should validate URL params', async () => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      mockReq.params = { id: '550e8400-e29b-41d4-a716-446655440000' };
      const middleware = validateRequest({ params: paramsSchema });

      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should reject invalid URL params', async () => {
      const paramsSchema = z.object({ id: z.string().uuid() });
      mockReq.params = { id: 'not-a-uuid' };
      const middleware = validateRequest({ params: paramsSchema });

      await middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'VALIDATION_ERROR',
          details: expect.arrayContaining([expect.objectContaining({ location: 'params' })]),
        })
      );
    });

    it('should validate headers when schema provided', async () => {
      const headersSchema = z.object({
        'x-api-key': z.string().min(1),
      });
      mockReq.headers = { 'x-api-key': 'my-api-key' };
      const middleware = validateRequest({ headers: headersSchema });

      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should validate multiple parts simultaneously', async () => {
      mockReq.body = { name: 'John', email: 'john@example.com' };
      mockReq.query = { page: '1' };
      const middleware = validateRequest({ body: bodySchema, query: querySchema });

      await middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    describe('Security checks', () => {
      it('should detect SQL injection in body', async () => {
        mockReq.body = { name: "Robert'; DROP TABLE users; --", email: 'test@test.com' };
        const middleware = validateRequest({ body: bodySchema });

        await middleware(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: 'SECURITY_VIOLATION',
            message: 'Request contains potentially dangerous content',
          })
        );
      });

      it('should detect SQL UNION injection', async () => {
        mockReq.body = { name: '1 UNION SELECT * FROM users', email: 'test@test.com' };
        const middleware = validateRequest({ body: bodySchema });

        await middleware(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({ error: 'SECURITY_VIOLATION' })
        );
      });

      it('should detect XSS in body', async () => {
        mockReq.body = { name: '<script>alert("xss")</script>', email: 'test@test.com' };
        const middleware = validateRequest({ body: bodySchema });

        await middleware(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({ error: 'SECURITY_VIOLATION' })
        );
      });

      it('should detect javascript: protocol XSS', async () => {
        mockReq.body = { name: 'javascript:alert(1)', email: 'test@test.com' };
        const middleware = validateRequest({ body: bodySchema });

        await middleware(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      it('should detect event handler XSS', async () => {
        mockReq.body = { name: '<img onerror=alert(1)>', email: 'test@test.com' };
        const middleware = validateRequest({ body: bodySchema });

        await middleware(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });

      it('should skip security check when disabled', async () => {
        mockReq.body = { name: '<script>alert("xss")</script>', email: 'test@test.com' };
        const middleware = validateRequest({ body: bodySchema }, { checkSecurity: false });

        await middleware(mockReq, mockRes, nextFn);

        // Should fail validation (name too short after escaping) but not security
        expect(mockRes.json).not.toHaveBeenCalledWith(
          expect.objectContaining({ error: 'SECURITY_VIOLATION' })
        );
      });

      it('should detect dangerous patterns in nested objects', async () => {
        const nestedSchema = z.object({
          user: z.object({
            name: z.string(),
          }),
        });
        mockReq.body = { user: { name: '<script>alert(1)</script>' } };
        const middleware = validateRequest({ body: nestedSchema });

        await middleware(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(
          expect.objectContaining({ error: 'SECURITY_VIOLATION' })
        );
      });

      it('should detect dangerous patterns in arrays', async () => {
        const arraySchema = z.object({
          names: z.array(z.string()),
        });
        mockReq.body = { names: ['John', '<script>alert(1)</script>'] };
        const middleware = validateRequest({ body: arraySchema });

        await middleware(mockReq, mockRes, nextFn);

        expect(mockRes.status).toHaveBeenCalledWith(400);
      });
    });

    describe('Sanitization', () => {
      it('should sanitize strings when enabled', async () => {
        const simpleSchema = z.object({ name: z.string() });
        mockReq.body = { name: 'John <b>Doe</b>' };
        const middleware = validateRequest(
          { body: simpleSchema },
          { sanitize: true, checkSecurity: false }
        );

        await middleware(mockReq, mockRes, nextFn);

        expect(nextFn).toHaveBeenCalled();
        expect(mockReq.body.name).toBe('John &lt;b&gt;Doe&lt;/b&gt;');
      });
    });
  });

  describe('validateContentType', () => {
    it('should allow valid content type', () => {
      mockReq.headers['content-type'] = 'application/json';
      mockReq.body = { test: true };
      const middleware = validateContentType();

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should reject invalid content type', () => {
      mockReq.headers['content-type'] = 'text/plain';
      mockReq.body = { test: true };
      const middleware = validateContentType();

      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(415);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'UNSUPPORTED_MEDIA_TYPE',
        })
      );
    });

    it('should skip validation for GET requests', () => {
      mockReq.method = 'GET';
      mockReq.headers['content-type'] = 'text/plain';
      const middleware = validateContentType();

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should skip validation for DELETE requests', () => {
      mockReq.method = 'DELETE';
      const middleware = validateContentType();

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should skip when body is empty', () => {
      mockReq.body = {};
      const middleware = validateContentType();

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should require content-type when body present', () => {
      mockReq.body = { test: true };
      const middleware = validateContentType();

      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(415);
    });

    it('should allow custom content types', () => {
      mockReq.headers['content-type'] = 'application/xml';
      mockReq.body = { test: true };
      const middleware = validateContentType(['application/json', 'application/xml']);

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should match content type with charset', () => {
      mockReq.headers['content-type'] = 'application/json; charset=utf-8';
      mockReq.body = { test: true };
      const middleware = validateContentType();

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('validateBodySize', () => {
    it('should allow requests within size limit', () => {
      mockReq.headers['content-length'] = '1000';
      const middleware = validateBodySize(10000);

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should reject requests exceeding size limit', () => {
      mockReq.headers['content-length'] = '2000000';
      const middleware = validateBodySize(1048576); // 1MB

      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'PAYLOAD_TOO_LARGE',
        })
      );
    });

    it('should use default 1MB limit', () => {
      mockReq.headers['content-length'] = '500000';
      const middleware = validateBodySize();

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should handle missing content-length', () => {
      const middleware = validateBodySize();

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });

  describe('requireFields', () => {
    it('should pass when all required fields present', () => {
      mockReq.body = { name: 'John', email: 'john@test.com' };
      const middleware = requireFields(['name', 'email']);

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should reject when field is missing', () => {
      mockReq.body = { name: 'John' };
      const middleware = requireFields(['name', 'email']);

      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'MISSING_REQUIRED_FIELDS',
          missingFields: ['email'],
        })
      );
    });

    it('should reject empty string as missing', () => {
      mockReq.body = { name: 'John', email: '' };
      const middleware = requireFields(['name', 'email']);

      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          missingFields: ['email'],
        })
      );
    });

    it('should reject null as missing', () => {
      mockReq.body = { name: 'John', email: null };
      const middleware = requireFields(['name', 'email']);

      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should list all missing fields', () => {
      mockReq.body = {};
      const middleware = requireFields(['name', 'email', 'phone']);

      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          missingFields: ['name', 'email', 'phone'],
        })
      );
    });
  });

  describe('validateIdParam', () => {
    it('should accept valid UUID', () => {
      mockReq.params = { id: '550e8400-e29b-41d4-a716-446655440000' };
      const middleware = validateIdParam();

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should accept valid CUID', () => {
      mockReq.params = { id: 'cjld2cjxh0000qzrmn831i7rn' };
      const middleware = validateIdParam();

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should accept simple alphanumeric ID', () => {
      mockReq.params = { id: 'user-123' };
      const middleware = validateIdParam();

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should reject missing ID', () => {
      mockReq.params = {};
      const middleware = validateIdParam();

      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_ID',
          message: 'Missing id parameter',
        })
      );
    });

    it('should reject invalid ID format', () => {
      mockReq.params = { id: '../../etc/passwd' };
      const middleware = validateIdParam();

      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_ID',
        })
      );
    });

    it('should use custom param name', () => {
      mockReq.params = { userId: '550e8400-e29b-41d4-a716-446655440000' };
      const middleware = validateIdParam('userId');

      middleware(mockReq, mockRes, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should report missing custom param name', () => {
      mockReq.params = {};
      const middleware = validateIdParam('userId');

      middleware(mockReq, mockRes, nextFn);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Missing userId parameter',
        })
      );
    });
  });

  describe('commonSchemas', () => {
    describe('pagination', () => {
      it('should parse valid pagination', () => {
        const result = commonSchemas.pagination.parse({
          page: '2',
          limit: '50',
        });
        expect(result.page).toBe(2);
        expect(result.limit).toBe(50);
      });

      it('should use defaults when not provided', () => {
        const result = commonSchemas.pagination.parse({});
        expect(result.page).toBe(1);
        expect(result.limit).toBe(20);
      });

      it('should reject limit over 100', () => {
        expect(() => commonSchemas.pagination.parse({ limit: '200' })).toThrow();
      });

      it('should include sortBy and sortOrder', () => {
        const result = commonSchemas.pagination.parse({
          sortBy: 'createdAt',
          sortOrder: 'asc',
        });
        expect(result.sortBy).toBe('createdAt');
        expect(result.sortOrder).toBe('asc');
      });
    });

    describe('email', () => {
      it('should lowercase email', () => {
        const result = commonSchemas.email.parse('TEST@EXAMPLE.COM');
        expect(result).toBe('test@example.com');
      });

      it('should reject invalid email', () => {
        expect(() => commonSchemas.email.parse('notanemail')).toThrow();
      });
    });

    describe('optionalEmail', () => {
      it('should accept valid email', () => {
        const result = commonSchemas.optionalEmail.parse('test@example.com');
        expect(result).toBe('test@example.com');
      });

      it('should convert empty string to undefined', () => {
        const result = commonSchemas.optionalEmail.parse('');
        expect(result).toBeUndefined();
      });

      it('should accept undefined', () => {
        const result = commonSchemas.optionalEmail.parse(undefined);
        expect(result).toBeUndefined();
      });
    });

    describe('phone', () => {
      it('should accept E.164 format', () => {
        const result = commonSchemas.phone.parse('+1234567890');
        expect(result).toBe('+1234567890');
      });

      it('should accept without plus', () => {
        const result = commonSchemas.phone.parse('1234567890');
        expect(result).toBe('1234567890');
      });

      it('should reject invalid phone', () => {
        expect(() => commonSchemas.phone.parse('abc123')).toThrow();
      });
    });

    describe('hexColor', () => {
      it('should accept valid hex color', () => {
        const result = commonSchemas.hexColor.parse('#FF5733');
        expect(result).toBe('#FF5733');
      });

      it('should reject invalid hex color', () => {
        expect(() => commonSchemas.hexColor.parse('#GGG')).toThrow();
        expect(() => commonSchemas.hexColor.parse('FF5733')).toThrow();
      });
    });

    describe('percentage', () => {
      it('should accept 0-100', () => {
        expect(commonSchemas.percentage.parse(0)).toBe(0);
        expect(commonSchemas.percentage.parse(50)).toBe(50);
        expect(commonSchemas.percentage.parse(100)).toBe(100);
      });

      it('should reject out of range', () => {
        expect(() => commonSchemas.percentage.parse(-1)).toThrow();
        expect(() => commonSchemas.percentage.parse(101)).toThrow();
      });
    });

    describe('booleanString', () => {
      it('should accept true boolean', () => {
        expect(commonSchemas.booleanString.parse(true)).toBe(true);
      });

      it('should accept false boolean', () => {
        expect(commonSchemas.booleanString.parse(false)).toBe(false);
      });

      it('should convert "true" string', () => {
        expect(commonSchemas.booleanString.parse('true')).toBe(true);
      });

      it('should convert "false" string', () => {
        expect(commonSchemas.booleanString.parse('false')).toBe(false);
      });

      it('should convert other strings to false', () => {
        expect(commonSchemas.booleanString.parse('yes')).toBe(false);
      });
    });

    describe('CRM domain enums', () => {
      it('should validate contactStatus', () => {
        expect(commonSchemas.contactStatus.parse('ACTIVE')).toBe('ACTIVE');
        expect(() => commonSchemas.contactStatus.parse('INVALID')).toThrow();
      });

      it('should validate lifecycleStage', () => {
        expect(commonSchemas.lifecycleStage.parse('LEAD')).toBe('LEAD');
        expect(commonSchemas.lifecycleStage.parse('MQL')).toBe('MQL');
      });

      it('should validate ticketStatus', () => {
        expect(commonSchemas.ticketStatus.parse('OPEN')).toBe('OPEN');
        expect(commonSchemas.ticketStatus.parse('RESOLVED')).toBe('RESOLVED');
      });

      it('should validate priority', () => {
        expect(commonSchemas.priority.parse('HIGH')).toBe('HIGH');
        expect(commonSchemas.priority.parse('URGENT')).toBe('URGENT');
      });

      it('should validate paymentMethod', () => {
        expect(commonSchemas.paymentMethod.parse('UPI')).toBe('UPI');
        expect(commonSchemas.paymentMethod.parse('BANK_TRANSFER')).toBe('BANK_TRANSFER');
      });
    });
  });

  describe('makePartial', () => {
    it('should make all fields optional', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const partialSchema = makePartial(schema);

      const result = partialSchema.parse({});
      expect(result).toEqual({});
    });

    it('should still validate provided fields', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });
      const partialSchema = makePartial(schema);

      expect(() => partialSchema.parse({ age: 'not a number' })).toThrow();
    });
  });

  describe('requireAtLeastOne', () => {
    it('should pass when at least one field present', () => {
      const schema = z.object({
        email: z.string().optional(),
        phone: z.string().optional(),
      });
      const refinedSchema = requireAtLeastOne(schema, ['email', 'phone']);

      const result = refinedSchema.parse({ email: 'test@test.com' });
      expect(result.email).toBe('test@test.com');
    });

    it('should fail when no fields present', () => {
      const schema = z.object({
        email: z.string().optional(),
        phone: z.string().optional(),
      });
      const refinedSchema = requireAtLeastOne(schema, ['email', 'phone']);

      expect(() => refinedSchema.parse({})).toThrow(
        /At least one of the following fields is required/
      );
    });

    it('should pass when multiple fields present', () => {
      const schema = z.object({
        email: z.string().optional(),
        phone: z.string().optional(),
      });
      const refinedSchema = requireAtLeastOne(schema, ['email', 'phone']);

      const result = refinedSchema.parse({ email: 'test@test.com', phone: '+1234567890' });
      expect(result.email).toBe('test@test.com');
      expect(result.phone).toBe('+1234567890');
    });
  });

  describe('conditionalRequired', () => {
    it('should require fields when condition met', () => {
      const schema = z.object({
        type: z.string(),
        amount: z.number().optional(),
      });
      const condition = (data) => data.type === 'payment';
      const refinedSchema = conditionalRequired(schema, condition, ['amount']);

      expect(() => refinedSchema.parse({ type: 'payment' })).toThrow();
    });

    it('should not require fields when condition not met', () => {
      const schema = z.object({
        type: z.string(),
        amount: z.number().optional(),
      });
      const condition = (data) => data.type === 'payment';
      const refinedSchema = conditionalRequired(schema, condition, ['amount']);

      const result = refinedSchema.parse({ type: 'other' });
      expect(result.type).toBe('other');
    });

    it('should pass when condition met and fields provided', () => {
      const schema = z.object({
        type: z.string(),
        amount: z.number().optional(),
      });
      const condition = (data) => data.type === 'payment';
      const refinedSchema = conditionalRequired(schema, condition, ['amount']);

      const result = refinedSchema.parse({ type: 'payment', amount: 100 });
      expect(result.amount).toBe(100);
    });
  });

  describe('sanitization helpers', () => {
    const { sanitizeString, sanitizeObject, checkForDangerousPatterns } = validationModule;

    describe('sanitizeString', () => {
      it('should escape HTML entities', () => {
        expect(sanitizeString('<script>')).toBe('&lt;script&gt;');
        expect(sanitizeString('"test"')).toBe('&quot;test&quot;');
        expect(sanitizeString("'test'")).toBe('&#x27;test&#x27;');
        expect(sanitizeString('&test')).toBe('&amp;test');
      });

      it('should return non-strings unchanged', () => {
        expect(sanitizeString(123)).toBe(123);
        expect(sanitizeString(null)).toBe(null);
      });
    });

    describe('sanitizeObject', () => {
      it('should sanitize nested objects', () => {
        const obj = {
          name: '<script>alert(1)</script>',
          data: {
            value: '<b>test</b>',
          },
        };
        const result = sanitizeObject(obj);
        expect(result.name).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
        expect(result.data.value).toBe('&lt;b&gt;test&lt;/b&gt;');
      });

      it('should sanitize arrays', () => {
        const arr = ['<script>', '<div>'];
        const result = sanitizeObject(arr);
        expect(result[0]).toBe('&lt;script&gt;');
        expect(result[1]).toBe('&lt;div&gt;');
      });

      it('should preserve non-string values', () => {
        const obj = { num: 123, bool: true, str: '<test>' };
        const result = sanitizeObject(obj);
        expect(result.num).toBe(123);
        expect(result.bool).toBe(true);
        expect(result.str).toBe('&lt;test&gt;');
      });
    });

    describe('checkForDangerousPatterns', () => {
      it('should detect SQL injection', () => {
        const issues = checkForDangerousPatterns('SELECT * FROM users');
        expect(issues.length).toBeGreaterThan(0);
        expect(issues[0].type).toBe('SQL_INJECTION');
      });

      it('should detect XSS', () => {
        const issues = checkForDangerousPatterns('<script>alert(1)</script>');
        expect(issues.length).toBeGreaterThan(0);
        expect(issues[0].type).toBe('XSS');
      });

      it('should return path for nested issues', () => {
        const issues = checkForDangerousPatterns({ user: { name: 'javascript:alert(1)' } });
        expect(issues.length).toBeGreaterThan(0);
        expect(issues[0].path).toBe('user.name');
      });

      it('should return empty array for safe content', () => {
        const issues = checkForDangerousPatterns('Hello World');
        expect(issues).toEqual([]);
      });
    });
  });
});
