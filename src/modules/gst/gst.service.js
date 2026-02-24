import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import { logger } from '../../common/logger.js';

const prisma = new PrismaClient();

// ============================================================================
// GST Configuration
// ============================================================================

/**
 * Get GST configuration for tenant
 */
export async function getGstConfig(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      gstin: true,
      legalName: true,
      tradeName: true,
      stateCode: true,
      stateName: true,
      registeredAddress: true,
      gstRegistrationType: true,
      pan: true,
      cin: true,
    },
  });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  return {
    gstin: tenant.gstin,
    legalName: tenant.legalName,
    tradeName: tenant.tradeName,
    stateCode: tenant.stateCode,
    stateName: tenant.stateName,
    address: tenant.registeredAddress,
    registrationType: tenant.gstRegistrationType || 'REGULAR',
    pan: tenant.pan,
    cin: tenant.cin,
    isConfigured: !!(tenant.gstin && tenant.legalName && tenant.stateCode),
  };
}

/**
 * Update GST configuration
 */
export async function updateGstConfig(tenantId, data) {
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      gstin: data.gstin,
      legalName: data.legalName,
      tradeName: data.tradeName,
      stateCode: data.stateCode,
      stateName: data.stateName,
      registeredAddress: JSON.stringify(data.address),
      gstRegistrationType: data.registrationType,
    },
    select: {
      gstin: true,
      legalName: true,
      tradeName: true,
      stateCode: true,
      stateName: true,
      registeredAddress: true,
      gstRegistrationType: true,
    },
  });

  return updated;
}

/**
 * Validate GSTIN via third-party API
 * TODO: Integrate with actual GSTIN verification API (e.g., TaxCloud, Razorpay)
 */
export async function validateGstin(gstin) {
  // For now, return basic validation based on GSTIN format
  // In production, call government API or third-party service

  const stateCode = gstin.substring(0, 2);
  const panNumber = gstin.substring(2, 12);
  const entityCode = gstin.substring(12, 13);
  const checksum = gstin.substring(14, 15);

  return {
    valid: true, // Placeholder - should be actual API response
    gstin,
    stateCode,
    panNumber,
    entityCode,
    status: 'Active', // Mock data
    legalName: 'Sample Business Pvt Ltd', // Mock data
    tradeName: 'Sample Business', // Mock data
    registrationDate: '2020-01-01', // Mock data
    address: 'Sample Address, City, State - 123456', // Mock data
    message: 'GSTIN validation API not yet integrated. Using mock data.',
  };
}

// ============================================================================
// HSN/SAC Code Management
// ============================================================================

/**
 * List HSN/SAC codes for tenant
 */
