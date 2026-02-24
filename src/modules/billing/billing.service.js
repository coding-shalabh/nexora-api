import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import { eventBus, createEvent, EventTypes } from '../../common/events/event-bus.js';
import { nanoid } from 'nanoid';
import { razorpayService } from '../../services/razorpay.service.js';
import { logger } from '../../common/logger.js';

class BillingService {
  async getQuotes(tenantId, filters) {
    const where = { tenantId };
    if (filters.status) where.status = filters.status;

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        include: {
          lines: true,
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
        lines: true,
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
      throw new NotFoundError('Quote');
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
      throw new NotFoundError('Quote');
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
    const where = { tenantId };
    if (filters.status) where.status = filters.status;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          lines: true,
          contact: { select: { id: true, firstName: true, lastName: true, email: true } },
          payments: {
            select: { id: true, amount: true, status: true, method: true, createdAt: true },
          },
        },
        skip: ((filters.page || 1) - 1) * (filters.limit || 25),
        take: filters.limit || 25,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices,
      meta: {
        total,
        page: filters.page || 1,
        limit: filters.limit || 25,
        totalPages: Math.ceil(total / (filters.limit || 25)),
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
        throw new NotFoundError('Quote');
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
        hsnCode: item.hsnCode || null,
        sacCode: item.sacCode || null,
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

    // Use Prisma relation connect pattern (Prisma 5.x requires this for FK fields)
    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber: `INV-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`,
        ...(data.contactId && { contact: { connect: { id: data.contactId } } }),
        ...(data.quoteId && { quote: { connect: { id: data.quoteId } } }),
        status: 'DRAFT',
        subtotal,
        taxAmount: totalTax,
        discountAmount: totalDiscount,
        totalAmount,
        paidAmount: 0,
        balanceDue: totalAmount,
        currency: isGstInvoice ? 'INR' : 'USD',
        dueDate: new Date(data.dueDate),
        createdById: userId,
        notes: data.notes || null,
        terms: data.terms || null,

        // GST Invoice Fields
        isGstInvoice,
        invoiceType: data.invoiceType || 'TAX_INVOICE',
        supplyType: data.supplyType || 'B2B',

        // Seller Info (from tenant)
        sellerGstin: tenant?.gstin || null,
        sellerLegalName: tenant?.legalName || tenant?.name || null,
        sellerTradeName: tenant?.tradeName || null,
        sellerAddress: tenant?.registeredAddress || tenant?.address || null,
        sellerStateCode: tenant?.stateCode || null,
        sellerStateName: tenant?.stateName || null,

        // Buyer Info
        buyerGstin: data.buyerGstin || null,
        buyerLegalName: data.buyerLegalName || null,
        buyerAddress: data.buyerAddress || null,
        buyerStateCode: data.buyerStateCode || null,

        // Shipping
        shipToName: data.shipToName || null,
        shipToAddress: data.shipToAddress || null,
        shipToStateCode: data.shipToStateCode || null,

        // Place of Supply
        placeOfSupply: data.placeOfSupply || null,
        isInterState,

        // GST Totals
        taxableAmount: subtotal,
        cgstAmount: totalCgst,
        sgstAmount: totalSgst,
        igstAmount: totalIgst,
        cessAmount: totalCess,

        // Other
        isReverseCharge: data.isReverseCharge || false,
        transporterName: data.transporterName || null,
        vehicleNumber: data.vehicleNumber || null,
        eWayBillNumber: data.eWayBillNumber || null,
        financialYear: this.getFinancialYear(),

        lines: {
          create: lineItemsData,
        },
      },
      include: {
        lines: true,
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
      throw new NotFoundError('Invoice');
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
      throw new NotFoundError('Invoice');
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
        lines: true,
      },
    });

    if (!quote) {
      throw new NotFoundError('Quote');
    }

    return quote;
  }

  async updateQuote(tenantId, quoteId, data) {
    const existing = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Quote');
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
        lines: true,
      },
    });

    return quote;
  }

  async deleteQuote(tenantId, quoteId) {
    const existing = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Quote');
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
      throw new NotFoundError('Quote');
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
        lines: true,
      },
    });

    if (!invoice) {
      throw new NotFoundError('Invoice');
    }

    return invoice;
  }

  async updateInvoice(tenantId, invoiceId, data) {
    const existing = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Invoice');
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
        lines: true,
      },
    });

    return invoice;
  }

  async deleteInvoice(tenantId, invoiceId) {
    const existing = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Invoice');
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
      throw new NotFoundError('Invoice');
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
      throw new NotFoundError('Payment');
    }

    return payment;
  }

  async refundPayment(tenantId, paymentId, data) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId },
      include: { invoice: true },
    });

    if (!payment) {
      throw new NotFoundError('Payment');
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

  // ============ PLANS (from DB) ============

  /**
   * Fetch all active plans from the database.
   */
  async getPlans() {
    const plans = await prisma.plan.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { sortOrder: 'asc' },
    });

    return plans;
  }

  /**
   * Fetch a single plan by ID.
   */
  async getPlan(planId) {
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundError('Plan');
    }

    return plan;
  }

  // ============ SUBSCRIPTION MANAGEMENT ============

  /**
   * Get the current subscription for a tenant, including plan details.
   */
  async getSubscription(tenantId) {
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId },
      include: {
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return null;
    }

    return subscription;
  }

  /**
   * Create a new subscription for a tenant.
   * If a TRIALING subscription exists, it transitions to ACTIVE.
   * @param {string} tenantId
   * @param {string} planId - Internal plan ID
   * @param {string} billingCycle - 'MONTHLY' or 'YEARLY'
   * @param {object} paymentData - Razorpay payment details
   */
  async createSubscription(tenantId, planId, billingCycle, paymentData = {}) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundError('Plan');
    }

    // Calculate end date based on billing cycle
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (billingCycle === 'YEARLY') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    // Check for existing subscription
    const existing = await prisma.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    let subscription;

    if (existing && (existing.status === 'TRIALING' || existing.status === 'EXPIRED')) {
      // Upgrade trial or expired subscription to active
      subscription = await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          planId,
          status: 'ACTIVE',
          billingCycle,
          startDate,
          endDate,
          trialEndsAt: null,
          cancelledAt: null,
          stripeCustomerId: paymentData.razorpayCustomerId || existing.stripeCustomerId,
          stripeSubscriptionId: paymentData.razorpaySubscriptionId || existing.stripeSubscriptionId,
        },
        include: { plan: true },
      });
    } else if (existing && existing.status === 'ACTIVE') {
      // Plan upgrade/change -- update existing
      subscription = await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          planId,
          billingCycle,
          startDate,
          endDate,
          stripeSubscriptionId: paymentData.razorpaySubscriptionId || existing.stripeSubscriptionId,
        },
        include: { plan: true },
      });
    } else {
      // Create new subscription
      subscription = await prisma.subscription.create({
        data: {
          tenantId,
          planId,
          status: 'ACTIVE',
          billingCycle,
          startDate,
          endDate,
          seats: plan.maxUsers || 1,
          stripeCustomerId: paymentData.razorpayCustomerId || null,
          stripeSubscriptionId: paymentData.razorpaySubscriptionId || null,
        },
        include: { plan: true },
      });
    }

    logger.info(
      { tenantId, planId, billingCycle, subscriptionId: subscription.id },
      'Subscription created/updated'
    );

    return subscription;
  }

  /**
   * Cancel a tenant's active subscription.
   */
  async cancelSubscription(tenantId) {
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundError('Active subscription');
    }

    // If there's a Razorpay subscription, cancel it there too
    if (subscription.stripeSubscriptionId) {
      try {
        await razorpayService.cancelSubscription(subscription.stripeSubscriptionId, true);
      } catch (error) {
        logger.warn(
          { error: error.message, subscriptionId: subscription.stripeSubscriptionId },
          'Failed to cancel Razorpay subscription (may already be cancelled)'
        );
      }
    }

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
      include: { plan: true },
    });

    eventBus.publish(
      createEvent(EventTypes.SUBSCRIPTION_CANCELLED || 'subscription.cancelled', tenantId, {
        subscriptionId: updated.id,
      })
    );

    return updated;
  }

  /**
   * Upgrade a tenant to a new plan.
   */
  async upgradePlan(tenantId, newPlanId, billingCycle) {
    const plan = await prisma.plan.findUnique({ where: { id: newPlanId } });
    if (!plan) {
      throw new NotFoundError('Plan');
    }

    return this.createSubscription(tenantId, newPlanId, billingCycle);
  }

  // ============ RAZORPAY CHECKOUT ============

  /**
   * Create a Razorpay order for plan checkout.
   * @param {string} tenantId
   * @param {string} planId - Internal plan ID
   * @param {string} billingCycle - 'MONTHLY' or 'YEARLY'
   * @returns {object} { orderId, amount, currency, key }
   */
  async createCheckoutOrder(tenantId, planId, billingCycle) {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundError('Plan');
    }

    // Calculate amount in paise (smallest currency unit for INR)
    const price = billingCycle === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
    const amountInPaise = Math.round(Number(price) * 100);

    if (amountInPaise <= 0) {
      throw new Error('Cannot create a checkout order for a free plan');
    }

    const receipt = `rcpt_${tenantId}_${nanoid(8)}`;

    const order = await razorpayService.createOrder(
      amountInPaise,
      plan.currency || 'INR',
      receipt,
      {
        tenantId,
        planId,
        planName: plan.displayName,
        billingCycle,
      }
    );

    return {
      orderId: order.id,
      amount: amountInPaise,
      currency: plan.currency || 'INR',
      key: razorpayService.getKeyId(),
      planName: plan.displayName,
      billingCycle,
    };
  }

  /**
   * Verify a Razorpay payment and activate the subscription.
   * Creates Subscription, Payment, and Invoice records.
   */
  async verifyAndActivatePayment(tenantId, userId, data) {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planId, billingCycle } =
      data;

    // 1. Verify signature
    const isValid = razorpayService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      throw new Error('Payment verification failed: invalid signature');
    }

    // 2. Fetch payment details from Razorpay
    const paymentDetails = await razorpayService.fetchPayment(razorpay_payment_id);

    // 3. Get plan
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundError('Plan');
    }

    const price = billingCycle === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
    const amount = Number(price);

    // 4. Use a transaction to create all records atomically
    const result = await prisma.$transaction(async (tx) => {
      // Create/update subscription
      const subscription = await this._upsertSubscription(tx, tenantId, planId, billingCycle, {
        razorpayCustomerId: paymentDetails.customer_id || null,
      });

      // Create invoice
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          invoiceNumber: `INV-SUB-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`,
          status: 'PAID',
          subtotal: amount,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: amount,
          paidAmount: amount,
          balanceDue: 0,
          currency: plan.currency || 'INR',
          dueDate: new Date(),
          paidAt: new Date(),
          createdById: userId,
          notes: `Subscription payment for ${plan.displayName} (${billingCycle})`,
          financialYear: this.getFinancialYear(),
          lines: {
            create: [
              {
                description: `${plan.displayName} - ${billingCycle === 'YEARLY' ? 'Annual' : 'Monthly'} subscription`,
                quantity: 1,
                unitPrice: amount,
                totalPrice: amount,
                order: 0,
              },
            ],
          },
        },
      });

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: invoice.id,
          amount,
          currency: plan.currency || 'INR',
          method: this._mapRazorpayMethod(paymentDetails.method),
          providerPaymentId: razorpay_payment_id,
          providerData: {
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            method: paymentDetails.method,
            bank: paymentDetails.bank,
            wallet: paymentDetails.wallet,
            vpa: paymentDetails.vpa,
            email: paymentDetails.email,
            contact: paymentDetails.contact,
          },
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });

      return { subscription, invoice, payment };
    });

    logger.info(
      {
        tenantId,
        planId,
        paymentId: razorpay_payment_id,
        subscriptionId: result.subscription.id,
      },
      'Payment verified and subscription activated'
    );

    return result;
  }

  /**
   * Internal helper: upsert subscription within a transaction.
   */
  async _upsertSubscription(tx, tenantId, planId, billingCycle, extras = {}) {
    const startDate = new Date();
    const endDate = new Date(startDate);
    if (billingCycle === 'YEARLY') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const plan = await tx.plan.findUnique({ where: { id: planId } });

    const existing = await tx.subscription.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return tx.subscription.update({
        where: { id: existing.id },
        data: {
          planId,
          status: 'ACTIVE',
          billingCycle,
          startDate,
          endDate,
          trialEndsAt: null,
          cancelledAt: null,
          ...(extras.razorpayCustomerId && {
            stripeCustomerId: extras.razorpayCustomerId,
          }),
        },
        include: { plan: true },
      });
    }

    return tx.subscription.create({
      data: {
        tenantId,
        planId,
        status: 'ACTIVE',
        billingCycle,
        startDate,
        endDate,
        seats: plan?.maxUsers || 1,
        ...(extras.razorpayCustomerId && {
          stripeCustomerId: extras.razorpayCustomerId,
        }),
      },
      include: { plan: true },
    });
  }

  // ============ PAYMENT TRACKING ============

  /**
   * Record a successful Razorpay payment.
   */
  async handlePaymentSuccess(tenantId, razorpayPaymentId, razorpayOrderId, amount, planId) {
    // Check if payment already recorded (idempotency)
    const existingPayment = await prisma.payment.findFirst({
      where: { providerPaymentId: razorpayPaymentId },
    });

    if (existingPayment) {
      logger.info({ razorpayPaymentId }, 'Payment already recorded, skipping');
      return existingPayment;
    }

    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    const paymentDetails = await razorpayService.fetchPayment(razorpayPaymentId);

    // Find or create an invoice for this payment
    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        invoiceNumber: `INV-RZP-${new Date().getFullYear()}-${nanoid(6).toUpperCase()}`,
        status: 'PAID',
        subtotal: amount,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: amount,
        paidAmount: amount,
        balanceDue: 0,
        currency: plan?.currency || 'INR',
        dueDate: new Date(),
        paidAt: new Date(),
        createdById: 'system',
        notes: `Razorpay payment ${razorpayPaymentId}`,
        financialYear: this.getFinancialYear(),
      },
    });

    const payment = await prisma.payment.create({
      data: {
        tenantId,
        invoiceId: invoice.id,
        amount,
        currency: plan?.currency || 'INR',
        method: this._mapRazorpayMethod(paymentDetails.method),
        providerPaymentId: razorpayPaymentId,
        providerData: {
          razorpayOrderId,
          razorpayPaymentId,
          method: paymentDetails.method,
          bank: paymentDetails.bank,
          wallet: paymentDetails.wallet,
          vpa: paymentDetails.vpa,
        },
        status: 'COMPLETED',
        processedAt: new Date(),
      },
    });

    return payment;
  }

  /**
   * Record a failed payment attempt.
   */
  async handlePaymentFailure(tenantId, razorpayPaymentId, reason) {
    logger.warn({ tenantId, razorpayPaymentId, reason }, 'Payment failed');

    // Find the subscription and set to PAST_DUE
    const subscription = await prisma.subscription.findFirst({
      where: { tenantId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    if (subscription) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'PAST_DUE' },
      });
    }

    // Record the failed payment if we can find an invoice
    const latestInvoice = await prisma.invoice.findFirst({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    if (latestInvoice) {
      await prisma.payment.create({
        data: {
          tenantId,
          invoiceId: latestInvoice.id,
          amount: 0,
          currency: 'INR',
          method: 'OTHER',
          providerPaymentId: razorpayPaymentId,
          providerData: { reason, razorpayPaymentId },
          status: 'FAILED',
        },
      });
    }

    return { recorded: true };
  }

  // ============ DUNNING ============

  /**
   * Get dunning status: overdue invoices and failed payments.
   */
  async getDunningStatus(tenantId) {
    const [overdueInvoices, failedPayments, subscription] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          tenantId,
          status: { in: ['SENT', 'OVERDUE'] },
          dueDate: { lt: new Date() },
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.payment.findMany({
        where: {
          tenantId,
          status: 'FAILED',
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.subscription.findFirst({
        where: { tenantId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            planName: subscription.plan.displayName,
          }
        : null,
      overdueInvoices: overdueInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        totalAmount: Number(inv.totalAmount),
        balanceDue: Number(inv.balanceDue),
        dueDate: inv.dueDate,
        daysPastDue: Math.floor((Date.now() - inv.dueDate.getTime()) / (1000 * 60 * 60 * 24)),
      })),
      failedPayments: failedPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        providerPaymentId: p.providerPaymentId,
        reason: p.providerData?.reason || 'Unknown',
        createdAt: p.createdAt,
      })),
      totalOverdue: overdueInvoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0),
      hasOverduePayments: overdueInvoices.length > 0 || failedPayments.length > 0,
    };
  }

  /**
   * Retry a failed payment using the original Razorpay payment reference.
   */
  async retryFailedPayment(tenantId, paymentId) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, tenantId, status: 'FAILED' },
      include: { invoice: true },
    });

    if (!payment) {
      throw new NotFoundError('Failed payment');
    }

    // Create a new Razorpay order for the retry
    const amount = Number(payment.invoice.balanceDue) || Number(payment.invoice.totalAmount);
    const amountInPaise = Math.round(amount * 100);

    const receipt = `retry_${tenantId}_${nanoid(8)}`;
    const order = await razorpayService.createOrder(
      amountInPaise,
      payment.currency || 'INR',
      receipt,
      {
        tenantId,
        retryOf: paymentId,
        invoiceId: payment.invoiceId,
      }
    );

    return {
      orderId: order.id,
      amount: amountInPaise,
      currency: payment.currency || 'INR',
      key: razorpayService.getKeyId(),
      invoiceId: payment.invoiceId,
      originalPaymentId: paymentId,
    };
  }

  // ============ WEBHOOK HANDLING ============

  /**
   * Process a Razorpay webhook event.
   */
  async handleWebhookEvent(event, payload) {
    const entity = payload.payment?.entity || payload.subscription?.entity || {};

    switch (event) {
      case 'payment.captured': {
        const { id: paymentId, order_id: orderId, amount, notes } = entity;
        const tenantId = notes?.tenantId;
        const planId = notes?.planId;

        if (tenantId && planId) {
          await this.handlePaymentSuccess(
            tenantId,
            paymentId,
            orderId,
            amount / 100, // Convert from paise
            planId
          );
        }
        break;
      }

      case 'payment.failed': {
        const { id: paymentId, notes, error_description } = entity;
        const tenantId = notes?.tenantId;

        if (tenantId) {
          await this.handlePaymentFailure(tenantId, paymentId, error_description);
        }
        break;
      }

      case 'subscription.charged': {
        const subscriptionEntity = payload.subscription?.entity || {};
        const { id: rzpSubId, plan_id, notes: subNotes } = subscriptionEntity;
        const tenantId = subNotes?.tenantId;

        if (tenantId) {
          // Update subscription as active
          const subscription = await prisma.subscription.findFirst({
            where: {
              tenantId,
              stripeSubscriptionId: rzpSubId,
            },
          });

          if (subscription) {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: { status: 'ACTIVE' },
            });
          }
        }
        break;
      }

      case 'subscription.cancelled': {
        const subscriptionEntity = payload.subscription?.entity || {};
        const { id: rzpSubId } = subscriptionEntity;

        const subscription = await prisma.subscription.findFirst({
          where: { stripeSubscriptionId: rzpSubId },
        });

        if (subscription) {
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date(),
            },
          });
        }
        break;
      }

      default:
        logger.info({ event }, 'Unhandled Razorpay webhook event');
    }
  }

  // ============ TRIAL MANAGEMENT ============

  /**
   * Check and expire trials that have passed their end date.
   * Can be called from a cron job or on-demand.
   */
  async expireTrials() {
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: 'TRIALING',
        trialEndsAt: { lte: new Date() },
      },
    });

    const results = [];
    for (const sub of expiredTrials) {
      const updated = await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: 'EXPIRED' },
      });
      results.push(updated);
      logger.info({ tenantId: sub.tenantId, subscriptionId: sub.id }, 'Trial expired');
    }

    return { expired: results.length, subscriptions: results };
  }

  // ============ HELPERS ============

  /**
   * Map Razorpay payment method to our PaymentMethod enum.
   */
  _mapRazorpayMethod(razorpayMethod) {
    const methodMap = {
      card: 'CARD',
      netbanking: 'BANK_TRANSFER',
      wallet: 'WALLET',
      upi: 'UPI',
      bank_transfer: 'BANK_TRANSFER',
      emi: 'CARD',
    };

    return methodMap[razorpayMethod] || 'OTHER';
  }
}

export const billingService = new BillingService();
