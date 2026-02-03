/**
 * Billing Service Unit Tests
 *
 * Tests for quotes, invoices, and payment management
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing service
vi.mock('@crm360/database', () => ({
  prisma: {
    quote: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    invoice: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tenant: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@crm360/shared', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(message) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
}));

vi.mock('../../common/events/event-bus.js', () => ({
  eventBus: {
    publish: vi.fn(),
  },
  createEvent: vi.fn((type, tenantId, data, meta) => ({
    type,
    tenantId,
    data,
    meta,
  })),
  EventTypes: {
    QUOTE_CREATED: 'QUOTE_CREATED',
    QUOTE_SENT: 'QUOTE_SENT',
    QUOTE_ACCEPTED: 'QUOTE_ACCEPTED',
    INVOICE_CREATED: 'INVOICE_CREATED',
    INVOICE_SENT: 'INVOICE_SENT',
    INVOICE_PAID: 'INVOICE_PAID',
  },
}));

vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'ABC123'),
}));

import { billingService } from '../modules/billing/billing.service.js';
import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import { eventBus, createEvent, EventTypes } from '../../common/events/event-bus.js';

describe('BillingService', () => {
  const tenantId = 'tenant-123';
  const userId = 'user-123';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============ QUOTES TESTS ============

  describe('getQuotes', () => {
    const filters = { page: 1, limit: 10 };

    it('should return quotes with pagination', async () => {
      const mockQuotes = [
        { id: 'quote-1', quoteNumber: 'QUO-2024-ABC123', status: 'DRAFT', lines: [] },
        { id: 'quote-2', quoteNumber: 'QUO-2024-DEF456', status: 'SENT', lines: [] },
      ];

      prisma.quote.findMany.mockResolvedValue(mockQuotes);
      prisma.quote.count.mockResolvedValue(2);

      const result = await billingService.getQuotes(tenantId, filters);

      expect(prisma.quote.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: { lines: true },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.quotes).toEqual(mockQuotes);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter quotes by status', async () => {
      const filtersWithStatus = { ...filters, status: 'SENT' };

      prisma.quote.findMany.mockResolvedValue([]);
      prisma.quote.count.mockResolvedValue(0);

      await billingService.getQuotes(tenantId, filtersWithStatus);

      expect(prisma.quote.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, status: 'SENT' },
        })
      );
    });
  });

  describe('getQuote', () => {
    it('should return a quote by id', async () => {
      const mockQuote = {
        id: 'quote-1',
        tenantId,
        quoteNumber: 'QUO-2024-ABC123',
        contact: { id: 'c1', firstName: 'John', lastName: 'Doe' },
        deal: { id: 'deal-1', name: 'Enterprise Deal' },
        lineItems: [],
      };

      prisma.quote.findFirst.mockResolvedValue(mockQuote);

      const result = await billingService.getQuote(tenantId, 'quote-1');

      expect(prisma.quote.findFirst).toHaveBeenCalledWith({
        where: { id: 'quote-1', tenantId },
        include: {
          contact: true,
          deal: { select: { id: true, name: true } },
          lineItems: true,
        },
      });
      expect(result).toEqual(mockQuote);
    });

    it('should throw NotFoundError when quote does not exist', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(billingService.getQuote(tenantId, 'nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('createQuote', () => {
    it('should create a quote with line items', async () => {
      const data = {
        title: 'Software Development Quote',
        contactId: 'contact-1',
        companyId: 'company-1',
        dealId: 'deal-1',
        currency: 'INR',
        validUntil: '2024-12-31',
        notes: 'Project quote',
        terms: 'Net 30',
        items: [
          { description: 'Development', quantity: 100, unitPrice: 5000, discount: 10 },
          { description: 'Testing', quantity: 50, unitPrice: 3000, discount: 0 },
        ],
      };

      const mockQuote = {
        id: 'quote-1',
        quoteNumber: 'QUO-2024-ABC123',
        ...data,
        status: 'DRAFT',
        subtotal: 600000, // (100*5000*0.9) + (50*3000) = 450000 + 150000
        total: 600000,
        lines: [],
      };

      prisma.quote.create.mockResolvedValue(mockQuote);

      const result = await billingService.createQuote(tenantId, userId, data);

      expect(prisma.quote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          quoteNumber: expect.stringContaining('QUO-'),
          title: data.title,
          contactId: data.contactId,
          companyId: data.companyId,
          dealId: data.dealId,
          status: 'DRAFT',
          currency: 'INR',
          createdById: userId,
          lines: {
            create: expect.arrayContaining([
              expect.objectContaining({
                description: 'Development',
                quantity: 100,
                unitPrice: 5000,
              }),
            ]),
          },
        }),
        include: { lines: true },
      });
      expect(result).toEqual(mockQuote);
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(
        EventTypes.QUOTE_CREATED,
        tenantId,
        { quoteId: 'quote-1' },
        { userId }
      );
    });

    it('should create quote without items', async () => {
      const data = { title: 'Empty Quote' };

      prisma.quote.create.mockResolvedValue({
        id: 'quote-1',
        quoteNumber: 'QUO-2024-ABC123',
        subtotal: 0,
        total: 0,
        lines: [],
      });

      await billingService.createQuote(tenantId, userId, data);

      expect(prisma.quote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 0,
            total: 0,
            lines: { create: [] },
          }),
        })
      );
    });

    it('should use default currency USD when not provided', async () => {
      const data = { title: 'Quote' };

      prisma.quote.create.mockResolvedValue({ id: 'quote-1', lines: [] });

      await billingService.createQuote(tenantId, userId, data);

      expect(prisma.quote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: 'INR',
          }),
        })
      );
    });
  });

  describe('updateQuote', () => {
    it('should update quote details', async () => {
      const existingQuote = {
        id: 'quote-1',
        tenantId,
        status: 'DRAFT',
        subtotal: 1000,
        discountAmount: 0,
        taxAmount: 0,
      };
      const updateData = {
        notes: 'Updated notes',
        validUntil: '2025-01-15',
      };

      prisma.quote.findFirst.mockResolvedValue(existingQuote);
      prisma.quote.update.mockResolvedValue({ ...existingQuote, ...updateData, lineItems: [] });

      const result = await billingService.updateQuote(tenantId, 'quote-1', updateData);

      expect(prisma.quote.update).toHaveBeenCalledWith({
        where: { id: 'quote-1' },
        data: expect.objectContaining({
          notes: 'Updated notes',
        }),
        include: { lineItems: true },
      });
    });

    it('should recalculate totals when items are provided', async () => {
      const existingQuote = {
        id: 'quote-1',
        tenantId,
        status: 'DRAFT',
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
      };
      const updateData = {
        items: [{ quantity: 10, unitPrice: 100, discount: 0 }],
      };

      prisma.quote.findFirst.mockResolvedValue(existingQuote);
      prisma.quote.update.mockResolvedValue({ ...existingQuote, subtotal: 1000 });

      await billingService.updateQuote(tenantId, 'quote-1', updateData);

      expect(prisma.quote.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 1000,
            totalAmount: 1000,
          }),
        })
      );
    });

    it('should throw error when updating accepted quote', async () => {
      prisma.quote.findFirst.mockResolvedValue({
        id: 'quote-1',
        tenantId,
        status: 'ACCEPTED',
      });

      await expect(billingService.updateQuote(tenantId, 'quote-1', {})).rejects.toThrow(
        'Cannot update an accepted quote'
      );
    });

    it('should throw NotFoundError when quote does not exist', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(billingService.updateQuote(tenantId, 'nonexistent', {})).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('deleteQuote', () => {
    it('should delete a draft quote', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: 'quote-1', tenantId, status: 'DRAFT' });
      prisma.quote.delete.mockResolvedValue({});

      await billingService.deleteQuote(tenantId, 'quote-1');

      expect(prisma.quote.delete).toHaveBeenCalledWith({
        where: { id: 'quote-1' },
      });
    });

    it('should throw error when deleting accepted quote', async () => {
      prisma.quote.findFirst.mockResolvedValue({ id: 'quote-1', tenantId, status: 'ACCEPTED' });

      await expect(billingService.deleteQuote(tenantId, 'quote-1')).rejects.toThrow(
        'Cannot delete an accepted quote'
      );
    });

    it('should throw NotFoundError when quote does not exist', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(billingService.deleteQuote(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('sendQuote', () => {
    it('should mark quote as sent', async () => {
      const mockQuote = { id: 'quote-1', tenantId, status: 'DRAFT' };

      prisma.quote.findFirst.mockResolvedValue(mockQuote);
      prisma.quote.update.mockResolvedValue({ ...mockQuote, status: 'SENT' });

      const result = await billingService.sendQuote(tenantId, 'quote-1');

      expect(prisma.quote.update).toHaveBeenCalledWith({
        where: { id: 'quote-1' },
        data: { status: 'SENT' },
      });
      expect(result.status).toBe('SENT');
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(EventTypes.QUOTE_SENT, tenantId, {
        quoteId: 'quote-1',
      });
    });

    it('should throw NotFoundError when quote does not exist', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(billingService.sendQuote(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('acceptQuote', () => {
    it('should mark quote as accepted', async () => {
      const mockQuote = { id: 'quote-1', tenantId, status: 'SENT' };

      prisma.quote.findFirst.mockResolvedValue(mockQuote);
      prisma.quote.update.mockResolvedValue({
        ...mockQuote,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      });

      const result = await billingService.acceptQuote(tenantId, 'quote-1');

      expect(prisma.quote.update).toHaveBeenCalledWith({
        where: { id: 'quote-1' },
        data: {
          status: 'ACCEPTED',
          acceptedAt: expect.any(Date),
        },
      });
      expect(result.status).toBe('ACCEPTED');
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(EventTypes.QUOTE_ACCEPTED, tenantId, {
        quoteId: 'quote-1',
      });
    });

    it('should throw NotFoundError when quote does not exist', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(billingService.acceptQuote(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('declineQuote', () => {
    it('should mark quote as declined with reason', async () => {
      const mockQuote = { id: 'quote-1', tenantId, status: 'SENT', notes: 'Original notes' };
      const reason = 'Budget constraints';

      prisma.quote.findFirst.mockResolvedValue(mockQuote);
      prisma.quote.update.mockResolvedValue({ ...mockQuote, status: 'DECLINED' });

      const result = await billingService.declineQuote(tenantId, 'quote-1', reason);

      expect(prisma.quote.update).toHaveBeenCalledWith({
        where: { id: 'quote-1' },
        data: {
          status: 'DECLINED',
          notes: 'Original notes\n\nDeclined: Budget constraints',
        },
      });
      expect(result.status).toBe('DECLINED');
    });

    it('should decline without reason', async () => {
      const mockQuote = { id: 'quote-1', tenantId, status: 'SENT', notes: 'Notes' };

      prisma.quote.findFirst.mockResolvedValue(mockQuote);
      prisma.quote.update.mockResolvedValue({ ...mockQuote, status: 'DECLINED' });

      await billingService.declineQuote(tenantId, 'quote-1', null);

      expect(prisma.quote.update).toHaveBeenCalledWith({
        where: { id: 'quote-1' },
        data: {
          status: 'DECLINED',
          notes: 'Notes',
        },
      });
    });

    it('should throw NotFoundError when quote does not exist', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(billingService.declineQuote(tenantId, 'nonexistent', 'reason')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============ INVOICES TESTS ============

  describe('getInvoices', () => {
    const filters = { page: 1, limit: 10 };

    it('should return invoices with pagination', async () => {
      const mockInvoices = [
        {
          id: 'invoice-1',
          invoiceNumber: 'INV-2024-ABC123',
          status: 'DRAFT',
          contact: { id: 'c1', firstName: 'John', lastName: 'Doe' },
          quote: { id: 'q1', quoteNumber: 'QUO-2024-XYZ' },
          lineItems: [],
        },
      ];

      prisma.invoice.findMany.mockResolvedValue(mockInvoices);
      prisma.invoice.count.mockResolvedValue(1);

      const result = await billingService.getInvoices(tenantId, filters);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          quote: { select: { id: true, quoteNumber: true } },
          lineItems: true,
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.invoices).toEqual(mockInvoices);
    });

    it('should filter invoices by status', async () => {
      const filtersWithStatus = { ...filters, status: 'PAID' };

      prisma.invoice.findMany.mockResolvedValue([]);
      prisma.invoice.count.mockResolvedValue(0);

      await billingService.getInvoices(tenantId, filtersWithStatus);

      expect(prisma.invoice.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, status: 'PAID' },
        })
      );
    });
  });

  describe('getInvoice', () => {
    it('should return an invoice by id with payments', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        tenantId,
        invoiceNumber: 'INV-2024-ABC123',
        contact: { id: 'c1', firstName: 'John', lastName: 'Doe' },
        quote: { id: 'q1', quoteNumber: 'QUO-2024-XYZ' },
        payments: [],
        lineItems: [],
      };

      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);

      const result = await billingService.getInvoice(tenantId, 'invoice-1');

      expect(prisma.invoice.findFirst).toHaveBeenCalledWith({
        where: { id: 'invoice-1', tenantId },
        include: {
          contact: true,
          quote: { select: { id: true, quoteNumber: true } },
          payments: { orderBy: { createdAt: 'desc' } },
          lineItems: true,
        },
      });
      expect(result).toEqual(mockInvoice);
    });

    it('should throw NotFoundError when invoice does not exist', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(billingService.getInvoice(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('createInvoice', () => {
    const mockTenant = {
      id: tenantId,
      name: 'Helix Code',
      legalName: 'Helix Code Pvt Ltd',
      gstin: '29AAAAA0000A1Z5',
      stateCode: '29',
      stateName: 'Karnataka',
      address: '123 Main St',
    };

    it('should create a standard invoice', async () => {
      const data = {
        contactId: 'contact-1',
        dueDate: '2024-12-31',
        notes: 'Payment due on receipt',
        items: [{ description: 'Service', quantity: 1, unitPrice: 10000, discount: 0 }],
      };

      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.invoice.create.mockResolvedValue({
        id: 'invoice-1',
        invoiceNumber: 'INV-2024-ABC123',
        status: 'DRAFT',
        subtotal: 10000,
        totalAmount: 10000,
        lineItems: [],
      });

      const result = await billingService.createInvoice(tenantId, userId, data);

      expect(prisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          invoiceNumber: expect.stringContaining('INV-'),
          status: 'DRAFT',
          contactId: 'contact-1',
          createdById: userId,
        }),
        include: { lineItems: true },
      });
      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(
        EventTypes.INVOICE_CREATED,
        tenantId,
        { invoiceId: 'invoice-1' },
        { userId }
      );
    });

    it('should create GST invoice with intra-state CGST/SGST', async () => {
      const data = {
        contactId: 'contact-1',
        dueDate: '2024-12-31',
        isGstInvoice: true,
        placeOfSupply: '29', // Same state
        items: [
          {
            description: 'Service',
            quantity: 1,
            unitPrice: 10000,
            gstRate: 18,
            hsnCode: '9983',
          },
        ],
      };

      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.invoice.create.mockResolvedValue({
        id: 'invoice-1',
        isGstInvoice: true,
        cgstAmount: 900,
        sgstAmount: 900,
        igstAmount: 0,
      });

      await billingService.createInvoice(tenantId, userId, data);

      expect(prisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isGstInvoice: true,
          isInterState: false,
          currency: 'INR',
          sellerGstin: '29AAAAA0000A1Z5',
        }),
        include: { lineItems: true },
      });
    });

    it('should create GST invoice with inter-state IGST', async () => {
      const data = {
        contactId: 'contact-1',
        dueDate: '2024-12-31',
        isGstInvoice: true,
        placeOfSupply: '27', // Different state (Maharashtra)
        items: [
          {
            description: 'Service',
            quantity: 1,
            unitPrice: 10000,
            gstRate: 18,
          },
        ],
      };

      prisma.tenant.findUnique.mockResolvedValue(mockTenant);
      prisma.invoice.create.mockResolvedValue({
        id: 'invoice-1',
        isGstInvoice: true,
        igstAmount: 1800,
      });

      await billingService.createInvoice(tenantId, userId, data);

      expect(prisma.invoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isGstInvoice: true,
          isInterState: true,
        }),
        include: { lineItems: true },
      });
    });
  });

  describe('updateInvoice', () => {
    it('should update invoice details', async () => {
      const existingInvoice = {
        id: 'invoice-1',
        tenantId,
        status: 'DRAFT',
        subtotal: 1000,
        discountAmount: 0,
        taxAmount: 0,
        paidAmount: 0,
      };
      const updateData = {
        notes: 'Updated notes',
        dueDate: '2025-01-15',
      };

      prisma.invoice.findFirst.mockResolvedValue(existingInvoice);
      prisma.invoice.update.mockResolvedValue({ ...existingInvoice, ...updateData });

      await billingService.updateInvoice(tenantId, 'invoice-1', updateData);

      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
        data: expect.objectContaining({
          notes: 'Updated notes',
          dueDate: new Date('2025-01-15'),
        }),
        include: { lineItems: true },
      });
    });

    it('should throw error when updating paid invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'invoice-1',
        tenantId,
        status: 'PAID',
      });

      await expect(billingService.updateInvoice(tenantId, 'invoice-1', {})).rejects.toThrow(
        'Cannot update a paid invoice'
      );
    });

    it('should throw NotFoundError when invoice does not exist', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(billingService.updateInvoice(tenantId, 'nonexistent', {})).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('deleteInvoice', () => {
    it('should delete an unpaid invoice', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'invoice-1',
        tenantId,
        paidAmount: 0,
      });
      prisma.invoice.delete.mockResolvedValue({});

      await billingService.deleteInvoice(tenantId, 'invoice-1');

      expect(prisma.invoice.delete).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
      });
    });

    it('should throw error when deleting invoice with payments', async () => {
      prisma.invoice.findFirst.mockResolvedValue({
        id: 'invoice-1',
        tenantId,
        paidAmount: 5000,
      });

      await expect(billingService.deleteInvoice(tenantId, 'invoice-1')).rejects.toThrow(
        'Cannot delete an invoice with payments'
      );
    });

    it('should throw NotFoundError when invoice does not exist', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(billingService.deleteInvoice(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('sendInvoice', () => {
    it('should mark invoice as sent', async () => {
      const mockInvoice = { id: 'invoice-1', tenantId, status: 'DRAFT' };

      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.invoice.update.mockResolvedValue({ ...mockInvoice, status: 'SENT' });

      const result = await billingService.sendInvoice(tenantId, 'invoice-1');

      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
        data: { status: 'SENT' },
      });
      expect(result.status).toBe('SENT');
      expect(eventBus.publish).toHaveBeenCalled();
    });

    it('should throw NotFoundError when invoice does not exist', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(billingService.sendInvoice(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('voidInvoice', () => {
    it('should void an invoice', async () => {
      const mockInvoice = { id: 'invoice-1', tenantId, status: 'SENT' };

      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.invoice.update.mockResolvedValue({ ...mockInvoice, status: 'VOID' });

      const result = await billingService.voidInvoice(tenantId, 'invoice-1');

      expect(prisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
        data: {
          status: 'VOID',
          updatedAt: expect.any(Date),
        },
      });
      expect(result.status).toBe('VOID');
    });

    it('should throw NotFoundError when invoice does not exist', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(billingService.voidInvoice(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============ PAYMENTS TESTS ============

  describe('getPayments', () => {
    const filters = { page: 1, limit: 10 };

    it('should return payments with pagination', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          amount: 5000,
          status: 'COMPLETED',
          invoice: { id: 'inv-1', invoiceNumber: 'INV-2024-ABC' },
        },
      ];

      prisma.payment.findMany.mockResolvedValue(mockPayments);
      prisma.payment.count.mockResolvedValue(1);

      const result = await billingService.getPayments(tenantId, filters);

      expect(prisma.payment.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      expect(result.payments).toEqual(mockPayments);
    });

    it('should filter payments by status', async () => {
      const filtersWithStatus = { ...filters, status: 'COMPLETED' };

      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      await billingService.getPayments(tenantId, filtersWithStatus);

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId, status: 'COMPLETED' },
        })
      );
    });
  });

  describe('getPayment', () => {
    it('should return a payment by id', async () => {
      const mockPayment = {
        id: 'payment-1',
        tenantId,
        amount: 5000,
        invoice: {
          id: 'inv-1',
          contact: { id: 'c1', firstName: 'John', lastName: 'Doe' },
        },
      };

      prisma.payment.findFirst.mockResolvedValue(mockPayment);

      const result = await billingService.getPayment(tenantId, 'payment-1');

      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { id: 'payment-1', tenantId },
        include: {
          invoice: {
            include: {
              contact: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });
      expect(result).toEqual(mockPayment);
    });

    it('should throw NotFoundError when payment does not exist', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(billingService.getPayment(tenantId, 'nonexistent')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe('recordPayment', () => {
    it('should record partial payment', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        tenantId,
        totalAmount: 10000,
        paidAmount: 0,
        currency: 'INR',
      };
      const paymentData = {
        invoiceId: 'invoice-1',
        amount: 5000,
        method: 'BANK_TRANSFER',
        transactionId: 'TXN123',
      };

      const mockPayment = { id: 'payment-1', amount: 5000, status: 'COMPLETED' };

      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.$transaction.mockResolvedValue([mockPayment]);

      const result = await billingService.recordPayment(tenantId, paymentData);

      expect(prisma.$transaction).toHaveBeenCalledWith([
        expect.objectContaining({}), // payment.create
        expect.objectContaining({}), // invoice.update
      ]);
      expect(result).toEqual(mockPayment);
    });

    it('should mark invoice as PAID when fully paid', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        tenantId,
        totalAmount: 10000,
        paidAmount: 5000,
        currency: 'INR',
      };
      const paymentData = {
        invoiceId: 'invoice-1',
        amount: 5000,
        method: 'CARD',
      };

      const mockPayment = { id: 'payment-1', amount: 5000, status: 'COMPLETED' };

      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.$transaction.mockResolvedValue([mockPayment]);

      await billingService.recordPayment(tenantId, paymentData);

      expect(eventBus.publish).toHaveBeenCalled();
      expect(createEvent).toHaveBeenCalledWith(EventTypes.INVOICE_PAID, tenantId, {
        invoiceId: 'invoice-1',
        paymentId: 'payment-1',
      });
    });

    it('should throw NotFoundError when invoice does not exist', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(
        billingService.recordPayment(tenantId, { invoiceId: 'nonexistent', amount: 100 })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('refundPayment', () => {
    it('should refund a payment', async () => {
      const mockPayment = {
        id: 'payment-1',
        tenantId,
        amount: 5000,
        status: 'COMPLETED',
        invoice: {
          id: 'invoice-1',
          totalAmount: 10000,
          paidAmount: 5000,
        },
      };

      prisma.payment.findFirst.mockResolvedValue(mockPayment);
      prisma.$transaction.mockResolvedValue([]);

      const result = await billingService.refundPayment(tenantId, 'payment-1', {});

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.refundAmount).toBe(5000);
    });

    it('should allow partial refund', async () => {
      const mockPayment = {
        id: 'payment-1',
        tenantId,
        amount: 5000,
        status: 'COMPLETED',
        invoice: {
          id: 'invoice-1',
          totalAmount: 10000,
          paidAmount: 5000,
        },
      };

      prisma.payment.findFirst.mockResolvedValue(mockPayment);
      prisma.$transaction.mockResolvedValue([]);

      const result = await billingService.refundPayment(tenantId, 'payment-1', { amount: 2000 });

      expect(result.refundAmount).toBe(2000);
    });

    it('should throw error when payment already refunded', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'payment-1',
        tenantId,
        status: 'REFUNDED',
      });

      await expect(billingService.refundPayment(tenantId, 'payment-1', {})).rejects.toThrow(
        'Payment is already refunded'
      );
    });

    it('should throw NotFoundError when payment does not exist', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(billingService.refundPayment(tenantId, 'nonexistent', {})).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============ HELPER METHODS TESTS ============

  describe('getFinancialYear', () => {
    it('should return correct financial year after March', () => {
      const originalDate = Date;
      const mockDate = new Date('2024-04-15');
      vi.spyOn(global, 'Date').mockImplementation((...args) => {
        if (args.length === 0) return mockDate;
        return new originalDate(...args);
      });

      const result = billingService.getFinancialYear();

      expect(result).toBe('2024-25');

      vi.restoreAllMocks();
    });

    it('should return correct financial year before April', () => {
      const originalDate = Date;
      const mockDate = new Date('2024-02-15');
      vi.spyOn(global, 'Date').mockImplementation((...args) => {
        if (args.length === 0) return mockDate;
        return new originalDate(...args);
      });

      const result = billingService.getFinancialYear();

      expect(result).toBe('2023-24');

      vi.restoreAllMocks();
    });
  });

  // ============ TENANT ISOLATION TESTS ============

  describe('Tenant Isolation', () => {
    it('should not return quotes from other tenants', async () => {
      prisma.quote.findFirst.mockResolvedValue(null);

      await expect(billingService.getQuote('different-tenant', 'quote-1')).rejects.toThrow(
        NotFoundError
      );

      expect(prisma.quote.findFirst).toHaveBeenCalledWith({
        where: { id: 'quote-1', tenantId: 'different-tenant' },
        include: expect.anything(),
      });
    });

    it('should not return invoices from other tenants', async () => {
      prisma.invoice.findFirst.mockResolvedValue(null);

      await expect(billingService.getInvoice('different-tenant', 'invoice-1')).rejects.toThrow(
        NotFoundError
      );
    });

    it('should not return payments from other tenants', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(billingService.getPayment('different-tenant', 'payment-1')).rejects.toThrow(
        NotFoundError
      );
    });
  });

  // ============ EVENT PUBLISHING TESTS ============

  describe('Event Publishing', () => {
    it('should publish QUOTE_CREATED event', async () => {
      prisma.quote.create.mockResolvedValue({ id: 'quote-1', lines: [] });

      await billingService.createQuote(tenantId, userId, { title: 'Quote' });

      expect(createEvent).toHaveBeenCalledWith(
        EventTypes.QUOTE_CREATED,
        tenantId,
        { quoteId: 'quote-1' },
        { userId }
      );
    });

    it('should publish INVOICE_CREATED event', async () => {
      prisma.tenant.findUnique.mockResolvedValue({ id: tenantId });
      prisma.invoice.create.mockResolvedValue({ id: 'invoice-1', lineItems: [] });

      await billingService.createInvoice(tenantId, userId, { dueDate: '2024-12-31' });

      expect(createEvent).toHaveBeenCalledWith(
        EventTypes.INVOICE_CREATED,
        tenantId,
        { invoiceId: 'invoice-1' },
        { userId }
      );
    });

    it('should publish INVOICE_PAID event when fully paid', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        tenantId,
        totalAmount: 10000,
        paidAmount: 9000,
        currency: 'INR',
      };
      const mockPayment = { id: 'payment-1', amount: 1000 };

      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.$transaction.mockResolvedValue([mockPayment]);

      await billingService.recordPayment(tenantId, {
        invoiceId: 'invoice-1',
        amount: 1000,
        method: 'CARD',
      });

      expect(createEvent).toHaveBeenCalledWith(EventTypes.INVOICE_PAID, tenantId, {
        invoiceId: 'invoice-1',
        paymentId: 'payment-1',
      });
    });
  });

  // ============ EDGE CASES ============

  describe('Edge Cases', () => {
    it('should handle quote with zero discount', async () => {
      const data = {
        items: [{ description: 'Item', quantity: 10, unitPrice: 100 }],
      };

      prisma.quote.create.mockResolvedValue({ id: 'quote-1', subtotal: 1000, lines: [] });

      await billingService.createQuote(tenantId, userId, data);

      expect(prisma.quote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 1000,
          }),
        })
      );
    });

    it('should handle overpayment gracefully', async () => {
      const mockInvoice = {
        id: 'invoice-1',
        tenantId,
        totalAmount: 5000,
        paidAmount: 4000,
        currency: 'INR',
      };
      const mockPayment = { id: 'payment-1', amount: 2000 };

      prisma.invoice.findFirst.mockResolvedValue(mockInvoice);
      prisma.$transaction.mockResolvedValue([mockPayment]);

      await billingService.recordPayment(tenantId, {
        invoiceId: 'invoice-1',
        amount: 2000,
        method: 'CASH',
      });

      // Should still mark as PAID and set balanceDue to 0
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should handle empty items array in quote creation', async () => {
      prisma.quote.create.mockResolvedValue({ id: 'quote-1', subtotal: 0, lines: [] });

      await billingService.createQuote(tenantId, userId, { items: [] });

      expect(prisma.quote.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 0,
            total: 0,
          }),
        })
      );
    });
  });
});