export async function listHsnCodes(tenantId, filters = {}) {
  const where = { tenantId };

  if (filters.search) {
    where.OR = [
      { code: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.type === 'goods') {
    where.isService = false;
  } else if (filters.type === 'services') {
    where.isService = true;
  }

  // Note: HSNCode model needs to be added to Prisma schema
  // For now, return mock data
  return [
    {
      id: '1',
      code: '9403',
      description: 'Other furniture and parts thereof',
      gstRate: 18,
      cess: 0,
      isService: false,
    },
    {
      id: '2',
      code: '998314',
      description: 'IT design and development services',
      gstRate: 18,
      cess: 0,
      isService: true,
    },
  ];
}

/**
 * Create HSN/SAC code
 */
export async function createHsnCode(tenantId, data) {
  // TODO: Implement when HSNCode model is added to schema
  logger.warn('HSNCode model not yet in schema - returning mock data');

  return {
    id: Date.now().toString(),
    tenantId,
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Update HSN/SAC code
 */
export async function updateHsnCode(tenantId, id, data) {
  // TODO: Implement when HSNCode model is added to schema
  logger.warn('HSNCode model not yet in schema - returning mock data');

  return {
    id,
    tenantId,
    ...data,
    updatedAt: new Date(),
  };
}

/**
 * Delete HSN/SAC code
 */
export async function deleteHsnCode(tenantId, id) {
  // TODO: Implement when HSNCode model is added to schema
  logger.warn('HSNCode model not yet in schema');
  return true;
}

// ============================================================================
// GST Tax Calculation
// ============================================================================

/**
 * Calculate GST (CGST + SGST for intra-state, IGST for inter-state)
 */
export function calculateGst(amount, gstRate, sellerState, buyerState, cess = 0) {
  const isInterState = sellerState !== buyerState;

  const taxableAmount = amount;
  const gstAmount = (taxableAmount * gstRate) / 100;
  const cessAmount = cess ? (taxableAmount * cess) / 100 : 0;

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterState) {
    igst = gstAmount;
  } else {
    cgst = gstAmount / 2;
    sgst = gstAmount / 2;
  }

  const totalTax = cgst + sgst + igst + cessAmount;
  const totalAmount = taxableAmount + totalTax;

  return {
    taxableAmount,
    gstRate,
    cgst,
    sgst,
    igst,
    cess: cessAmount,
    totalTax,
    totalAmount,
    isInterState,
  };
}

// ============================================================================
// Invoice QR Code (GST Compliant)
// ============================================================================

/**
 * Generate QR code for GST invoice (as per CBIC guidelines)
 */
export async function generateInvoiceQr(tenantId, invoiceId) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      contact: true,
      lines: true,
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  // QR code data as per CBIC Notification No. 14/2020
  const qrData = {
    SellerGstin: invoice.sellerGstin || '',
    BuyerGstin: invoice.buyerGstin || '',
    DocNo: invoice.invoiceNumber,
    DocDt: invoice.issueDate.toISOString().split('T')[0],
    DocAmt: parseFloat(invoice.totalAmount),
    ItemCnt: invoice.lines.length,
    MainHsnCode: invoice.lines[0]?.hsnCode || '',
    IrnNo: invoice.irn || '',
    IrnDt: invoice.ackDate ? invoice.ackDate.toISOString().split('T')[0] : '',
  };

  const qrString = JSON.stringify(qrData);
  const qrCode = await QRCode.toDataURL(qrString);

  // Update invoice with QR code
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { signedQrCode: qrCode },
  });

  return qrCode;
}

// ============================================================================
// E-Invoice (IRN Generation)
// ============================================================================

/**
 * Generate E-Invoice (IRN)
 * TODO: Integrate with GSP (GST Suvidha Provider) like ClearTax or IRIS
 */
export async function generateEInvoice(tenantId, invoiceId) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: {
      contact: true,
      lines: true,
    },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (!invoice.sellerGstin) {
    throw new Error('Seller GSTIN is required for e-invoice');
  }

  // Mock IRN generation
  // In production, this should call GSP API
  const mockIrn = `${Date.now()}${Math.random().toString(36).substring(2, 15)}`.substring(0, 64);
  const mockAckNo = Math.random().toString().substring(2, 12);
  const mockAckDate = new Date();

  // Generate signed QR code
  const qrCode = await generateInvoiceQr(tenantId, invoiceId);

  // Update invoice with e-invoice details
  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      isEInvoice: true,
      irn: mockIrn,
      irnStatus: 'GENERATED',
      ackNumber: mockAckNo,
      ackDate: mockAckDate,
      irnGeneratedAt: new Date(),
      signedQrCode: qrCode,
    },
  });

  logger.info({ invoiceId, irn: mockIrn }, 'E-invoice generated (mock)');

  return {
    irn: mockIrn,
    ackNumber: mockAckNo,
    ackDate: mockAckDate,
    qrCode,
    message: 'E-invoice API not yet integrated. Using mock data.',
  };
}

/**
 * Cancel E-Invoice
 * TODO: Integrate with GSP API
 */
