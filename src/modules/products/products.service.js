import { prisma } from '@crm360/database';
import { NotFoundError } from '@crm360/shared';
import { nanoid } from 'nanoid';

class ProductsService {
  /**
   * Get all products with filters and pagination
   */
  async getProducts(tenantId, filters = {}) {
    const where = { tenantId };

    // Search filter
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { sku: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Product type filter
    if (filters.productType) {
      where.productType = filters.productType;
    }

    // Active/inactive filter
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const page = filters.page || 1;
    const limit = filters.limit || 25;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: filters.sortBy
          ? { [filters.sortBy]: filters.sortOrder || 'desc' }
          : { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      success: true,
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get product statistics
   */
  async getProductStats(tenantId) {
    const [total, active, goods, services] = await Promise.all([
      prisma.product.count({ where: { tenantId } }),
      prisma.product.count({ where: { tenantId, isActive: true } }),
      prisma.product.count({ where: { tenantId, productType: 'GOODS' } }),
      prisma.product.count({ where: { tenantId, productType: 'SERVICES' } }),
    ]);

    return {
      success: true,
      data: {
        total,
        active,
        inactive: total - active,
        goods,
        services,
      },
    };
  }

  /**
   * Get a single product by ID
   */
  async getProduct(tenantId, productId) {
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return {
      success: true,
      data: product,
    };
  }

  /**
   * Create a new product
   */
  async createProduct(tenantId, data) {
    const product = await prisma.product.create({
      data: {
        id: nanoid(),
        tenantId,
        name: data.name,
        description: data.description,
        sku: data.sku,
        unitPrice: data.unitPrice,
        currency: data.currency || 'USD',
        taxRate: data.taxRate,
        isActive: data.isActive !== undefined ? data.isActive : true,
        hsnCode: data.hsnCode,
        sacCode: data.sacCode,
        productType: data.productType || 'GOODS',
        gstRate: data.gstRate,
        cessRate: data.cessRate,
        unit: data.unit,
        isTaxExempt: data.isTaxExempt || false,
        taxExemptReason: data.taxExemptReason,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      data: product,
      message: 'Product created successfully',
    };
  }

  /**
   * Update a product
   */
  async updateProduct(tenantId, productId, data) {
    // Check if product exists
    const existing = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      data: product,
      message: 'Product updated successfully',
    };
  }

  /**
   * Delete a product (soft delete by setting isActive to false)
   */
  async deleteProduct(tenantId, productId) {
    // Check if product exists
    const existing = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    await prisma.product.update({
      where: { id: productId },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Product deleted successfully',
    };
  }

  /**
   * Archive a product (alias for delete)
   */
  async archiveProduct(tenantId, productId) {
    return this.deleteProduct(tenantId, productId);
  }

  /**
   * Restore an archived product
   */
  async restoreProduct(tenantId, productId) {
    // Check if product exists
    const existing = await prisma.product.findFirst({
      where: { id: productId, tenantId },
    });

    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    const product = await prisma.product.update({
      where: { id: productId },
      data: {
        isActive: true,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      data: product,
      message: 'Product restored successfully',
    };
  }
}

export const productsService = new ProductsService();
