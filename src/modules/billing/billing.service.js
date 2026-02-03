import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import { eventBus, createEvent, EventTypes } from '../../common/events/event-bus.js';
import { nanoid } from 'nanoid';

class BillingService {
  async getQuotes(tenantId, filters) {
    const where = { tenantId };
    if (filters.status) where.status = filters.status;

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        include: {
          lineItems: true,
        },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.quote.count({ where }),
    ]);

    return {
      quotes,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async createQuote(tenantId, userId, data) {
    const items = data.items || [];
    const subtotal = items.reduce((sum, item) => {
      const itemTotal = item.quantity * item.unitPrice;
      const discount = item.discount ? itemTotal * (item.discount / 100) : 0;
      return sum + (itemTotal - discount);
    }, 0);

    const quote = await prisma.quote.create({
      data: {
        tenantId,
        quoteNumber: `QUO-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`,
        title: data.title || 'Quote',
        contactId: data.contactId,
        companyId: data.companyId,
        dealId: data.dealId,
        status: 'DRAFT',
        subtotal,
        tax: 0,
        discount: 0,
        total: subtotal,
        currency: data.currency || 'INR',
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        notes: data.notes,
        terms: data.terms,
        createdById: userId,
        lines: {
          create: items.map((item, index) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            tax: 0,
            discount: item.discount || 0,
            total: item.quantity * item.unitPrice * (1 - (item.discount || 0) / 100),
            sortOrder: index,
          })),
        },
      },
      include: {
        lineItems: true,
      },
    });

    eventBus.publish(
      createEvent(EventTypes.QUOTE_CREATED, tenantId, { quoteId: quote.id }, { userId })
    );

    return quote;
  }

  async sendQuote(tenantId, quoteId) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });

    if (!quote) {
      throw new NotFoundError('Quote not found');
    }

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'SENT',
      },
    });

    eventBus.publish(createEvent(EventTypes.QUOTE_SENT, tenantId, { quoteId }));

    return updated;
  }

  async acceptQuote(tenantId, quoteId) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });

    if (!quote) {
      throw new NotFoundError('Quote not found');
    }

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
    });

    eventBus.publish(createEvent(EventTypes.QUOTE_ACCEPTED, tenantId, { quoteId }));

    return updated;
  }

  async getInvoices(tenantId, filters) {
    // TODO: Invoices feature not yet implemented - Invoice model doesn't exist
    // Return empty data with proper structure
    return {
      invoices: [],
      meta: {
        total: 0,
        page: filters.page || 1,
        limit: filters.limit || 25,
        totalPages: 0,
      },
    };
  }

  async createInvoice(tenantId, userId, data) {
    // Get tenant for seller info
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    // Auto-populate items from quote if quoteId provided and items not provided
    let items = data.items || [];
    if (data.quoteId && items.length === 0) {
      const quote = await prisma.quote.findUnique({
        where: { id: data.quoteId, tenantId },
        include: { lines: true },
      });

      if (!quote) {
        throw new NotFoundError('Quote not found');
      }

      // Transform quote lines to invoice items format
      items = quote.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discount: line.discountPercent || 0,
        hsnCode: line.hsnCode,
        sacCode: line.sacCode,
        unit: line.unit,
        gstRate: line.gstRate || 0,
        cessRate: line.cessRate || 0,
      }));
    }

    const isGstInvoice = data.isGstInvoice || false;
    const isInterState =
      data.placeOfSupply && tenant?.stateCode ? data.placeOfSupply !== tenant.stateCode : false;

    // Calculate line items with GST
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalCess = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    const lineItemsData = items.map((item, index) => {
      const quantity = item.quantity;
      const unitPrice = item.unitPrice;
      const grossAmount = quantity * unitPrice;
      const discountPercent = item.discount || 0;
      const discountAmount = grossAmount * (discountPercent / 100);
      const taxableValue = grossAmount - discountAmount;

      // GST Calculation
      const gstRate = item.gstRate || 0;
      const cessRate = item.cessRate || 0;

      let cgstRate = 0,
        cgstAmount = 0;
      let sgstRate = 0,
        sgstAmount = 0;
      let igstRate = 0,
        igstAmount = 0;
      let cessAmount = 0;

      if (isGstInvoice && gstRate > 0) {
        if (isInterState) {
          // Inter-state: Apply IGST
          igstRate = gstRate;
          igstAmount = taxableValue * (gstRate / 100);
        } else {
          // Intra-state: Apply CGST + SGST (split equally)
          cgstRate = gstRate / 2;
          sgstRate = gstRate / 2;
          cgstAmount = taxableValue * (cgstRate / 100);
          sgstAmount = taxableValue * (sgstRate / 100);
        }
        cessAmount = taxableValue * (cessRate / 100);
      }

      const lineTotalTax = cgstAmount + sgstAmount + igstAmount + cessAmount;
      const totalPrice = taxableValue + lineTotalTax;

      subtotal += taxableValue;
      totalCgst += cgstAmount;
      totalSgst += sgstAmount;
      totalIgst += igstAmount;
      totalCess += cessAmount;
      totalTax += lineTotalTax;
      totalDiscount += discountAmount;

      return {
        description: item.description,
        quantity,
        unitPrice,
        taxRate: gstRate,
        discountPercent,
        discountAmount,
        totalPrice,
        order: index,
        // GST fields
        hsnCode: item.hsnCode,
        sacCode: item.sacCode,
        unit: item.unit || 'NOS',
        productType: item.sacCode ? 'SERVICES' : 'GOODS',
        taxableValue,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
        cessRate,
        cessAmount,
        totalTax: lineTotalTax,
      };
    });

    const totalAmount = subtotal + totalTax;

    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber: `INV-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`,
        contactId: data.contactId,
        quoteId: data.quoteId,
        status: 'DRAFT',
        subtotal,
        taxAmount: totalTax,
        discountAmount: totalDiscount,
        totalAmount,
        paidAmount: 0,
        balanceDue: totalAmount,
        currency: isGstInvoice ? 'INR' : 'USD',
        dueDate: new Date(data.dueDate),
        notes: data.notes,
        terms: data.terms,
        createdById: userId,

        // GST Invoice Fields
        isGstInvoice,
        invoiceType: data.invoiceType || 'TAX_INVOICE',
        supplyType: data.supplyType || 'B2B',

        // Seller Info (from tenant)
        sellerGstin: tenant?.gstin,
        sellerLegalName: tenant?.legalName || tenant?.name,
        sellerTradeName: tenant?.tradeName,
        sellerAddress: tenant?.registeredAddress || tenant?.address,
        sellerStateCode: tenant?.stateCode,
        sellerStateName: tenant?.stateName,

        // Buyer Info
        buyerGstin: data.buyerGstin,
        buyerLegalName: data.buyerLegalName,
        buyerAddress: data.buyerAddress,
        buyerStateCode: data.buyerStateCode,

        // Shipping
        shipToName: data.shipToName,
        shipToAddress: data.shipToAddress,
        shipToStateCode: data.shipToStateCode,

        // Place of Supply
        placeOfSupply: data.placeOfSupply,
        isInterState,

        // GST Totals
        taxableAmount: subtotal,
        cgstAmount: totalCgst,
        sgstAmount: totalSgst,
        igstAmount: totalIgst,
        cessAmount: totalCess,

        // Other
        isReverseCharge: data.isReverseCharge || false,
        transporterName: data.transporterName,
        vehicleNumber: data.vehicleNumber,
        eWayBillNumber: data.eWayBillNumber,
        financialYear: this.getFinancialYear(),

        lineItems: {
          create: lineItemsData,
        },
      },
      include: {
        lineItems: true,
      },
    });

    eventBus.publish(
      createEvent(EventTypes.INVOICE_CREATED, tenantId, { invoiceId: invoice.id }, { userId })
    );

    return invoice;
  }

  getFinancialYear() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    // Financial year in India is April to March
    if (month >= 3) {
      return `${year}-${(year + 1).toString().slice(-2)}`;
    }
    return `${year - 1}-${year.toString().slice(-2)}`;
  }

  async sendInvoice(tenantId, invoiceId) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'SENT',
      },
    });

    eventBus.publish(createEvent(EventTypes.INVOICE_SENT, tenantId, { invoiceId }));

    return updated;
  }

  async getPayments(tenantId, filters) {
    const where = { tenantId };
    if (filters.status) where.status = filters.status;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          invoice: { select: { id: true, invoiceNumber: true } },
        },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      payments,
      meta: {
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  async recordPayment(tenantId, data) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: data.invoiceId, tenantId },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const amount = data.amount;
    const newPaidAmount = Number(invoice.paidAmount) + amount;
    const newBalanceDue = Number(invoice.totalAmount) - newPaidAmount;
    const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIAL';

    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount,
          currency: invoice.currency,
          method: data.method,
          transactionId: data.transactionId,
          status: 'COMPLETED',
        },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          paidAmount: newPaidAmount,
          balanceDue: Math.max(0, newBalanceDue),
          status: newStatus,
          paidAt: newStatus === 'PAID' ? new Date() : undefined,
        },
      }),
    ]);

    if (newStatus === 'PAID') {
      eventBus.publish(
        createEvent(EventTypes.INVOICE_PAID, tenantId, {
          invoiceId: invoice.id,
          paymentId: payment.id,
        })
      );
    }

    return payment;
  }

  // ============ QUOTE CRUD ============

  async getQuote(tenantId, quoteId) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
      include: {
        contact: true,
        deal: { select: { id: true, name: true } },
        lineItems: true,
      },
    });

    if (!quote) {
      throw new NotFoundError('Quote not found');
    }

    return quote;
  }

  async updateQuote(tenantId, quoteId, data) {
    const existing = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Quote not found');
    }

    if (existing.status === 'ACCEPTED') {
      throw new Error('Cannot update an accepted quote');
    }

    let subtotal = Number(existing.subtotal);
    if (data.items) {
      subtotal = data.items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unitPrice;
        const discount = item.discount ? itemTotal * (item.discount / 100) : 0;
        return sum + (itemTotal - discount);
      }, 0);
    }

    const discountAmount = data.discount || Number(existing.discountAmount) || 0;
    const taxAmount = data.tax || Number(existing.taxAmount) || 0;
    const totalAmount = subtotal - discountAmount + taxAmount;

    const quote = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        notes: data.notes,
        expiryDate: data.validUntil ? new Date(data.validUntil) : undefined,
      },
      include: {
        lineItems: true,
      },
    });

    return quote;
  }

  async deleteQuote(tenantId, quoteId) {
    const existing = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Quote not found');
    }

    if (existing.status === 'ACCEPTED') {
      throw new Error('Cannot delete an accepted quote');
    }

    await prisma.quote.delete({
      where: { id: quoteId },
    });
  }

  async declineQuote(tenantId, quoteId, reason) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });

    if (!quote) {
      throw new NotFoundError('Quote not found');
    }

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'DECLINED',
        notes: reason ? `${quote.notes || ''}\n\nDeclined: ${reason}` : quote.notes,
      },
    });

    return updated;
  }

  // ============ INVOICE CRUD ============

  async getInvoice(tenantId, invoiceId) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: {
        contact: true,
        quote: { select: { id: true, quoteNumber: true } },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
        lineItems: true,
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    return invoice;
  }

  async updateInvoice(tenantId, invoiceId, data) {
    const existing = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Invoice not found');
    }

    if (existing.status === 'PAID') {
      throw new Error('Cannot update a paid invoice');
    }

    let subtotal = Number(existing.subtotal);
    if (data.items) {
      subtotal = data.items.reduce((sum, item) => {
        const itemTotal = item.quantity * item.unitPrice;
        const discount = item.discount ? itemTotal * (item.discount / 100) : 0;
        return sum + (itemTotal - discount);
      }, 0);
    }

    const discountAmount = data.discount || Number(existing.discountAmount) || 0;
    const taxAmount = data.tax || Number(existing.taxAmount) || 0;
    const totalAmount = subtotal - discountAmount + taxAmount;
    const balanceDue = totalAmount - Number(existing.paidAmount);

    const invoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        balanceDue: Math.max(0, balanceDue),
        notes: data.notes,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
      include: {
        lineItems: true,
      },
    });

    return invoice;
  }

  async deleteInvoice(tenantId, invoiceId) {
    const existing = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Invoice not found');
    }

    if (Number(existing.paidAmount) > 0) {
      throw new Error('Cannot delete an invoice with payments');
    }

    await prisma.invoice.delete({
      where: { id: invoiceId },
    });
  }

  async voidInvoice(tenantId, invoiceId) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'VOID',
        updatedAt: new Date(),
      },
    });

    return updated;
  }

  // ============ PAYMENT CRUD ============

  async getPayment(tenantId, paymentId) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
      include: {
        invoice: {
          include: {
            contact: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    return payment;
  }

  async refundPayment(tenantId, paymentId, data) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
      include: { invoice: true },
    });

    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (payment.status === 'REFUNDED') {
      throw new Error('Payment is already refunded');
    }

    const refundAmount = data.amount || Number(payment.amount);
    const newPaidAmount = Number(payment.invoice.paidAmount) - refundAmount;
    const newBalanceDue = Number(payment.invoice.totalAmount) - newPaidAmount;
    const newStatus = newPaidAmount <= 0 ? 'DRAFT' : 'PARTIAL';

    await prisma.$transaction([
      prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'REFUNDED',
        },
      }),
      prisma.invoice.update({
        where: { id: payment.invoice.id },
        data: {
          paidAmount: Math.max(0, newPaidAmount),
          balanceDue: newBalanceDue,
          status: newStatus,
        },
      }),
    ]);

    return { success: true, refundAmount };
  }
}

export const billingService = new BillingService();
