import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import { nanoid } from 'nanoid';

class QuotesService {
  /**
   * Generate next quote number for tenant
   */
  async generateQuoteNumber(tenantId) {
    const year = new Date().getFullYear();
    const prefix = `QT-${year}-`;

    // Find the latest quote number for this year
    const lastQuote = await prisma.quote.findFirst({
      where: {
        tenantId,
        quoteNumber: {
          startsWith: prefix,
        },
      },
      orderBy: {
        quoteNumber: 'desc',
      },
      select: {
        quoteNumber: true,
      },
    });

    if (!lastQuote) {
      return `${prefix}001`;
    }

    // Extract number and increment
    const lastNumber = parseInt(lastQuote.quoteNumber.replace(prefix, ''));
    const nextNumber = (lastNumber + 1).toString().padStart(3, '0');
    return `${prefix}${nextNumber}`;
  }

  /**
   * Calculate quote totals from line items
   */
  calculateQuoteTotals(lines) {
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    for (const line of lines) {
      subtotal += Number(line.totalPrice);
      taxAmount += Number(line.totalTax || 0);
      discountAmount += Number(line.discountAmount || 0);
    }

    const totalAmount = subtotal + taxAmount - discountAmount;

    return {
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount,
    };
  }

  /**
   * Calculate line item totals
   */
  calculateLineItem(line, isGstQuote = false, isInterState = false) {
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unitPrice);
    const discountPercent = Number(line.discountPercent || 0);
    const discountAmount = Number(line.discountAmount || 0);
    const taxRate = Number(line.taxRate || 0);

    // Calculate base amount
    const baseAmount = quantity * unitPrice;

    // Apply discounts
    const percentDiscount = (baseAmount * discountPercent) / 100;
    const totalDiscount = percentDiscount + discountAmount;
    const taxableValue = baseAmount - totalDiscount;

    // Calculate taxes
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;
    let cessAmount = 0;
    let totalTax = 0;

    if (isGstQuote && !line.isTaxExempt) {
      if (isInterState) {
        // Interstate: IGST only
        igstAmount = (taxableValue * taxRate) / 100;
        totalTax = igstAmount;
      } else {
        // Intrastate: CGST + SGST
        cgstAmount = (taxableValue * (taxRate / 2)) / 100;
        sgstAmount = (taxableValue * (taxRate / 2)) / 100;
        totalTax = cgstAmount + sgstAmount;
      }

      // Add CESS if applicable
      if (line.cessRate) {
        cessAmount = (taxableValue * Number(line.cessRate)) / 100;
        totalTax += cessAmount;
      }
    } else if (!line.isTaxExempt) {
      // Simple tax calculation for non-GST quotes
      totalTax = (taxableValue * taxRate) / 100;
    }

    const totalPrice = taxableValue + totalTax;

