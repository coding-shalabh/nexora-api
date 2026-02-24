import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed GST data for Indian market testing
 *
 * Run with: node seed-gst.js
 */

async function main() {
  console.log('🇮🇳 Starting GST seed data...');

  // Find existing tenant (use arpit.sharma@helixcode.in tenant)
  const user = await prisma.user.findFirst({
    where: { email: 'arpit.sharma@helixcode.in' },
  });

  if (!user) {
    console.error('❌ User not found! Run main seed first.');
    return;
  }

  const tenantId = user.tenantId;
  console.log(`✅ Found tenant: ${tenantId}`);

  // ==================================================================
  // 0. Cleanup existing GST data (for idempotent seeding)
  // ==================================================================

  console.log('🧹 Cleaning up existing GST data...');

  // Delete existing GST invoices for this tenant
  await prisma.invoice.deleteMany({
    where: {
      tenantId,
      invoiceNumber: {
        in: ['INV-2026-001', 'INV-2026-002', 'INV-2026-003', 'CN-2026-001'],
      },
    },
  });

  // Delete existing GST contacts
  await prisma.contact.deleteMany({
    where: {
      tenantId,
      email: {
        in: ['customer1@example.com', 'customer2@example.com', 'amit.patel@gmail.com'],
      },
    },
  });

  console.log('✅ Cleanup complete');

  // ==================================================================
  // 1. Update Tenant with GST Configuration
  // ==================================================================

  console.log('📝 Updating tenant with GST configuration...');

  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      gstin: '29AABCT1234E1Z5', // Sample Karnataka GSTIN
      pan: 'AABCT1234E',
      legalName: 'Helix Code Private Limited',
      tradeName: 'Helix Code',
      stateCode: '29',
      stateName: 'Karnataka',
      registeredAddress: JSON.stringify({
        street: '123 MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        country: 'India',
      }),
      gstRegistrationType: 'REGULAR',
      cin: 'U72900KA2020PTC123456',
    },
  });

  console.log('✅ Tenant GST configuration updated');

  // ==================================================================
  // 2. Create Sample Contacts with GSTIN
  // ==================================================================

  console.log('📝 Creating contacts with GSTIN...');

  const contact1 = await prisma.contact.create({
    data: {
      tenantId,
      firstName: 'Rajesh',
      lastName: 'Kumar',
      email: 'customer1@example.com',
      phone: '+919876543210',
      gstin: '27AABCT9876M1Z5', // Maharashtra GSTIN
      billingAddress: '456 Andheri West',
      billingCity: 'Mumbai',
      billingState: 'Maharashtra',
      billingStateCode: '27',
      billingPincode: '400058',
    },
  });

  const contact2 = await prisma.contact.create({
    data: {
      tenantId,
      firstName: 'Priya',
      lastName: 'Sharma',
      email: 'customer2@example.com',
      phone: '+919123456789',
      gstin: '29AABCD5678F1Z3', // Karnataka GSTIN (same state)
      billingAddress: '789 Koramangala',
      billingCity: 'Bengaluru',
      billingState: 'Karnataka',
      billingStateCode: '29',
      billingPincode: '560034',
    },
  });

  console.log('✅ Contacts created with GSTIN');

  // ==================================================================
  // 3. Create GST Invoices
  // ==================================================================

  console.log('📝 Creating GST invoices...');

  // Get admin user for createdById
  const adminUser = await prisma.user.findFirst({
    where: { tenantId, email: 'arpit.sharma@helixcode.in' },
  });

  // Invoice 1: Inter-state (IGST) - Karnataka to Maharashtra
  const invoice1 = await prisma.invoice.create({
    data: {
      tenantId,
      invoiceNumber: 'INV-2026-001',
      contactId: contact1.id,
      status: 'SENT',
      issueDate: new Date('2026-02-01'),
      dueDate: new Date('2026-02-15'),
      subtotal: 10000.0,
      currency: 'INR',
      createdById: adminUser.id,
      financialYear: '2025-26',

      // GST Invoice Fields
      isGstInvoice: true,
      invoiceType: 'TAX_INVOICE',
      supplyType: 'B2B',

      // Seller Details (from Tenant)
      sellerGstin: '29AABCT1234E1Z5',
      sellerLegalName: 'Helix Code Private Limited',
      sellerTradeName: 'Helix Code',
      sellerAddress: '123 MG Road, Bengaluru, Karnataka - 560001',
      sellerStateCode: '29',
      sellerStateName: 'Karnataka',

      // Buyer Details (from Contact)
      buyerGstin: '27AABCT9876M1Z5',
      buyerLegalName: 'Tech Solutions Pvt Ltd',
      buyerAddress: '456 Andheri West, Mumbai, Maharashtra - 400058',
      buyerStateCode: '27',
      buyerStateName: 'Maharashtra',

      // Place of Supply
      placeOfSupply: '27', // Maharashtra
      placeOfSupplyName: 'Maharashtra',
      isInterState: true, // Karnataka → Maharashtra

      // Tax Calculation (Inter-state = IGST only)
      taxableAmount: 10000.0,
      cgstAmount: 0.0,
      sgstAmount: 0.0,
      igstAmount: 1800.0, // 18% IGST
      cessAmount: 0.0,
      taxAmount: 1800.0,
      totalAmount: 11800.0,
      balanceDue: 11800.0,

      // E-Invoice fields (optional)
      isEInvoice: false,
      isReverseCharge: false,

      // Invoice Lines
      lines: {
        create: [
          {
            description: 'Web Development Services',
            quantity: 1,
            unitPrice: 10000.0,
            taxRate: 18.0,
            totalPrice: 11800.0,
            hsnCode: '998314', // SAC for IT design & development
            productType: 'SERVICES',
            taxableValue: 10000.0,
            cgstRate: 0.0,
            cgstAmount: 0.0,
            sgstRate: 0.0,
            sgstAmount: 0.0,
            igstRate: 18.0,
            igstAmount: 1800.0,
            totalTax: 1800.0,
            order: 1,
          },
        ],
      },
    },
  });

  console.log(`✅ Invoice ${invoice1.invoiceNumber} created (Inter-state IGST)`);

  // Invoice 2: Intra-state (CGST + SGST) - Karnataka to Karnataka
  const invoice2 = await prisma.invoice.create({
    data: {
      tenantId,
      invoiceNumber: 'INV-2026-002',
      contactId: contact2.id,
      status: 'PAID',
      issueDate: new Date('2026-02-05'),
      dueDate: new Date('2026-02-20'),
      paidAt: new Date('2026-02-10'),
      subtotal: 50000.0,
      currency: 'INR',
      createdById: adminUser.id,
      financialYear: '2025-26',

      // GST Invoice Fields
      isGstInvoice: true,
      invoiceType: 'TAX_INVOICE',
      supplyType: 'B2B',

      // Seller Details
      sellerGstin: '29AABCT1234E1Z5',
      sellerLegalName: 'Helix Code Private Limited',
      sellerTradeName: 'Helix Code',
      sellerAddress: '123 MG Road, Bengaluru, Karnataka - 560001',
      sellerStateCode: '29',
      sellerStateName: 'Karnataka',

      // Buyer Details
      buyerGstin: '29AABCD5678F1Z3',
      buyerLegalName: 'Digital Marketing Agency',
      buyerAddress: '789 Koramangala, Bengaluru, Karnataka - 560034',
      buyerStateCode: '29',
      buyerStateName: 'Karnataka',

      // Place of Supply
      placeOfSupply: '29', // Karnataka
      placeOfSupplyName: 'Karnataka',
      isInterState: false, // Karnataka → Karnataka

      // Tax Calculation (Intra-state = CGST + SGST)
      taxableAmount: 50000.0,
      cgstAmount: 4500.0, // 9% CGST
      sgstAmount: 4500.0, // 9% SGST
      igstAmount: 0.0,
      cessAmount: 0.0,
      taxAmount: 9000.0, // Total 18%
      totalAmount: 59000.0,
      paidAmount: 59000.0,
      balanceDue: 0.0,

      // E-Invoice fields
      isEInvoice: false,
      isReverseCharge: false,

      // Invoice Lines
      lines: {
        create: [
          {
            description: 'Software License (Annual)',
            quantity: 1,
            unitPrice: 30000.0,
            taxRate: 18.0,
            totalPrice: 35400.0,
            hsnCode: '998311', // SAC for software services
            productType: 'SERVICES',
            taxableValue: 30000.0,
            cgstRate: 9.0,
            cgstAmount: 2700.0,
            sgstRate: 9.0,
            sgstAmount: 2700.0,
            igstRate: 0.0,
            igstAmount: 0.0,
            totalTax: 5400.0,
            order: 1,
          },
          {
            description: 'Training & Support',
            quantity: 1,
            unitPrice: 20000.0,
            taxRate: 18.0,
            totalPrice: 23600.0,
            hsnCode: '999293', // SAC for training
            productType: 'SERVICES',
            taxableValue: 20000.0,
            cgstRate: 9.0,
            cgstAmount: 1800.0,
            sgstRate: 9.0,
            sgstAmount: 1800.0,
            igstRate: 0.0,
            igstAmount: 0.0,
            totalTax: 3600.0,
            order: 2,
          },
        ],
      },
    },
  });

  console.log(`✅ Invoice ${invoice2.invoiceNumber} created (Intra-state CGST+SGST)`);

  // Invoice 3: B2C Small (No GSTIN)
  const contact3 = await prisma.contact.create({
    data: {
      tenantId,
      firstName: 'Amit',
      lastName: 'Patel',
      email: 'amit.patel@gmail.com',
      phone: '+919988776655',
      // No GSTIN for B2C
      billingState: 'Gujarat',
      billingStateCode: '24',
    },
  });

  const invoice3 = await prisma.invoice.create({
    data: {
      tenantId,
      invoiceNumber: 'INV-2026-003',
      contactId: contact3.id,
      status: 'DRAFT',
      issueDate: new Date('2026-02-10'),
      dueDate: new Date('2026-02-25'),
      subtotal: 1500.0,
      currency: 'INR',
      createdById: adminUser.id,
      financialYear: '2025-26',

      // GST Invoice Fields
      isGstInvoice: true,
      invoiceType: 'TAX_INVOICE',
      supplyType: 'B2C_SMALL', // B2C invoice < ₹2.5 lakhs

      // Seller Details
      sellerGstin: '29AABCT1234E1Z5',
      sellerLegalName: 'Helix Code Private Limited',
      sellerStateCode: '29',
      sellerStateName: 'Karnataka',

      // Buyer Details (no GSTIN for B2C)
      buyerGstin: null,
      buyerLegalName: 'Amit Patel',
      buyerStateCode: '24',
      buyerStateName: 'Gujarat',

      // Place of Supply
      placeOfSupply: '24', // Gujarat
      placeOfSupplyName: 'Gujarat',
      isInterState: true,

      // Tax Calculation
      taxableAmount: 1500.0,
      cgstAmount: 0.0,
      sgstAmount: 0.0,
      igstAmount: 270.0, // 18% IGST
      cessAmount: 0.0,
      taxAmount: 270.0,
      totalAmount: 1770.0,
      balanceDue: 1770.0,

      isEInvoice: false,
      isReverseCharge: false,

      // Invoice Lines
      lines: {
        create: [
          {
            description: 'Website Hosting (Monthly)',
            quantity: 1,
            unitPrice: 1500.0,
            taxRate: 18.0,
            totalPrice: 1770.0,
            hsnCode: '998319', // SAC for web hosting
            productType: 'SERVICES',
            taxableValue: 1500.0,
            cgstRate: 0.0,
            cgstAmount: 0.0,
            sgstRate: 0.0,
            sgstAmount: 0.0,
            igstRate: 18.0,
            igstAmount: 270.0,
            totalTax: 270.0,
            order: 1,
          },
        ],
      },
    },
  });

  console.log(`✅ Invoice ${invoice3.invoiceNumber} created (B2C Small)`);

  // ==================================================================
  // 4. Create Credit Note (for returns)
  // ==================================================================

  console.log('📝 Creating credit note...');

  const creditNote = await prisma.invoice.create({
    data: {
      tenantId,
      invoiceNumber: 'CN-2026-001',
      contactId: contact1.id,
      status: 'SENT',
      issueDate: new Date('2026-02-12'),
      dueDate: new Date('2026-02-12'),
      subtotal: -2000.0, // Negative for credit
      currency: 'INR',
      createdById: adminUser.id,
      financialYear: '2025-26',

      // GST Invoice Fields
      isGstInvoice: true,
      invoiceType: 'CREDIT_NOTE',
      supplyType: 'B2B',

      // Reference to original invoice
      originalInvoiceNo: 'INV-2026-001',
      originalInvoiceDate: new Date('2026-02-01'),
      reasonForNote: 'Partial service cancellation',

      // Seller & Buyer (same as original invoice)
      sellerGstin: '29AABCT1234E1Z5',
      sellerLegalName: 'Helix Code Private Limited',
      sellerStateCode: '29',
      buyerGstin: '27AABCT9876M1Z5',
      buyerLegalName: 'Tech Solutions Pvt Ltd',
      buyerStateCode: '27',

      placeOfSupply: '27',
      isInterState: true,

      // Tax Calculation (credit = negative)
      taxableAmount: -2000.0,
      igstAmount: -360.0, // -18%
      taxAmount: -360.0,
      totalAmount: -2360.0,
      balanceDue: -2360.0,

      isEInvoice: false,

      lines: {
        create: [
          {
            description: 'Service Credit (Partial)',
            quantity: 1,
            unitPrice: -2000.0,
            taxRate: 18.0,
            totalPrice: -2360.0,
            hsnCode: '998314',
            productType: 'SERVICES',
            taxableValue: -2000.0,
            igstRate: 18.0,
            igstAmount: -360.0,
            totalTax: -360.0,
            order: 1,
          },
        ],
      },
    },
  });

  console.log(`✅ Credit Note ${creditNote.invoiceNumber} created`);

  // ==================================================================
  // Summary
  // ==================================================================

  console.log('\n✅ GST seed data created successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Tenant GST config: ✅ (GSTIN: 29AABCT1234E1Z5)`);
  console.log(`   - Contacts with GSTIN: ✅ (3 contacts)`);
  console.log(`   - GST Invoices: ✅ (4 invoices)`);
  console.log(`     • INV-2026-001: Inter-state (IGST) - ₹11,800`);
  console.log(`     • INV-2026-002: Intra-state (CGST+SGST) - ₹59,000`);
  console.log(`     • INV-2026-003: B2C Small (IGST) - ₹1,770`);
  console.log(`     • CN-2026-001: Credit Note - (₹2,360)`);
  console.log('\n🎉 You can now test GST features in the application!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding GST data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
