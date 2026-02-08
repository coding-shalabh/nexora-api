/**
 * Commerce Module Service
 * Handles inventory, discounts, revenue, and commerce settings
 */

import { prisma } from '@crm360/database';

export const commerceService = {
  // ==================== INVENTORY ====================

  async listInventory({ tenantId, page = 1, limit = 20, status, search }) {
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Since inventory is tied to products, we'll query products with stock info
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    // Transform products to inventory format
    const inventory = products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      stock: p.stockQuantity || 0,
      reorderPoint: p.reorderPoint || 10,
      status: getStockStatus(p.stockQuantity, p.reorderPoint),
      unitPrice: p.unitPrice,
      lastUpdated: p.updatedAt,
    }));

    return {
      data: inventory,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async adjustInventory({ tenantId, productId, quantity, reason }) {
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!product) {
      throw new Error('Product not found');
    }

    const newQuantity = (product.stockQuantity || 0) + quantity;

    if (newQuantity < 0) {
      throw new Error('Insufficient stock');
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: {
        stockQuantity: newQuantity,
      },
    });

    // Log the adjustment
    await prisma.inventoryLog.create({
      data: {
        tenantId,
        productId,
        quantityChange: quantity,
        newQuantity,
        reason,
        createdBy: 'system', // Should be from req.userId
      },
    });

    return {
      id: updated.id,
      sku: updated.sku,
      name: updated.name,
      previousStock: product.stockQuantity || 0,
      adjustment: quantity,
      newStock: newQuantity,
    };
  },

  // ==================== DISCOUNTS ====================

  async listDiscounts({ tenantId, page = 1, limit = 20, status, type }) {
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
    };

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    const [discounts, total] = await Promise.all([
      prisma.discount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.discount.count({ where }),
    ]);

    return {
      data: discounts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getDiscount({ tenantId, discountId }) {
    const discount = await prisma.discount.findFirst({
      where: { id: discountId, tenantId },
    });

    if (!discount) {
      throw new Error('Discount not found');
    }

    return discount;
  },

  async createDiscount({ tenantId, data }) {
    // Generate unique code if not provided
    const code = data.code || generateDiscountCode();

    const discount = await prisma.discount.create({
      data: {
        tenantId,
        code,
        name: data.name,
        type: data.type, // PERCENTAGE, FIXED_AMOUNT, FREE_SHIPPING
        value: data.value,
        minimumPurchase: data.minimumPurchase,
        maximumDiscount: data.maximumDiscount,
        usageLimit: data.usageLimit,
        perCustomerLimit: data.perCustomerLimit || 1,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        applicableTo: data.applicableTo, // ALL, PRODUCTS, CATEGORIES
        productIds: data.productIds,
        status: 'ACTIVE',
      },
    });

    return discount;
  },

  async updateDiscount({ tenantId, discountId, data }) {
    const existing = await prisma.discount.findFirst({
      where: { id: discountId, tenantId },
    });

    if (!existing) {
      throw new Error('Discount not found');
    }

    const discount = await prisma.discount.update({
      where: { id: discountId },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : existing.startDate,
        endDate: data.endDate ? new Date(data.endDate) : existing.endDate,
      },
    });

    return discount;
  },

  async deleteDiscount({ tenantId, discountId }) {
    const existing = await prisma.discount.findFirst({
      where: { id: discountId, tenantId },
    });

    if (!existing) {
      throw new Error('Discount not found');
    }

    await prisma.discount.delete({
      where: { id: discountId },
    });

    return { success: true };
  },

  async validateDiscount({ tenantId, code, cartTotal }) {
    const discount = await prisma.discount.findFirst({
      where: {
        tenantId,
        code,
        status: 'ACTIVE',
      },
    });

    if (!discount) {
      return { valid: false, error: 'Invalid discount code' };
    }

    const now = new Date();

    if (discount.startDate && now < discount.startDate) {
      return { valid: false, error: 'Discount not yet active' };
    }

    if (discount.endDate && now > discount.endDate) {
      return { valid: false, error: 'Discount has expired' };
    }

    if (discount.usageLimit && discount.usageCount >= discount.usageLimit) {
      return { valid: false, error: 'Discount usage limit reached' };
    }

    if (discount.minimumPurchase && cartTotal < discount.minimumPurchase) {
      return {
        valid: false,
        error: `Minimum purchase of ${discount.minimumPurchase} required`,
      };
    }

    let discountAmount = 0;
    if (discount.type === 'PERCENTAGE') {
      discountAmount = (cartTotal * discount.value) / 100;
      if (discount.maximumDiscount) {
        discountAmount = Math.min(discountAmount, discount.maximumDiscount);
      }
    } else if (discount.type === 'FIXED_AMOUNT') {
      discountAmount = discount.value;
    }

    return {
      valid: true,
      discount,
      discountAmount,
    };
  },

  // ==================== REVENUE ====================

  async getRevenueSummary({ tenantId, startDate, endDate }) {
    const where = {
      tenantId,
      status: 'PAID',
    };

    if (startDate) {
      where.createdAt = { gte: new Date(startDate) };
    }

    if (endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        total: true,
        createdAt: true,
      },
    });

    const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const invoiceCount = invoices.length;
    const avgInvoiceValue = invoiceCount > 0 ? totalRevenue / invoiceCount : 0;

    return {
      totalRevenue,
      invoiceCount,
      averageInvoiceValue: avgInvoiceValue,
      period: { startDate, endDate },
    };
  },

  async getRevenueBreakdown({ tenantId, groupBy = 'month', startDate, endDate }) {
    // Simplified breakdown by month
    const where = {
      tenantId,
      status: 'PAID',
    };

    if (startDate) {
      where.createdAt = { gte: new Date(startDate) };
    }

    if (endDate) {
      where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      select: {
        total: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group by month
    const breakdown = {};
    invoices.forEach((inv) => {
      const key = inv.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!breakdown[key]) {
        breakdown[key] = { period: key, revenue: 0, count: 0 };
      }
      breakdown[key].revenue += inv.total || 0;
      breakdown[key].count += 1;
    });

    return Object.values(breakdown);
  },

  // ==================== SETTINGS ====================

  async getSettings({ tenantId }) {
    const settings = await prisma.commerceSettings.findFirst({
      where: { tenantId },
    });

    if (!settings) {
      // Return default settings
      return {
        currency: 'USD',
        taxEnabled: true,
        defaultTaxRate: 18,
        invoicePrefix: 'INV-',
        quotePrefix: 'QUO-',
        paymentTerms: 30,
        autoGenerateInvoiceNumber: true,
      };
    }

    return settings;
  },

  async updateSettings({ tenantId, data }) {
    const settings = await prisma.commerceSettings.upsert({
      where: { tenantId },
      update: data,
      create: {
        tenantId,
        ...data,
      },
    });

    return settings;
  },

  // ==================== RECEIPTS ====================

  async listReceipts({ tenantId, page = 1, limit = 20 }) {
    const skip = (page - 1) * limit;

    const [receipts, total] = await Promise.all([
      prisma.payment.findMany({
        where: { tenantId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              contact: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.payment.count({ where: { tenantId } }),
    ]);

    return {
      data: receipts.map((p) => ({
        id: p.id,
        receiptNumber: `RCP-${p.id.substring(0, 8).toUpperCase()}`,
        invoiceNumber: p.invoice?.invoiceNumber,
        amount: p.amount,
        paymentMethod: p.paymentMethod,
        status: p.status,
        customer: p.invoice?.contact
          ? `${p.invoice.contact.firstName} ${p.invoice.contact.lastName}`
          : 'Unknown',
        date: p.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};

// Helper functions
function getStockStatus(quantity, reorderPoint) {
  if (!quantity || quantity <= 0) return 'OUT_OF_STOCK';
  if (quantity <= (reorderPoint || 10)) return 'LOW_STOCK';
  return 'IN_STOCK';
}

function generateDiscountCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