    return {
      ...line,
      taxableValue,
      discountAmount: totalDiscount,
      totalPrice,
      cgstRate: isInterState ? 0 : taxRate / 2,
      cgstAmount,
      sgstRate: isInterState ? 0 : taxRate / 2,
      sgstAmount,
      igstRate: isInterState ? taxRate : 0,
      igstAmount,
      cessRate: line.cessRate || 0,
      cessAmount,
      totalTax,
    };
  }

  /**
   * Get all quotes with filters and pagination
   */
  async getQuotes(tenantId, filters = {}) {
    // TODO: Quotes feature not yet implemented - Quote model doesn't exist
    // Return empty data with proper structure
    const page = filters.page || 1;
    const limit = filters.limit || 25;

    return {
      success: true,
      data: [],
      meta: {
        total: 0,
        page,
        limit,
        totalPages: 0,
      },
    };
  }

  /**
   * Get quote statistics
   */
  async getQuoteStats(tenantId) {
    // TODO: Quotes feature not yet implemented - Quote model doesn't exist
    // Return empty stats with proper structure
    return {
      success: true,
      data: {
        total: 0,
        drafts: 0,
        sent: 0,
        accepted: 0,
        pending: 0,
        totalValue: 0,
      },
    };
  }

  /**
   * Get a single quote by ID
   */
  async getQuote(tenantId, quoteId) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
      include: {
        contact: true,
        deal: true,
        lines: {
          include: {
            product: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!quote) {
      throw new NotFoundError('Quote not found');
    }

    return {
      success: true,
      data: quote,
    };
  }

  /**
   * Create a new quote
   */
  async createQuote(tenantId, userId, data) {
    const quoteNumber = await this.generateQuoteNumber(tenantId);

    // Process line items if provided
    const lines = data.lines || [];
    const processedLines = lines.map((line, index) =>
      this.calculateLineItem(
        {
          ...line,
          id: nanoid(),
          order: index + 1,
        },
        data.isGstQuote,
        data.isInterState
      )
    );

    // Calculate totals
    const totals = this.calculateQuoteTotals(processedLines);

    const quote = await prisma.quote.create({
      data: {
        id: nanoid(),
        tenantId,
        quoteNumber,
        ...(data.contactId && { contact: { connect: { id: data.contactId } } }),
        ...(data.dealId && { deal: { connect: { id: data.dealId } } }),
        status: 'DRAFT',
        issueDate: new Date(),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        currency: data.currency || 'USD',
        notes: data.notes,
        terms: data.terms,
        isGstQuote: data.isGstQuote || false,
        supplyType: data.supplyType || 'B2B',
        sellerGstin: data.sellerGstin,
        sellerLegalName: data.sellerLegalName,
        sellerAddress: data.sellerAddress,
        sellerStateCode: data.sellerStateCode,
        buyerGstin: data.buyerGstin,
        buyerLegalName: data.buyerLegalName,
        buyerAddress: data.buyerAddress,
        buyerStateCode: data.buyerStateCode,
        placeOfSupply: data.placeOfSupply,
        isInterState: data.isInterState || false,
        isReverseCharge: data.isReverseCharge || false,
        createdById: userId,
        updatedAt: new Date(),
        ...totals,
        lines: {
          create: processedLines,
        },
      },
      include: {
        lines: true,
        contact: true,
        deal: true,
      },
    });

    return {
      success: true,
      data: quote,
      message: 'Quote created successfully',
    };
  }

  /**
   * Update a quote
   */
  async updateQuote(tenantId, quoteId, data) {
    // Check if quote exists
    const existing = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Quote not found');
    }

    const quote = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        ...data,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        updatedAt: new Date(),
      },
      include: {
        lines: true,
        contact: true,
        deal: true,
      },
    });

    return {
      success: true,
      data: quote,
      message: 'Quote updated successfully',
    };
  }

  /**
   * Delete a quote
   */
  async deleteQuote(tenantId, quoteId) {
    // Check if quote exists
    const existing = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Quote not found');
    }

    await prisma.quote.delete({
      where: { id: quoteId },
    });

    return {
      success: true,
      message: 'Quote deleted successfully',
    };
  }

  /**
   * Send quote to contact
   */
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
        updatedAt: new Date(),
      },
      include: {
        lines: true,
        contact: true,
        deal: true,
      },
    });

    return {
      success: true,
      data: updated,
      message: 'Quote sent successfully',
    };
  }

  /**
   * Accept a quote
   */
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
        updatedAt: new Date(),
      },
      include: {
        lines: true,
        contact: true,
        deal: true,
      },
    });

    return {
      success: true,
      data: updated,
      message: 'Quote accepted successfully',
    };
  }

  /**
   * Reject a quote
   */
  async rejectQuote(tenantId, quoteId) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });

    if (!quote) {
      throw new NotFoundError('Quote not found');
    }

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        status: 'REJECTED',
        updatedAt: new Date(),
      },
      include: {
        lines: true,
        contact: true,
        deal: true,
      },
    });

    return {
      success: true,
      data: updated,
      message: 'Quote rejected successfully',
    };
  }

  /**
   * Duplicate a quote
   */
  async duplicateQuote(tenantId, quoteId, userId) {
    const original = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
      include: {
        lines: true,
      },
    });

    if (!original) {
      throw new NotFoundError('Quote not found');
    }

    const quoteNumber = await this.generateQuoteNumber(tenantId);

    const quote = await prisma.quote.create({
      data: {
        id: nanoid(),
        tenantId,
        quoteNumber,
        contactId: original.contactId,
        dealId: original.dealId,
        status: 'DRAFT',
        issueDate: new Date(),
        expiryDate: original.expiryDate,
        subtotal: original.subtotal,
        taxAmount: original.taxAmount,
        discountAmount: original.discountAmount,
        totalAmount: original.totalAmount,
        currency: original.currency,
        notes: original.notes,
        terms: original.terms,
        isGstQuote: original.isGstQuote,
        supplyType: original.supplyType,
        sellerGstin: original.sellerGstin,
        sellerLegalName: original.sellerLegalName,
        sellerAddress: original.sellerAddress,
        sellerStateCode: original.sellerStateCode,
        buyerGstin: original.buyerGstin,
        buyerLegalName: original.buyerLegalName,
        buyerAddress: original.buyerAddress,
        buyerStateCode: original.buyerStateCode,
        placeOfSupply: original.placeOfSupply,
        isInterState: original.isInterState,
        isReverseCharge: original.isReverseCharge,
        createdById: userId,
        updatedAt: new Date(),
        lines: {
          create: original.lines.map((line) => ({
            id: nanoid(),
            productId: line.productId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            discountPercent: line.discountPercent,
            discountAmount: line.discountAmount,
            totalPrice: line.totalPrice,
            order: line.order,
            hsnCode: line.hsnCode,
            sacCode: line.sacCode,
            unit: line.unit,
            productType: line.productType,
            taxableValue: line.taxableValue,
            cgstRate: line.cgstRate,
            cgstAmount: line.cgstAmount,
            sgstRate: line.sgstRate,
            sgstAmount: line.sgstAmount,
            igstRate: line.igstRate,
            igstAmount: line.igstAmount,
            cessRate: line.cessRate,
            cessAmount: line.cessAmount,
            totalTax: line.totalTax,
            isTaxExempt: line.isTaxExempt,
            exemptReason: line.exemptReason,
          })),
        },
      },
      include: {
        lines: true,
        contact: true,
        deal: true,
      },
    });

    return {
      success: true,
      data: quote,
      message: 'Quote duplicated successfully',
    };
  }

  /**
   * Add line items to a quote
   */
  async addLineItems(tenantId, quoteId, lines) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
      include: { lines: true },
    });

    if (!quote) {
      throw new NotFoundError('Quote not found');
    }

    // Process new line items
    const maxOrder = quote.lines.length;
    const processedLines = lines.map((line, index) =>
      this.calculateLineItem(
        {
          ...line,
          id: nanoid(),
          quoteId,
          order: maxOrder + index + 1,
        },
        quote.isGstQuote,
        quote.isInterState
      )
    );

    // Create line items
    await prisma.quoteLine.createMany({
      data: processedLines,
    });

    // Recalculate quote totals
    const allLines = await prisma.quoteLine.findMany({
      where: { quoteId },
    });

    const totals = this.calculateQuoteTotals(allLines);

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        ...totals,
        updatedAt: new Date(),
      },
      include: {
        lines: true,
        contact: true,
        deal: true,
      },
    });

    return {
      success: true,
      data: updated,
      message: 'Line items added successfully',
    };
  }

  /**
   * Remove a line item from a quote
   */
  async removeLineItem(tenantId, quoteId, lineId) {
    const quote = await prisma.quote.findFirst({
      where: { id: quoteId, tenantId },
    });

    if (!quote) {
      throw new NotFoundError('Quote not found');
    }

    // Delete line item
    await prisma.quoteLine.delete({
      where: { id: lineId },
    });

    // Recalculate quote totals
    const lines = await prisma.quoteLine.findMany({
      where: { quoteId },
    });

    const totals = this.calculateQuoteTotals(lines);

    const updated = await prisma.quote.update({
      where: { id: quoteId },
      data: {
        ...totals,
        updatedAt: new Date(),
      },
      include: {
        lines: true,
        contact: true,
        deal: true,
      },
    });

    return {
      success: true,
      data: updated,
      message: 'Line item removed successfully',
    };
  }
}

export const quotesService = new QuotesService();