export async function cancelEInvoice(tenantId, invoiceId, reason) {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
  });

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  if (!invoice.irn) {
    throw new Error('Invoice does not have an IRN');
  }

  // Update invoice status
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      irnStatus: 'CANCELLED',
    },
  });

  return {
    success: true,
    message: 'E-invoice cancelled successfully (mock)',
  };
}

// ============================================================================
// GST Returns (GSTR-1 & GSTR-3B)
// ============================================================================

/**
 * Generate GSTR-1 JSON (Outward supplies)
 */
export async function generateGstr1(tenantId, month, year) {
  // Get all invoices for the month
  const startDate = new Date(`${month}-01`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      isGstInvoice: true,
      issueDate: {
        gte: startDate,
        lt: endDate,
      },
      status: {
        in: ['SENT', 'PAID', 'PARTIALLY_PAID'],
      },
    },
    include: {
      contact: true,
      lines: true,
    },
  });

  // Group invoices by supply type
  const b2bInvoices = invoices.filter((inv) => inv.supplyType === 'B2B');
  const b2cLargeInvoices = invoices.filter((inv) => inv.supplyType === 'B2C_LARGE');
  const b2cSmallInvoices = invoices.filter((inv) => inv.supplyType === 'B2C_SMALL');
  const exportInvoices = invoices.filter((inv) =>
    ['EXPORT_WITH_PAY', 'EXPORT_WITHOUT_PAY'].includes(inv.supplyType)
  );

  // Format as per GSTR-1 JSON structure
  const gstr1 = {
    gstin: invoices[0]?.sellerGstin || '',
    fp: month,
    b2b: b2bInvoices.map((inv) => ({
      ctin: inv.buyerGstin,
      inv: [
        {
          inum: inv.invoiceNumber,
          idt: inv.issueDate.toISOString().split('T')[0],
          val: parseFloat(inv.totalAmount),
          pos: inv.placeOfSupply,
          rchrg: inv.isReverseCharge ? 'Y' : 'N',
          inv_typ: 'R',
          itms: inv.lines.map((line) => ({
            num: line.order,
            itm_det: {
              txval: parseFloat(line.taxableValue),
              rt: parseFloat(line.cgstRate) + parseFloat(line.sgstRate),
              csamt: parseFloat(line.cessAmount),
              camt: parseFloat(line.cgstAmount),
              samt: parseFloat(line.sgstAmount),
              iamt: parseFloat(line.igstAmount),
            },
          })),
        },
      ],
    })),
    b2cl: b2cLargeInvoices.map((inv) => ({
      pos: inv.placeOfSupply,
      inv: [
        {
          inum: inv.invoiceNumber,
          idt: inv.issueDate.toISOString().split('T')[0],
          val: parseFloat(inv.totalAmount),
          itms: inv.lines.map((line) => ({
            num: line.order,
            itm_det: {
              txval: parseFloat(line.taxableValue),
              rt: parseFloat(line.igstRate),
              iamt: parseFloat(line.igstAmount),
            },
          })),
        },
      ],
    })),
    b2cs: {
      // B2C Small aggregated by rate and place of supply
      // TODO: Implement aggregation logic
    },
    exp: exportInvoices.map((inv) => ({
      exp_typ: inv.supplyType === 'EXPORT_WITH_PAY' ? 'WPAY' : 'WOPAY',
      inv: [
        {
          inum: inv.invoiceNumber,
          idt: inv.issueDate.toISOString().split('T')[0],
          val: parseFloat(inv.totalAmount),
          sbpcode: '000000', // Port code - to be added
          sbnum: '', // Shipping bill number
          sbdt: '', // Shipping bill date
        },
      ],
    })),
  };

  return gstr1;
}

/**
 * Generate GSTR-3B JSON (Summary return)
 */
export async function generateGstr3b(tenantId, month, year) {
  // Similar to GSTR-1 but with summary totals
  // TODO: Implement complete GSTR-3B logic

  const startDate = new Date(`${month}-01`);
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 1);

  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      isGstInvoice: true,
      issueDate: {
        gte: startDate,
        lt: endDate,
      },
      status: {
        in: ['SENT', 'PAID', 'PARTIALLY_PAID'],
      },
    },
  });

  const totalTaxable = invoices.reduce((sum, inv) => sum + parseFloat(inv.taxableAmount), 0);
  const totalIgst = invoices.reduce((sum, inv) => sum + parseFloat(inv.igstAmount), 0);
  const totalCgst = invoices.reduce((sum, inv) => sum + parseFloat(inv.cgstAmount), 0);
  const totalSgst = invoices.reduce((sum, inv) => sum + parseFloat(inv.sgstAmount), 0);
  const totalCess = invoices.reduce((sum, inv) => sum + parseFloat(inv.cessAmount), 0);

  const gstr3b = {
    gstin: invoices[0]?.sellerGstin || '',
    ret_period: month,
    sup_details: {
      osup_det: {
        txval: totalTaxable,
        iamt: totalIgst,
        camt: totalCgst,
        samt: totalSgst,
        csamt: totalCess,
      },
    },
    // TODO: Add ITC (Input Tax Credit) section
    // TODO: Add tax liability and payment section
  };

  return gstr3b;
}

/**
 * List GST returns for a financial year
 */
export async function listGstReturns(tenantId, year) {
  // TODO: Implement GST return tracking in database
  // For now, return mock data

  return [
    {
      id: '1',
      returnType: 'GSTR-1',
      month: '2026-02',
      financialYear: '2025-26',
      status: 'DRAFT',
      dueDate: '2026-03-11',
    },
    {
      id: '2',
      returnType: 'GSTR-3B',
      month: '2026-02',
      financialYear: '2025-26',
      status: 'DRAFT',
      dueDate: '2026-03-20',
    },
  ];
}

// ============================================================================
// Helper: Indian States with Codes
// ============================================================================

export function getIndianStates() {
  return [
    { code: '01', name: 'Jammu and Kashmir' },
    { code: '02', name: 'Himachal Pradesh' },
    { code: '03', name: 'Punjab' },
    { code: '04', name: 'Chandigarh' },
    { code: '05', name: 'Uttarakhand' },
    { code: '06', name: 'Haryana' },
    { code: '07', name: 'Delhi' },
    { code: '08', name: 'Rajasthan' },
    { code: '09', name: 'Uttar Pradesh' },
    { code: '10', name: 'Bihar' },
    { code: '11', name: 'Sikkim' },
    { code: '12', name: 'Arunachal Pradesh' },
    { code: '13', name: 'Nagaland' },
    { code: '14', name: 'Manipur' },
    { code: '15', name: 'Mizoram' },
    { code: '16', name: 'Tripura' },
    { code: '17', name: 'Meghalaya' },
    { code: '18', name: 'Assam' },
    { code: '19', name: 'West Bengal' },
    { code: '20', name: 'Jharkhand' },
    { code: '21', name: 'Odisha' },
    { code: '22', name: 'Chhattisgarh' },
    { code: '23', name: 'Madhya Pradesh' },
    { code: '24', name: 'Gujarat' },
    { code: '25', name: 'Daman and Diu' },
    { code: '26', name: 'Dadra and Nagar Haveli' },
    { code: '27', name: 'Maharashtra' },
    { code: '28', name: 'Andhra Pradesh' },
    { code: '29', name: 'Karnataka' },
    { code: '30', name: 'Goa' },
    { code: '31', name: 'Lakshadweep' },
    { code: '32', name: 'Kerala' },
    { code: '33', name: 'Tamil Nadu' },
    { code: '34', name: 'Puducherry' },
    { code: '35', name: 'Andaman and Nicobar Islands' },
    { code: '36', name: 'Telangana' },
    { code: '37', name: 'Andhra Pradesh (New)' },
    { code: '38', name: 'Ladakh' },
  ];
}
