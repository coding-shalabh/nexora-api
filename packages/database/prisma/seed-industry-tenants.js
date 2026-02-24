/**
 * INDUSTRY TENANT SEEDER
 * Creates 8 realistic industry tenants with hub-specific data.
 * Each tenant only gets data for its relevant hubs (per hub matrix).
 * Channel data routes through API Dog mock servers.
 *
 * Run: node packages/database/prisma/seed-industry-tenants.js
 *
 * Prerequisites: Run nuke-db.js first to restore platform essentials.
 *
 * Tenants:
 *  1. PrimeView Realty       - Real Estate
 *  2. SpiceCraft Restaurants  - Restaurant / F&B
 *  3. EduPrime Academy       - Education
 *  4. LegalEdge Associates   - Legal / Law Firm
 *  5. FitZone India          - Gym / Fitness
 *  6. PixelWave Digital      - Digital Agency
 *  7. AutoPrime Motors       - Auto Dealer
 *  8. TaxShield Advisors     - CA / Accounting Firm
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ==================== API DOG MOCK CONFIG ====================
// All tenants share the same API Dog project but each gets a separate mock server.
// Update these URLs after creating mock servers in API Dog project 1204909.
const APIDOG_TOKEN = '4BwI4HdkyYbT3O2YbbJaE';
const APIDOG_BASE_URL = 'https://mock.apidog.com/m1/1204909-1200223-default';

// ==================== HELPERS ====================

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function avatarUrl(name, bg) {
  const encoded = encodeURIComponent(name);
  return `https://ui-avatars.com/api/?name=${encoded}&background=${bg}&color=fff&size=128&bold=true`;
}

// ==================== 8 INDUSTRY TENANT CONFIGS ====================

const TENANT_CONFIGS = [
  // ── 1. PrimeView Realty ──
  {
    name: 'PrimeView Realty',
    slug: 'primeview-realty',
    domain: 'primeviewrealty.in',
    email: 'admin@primeviewrealty.in',
    industry: 'Real Estate',
    phone: '+91 9811001001',
    brandColor: '2563EB',
    hubs: {
      crm: true,
      sales: true,
      inbox: true,
      marketing: true,
      service: true,
      projects: true,
      commerce: false,
      hr: true,
      finance: true,
      inventory: false,
      analytics: true,
      automation: true,
      calendar: true,
    },
    companies: [
      { name: 'DLF Limited', industry: 'Real Estate', employees: 15000, domain: 'dlf.in' },
      {
        name: 'Godrej Properties',
        industry: 'Real Estate',
        employees: 3500,
        domain: 'godrejproperties.com',
      },
      {
        name: 'Prestige Estates',
        industry: 'Real Estate',
        employees: 5000,
        domain: 'prestigeconstructions.com',
      },
      {
        name: 'Brigade Enterprises',
        industry: 'Real Estate',
        employees: 2000,
        domain: 'brigadegroup.com',
      },
      { name: 'Sobha Limited', industry: 'Construction', employees: 8000, domain: 'sobha.com' },
    ],
    products: [
      {
        name: '2BHK Apartment - Sector 82',
        unitPrice: '4500000.00',
        gstRate: '5.00',
        hsnCode: '997212',
      },
      {
        name: '3BHK Penthouse - Golf Course Road',
        unitPrice: '12500000.00',
        gstRate: '5.00',
        hsnCode: '997212',
      },
      {
        name: 'Commercial Office Space - 1000 sqft',
        unitPrice: '8500000.00',
        gstRate: '18.00',
        hsnCode: '997212',
      },
      {
        name: 'Villa Plot - 200 sq yards',
        unitPrice: '6000000.00',
        gstRate: '5.00',
        hsnCode: '997212',
      },
      {
        name: 'Interior Design Package',
        unitPrice: '350000.00',
        gstRate: '18.00',
        hsnCode: '998339',
      },
    ],
    pipelineName: 'Property Sales Pipeline',
    stages: [
      'Site Visit Booked',
      'Visit Done',
      'Negotiation',
      'Booking Amount',
      'Agreement',
      'Registered',
    ],
    dealNames: [
      { name: 'DLF Cyber City - 3BHK Block A', amount: '12500000' },
      { name: 'Godrej Sector 43 - 2BHK x3 Units', amount: '13500000' },
      { name: 'Prestige Office Space Deal', amount: '8500000' },
      { name: 'Brigade Villa Plot - Premium', amount: '6000000' },
      { name: 'Sobha Dream Acres - Bulk 5 units', amount: '22500000' },
      { name: 'Interior Package - Penthouse', amount: '750000' },
    ],
    ticketSubjects: [
      'Possession delay complaint - Tower B',
      'Parking allocation issue',
      'Maintenance charge dispute',
      'Water seepage in flat 302',
      'Registry document correction needed',
    ],
    calendarEvents: [
      'Site visit - Sector 82 Project',
      'Agreement signing - Mr. Kapoor',
      'Broker meet & greet lunch',
      'RERA compliance review',
      'New project launch event',
    ],
    campaigns: [
      { name: 'Festive Season 2025 - Home Offers', channel: 'email', campaignType: 'PROMOTIONAL' },
      {
        name: 'WhatsApp - New Launch Alert Sector 82',
        channel: 'whatsapp',
        campaignType: 'BROADCAST',
      },
      { name: 'Broker Referral Program Q2', channel: 'sms', campaignType: 'NURTURE' },
    ],
    hrDepts: ['Sales', 'Marketing', 'Legal', 'Construction', 'Finance'],
    projectNames: ['Sector 82 Township Phase 2', 'CRM Migration Project'],
  },

  // ── 2. SpiceCraft Restaurants ──
  {
    name: 'SpiceCraft Restaurants',
    slug: 'spicecraft-restaurants',
    domain: 'spicecraftindia.com',
    email: 'admin@spicecraftindia.com',
    industry: 'Restaurant & F&B',
    phone: '+91 9811002002',
    brandColor: 'DC2626',
    hubs: {
      crm: true,
      sales: false,
      inbox: true,
      marketing: true,
      service: true,
      projects: false,
      commerce: true,
      hr: true,
      finance: true,
      inventory: true,
      analytics: true,
      automation: false,
      calendar: true,
    },
    companies: [
      { name: 'Swiggy Partner', industry: 'Food Delivery', employees: 10000, domain: 'swiggy.com' },
      { name: 'Zomato Partner', industry: 'Food Delivery', employees: 8000, domain: 'zomato.com' },
      {
        name: 'ITC Hotels Catering',
        industry: 'Hospitality',
        employees: 30000,
        domain: 'itchotels.in',
      },
      {
        name: 'Big Basket Fresh Supply',
        industry: 'Grocery',
        employees: 12000,
        domain: 'bigbasket.com',
      },
    ],
    products: [
      {
        name: 'Biryani Family Pack (serves 4)',
        unitPrice: '799.00',
        gstRate: '5.00',
        hsnCode: '2106',
      },
      { name: 'Butter Chicken Thali', unitPrice: '349.00', gstRate: '5.00', hsnCode: '2106' },
      {
        name: 'Party Catering - 50 pax',
        unitPrice: '25000.00',
        gstRate: '18.00',
        hsnCode: '996331',
      },
      {
        name: 'Corporate Lunch Box (Monthly 30)',
        unitPrice: '4500.00',
        gstRate: '5.00',
        hsnCode: '2106',
      },
      { name: 'Premium Dessert Platter', unitPrice: '599.00', gstRate: '5.00', hsnCode: '2106' },
    ],
    pipelineName: null,
    stages: [],
    dealNames: [],
    ticketSubjects: [
      'Food quality complaint - Order #4521',
      'Delivery late by 45 mins',
      'Wrong order received',
      'Hygiene concern at outlet',
      'Catering booking cancellation request',
    ],
    calendarEvents: [
      'New menu tasting - Chef team',
      'Swiggy partner review meeting',
      'Health inspection prep',
      'Staff training - food safety',
      'Weekend special menu planning',
    ],
    campaigns: [
      {
        name: 'Weekend Special - 20% Off Biryanis',
        channel: 'whatsapp',
        campaignType: 'PROMOTIONAL',
      },
      { name: 'Festival Menu Launch', channel: 'sms', campaignType: 'BROADCAST' },
      { name: 'Corporate Lunch Tie-ups', channel: 'email', campaignType: 'NURTURE' },
    ],
    hrDepts: ['Kitchen', 'Service Staff', 'Delivery', 'Management', 'Procurement'],
    projectNames: [],
    inventoryItems: [
      { name: 'Basmati Rice (25kg)', sku: 'SC-RAW-001', qty: 50, unit: 'bag' },
      { name: 'Chicken Breast (1kg)', sku: 'SC-RAW-002', qty: 200, unit: 'kg' },
      { name: 'Cooking Oil (15L)', sku: 'SC-RAW-003', qty: 30, unit: 'can' },
      { name: 'Spice Mix - Biryani', sku: 'SC-RAW-004', qty: 100, unit: 'pack' },
      { name: 'Takeaway Containers (500ml)', sku: 'SC-PKG-001', qty: 5000, unit: 'piece' },
    ],
  },

  // ── 3. EduPrime Academy ──
  {
    name: 'EduPrime Academy',
    slug: 'eduprime-academy',
    domain: 'eduprimeacademy.in',
    email: 'admin@eduprimeacademy.in',
    industry: 'Education',
    phone: '+91 9811003003',
    brandColor: '7C3AED',
    hubs: {
      crm: true,
      sales: true,
      inbox: true,
      marketing: true,
      service: true,
      projects: true,
      commerce: true,
      hr: true,
      finance: true,
      inventory: false,
      analytics: true,
      automation: true,
      calendar: true,
    },
    companies: [
      { name: "Byju's Learning", industry: 'EdTech', employees: 50000, domain: 'byjus.com' },
      { name: 'Unacademy', industry: 'EdTech', employees: 5000, domain: 'unacademy.com' },
      { name: 'Vedantu Online', industry: 'EdTech', employees: 3000, domain: 'vedantu.com' },
      {
        name: 'Allen Career Institute',
        industry: 'Coaching',
        employees: 8000,
        domain: 'allen.ac.in',
      },
      { name: 'FIITJEE', industry: 'Coaching', employees: 4000, domain: 'fiitjee.com' },
    ],
    products: [
      {
        name: 'JEE Advanced Batch (1 Year)',
        unitPrice: '125000.00',
        gstRate: '18.00',
        hsnCode: '999293',
      },
      {
        name: 'NEET Crash Course (6 Months)',
        unitPrice: '65000.00',
        gstRate: '18.00',
        hsnCode: '999293',
      },
      {
        name: 'Foundation Course Class 9-10',
        unitPrice: '45000.00',
        gstRate: '18.00',
        hsnCode: '999293',
      },
      {
        name: 'Online Test Series (100 tests)',
        unitPrice: '5999.00',
        gstRate: '18.00',
        hsnCode: '999293',
      },
      { name: 'Study Material Kit', unitPrice: '3500.00', gstRate: '12.00', hsnCode: '4901' },
    ],
    pipelineName: 'Student Enrollment Pipeline',
    stages: ['Enquiry', 'Demo Class', 'Counselling', 'Fee Discussion', 'Enrolled', 'Dropped'],
    dealNames: [
      { name: 'JEE Batch 2026 - Group (15 students)', amount: '1875000' },
      { name: 'NEET Crash Course - Walk-in enrollments', amount: '650000' },
      { name: 'School Partnership - Allen Tie-up', amount: '500000' },
      { name: 'Online Test Series - B2B License', amount: '120000' },
      { name: 'Foundation Batch - Early Bird x20', amount: '810000' },
    ],
    ticketSubjects: [
      'Fee refund request - Course withdrawal',
      'Doubt session not scheduled',
      'Online portal login issue',
      'Study material not received',
      'Faculty feedback - Physics batch',
    ],
    calendarEvents: [
      'Parent-teacher meeting - JEE batch',
      'Monthly test - NEET students',
      'Faculty training workshop',
      'Open house event for new admissions',
      'Annual day celebration planning',
    ],
    campaigns: [
      { name: 'Early Bird Admission 2026', channel: 'email', campaignType: 'PROMOTIONAL' },
      { name: 'Free Demo Class - WhatsApp Blast', channel: 'whatsapp', campaignType: 'BROADCAST' },
      { name: 'Result Announcement Campaign', channel: 'sms', campaignType: 'BROADCAST' },
    ],
    hrDepts: [
      'Faculty - Science',
      'Faculty - Maths',
      'Administration',
      'Counselling',
      'IT Support',
    ],
    projectNames: ['Online Learning Platform v2', 'New Campus Indore Setup'],
  },

  // ── 4. LegalEdge Associates ──
  {
    name: 'LegalEdge Associates',
    slug: 'legaledge-associates',
    domain: 'legaledgelaw.in',
    email: 'admin@legaledgelaw.in',
    industry: 'Legal Services',
    phone: '+91 9811004004',
    brandColor: '0F766E',
    hubs: {
      crm: true,
      sales: true,
      inbox: true,
      marketing: false,
      service: true,
      projects: true,
      commerce: true,
      hr: true,
      finance: true,
      inventory: false,
      analytics: true,
      automation: false,
      calendar: true,
    },
    companies: [
      {
        name: 'Tata Legal Division',
        industry: 'Conglomerate',
        employees: 350000,
        domain: 'tata.com',
      },
      { name: 'Infosys Legal', industry: 'IT Services', employees: 300000, domain: 'infosys.com' },
      { name: 'HDFC Bank Legal', industry: 'Banking', employees: 120000, domain: 'hdfcbank.com' },
      {
        name: 'Reliance Industries',
        industry: 'Conglomerate',
        employees: 250000,
        domain: 'ril.com',
      },
    ],
    products: [
      {
        name: 'Corporate Legal Retainer (Monthly)',
        unitPrice: '75000.00',
        gstRate: '18.00',
        hsnCode: '998211',
      },
      {
        name: 'Trademark Registration',
        unitPrice: '15000.00',
        gstRate: '18.00',
        hsnCode: '998211',
      },
      {
        name: 'NCLT Case Filing + Representation',
        unitPrice: '250000.00',
        gstRate: '18.00',
        hsnCode: '998211',
      },
      {
        name: 'Contract Drafting & Review',
        unitPrice: '25000.00',
        gstRate: '18.00',
        hsnCode: '998211',
      },
      { name: 'Due Diligence Report', unitPrice: '150000.00', gstRate: '18.00', hsnCode: '998211' },
    ],
    pipelineName: 'Legal Case Pipeline',
    stages: ['Consultation', 'Engagement Letter', 'Discovery', 'Filing', 'Hearing', 'Resolved'],
    dealNames: [
      { name: 'Tata - Annual Retainer 2025-26', amount: '900000' },
      { name: 'Infosys - IP Dispute Representation', amount: '500000' },
      { name: 'HDFC - Regulatory Compliance Package', amount: '350000' },
      { name: 'Reliance - M&A Due Diligence', amount: '1500000' },
      { name: 'Startup Bundle - 5 Trademark Filings', amount: '75000' },
    ],
    ticketSubjects: [
      'Hearing date rescheduled - Case #LC-2025-042',
      'Document notarization delay',
      'Client requesting case status update',
      'Opposing counsel deadline response',
      'Court filing fee reimbursement',
    ],
    calendarEvents: [
      'Court hearing - Tata IP case',
      'Client consultation - New engagement',
      'Partner meeting - Quarterly review',
      'Bar council compliance deadline',
      'Team knowledge sharing - New regulations',
    ],
    campaigns: [],
    hrDepts: ['Senior Partners', 'Associates', 'Paralegals', 'Administration', 'Finance'],
    projectNames: ['Tata M&A Due Diligence', 'Office Digitization Project'],
  },

  // ── 5. FitZone India ──
  {
    name: 'FitZone India',
    slug: 'fitzone-india',
    domain: 'fitzoneindia.com',
    email: 'admin@fitzoneindia.com',
    industry: 'Gym & Fitness',
    phone: '+91 9811005005',
    brandColor: 'EA580C',
    hubs: {
      crm: true,
      sales: true,
      inbox: true,
      marketing: true,
      service: true,
      projects: false,
      commerce: true,
      hr: true,
      finance: true,
      inventory: true,
      analytics: true,
      automation: true,
      calendar: true,
    },
    companies: [
      {
        name: 'Decathlon Sports',
        industry: 'Sports Retail',
        employees: 15000,
        domain: 'decathlon.in',
      },
      {
        name: 'MuscleBlaze Nutrition',
        industry: 'Supplements',
        employees: 500,
        domain: 'muscleblaze.com',
      },
      { name: 'Cult.fit Corporate', industry: 'Fitness', employees: 5000, domain: 'cult.fit' },
      { name: 'Fitbit India', industry: 'Wearables', employees: 2000, domain: 'fitbit.com' },
    ],
    products: [
      { name: 'Annual Gym Membership', unitPrice: '24999.00', gstRate: '18.00', hsnCode: '999692' },
      {
        name: '6-Month Personal Training (3x/week)',
        unitPrice: '60000.00',
        gstRate: '18.00',
        hsnCode: '999692',
      },
      {
        name: 'Group Yoga Class Pass (30 sessions)',
        unitPrice: '4999.00',
        gstRate: '18.00',
        hsnCode: '999692',
      },
      {
        name: 'Diet & Nutrition Plan (3 months)',
        unitPrice: '8999.00',
        gstRate: '18.00',
        hsnCode: '999692',
      },
      {
        name: 'CrossFit Bootcamp (1 month)',
        unitPrice: '3999.00',
        gstRate: '18.00',
        hsnCode: '999692',
      },
    ],
    pipelineName: 'Membership Sales Pipeline',
    stages: [
      'Walk-in / Inquiry',
      'Trial Session',
      'Follow-up Call',
      'Price Quoted',
      'Enrolled',
      'Lapsed',
    ],
    dealNames: [
      { name: 'Decathlon Corporate Tie-up (50 members)', amount: '1250000' },
      { name: 'Cult.fit Co-branding Partnership', amount: '500000' },
      { name: 'MuscleBlaze Supplement Corner', amount: '180000' },
      { name: 'Bulk Annual Memberships - Q3 Drive', amount: '750000' },
      { name: 'PT Upsell Campaign - Existing Members', amount: '360000' },
    ],
    ticketSubjects: [
      'AC not working in cardio area',
      'Membership freeze request - Medical',
      'Locker key lost - Member #FZ1042',
      'Personal trainer complaint',
      'Equipment maintenance request - Treadmill #7',
    ],
    calendarEvents: [
      'New batch - Morning yoga 6 AM',
      'CrossFit competition - Internal',
      'Supplement expo at lobby',
      'Trainer certification workshop',
      'Monthly body composition check camp',
    ],
    campaigns: [
      {
        name: 'New Year New You - 40% Off Memberships',
        channel: 'whatsapp',
        campaignType: 'PROMOTIONAL',
      },
      { name: 'Refer a Friend - Earn 1 Month Free', channel: 'sms', campaignType: 'NURTURE' },
      { name: 'Corporate Wellness Program Mailer', channel: 'email', campaignType: 'NURTURE' },
    ],
    hrDepts: ['Trainers', 'Front Desk', 'Housekeeping', 'Management', 'Nutrition'],
    projectNames: [],
    inventoryItems: [
      { name: 'Whey Protein (2kg tub)', sku: 'FZ-SUP-001', qty: 100, unit: 'tub' },
      { name: 'Resistance Bands Set', sku: 'FZ-EQP-001', qty: 50, unit: 'set' },
      { name: 'Yoga Mat (6mm)', sku: 'FZ-EQP-002', qty: 80, unit: 'piece' },
      { name: 'Gym Towel (branded)', sku: 'FZ-MRC-001', qty: 200, unit: 'piece' },
      { name: 'Protein Bar Box (12 bars)', sku: 'FZ-SUP-002', qty: 150, unit: 'box' },
    ],
  },

  // ── 6. PixelWave Digital ──
  {
    name: 'PixelWave Digital',
    slug: 'pixelwave-digital',
    domain: 'pixelwave.agency',
    email: 'admin@pixelwave.agency',
    industry: 'Digital Agency',
    phone: '+91 9811006006',
    brandColor: 'DB2777',
    hubs: {
      crm: true,
      sales: true,
      inbox: true,
      marketing: true,
      service: true,
      projects: true,
      commerce: true,
      hr: true,
      finance: true,
      inventory: false,
      analytics: true,
      automation: true,
      calendar: true,
    },
    companies: [
      {
        name: 'Flipkart Marketplace',
        industry: 'E-Commerce',
        employees: 40000,
        domain: 'flipkart.com',
      },
      { name: 'PhonePe Payments', industry: 'FinTech', employees: 8000, domain: 'phonepe.com' },
      {
        name: 'Boat Lifestyle',
        industry: 'Consumer Electronics',
        employees: 3000,
        domain: 'boat-lifestyle.com',
      },
      {
        name: 'Sugar Cosmetics',
        industry: 'Beauty',
        employees: 1500,
        domain: 'sugarcosmetics.com',
      },
      { name: 'Lenskart', industry: 'Eyewear', employees: 10000, domain: 'lenskart.com' },
    ],
    products: [
      {
        name: 'Website Design & Development',
        unitPrice: '250000.00',
        gstRate: '18.00',
        hsnCode: '998314',
      },
      {
        name: 'Social Media Management (Monthly)',
        unitPrice: '45000.00',
        gstRate: '18.00',
        hsnCode: '998361',
      },
      {
        name: 'SEO Package (6 months)',
        unitPrice: '120000.00',
        gstRate: '18.00',
        hsnCode: '998361',
      },
      {
        name: 'Performance Marketing Retainer',
        unitPrice: '80000.00',
        gstRate: '18.00',
        hsnCode: '998361',
      },
      {
        name: 'Brand Identity Package',
        unitPrice: '175000.00',
        gstRate: '18.00',
        hsnCode: '998391',
      },
      {
        name: 'Video Production (per video)',
        unitPrice: '35000.00',
        gstRate: '18.00',
        hsnCode: '999612',
      },
    ],
    pipelineName: 'Agency Sales Pipeline',
    stages: [
      'Inbound Lead',
      'Discovery Call',
      'Proposal Sent',
      'Scope Finalized',
      'Contract Signed',
      'Lost',
    ],
    dealNames: [
      { name: 'Flipkart - Annual Digital Retainer', amount: '2400000' },
      { name: 'PhonePe - App Launch Campaign', amount: '800000' },
      { name: 'Boat - Influencer Marketing Q3', amount: '500000' },
      { name: 'Sugar - Brand Refresh + Website', amount: '425000' },
      { name: 'Lenskart - Performance Marketing', amount: '960000' },
      { name: 'New D2C Client - Full Stack Package', amount: '650000' },
    ],
    ticketSubjects: [
      'Website downtime - Flipkart microsite',
      'Social post approval pending 3 days',
      'SEO ranking dropped for target keywords',
      'Invoice payment delayed - Boat',
      'Creative revision request #4 - Sugar',
    ],
    calendarEvents: [
      'Campaign kickoff - PhonePe',
      'Weekly standup - Creative team',
      'Client presentation - Flipkart Q3 results',
      'Portfolio photoshoot',
      'Team outing - Friday',
    ],
    campaigns: [
      { name: 'Agency Showcase - Portfolio Email', channel: 'email', campaignType: 'BROADCAST' },
      { name: 'Case Study Drop - WhatsApp Leads', channel: 'whatsapp', campaignType: 'NURTURE' },
      { name: 'Diwali Creative Offers', channel: 'email', campaignType: 'PROMOTIONAL' },
    ],
    hrDepts: ['Design', 'Development', 'Marketing', 'Content', 'Account Management', 'Finance'],
    projectNames: [
      'Flipkart Festive Microsite',
      'PhonePe App Campaign',
      'Internal Website Redesign',
    ],
  },

  // ── 7. AutoPrime Motors ──
  {
    name: 'AutoPrime Motors',
    slug: 'autoprime-motors',
    domain: 'autoprimemotors.in',
    email: 'admin@autoprimemotors.in',
    industry: 'Auto Dealer',
    phone: '+91 9811007007',
    brandColor: '0369A1',
    hubs: {
      crm: true,
      sales: true,
      inbox: true,
      marketing: true,
      service: true,
      projects: false,
      commerce: true,
      hr: true,
      finance: true,
      inventory: true,
      analytics: true,
      automation: true,
      calendar: true,
    },
    companies: [
      {
        name: 'Maruti Suzuki India',
        industry: 'Automobile',
        employees: 40000,
        domain: 'marutisuzuki.com',
      },
      {
        name: 'Hyundai Motor India',
        industry: 'Automobile',
        employees: 15000,
        domain: 'hyundai.co.in',
      },
      { name: 'Tata Motors', industry: 'Automobile', employees: 80000, domain: 'tatamotors.com' },
      {
        name: 'ICICI Bank Auto Loans',
        industry: 'Banking',
        employees: 100000,
        domain: 'icicibank.com',
      },
      {
        name: 'HDFC Ergo Insurance',
        industry: 'Insurance',
        employees: 8000,
        domain: 'hdfcergo.com',
      },
    ],
    products: [
      {
        name: 'Maruti Swift LXi (Ex-showroom)',
        unitPrice: '649000.00',
        gstRate: '28.00',
        hsnCode: '8703',
      },
      {
        name: 'Hyundai Creta SX(O) (Ex-showroom)',
        unitPrice: '1599000.00',
        gstRate: '28.00',
        hsnCode: '8703',
      },
      {
        name: 'Tata Nexon EV Max (Ex-showroom)',
        unitPrice: '1899000.00',
        gstRate: '28.00',
        hsnCode: '8703',
      },
      {
        name: 'Extended Warranty - 3 Year',
        unitPrice: '18999.00',
        gstRate: '18.00',
        hsnCode: '997159',
      },
      { name: 'Car Accessories Package', unitPrice: '25000.00', gstRate: '28.00', hsnCode: '8708' },
      {
        name: 'Annual Maintenance Contract',
        unitPrice: '12000.00',
        gstRate: '18.00',
        hsnCode: '998714',
      },
    ],
    pipelineName: 'Vehicle Sales Pipeline',
    stages: ['Showroom Visit', 'Test Drive', 'Finance Application', 'Booking', 'Delivery', 'Lost'],
    dealNames: [
      { name: 'Fleet Deal - Maruti Swift x10', amount: '6490000' },
      { name: 'Creta SX(O) - Premium Delivery', amount: '1599000' },
      { name: 'Nexon EV Corporate Lease', amount: '3798000' },
      { name: 'ICICI Auto Loan Tie-up Commission', amount: '250000' },
      { name: 'Accessories + AMC Bundle Upsell', amount: '185000' },
      { name: 'Insurance Renewal Drive - HDFC Ergo', amount: '320000' },
    ],
    ticketSubjects: [
      'Service appointment reschedule',
      'Paint issue in newly delivered car',
      'Insurance claim assistance needed',
      'Spare parts availability inquiry',
      'Free service coupon not applied',
    ],
    calendarEvents: [
      'Test drive - Nexon EV prospect',
      'Vehicle delivery ceremony - Mr. Jain',
      'Service camp - Oil change special',
      'Maruti regional dealer meet',
      'Staff product training - New models',
    ],
    campaigns: [
      { name: 'Year-end Clearance Sale', channel: 'whatsapp', campaignType: 'PROMOTIONAL' },
      { name: 'EV Test Drive Weekend', channel: 'sms', campaignType: 'EVENT' },
      { name: 'Service Reminder - 6 Month Due', channel: 'email', campaignType: 'REENGAGEMENT' },
    ],
    hrDepts: ['Showroom Sales', 'Service Center', 'Finance & Insurance', 'Admin', 'Drivers'],
    projectNames: [],
    inventoryItems: [
      { name: 'Maruti Swift LXi (White)', sku: 'AP-VEH-001', qty: 5, unit: 'unit' },
      { name: 'Hyundai Creta SX(O) (Blue)', sku: 'AP-VEH-002', qty: 3, unit: 'unit' },
      { name: 'Tata Nexon EV Max (Grey)', sku: 'AP-VEH-003', qty: 2, unit: 'unit' },
      { name: 'Floor Mats Universal Set', sku: 'AP-ACC-001', qty: 50, unit: 'set' },
      { name: 'Car Cover (Premium)', sku: 'AP-ACC-002', qty: 30, unit: 'piece' },
    ],
  },

  // ── 8. TaxShield Advisors ──
  {
    name: 'TaxShield Advisors',
    slug: 'taxshield-advisors',
    domain: 'taxshieldca.in',
    email: 'admin@taxshieldca.in',
    industry: 'Chartered Accountancy',
    phone: '+91 9811008008',
    brandColor: '4338CA',
    hubs: {
      crm: true,
      sales: true,
      inbox: true,
      marketing: false,
      service: true,
      projects: true,
      commerce: true,
      hr: true,
      finance: true,
      inventory: false,
      analytics: true,
      automation: false,
      calendar: true,
    },
    companies: [
      {
        name: 'Ola Electric',
        industry: 'EV Manufacturing',
        employees: 10000,
        domain: 'olaelectric.com',
      },
      { name: 'Meesho', industry: 'E-Commerce', employees: 3000, domain: 'meesho.com' },
      { name: 'Licious Foods', industry: 'D2C Food', employees: 5000, domain: 'licious.in' },
      { name: 'Zerodha Broking', industry: 'FinTech', employees: 1500, domain: 'zerodha.com' },
      {
        name: 'Urban Company',
        industry: 'Home Services',
        employees: 4000,
        domain: 'urbancompany.com',
      },
    ],
    products: [
      {
        name: 'GST Return Filing (Monthly)',
        unitPrice: '5000.00',
        gstRate: '18.00',
        hsnCode: '998221',
      },
      {
        name: 'Annual Audit & Compliance',
        unitPrice: '75000.00',
        gstRate: '18.00',
        hsnCode: '998221',
      },
      {
        name: 'Company Incorporation Package',
        unitPrice: '15000.00',
        gstRate: '18.00',
        hsnCode: '998221',
      },
      {
        name: 'Tax Planning & Advisory (Annual)',
        unitPrice: '50000.00',
        gstRate: '18.00',
        hsnCode: '998221',
      },
      {
        name: 'Payroll Processing (per month per emp)',
        unitPrice: '200.00',
        gstRate: '18.00',
        hsnCode: '998221',
      },
      {
        name: 'Transfer Pricing Documentation',
        unitPrice: '200000.00',
        gstRate: '18.00',
        hsnCode: '998221',
      },
    ],
    pipelineName: 'Client Engagement Pipeline',
    stages: [
      'Initial Consultation',
      'Proposal Sent',
      'Scope Agreement',
      'Engagement Letter',
      'Active Client',
      'Churned',
    ],
    dealNames: [
      { name: 'Ola Electric - Annual Audit + GST', amount: '500000' },
      { name: 'Meesho - Incorporation + Compliance', amount: '250000' },
      { name: 'Licious - Transfer Pricing', amount: '200000' },
      { name: 'Zerodha - Tax Advisory Annual', amount: '150000' },
      { name: 'Urban Company - Payroll 200 Employees', amount: '480000' },
    ],
    ticketSubjects: [
      'GST return filing deadline approaching',
      'TDS mismatch in Q3 returns',
      'ROC annual filing reminder',
      'Client requesting audit report copy',
      'Advance tax calculation dispute',
    ],
    calendarEvents: [
      'GST filing deadline - 20th',
      'Audit planning meeting - Ola Electric',
      'ICAI seminar attendance',
      'Tax filing deadline - ITR',
      'Partner review meeting',
    ],
    campaigns: [],
    hrDepts: ['Audit', 'Tax Advisory', 'GST Compliance', 'Company Law', 'Admin'],
    projectNames: ['Ola Electric FY25 Audit', 'Meesho Compliance Setup'],
  },
];

// ==================== USERS PER INDUSTRY ====================

const INDIAN_NAMES = {
  firstNames: ['Rajesh', 'Priya', 'Arjun', 'Sneha', 'Vikram', 'Anita', 'Sanjay'],
  lastNames: ['Kumar', 'Sharma', 'Mehta', 'Patel', 'Singh', 'Joshi', 'Gupta'],
};

function getUsersForTenant(config) {
  const d = config.domain;
  return [
    {
      email: `admin@${d}`,
      firstName: INDIAN_NAMES.firstNames[0],
      lastName: INDIAN_NAMES.lastNames[0],
      role: 'Admin',
      jobTitle: 'CEO & Founder',
    },
    {
      email: `sales1@${d}`,
      firstName: INDIAN_NAMES.firstNames[1],
      lastName: INDIAN_NAMES.lastNames[1],
      role: 'Sales Representative',
      jobTitle: 'Senior Sales Manager',
    },
    {
      email: `sales2@${d}`,
      firstName: INDIAN_NAMES.firstNames[2],
      lastName: INDIAN_NAMES.lastNames[2],
      role: 'Sales Representative',
      jobTitle: 'Account Executive',
    },
    {
      email: `support@${d}`,
      firstName: INDIAN_NAMES.firstNames[3],
      lastName: INDIAN_NAMES.lastNames[3],
      role: 'Support Agent',
      jobTitle: 'Customer Success Manager',
    },
    {
      email: `marketing@${d}`,
      firstName: INDIAN_NAMES.firstNames[4],
      lastName: INDIAN_NAMES.lastNames[4],
      role: 'Marketing Manager',
      jobTitle: 'Head of Marketing',
    },
    {
      email: `hr@${d}`,
      firstName: INDIAN_NAMES.firstNames[5],
      lastName: INDIAN_NAMES.lastNames[5],
      role: 'Admin',
      jobTitle: 'HR Manager',
    },
    {
      email: `finance@${d}`,
      firstName: INDIAN_NAMES.firstNames[6],
      lastName: INDIAN_NAMES.lastNames[6],
      role: 'Admin',
      jobTitle: 'Finance Controller',
    },
  ];
}

// ==================== CONTACT NAME POOLS ====================

const FIRST_NAMES = [
  'Amit',
  'Priya',
  'Rahul',
  'Sunita',
  'Vikram',
  'Deepa',
  'Rohit',
  'Kavita',
  'Manoj',
  'Rekha',
  'Arun',
  'Meena',
  'Nitin',
  'Swati',
  'Karan',
];
const LAST_NAMES = [
  'Sharma',
  'Patel',
  'Gupta',
  'Singh',
  'Kumar',
  'Verma',
  'Agarwal',
  'Joshi',
  'Mehta',
  'Shah',
  'Nair',
  'Reddy',
  'Iyer',
  'Pillai',
  'Das',
];
const TITLES = [
  'Director',
  'VP',
  'Head of Operations',
  'CFO',
  'CTO',
  'Manager',
  'Founder',
  'MD',
  'GM',
  'Procurement Head',
];

// ==================== CONVERSATION TEMPLATES PER INDUSTRY ====================

// Each industry gets 3 WhatsApp, 2 SMS, 2 Email conversations with realistic messages
const CONVERSATION_TEMPLATES = {
  'Real Estate': {
    whatsapp: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        messages: [
          {
            dir: 'INBOUND',
            text: 'Hi, I saw your ad for 3BHK in Sector 82. Is it still available?',
            ago: 48,
          },
          {
            dir: 'OUTBOUND',
            text: 'Yes sir! We have 3BHK units starting at ₹45 lakhs. Would you like to schedule a site visit?',
            ago: 47,
          },
          { dir: 'INBOUND', text: 'What is the carpet area? And does it have a balcony?', ago: 46 },
          {
            dir: 'OUTBOUND',
            text: 'Carpet area is 1150 sqft with 2 balconies. I can share the floor plan. When would you like to visit?',
            ago: 45,
          },
          { dir: 'INBOUND', text: 'This Saturday works. Morning slot please', ago: 24 },
          {
            dir: 'OUTBOUND',
            text: "Done! Saturday 10:30 AM. I'll send location pin. Ask for Rahul at the site office 🏠",
            ago: 23,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'MEDIUM',
        purpose: 'SUPPORT',
        messages: [
          {
            dir: 'INBOUND',
            text: 'My possession was supposed to be in December but no update yet',
            ago: 120,
          },
          {
            dir: 'OUTBOUND',
            text: 'Apologies for the delay. Let me check with the project team. Which tower and flat number?',
            ago: 119,
          },
          { dir: 'INBOUND', text: 'Tower B, Flat 1204', ago: 118 },
          {
            dir: 'OUTBOUND',
            text: "Tower B is 95% complete. OC expected by end of January. We'll share the exact date within 48 hours.",
            ago: 96,
          },
          {
            dir: 'OUTBOUND',
            text: 'Update: Your possession date is confirmed for Feb 15. Registry will be scheduled the same week.',
            ago: 72,
          },
          { dir: 'INBOUND', text: 'Thank you for the update 👍', ago: 71 },
        ],
      },
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        messages: [
          {
            dir: 'INBOUND',
            text: 'I want to invest in commercial property. What options do you have?',
            ago: 12,
          },
          {
            dir: 'OUTBOUND',
            text: 'We have office spaces in Golf Course Road starting at ₹85L for 1000 sqft. Pre-leased options also available with 7% yield.',
            ago: 11,
          },
          {
            dir: 'INBOUND',
            text: 'Pre-leased sounds interesting. Can you share details?',
            ago: 10,
          },
        ],
      },
    ],
    sms: [
      {
        status: 'RESOLVED',
        priority: 'LOW',
        purpose: 'MARKETING',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'PrimeView Realty: Festive offer! Book a 2BHK at ₹45L with 0% GST benefit. Visit our Sector 82 site. Call 9811001001',
            ago: 72,
          },
          { dir: 'INBOUND', text: 'INTERESTED', ago: 70 },
          {
            dir: 'OUTBOUND',
            text: 'Thanks for your interest! Our team will call you within 2 hours to schedule a site visit.',
            ago: 69,
          },
        ],
      },
      {
        status: 'OPEN',
        priority: 'MEDIUM',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'Reminder: Your maintenance payment of ₹8,500 is due on 25th Feb. Pay via UPI to primeview@ybl',
            ago: 48,
          },
          { dir: 'INBOUND', text: 'Paid', ago: 24 },
        ],
      },
    ],
    email: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        subject: 'Investment Opportunity - Pre-leased Office Space',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'Dear Mr. Kapoor,\n\nThank you for your interest in our commercial properties. Attached is the brochure for our pre-leased office spaces on Golf Course Road.\n\nKey highlights:\n- 7% assured rental yield\n- 10-year lease with MNC tenant\n- RERA registered\n\nShall we arrange a site visit this week?\n\nBest regards,\nPrimeView Realty',
            ago: 24,
          },
          {
            dir: 'INBOUND',
            text: 'Thanks for the brochure. The yield looks good. Can you share the lease agreement copy and tenant details? Also what is the maintenance charge per sqft?',
            ago: 20,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'MEDIUM',
        purpose: 'SUPPORT',
        subject: 'Re: Registry Document Correction',
        messages: [
          {
            dir: 'INBOUND',
            text: 'Hi,\n\nThere is a spelling error in my registry document. My name is spelled as "Sharma" but it should be "Sharman". Please correct this urgently.',
            ago: 168,
          },
          {
            dir: 'OUTBOUND',
            text: 'We apologize for the error. We have initiated the correction process with the sub-registrar office. Expected timeline is 2-3 weeks. We will keep you updated.',
            ago: 160,
          },
          {
            dir: 'OUTBOUND',
            text: 'Good news! The corrected registry document is ready for collection from our office. Please bring your original ID proof.',
            ago: 48,
          },
          { dir: 'INBOUND', text: 'Collected today. Thanks for the quick resolution.', ago: 24 },
        ],
      },
    ],
  },
  'Restaurant & F&B': {
    whatsapp: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'INBOUND',
            text: 'I want to book a table for 8 people this Saturday night. Do you have a private dining area?',
            ago: 6,
          },
          {
            dir: 'OUTBOUND',
            text: 'Welcome to SpiceCraft! Yes, our Maharaja Room seats up to 10. Saturday 8 PM works. Should I reserve it?',
            ago: 5,
          },
          {
            dir: 'INBOUND',
            text: "Yes please. Also can you do a customized menu? It's a birthday celebration",
            ago: 4,
          },
          {
            dir: 'OUTBOUND',
            text: 'Absolutely! Our chef can create a special birthday menu. Budget per person? And any dietary restrictions?',
            ago: 3,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'MEDIUM',
        purpose: 'SUPPORT',
        messages: [
          {
            dir: 'INBOUND',
            text: 'The biryani I ordered yesterday was too spicy 🌶️ and the naan was cold',
            ago: 36,
          },
          {
            dir: 'OUTBOUND',
            text: "We're sorry about that! We take feedback seriously. We'd like to offer you a complimentary meal. Can I share a coupon code?",
            ago: 35,
          },
          { dir: 'INBOUND', text: 'Ok sure', ago: 34 },
          {
            dir: 'OUTBOUND',
            text: "Here's your code: SORRY20 — flat 20% off on your next order + free dessert. Valid for 30 days. 🙏",
            ago: 33,
          },
          { dir: 'INBOUND', text: 'Thanks appreciate it 👍', ago: 32 },
        ],
      },
      {
        status: 'OPEN',
        priority: 'MEDIUM',
        purpose: 'SALES',
        messages: [
          {
            dir: 'INBOUND',
            text: 'Do you do corporate lunch packages? We need daily tiffin for 25 employees',
            ago: 8,
          },
          {
            dir: 'OUTBOUND',
            text: 'Yes! Our corporate plans start at ₹150/meal with rotating menu. Delivery included within 5km. Want me to share the menu card?',
            ago: 7,
          },
        ],
      },
    ],
    sms: [
      {
        status: 'RESOLVED',
        priority: 'LOW',
        purpose: 'MARKETING',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'SpiceCraft: Weekend Special! 20% OFF on all Biryanis. Order now on Zomato/Swiggy or call 9811002002. T&C apply.',
            ago: 48,
          },
        ],
      },
      {
        status: 'OPEN',
        priority: 'MEDIUM',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'Your order #SC2847 is out for delivery. Expected in 30 mins. Track: spicecraft.in/track/SC2847',
            ago: 2,
          },
          { dir: 'INBOUND', text: 'Received. But dal makhani is missing from order', ago: 1 },
        ],
      },
    ],
    email: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        subject: 'Corporate Lunch Partnership Proposal',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'Dear HR Team,\n\nThank you for your interest in our corporate meal service.\n\nAttached: Menu card + pricing for 25 pax daily delivery\n- Veg thali: ₹150/meal\n- Non-veg thali: ₹180/meal\n- Includes roti, rice, 2 sabzi, dal, raita, dessert\n\nFree trial for first 3 days!\n\nRegards,\nSpiceCraft Restaurants',
            ago: 12,
          },
          {
            dir: 'INBOUND',
            text: 'This looks good. Can you do 50% veg and 50% non-veg? Also we need Jain options for 5 people. When can you start?',
            ago: 8,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'LOW',
        purpose: 'MARKETING',
        subject: 'Diwali Catering Menu 2025',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'Dear Valued Customer,\n\nDiwali is around the corner! Order our festive catering menu:\n- Paneer tikka platter (20 pcs): ₹1200\n- Biryani (5kg): ₹2500\n- Gulab Jamun (50 pcs): ₹800\n\nOrder before Oct 20 for 10% early bird discount.\n\nWarm regards,\nSpiceCraft',
            ago: 240,
          },
          {
            dir: 'INBOUND',
            text: 'I want to order the full Diwali package for our office party. 50 people. Please call me to discuss.',
            ago: 220,
          },
        ],
      },
    ],
  },
  Education: {
    whatsapp: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        messages: [
          {
            dir: 'INBOUND',
            text: 'What are the admission requirements for Class 8? My daughter scored 85% in Class 7',
            ago: 24,
          },
          {
            dir: 'OUTBOUND',
            text: 'Welcome to EduPrime! For Class 8 admission: entrance test + interview. 85% is a great score. Registration fee is ₹2000.',
            ago: 23,
          },
          { dir: 'INBOUND', text: 'When is the next entrance test?', ago: 22 },
          {
            dir: 'OUTBOUND',
            text: 'Next batch: March 15, 2026. Register online at eduprimeacademy.in/admissions or visit our campus. Shall I book a campus tour first?',
            ago: 21,
          },
          { dir: 'INBOUND', text: 'Campus tour would be great. This Saturday?', ago: 20 },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'MEDIUM',
        purpose: 'SUPPORT',
        messages: [
          {
            dir: 'INBOUND',
            text: 'My son Arjun is absent today due to fever. Please inform class teacher - Class 5B Roll No 23',
            ago: 8,
          },
          {
            dir: 'OUTBOUND',
            text: 'Noted. Get well soon Arjun! Attendance marked. Class teacher Mrs. Gupta has been informed. 🙏',
            ago: 7,
          },
        ],
      },
      {
        status: 'OPEN',
        priority: 'MEDIUM',
        purpose: 'GENERAL',
        messages: [
          {
            dir: 'INBOUND',
            text: 'Is the school bus available for Sector 62 area? My office is nearby so I need pickup from there',
            ago: 3,
          },
          {
            dir: 'OUTBOUND',
            text: 'Yes! Route 7 covers Sector 62. Bus timing: 7:15 AM pickup, 2:30 PM drop. Monthly charge: ₹3000. Want to register?',
            ago: 2,
          },
        ],
      },
    ],
    sms: [
      {
        status: 'RESOLVED',
        priority: 'LOW',
        purpose: 'GENERAL',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'EduPrime: PTM scheduled for Feb 28. Timing: 9AM-1PM. Please bring student diary. Regards, EduPrime Academy',
            ago: 72,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'HIGH',
        purpose: 'GENERAL',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'RESULT: Arjun Mehta (Class 5B) scored 92% in Unit Test 3. Rank: 3rd. View full marksheet at eduprimeacademy.in/results',
            ago: 120,
          },
          { dir: 'INBOUND', text: 'Thank you. Proud of him!', ago: 118 },
        ],
      },
    ],
    email: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        subject: 'Admission Inquiry - Class 8 (2026-27)',
        messages: [
          {
            dir: 'INBOUND',
            text: 'Dear Admissions Team,\n\nWe are looking to admit our daughter to Class 8 for the academic year 2026-27. She is currently studying at DPS Noida.\n\nCould you share:\n1. Admission process and dates\n2. Fee structure\n3. Scholarship options\n\nRegards,\nPriya Sharma',
            ago: 48,
          },
          {
            dir: 'OUTBOUND',
            text: 'Dear Mrs. Sharma,\n\nThank you for your interest. Please find attached:\n- Admission brochure with process timeline\n- Fee structure for 2026-27\n- Scholarship criteria (merit-based: 90%+ gets 25% off)\n\nEntrance test: March 15. Registration closes March 10.\n\nWarm regards,\nEduPrime Admissions',
            ago: 36,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'MEDIUM',
        purpose: 'SUPPORT',
        subject: 'Fee Payment Receipt Not Received',
        messages: [
          {
            dir: 'INBOUND',
            text: "I paid the Q2 fees on Feb 5 via UPI but haven't received the receipt yet. Transaction ID: UPI-28374652",
            ago: 96,
          },
          {
            dir: 'OUTBOUND',
            text: 'We found the payment. Receipt has been emailed and also added to the parent portal. Apologies for the delay in processing.',
            ago: 72,
          },
        ],
      },
    ],
  },
  'Legal Services': {
    whatsapp: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        messages: [
          {
            dir: 'INBOUND',
            text: 'I need help with a property dispute. My neighbour is encroaching on my land. Have land records as proof.',
            ago: 12,
          },
          {
            dir: 'OUTBOUND',
            text: 'Thank you for reaching out to LegalEdge. Property disputes are our speciality. Can you share the survey number and district?',
            ago: 11,
          },
          {
            dir: 'INBOUND',
            text: 'Survey No 123/4, Bangalore Urban district. I have the sale deed and mutation records.',
            ago: 10,
          },
          {
            dir: 'OUTBOUND',
            text: 'Good that you have documentation. Consultation fee is ₹2000 for first session (60 min). Shall I schedule it this week?',
            ago: 9,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'HIGH',
        purpose: 'SUPPORT',
        messages: [
          { dir: 'INBOUND', text: 'Is my GST return filing done? Deadline is tomorrow!', ago: 36 },
          {
            dir: 'OUTBOUND',
            text: 'Yes, your GSTR-3B for January has been filed. ARN number: AA2501264837364. You can verify on the GST portal.',
            ago: 35,
          },
          {
            dir: 'INBOUND',
            text: 'Thank you. Please also remind me about the next deadline.',
            ago: 34,
          },
          {
            dir: 'OUTBOUND',
            text: "Noted! GSTR-1 due date: March 11. We'll send reminder 3 days before. 👍",
            ago: 33,
          },
        ],
      },
      {
        status: 'PENDING',
        priority: 'MEDIUM',
        purpose: 'GENERAL',
        messages: [
          {
            dir: 'INBOUND',
            text: 'I need a rental agreement drafted. 2 year lease, ₹25000 monthly rent, 2 months security deposit.',
            ago: 72,
          },
          {
            dir: 'OUTBOUND',
            text: 'We can draft that. Standard rental agreement: ₹3500 + stamp duty. Need landlord and tenant Aadhaar + property address. Can you share?',
            ago: 70,
          },
        ],
      },
    ],
    sms: [
      {
        status: 'RESOLVED',
        priority: 'LOW',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'LegalEdge: Reminder - Your court hearing is scheduled for March 5 at 10:30 AM, Bangalore City Civil Court, Room 14. Carry all documents.',
            ago: 48,
          },
          { dir: 'INBOUND', text: 'Ok noted. Will be there by 10 AM', ago: 46 },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'MEDIUM',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'LegalEdge: Your trademark application TM-4728391 has been accepted. Publication in next journal. Congrats!',
            ago: 120,
          },
        ],
      },
    ],
    email: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        subject: 'Corporate Legal Retainership Inquiry',
        messages: [
          {
            dir: 'INBOUND',
            text: 'Dear LegalEdge,\n\nWe are a Series B startup looking for a corporate legal retainer to handle:\n- Employment contracts\n- IP protection\n- Investor agreements\n- ESOP documentation\n\nPlease share your retainership plans and rates.\n\nRegards,\nVikram Singh, CEO, TechVentures',
            ago: 24,
          },
          {
            dir: 'OUTBOUND',
            text: 'Dear Mr. Singh,\n\nThank you for considering LegalEdge. Our startup retainer plans:\n- Basic (₹25K/mo): Contract review + basic compliance\n- Growth (₹50K/mo): + IP, ESOP, investor docs\n- Enterprise (₹1L/mo): Dedicated partner + unlimited consultations\n\nShall we schedule a call to discuss your needs?\n\nBest,\nLegalEdge Associates',
            ago: 18,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'MEDIUM',
        purpose: 'SUPPORT',
        subject: 'Re: GST Notice - Demand Order',
        messages: [
          {
            dir: 'INBOUND',
            text: 'We received a GST demand notice for ₹3.2 lakhs. Attaching the notice. Please advise on next steps and deadline.',
            ago: 168,
          },
          {
            dir: 'OUTBOUND',
            text: 'Reviewed the notice. This is a GSTR-3B vs 2A mismatch. We can file an appeal within 90 days. Our response:\n1. Prepare reconciliation statement\n2. File appeal with supporting invoices\n3. Request personal hearing\n\nFee: ₹15,000 for complete representation.',
            ago: 144,
          },
          {
            dir: 'INBOUND',
            text: 'Please proceed. Attaching all invoices and GSTR-2A data.',
            ago: 120,
          },
        ],
      },
    ],
  },
  'Gym & Fitness': {
    whatsapp: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        messages: [
          {
            dir: 'INBOUND',
            text: "Hi, what are your membership plans? I'm looking for gym + swimming combo",
            ago: 6,
          },
          {
            dir: 'OUTBOUND',
            text: 'Hey! Welcome to FitZone 💪\nOur combos:\n- Gym + Pool: ₹3500/mo\n- Gym + Pool + Group Classes: ₹5000/mo\n- Annual (best value): ₹36,000/yr\n\nFree trial session available!',
            ago: 5,
          },
          { dir: 'INBOUND', text: 'Annual sounds good. Is there any joining fee?', ago: 4 },
          {
            dir: 'OUTBOUND',
            text: 'No joining fee this month! 🎉 Plus get a free gym bag + 2 PT sessions. Visit us anytime 6AM-10PM. Ask for Trainer Ravi.',
            ago: 3,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'MEDIUM',
        purpose: 'SUPPORT',
        messages: [
          {
            dir: 'INBOUND',
            text: "The AC in the cardio zone is not working again 😤 It's too hot to workout",
            ago: 48,
          },
          {
            dir: 'OUTBOUND',
            text: "Really sorry about that! The technician is on the way. Should be fixed within 2 hours. As a gesture, we're adding 2 extra days to your membership.",
            ago: 47,
          },
          { dir: 'INBOUND', text: 'Ok thanks', ago: 46 },
        ],
      },
      {
        status: 'OPEN',
        priority: 'MEDIUM',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'INBOUND',
            text: 'I want to add personal training to my plan. How much for 3 sessions per week?',
            ago: 2,
          },
          {
            dir: 'OUTBOUND',
            text: 'PT packages:\n- 12 sessions/mo: ₹6000\n- 20 sessions/mo: ₹9000 (most popular)\n- Unlimited: ₹12000\n\nIncludes diet plan + monthly body composition analysis!',
            ago: 1,
          },
        ],
      },
    ],
    sms: [
      {
        status: 'RESOLVED',
        priority: 'LOW',
        purpose: 'MARKETING',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'FitZone: New Year Offer! 40% OFF on annual memberships. Gym+Pool+Classes at ₹21,600/yr. Offer ends Jan 15. Call 9811005005',
            ago: 720,
          },
        ],
      },
      {
        status: 'OPEN',
        priority: 'MEDIUM',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'FitZone: Your membership expires in 5 days. Renew now and get 10% loyalty discount. Visit front desk or pay online.',
            ago: 24,
          },
          { dir: 'INBOUND', text: 'Will renew tomorrow at desk', ago: 12 },
        ],
      },
    ],
    email: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        subject: 'Corporate Wellness Program - 50 Employees',
        messages: [
          {
            dir: 'INBOUND',
            text: 'Hi FitZone,\n\nWe want to enroll 50 employees in your corporate wellness program. Please share:\n1. Corporate rates\n2. Facilities included\n3. Flexible timings for working professionals\n\nRegards,\nHR Team, TechCorp India',
            ago: 24,
          },
          {
            dir: 'OUTBOUND',
            text: 'Dear HR Team,\n\nGreat to hear from TechCorp! Our corporate plan for 50+ members:\n- ₹2000/person/month (40% off individual rate)\n- Full gym + pool + group classes\n- Dedicated morning (6-9 AM) and evening (6-9 PM) batches\n- Monthly health checkups included\n- Quarterly fitness challenges with prizes\n\nShall we arrange a facility tour?\n\nFit regards,\nFitZone India',
            ago: 18,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'LOW',
        purpose: 'GENERAL',
        subject: 'Personal Training Progress Report - January',
        messages: [
          {
            dir: 'OUTBOUND',
            text: "Hi Priya,\n\nYour January fitness report:\n- Body fat: 28% → 26% ✅\n- Weight: 68kg → 66.5kg ✅\n- Strength: Deadlift 40kg → 50kg ✅\n- Attendance: 18/20 sessions\n\nGreat progress! Let's push for 24% body fat by March.\n\nYour trainer,\nRavi",
            ago: 48,
          },
          {
            dir: 'INBOUND',
            text: "Thanks Ravi! Very motivating. Let's target 24% by March. See you Monday!",
            ago: 36,
          },
        ],
      },
    ],
  },
  'Digital Agency': {
    whatsapp: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        messages: [
          {
            dir: 'INBOUND',
            text: "We need a complete brand refresh - logo, website, social media kit. What's your timeline and budget?",
            ago: 12,
          },
          {
            dir: 'OUTBOUND',
            text: "Hi! We'd love to help. Typical brand refresh project:\n- Discovery: 1 week\n- Design: 3 weeks\n- Development: 2 weeks\n- Budget: ₹3-8L depending on scope\n\nCan we schedule a discovery call?",
            ago: 11,
          },
          {
            dir: 'INBOUND',
            text: 'We have a budget of around 5L. Can you share some past work?',
            ago: 10,
          },
          {
            dir: 'OUTBOUND',
            text: 'Absolutely! Here are 3 recent projects: pixelwave.agency/portfolio\n\n₹5L works for logo + website + basic social kit. Shall we do a 30-min Zoom call tomorrow?',
            ago: 9,
          },
        ],
      },
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SUPPORT',
        messages: [
          {
            dir: 'INBOUND',
            text: 'The PhonePe landing page is showing 404 error since morning! Can you check ASAP?',
            ago: 2,
          },
          {
            dir: 'OUTBOUND',
            text: 'On it! Checking the deployment now. Looks like the SSL certificate expired. Renewing it — should be back in 15 mins.',
            ago: 1.5,
          },
          {
            dir: 'OUTBOUND',
            text: "Fixed! ✅ Page is live now. Also set up auto-renewal for SSL so this won't happen again.",
            ago: 1,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'MEDIUM',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'INBOUND',
            text: 'Can you add a chatbot to our Flipkart microsite? Something simple for FAQ',
            ago: 72,
          },
          {
            dir: 'OUTBOUND',
            text: 'Sure! We can add a Tidio or custom chat widget. Cost: ₹15K for setup + ₹2K/month. Takes 3 days. Shall I proceed?',
            ago: 70,
          },
          { dir: 'INBOUND', text: 'Go ahead with Tidio', ago: 68 },
          {
            dir: 'OUTBOUND',
            text: 'Done! Chatbot is live on the Flipkart microsite. Test it out: flipkart-festive.pixelwave.agency 🤖',
            ago: 48,
          },
        ],
      },
    ],
    sms: [
      {
        status: 'RESOLVED',
        priority: 'LOW',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'PixelWave: Your website monthly report is ready. Traffic +23%, Conversions +15%. View: pixelwave.agency/reports/feb-2026',
            ago: 48,
          },
        ],
      },
      {
        status: 'OPEN',
        priority: 'MEDIUM',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'PixelWave: Your domain pixelwave.agency expires in 7 days. Reply YES to auto-renew or call us.',
            ago: 24,
          },
          { dir: 'INBOUND', text: 'YES', ago: 22 },
        ],
      },
    ],
    email: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        subject: 'Proposal: PhonePe App Launch Campaign',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'Dear PhonePe Team,\n\nPlease find attached our creative proposal for the App Launch Campaign:\n\n- 3 hero videos (15s, 30s, 60s)\n- 20 social media creatives\n- Landing page design + dev\n- Performance marketing setup (Google + Meta)\n\nTotal: ₹8,00,000 | Timeline: 4 weeks\n\nLooking forward to your feedback.\n\nBest,\nPixelWave Digital',
            ago: 48,
          },
          {
            dir: 'INBOUND',
            text: 'Proposal looks good. Can you add Instagram Reels content and reduce the video count to 2 (30s and 60s)? Also need Hindi + English versions.',
            ago: 36,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'MEDIUM',
        purpose: 'SUPPORT',
        subject: 'Re: Website Performance Issues - Flipkart Microsite',
        messages: [
          {
            dir: 'INBOUND',
            text: 'The Flipkart microsite is loading in 8 seconds. Our team says it should be under 3 seconds. Can you optimize?',
            ago: 96,
          },
          {
            dir: 'OUTBOUND',
            text: 'Analyzed the issue:\n1. Images not compressed (saving 4MB)\n2. No CDN configured\n3. Render-blocking JS\n\nFix deployed: Load time now 2.1s (from 8s). GTmetrix score: A.\n\nReport attached.',
            ago: 72,
          },
          {
            dir: 'INBOUND',
            text: 'Excellent work! The site feels much faster now. Thanks team!',
            ago: 48,
          },
        ],
      },
    ],
  },
  'Auto Dealer': {
    whatsapp: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        messages: [
          {
            dir: 'INBOUND',
            text: "What's the on-road price for Hyundai Creta SX(O) in Delhi?",
            ago: 8,
          },
          {
            dir: 'OUTBOUND',
            text: 'Hi! Creta SX(O) petrol on-road Delhi:\n- Ex-showroom: ₹16.15L\n- Registration: ₹1.45L\n- Insurance: ₹68K\n- Accessories: ₹35K\n- Total: ₹18.63L\n\nWe have it in White and Grey. Test drive?',
            ago: 7,
          },
          { dir: 'INBOUND', text: 'Any discount or exchange bonus?', ago: 6 },
          {
            dir: 'OUTBOUND',
            text: 'Current offers:\n- ₹25K exchange bonus\n- ₹15K corporate discount (if applicable)\n- Free 3 year AMC worth ₹18K\n\nVisit us for best deal! Ask for Sales Manager Amit.',
            ago: 5,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'MEDIUM',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'INBOUND',
            text: 'My car DL4CAF1234 is due for 2nd free service. How do I book?',
            ago: 48,
          },
          {
            dir: 'OUTBOUND',
            text: 'You can book at autoprimemotors.in/service or I can book for you. Preferred date?',
            ago: 47,
          },
          { dir: 'INBOUND', text: 'Next Monday morning please', ago: 46 },
          {
            dir: 'OUTBOUND',
            text: "Booked! Monday 9:00 AM. Service advisor: Sunil. Estimated time: 3-4 hours. We'll send pickup reminder on Sunday evening.",
            ago: 45,
          },
        ],
      },
      {
        status: 'OPEN',
        priority: 'MEDIUM',
        purpose: 'GENERAL',
        messages: [
          {
            dir: 'INBOUND',
            text: 'When is the new Tata Nexon EV launching at your showroom?',
            ago: 3,
          },
          {
            dir: 'OUTBOUND',
            text: 'Tata Nexon EV facelift expected by March end! You can pre-book with ₹21,000 token. Want me to add you to the waitlist?',
            ago: 2,
          },
        ],
      },
    ],
    sms: [
      {
        status: 'RESOLVED',
        priority: 'LOW',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'AutoPrime: Your vehicle DL4CAF1234 service is complete. Total: ₹0 (free service). Pickup anytime before 7PM.',
            ago: 24,
          },
          { dir: 'INBOUND', text: 'Coming in 30 min', ago: 23 },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'LOW',
        purpose: 'MARKETING',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'AutoPrime: Year-end Clearance! Up to ₹2L off on 2025 models. Exchange bonus ₹50K. Visit Mehrauli showroom. T&C apply.',
            ago: 720,
          },
        ],
      },
    ],
    email: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        subject: 'Fleet Purchase Inquiry - 10 Vehicles',
        messages: [
          {
            dir: 'INBOUND',
            text: 'Hi AutoPrime,\n\nWe need 10 Maruti Ertiga for our logistics fleet. Please share:\n1. Fleet discount pricing\n2. Insurance tie-up rates\n3. AMC packages\n4. Delivery timeline\n\nRegards,\nLogiTrans Pvt Ltd',
            ago: 24,
          },
          {
            dir: 'OUTBOUND',
            text: 'Dear LogiTrans Team,\n\nExcited to assist with your fleet requirement!\n\nMaruti Ertiga VXI (10 units):\n- Fleet price: ₹9.8L/unit (₹40K off ex-showroom)\n- Group insurance: ₹42K/unit (15% off individual)\n- 3-year AMC: ₹8K/unit\n- Delivery: 2-3 weeks (stock available)\n\nTotal fleet deal: ₹1.05 Cr all-inclusive\n\nShall we arrange a meeting with our fleet manager?',
            ago: 18,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'MEDIUM',
        purpose: 'SUPPORT',
        subject: 'Re: Insurance Claim Assistance - Accident',
        messages: [
          {
            dir: 'INBOUND',
            text: 'My car was hit while parked in the market. Need help filing insurance claim. Policy no: ICICI-2025-4837261',
            ago: 120,
          },
          {
            dir: 'OUTBOUND',
            text: "Sorry to hear that. We'll help with the claim process:\n1. FIR copy (if available) or self-declaration\n2. Photos of damage\n3. We'll coordinate with ICICI surveyor\n4. Estimated repair time: 5-7 days after approval\n\nPlease bring the car to our service center.",
            ago: 96,
          },
          {
            dir: 'INBOUND',
            text: 'Brought it in. Surveyor visited. Approved for ₹45K repair.',
            ago: 48,
          },
          {
            dir: 'OUTBOUND',
            text: "Great! Repair in progress. Expected completion: Friday. We'll arrange a courtesy wash before delivery. 🚗",
            ago: 36,
          },
        ],
      },
    ],
  },
  'Chartered Accountancy': {
    whatsapp: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'INBOUND',
            text: 'My ITR filing for FY 2024-25 - when can we start? I have salary + rental income + stocks',
            ago: 12,
          },
          {
            dir: 'OUTBOUND',
            text: "Hi! We can start now. For your profile (salary + rental + capital gains), you'll need:\n1. Form 16\n2. Rental income proof\n3. Capital gains statement from broker\n4. Bank statements (interest income)\n\nFee: ₹5000 for ITR-2. Shall I set up a document upload link?",
            ago: 11,
          },
          {
            dir: 'INBOUND',
            text: 'Yes please. Also I sold a flat this year - will that change the filing?',
            ago: 10,
          },
          {
            dir: 'OUTBOUND',
            text: "Yes, property sale = long-term capital gains (if held 2+ years). You can save tax under Section 54 if you reinvest. Fee becomes ₹8000 for the complex filing. I'll explain the options in our meeting.",
            ago: 9,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'HIGH',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'INBOUND',
            text: "GST notice received! They're saying ₹2.8L mismatch. Sending photo.",
            ago: 72,
          },
          {
            dir: 'OUTBOUND',
            text: "Don't worry, these are common. Usually GSTR-3B vs 2A mismatch. Send me the notice and your GSTR-2A data. We'll reconcile and respond.",
            ago: 71,
          },
          { dir: 'INBOUND', text: '[Document shared]', ago: 70 },
          {
            dir: 'OUTBOUND',
            text: "Reviewed. Found the issue — 3 invoices not reported by your supplier. We'll file a rectification. No penalty if responded within 15 days.",
            ago: 48,
          },
          {
            dir: 'OUTBOUND',
            text: 'Reply filed with GST department. Attached copy for your records. Matter should be closed within 30 days.',
            ago: 24,
          },
        ],
      },
      {
        status: 'OPEN',
        priority: 'MEDIUM',
        purpose: 'SALES',
        messages: [
          {
            dir: 'INBOUND',
            text: "I'm starting a new company - Pvt Ltd. Can you handle incorporation + GST registration?",
            ago: 4,
          },
          {
            dir: 'OUTBOUND',
            text: 'Absolutely! Our startup package:\n- Pvt Ltd incorporation: ₹8000\n- GST registration: ₹2000\n- First year compliance: ₹15000\n- Total bundle: ₹22,000 (save ₹3K)\n\nNeed DSC + DIN for directors. How many directors?',
            ago: 3,
          },
        ],
      },
    ],
    sms: [
      {
        status: 'RESOLVED',
        priority: 'HIGH',
        purpose: 'SERVICE',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'TaxShield: URGENT - Advance tax 4th installment due March 15. Your estimated payment: ₹45,000. Pay to avoid 1% interest.',
            ago: 48,
          },
          { dir: 'INBOUND', text: 'Paid via net banking. Challan no 2648371', ago: 36 },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'LOW',
        purpose: 'GENERAL',
        messages: [
          {
            dir: 'OUTBOUND',
            text: 'TaxShield: Your FY 2024-25 ITR has been filed. Acknowledgment no: ITR-V-2025-8374625. Refund of ₹12,400 expected in 30 days.',
            ago: 120,
          },
        ],
      },
    ],
    email: [
      {
        status: 'OPEN',
        priority: 'HIGH',
        purpose: 'SALES',
        subject: 'Annual Compliance Package for Startup',
        messages: [
          {
            dir: 'INBOUND',
            text: "Hi TaxShield,\n\nWe're a 2-year-old SaaS startup (Pvt Ltd). Looking for a CA firm to handle:\n- Monthly GST filing\n- TDS returns\n- ROC annual compliance\n- Audit\n- Payroll processing (12 employees)\n\nWhat's your annual package pricing?\n\nRegards,\nAnkur, Founder, CodeBridge Technologies",
            ago: 24,
          },
          {
            dir: 'OUTBOUND',
            text: "Dear Ankur,\n\nWelcome to TaxShield! For CodeBridge's profile:\n\nStartup Annual Package: ₹1,20,000/year\nIncludes:\n- Monthly GST (GSTR-1 + 3B): ✅\n- Quarterly TDS: ✅\n- ROC annual filing: ✅\n- Statutory audit: ✅\n- Payroll processing (up to 15 employees): ✅\n- Unlimited phone/WhatsApp support: ✅\n\nPayment: Monthly ₹10K or annual (save ₹10K).\n\nShall we schedule an onboarding call?\n\nBest,\nTaxShield Advisors",
            ago: 18,
          },
        ],
      },
      {
        status: 'RESOLVED',
        priority: 'HIGH',
        purpose: 'SUPPORT',
        subject: 'Re: Income Tax Assessment - AY 2024-25',
        messages: [
          {
            dir: 'INBOUND',
            text: 'Received a Section 143(1) notice showing demand of ₹28,000. But I believe my filing was correct. Can you review?',
            ago: 168,
          },
          {
            dir: 'OUTBOUND',
            text: "Reviewed the intimation. The mismatch is because:\n1. 26AS shows TDS of ₹15,000 not claimed in ITR\n2. One 80C deduction receipt was not attached\n\nWe'll file a rectification u/s 154. Expected refund after correction: ₹12,400.\n\nFee for rectification: ₹2,000.",
            ago: 144,
          },
          { dir: 'INBOUND', text: 'Please proceed with the rectification.', ago: 120 },
          {
            dir: 'OUTBOUND',
            text: 'Rectification filed. Reference: RECT-2025-9374625. The demand has been adjusted. Refund should process in 30-45 days.',
            ago: 48,
          },
        ],
      },
    ],
  },
};

let globalMsgCounter = 0;

// ==================== MAIN SEED FUNCTION ====================

async function seedTenant(config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Seeding: ${config.name} (${config.industry})`);
  console.log(`${'─'.repeat(60)}`);

  // ── Tenant ──
  const tenant = await prisma.tenant.create({
    data: {
      name: config.name,
      slug: config.slug,
      domain: config.domain,
      email: config.email,
      phone: config.phone,
      logoUrl: avatarUrl(config.name, config.brandColor),
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      locale: 'en-IN',
      industry: config.industry,
      size: '10-50',
      status: 'ACTIVE',
      settings: {
        branding: { primaryColor: `#${config.brandColor}` },
        features: { whatsapp: true, email: true, sms: true },
      },
    },
  });
  console.log(`  ✓ Tenant: ${tenant.name} (${tenant.id})`);

  // ── Workspace ──
  const workspace = await prisma.workspace.create({
    data: {
      tenantId: tenant.id,
      name: `${config.name} HQ`,
      isDefault: true,
      status: 'ACTIVE',
    },
  });

  // ── Users & Roles ──
  const passwordHash = await bcrypt.hash('Demo@2025', 10);
  const userDefs = getUsersForTenant(config);
  const userMap = {};

  for (const def of userDefs) {
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: def.email,
        firstName: def.firstName,
        lastName: def.lastName,
        displayName: `${def.firstName} ${def.lastName}`,
        avatarUrl: avatarUrl(`${def.firstName} ${def.lastName}`, config.brandColor),
        passwordHash,
        emailVerified: true,
        status: 'ACTIVE',
      },
    });

    await prisma.userWorkspace.create({
      data: { userId: user.id, workspaceId: workspace.id },
    });

    const role = await prisma.role.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: def.role } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: def.role,
        description: `${def.role} role`,
        isSystem: def.role === 'Admin',
      },
    });

    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    userMap[def.role] = userMap[def.role] || user;
    userMap[def.email] = user;
  }

  const adminUser = userMap['Admin'];
  const salesUser = userMap['Sales Representative'] || adminUser;
  const supportUser = userMap['Support Agent'] || adminUser;
  console.log(`  ✓ Users: ${userDefs.length} with roles`);

  // ── Integration (API Dog) ──
  await prisma.integration.create({
    data: {
      tenantId: tenant.id,
      name: 'API Dog (Mock Data)',
      type: 'messaging_provider',
      provider: 'apidog',
      status: 'CONNECTED',
      config: { projectId: '1204909' },
      credentials: { apiToken: APIDOG_TOKEN },
      connectedById: adminUser.id,
      isValidated: true,
      lastTestedAt: new Date(),
      testResult: 'All endpoints responding',
      services: ['WHATSAPP', 'SMS', 'VOICE', 'EMAIL'],
    },
  });
  console.log(`  ✓ Integration: API Dog (Mock Data)`);

  // ── Channel Accounts (4 per tenant — WhatsApp, SMS, Voice, Email) ──
  const channelTypes = [
    { type: 'WHATSAPP', name: `${config.name} - WhatsApp`, phone: config.phone },
    { type: 'SMS', name: `${config.name} - SMS`, phone: config.phone },
    { type: 'VOICE', name: `${config.name} - Voice`, phone: config.phone },
    { type: 'EMAIL_SMTP', name: `${config.name} - Email`, email: config.email },
  ];

  for (const ch of channelTypes) {
    await prisma.channelAccount.create({
      data: {
        tenantId: tenant.id,
        type: ch.type,
        name: ch.name,
        provider: 'APIDOG',
        providerConfig: { baseUrl: APIDOG_BASE_URL, apiToken: APIDOG_TOKEN },
        phoneNumber: ch.phone || null,
        emailAddress: ch.email || null,
        status: 'ACTIVE',
        healthStatus: 'HEALTHY',
        isDefault: true,
        isConfigComplete: true,
      },
    });
  }
  console.log(`  ✓ Channel Accounts: 4 (WA/SMS/Voice/Email) via API Dog`);

  // ── Tags ──
  const tagNames = ['VIP', 'Hot Lead', 'Enterprise', 'Renewal', 'High Value'];
  const tagMap = {};
  for (const tagName of tagNames) {
    const tag = await prisma.tag.create({
      data: {
        tenantId: tenant.id,
        name: tagName,
        color: pick(['#ef4444', '#f59e0b', '#10b981', '#6366f1', '#3b82f6']),
      },
    });
    tagMap[tagName] = tag;
  }

  // ── Companies (CRM hub — all tenants have this) ──
  const companyMap = {};
  for (const co of config.companies) {
    const company = await prisma.company.create({
      data: {
        tenantId: tenant.id,
        name: co.name,
        domain: co.domain,
        industry: co.industry,
        employeeCount: String(co.employees),
        lifecycleStage: pick(['CUSTOMER', 'OPPORTUNITY', 'LEAD', 'QUALIFIED']),
        companyType: pick(['CUSTOMER', 'PROSPECT', 'PARTNER']),
        ownerId: adminUser.id,
        websiteUrl: `https://www.${co.domain}`,
      },
    });
    companyMap[co.name] = company;
  }
  console.log(`  ✓ Companies: ${config.companies.length}`);

  // ── Contacts (3 per company) ──
  const allContacts = [];
  let contactIdx = 0;
  for (const co of config.companies) {
    const company = companyMap[co.name];
    const count = co === config.companies[0] ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const fn = FIRST_NAMES[(contactIdx * 3 + i) % FIRST_NAMES.length];
      const ln = LAST_NAMES[(contactIdx + i) % LAST_NAMES.length];
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}@${co.domain}`;
      try {
        const contact = await prisma.contact.create({
          data: {
            tenantId: tenant.id,
            firstName: fn,
            lastName: ln,
            displayName: `${fn} ${ln}`,
            email,
            phone: `+91 9${randInt(100000000, 999999999)}`,
            jobTitle: pick(TITLES),
            companyId: company.id,
            ownerId: i % 2 === 0 ? adminUser.id : salesUser.id,
            createdById: adminUser.id,
            lifecycleStage: pick(['CUSTOMER', 'OPPORTUNITY', 'LEAD', 'SQL', 'MQL']),
            leadScore: randInt(40, 98),
            rating: pick(['HOT', 'WARM', 'COLD']),
            priority: pick(['HIGH', 'MEDIUM', 'LOW']),
            source: pick(['MANUAL', 'REFERRAL', 'WEBSITE', 'EMAIL']),
            status: 'ACTIVE',
            emailConsent: true,
            marketingConsent: true,
            whatsappConsent: true,
            lastActivityAt: daysAgo(randInt(1, 30)),
          },
        });
        allContacts.push(contact);

        // Tag random contacts
        if (randInt(0, 1) === 1) {
          const tag = pick(Object.values(tagMap));
          await prisma.contactTag
            .create({
              data: { contactId: contact.id, tagId: tag.id },
            })
            .catch(() => {});
        }
      } catch (_) {
        /* skip duplicate */
      }
    }
    contactIdx++;
  }
  console.log(`  ✓ Contacts: ${allContacts.length}`);

  // ── Products (Commerce hub — conditional) ──
  const productMap = {};
  if (config.hubs.commerce || config.hubs.sales) {
    for (let pi = 0; pi < config.products.length; pi++) {
      const p = config.products[pi];
      const sku = `${config.slug.toUpperCase().replace(/-/g, '').slice(0, 4)}-${p.hsnCode}-${String(pi + 1).padStart(3, '0')}`;
      const product = await prisma.product.create({
        data: {
          tenantId: tenant.id,
          name: p.name,
          sku,
          unitPrice: p.unitPrice,
          currency: 'INR',
          gstRate: p.gstRate,
          hsnCode: p.hsnCode,
          productType: 'GOODS',
          isActive: true,
        },
      });
      productMap[p.name] = product;
    }
    console.log(`  ✓ Products: ${config.products.length}`);
  }

  // ── Pipeline & Stages (Sales hub — conditional) ──
  let pipeline = null;
  const stageMap = {};
  if (config.hubs.sales && config.pipelineName) {
    pipeline = await prisma.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: config.pipelineName,
        type: 'DEAL',
        isDefault: true,
      },
    });

    for (let i = 0; i < config.stages.length; i++) {
      const stageName = config.stages[i];
      const isWon =
        stageName.toLowerCase().includes('registered') ||
        stageName.toLowerCase().includes('enrolled') ||
        stageName.toLowerCase().includes('delivered') ||
        stageName.toLowerCase().includes('delivery') ||
        stageName.toLowerCase().includes('active client') ||
        stageName.toLowerCase().includes('signed') ||
        stageName.toLowerCase().includes('resolved');
      const isLost =
        stageName.toLowerCase().includes('lost') ||
        stageName.toLowerCase().includes('dropped') ||
        stageName.toLowerCase().includes('lapsed') ||
        stageName.toLowerCase().includes('churned');

      const stage = await prisma.stage.create({
        data: {
          tenantId: tenant.id,
          pipelineId: pipeline.id,
          name: stageName,
          order: i,
          probability: isWon ? 100 : isLost ? 0 : Math.round(((i + 1) / config.stages.length) * 90),
          isWon,
          isLost,
          color: pick(['#6366f1', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6']),
        },
      });
      stageMap[stageName] = stage;
    }
    console.log(`  ✓ Pipeline: "${config.pipelineName}" with ${config.stages.length} stages`);
  }

  // ── Deals (Sales hub — conditional) ──
  const allDeals = [];
  if (config.hubs.sales && pipeline && config.dealNames.length > 0) {
    const products = Object.values(productMap);
    for (let i = 0; i < config.dealNames.length; i++) {
      const d = config.dealNames[i];
      const stageIdx = i < config.stages.length ? i : randInt(0, config.stages.length - 1);
      const stageName = config.stages[stageIdx];
      const stage = stageMap[stageName];
      const contact = allContacts[i % allContacts.length] || null;
      const companyName = config.companies[i % config.companies.length].name;
      const company = companyMap[companyName];

      try {
        const deal = await prisma.deal.create({
          data: {
            tenantId: tenant.id,
            name: d.name,
            pipelineId: pipeline.id,
            stageId: stage.id,
            amount: d.amount,
            currency: 'INR',
            contactId: contact?.id || null,
            companyId: company?.id || null,
            ownerId: i % 2 === 0 ? adminUser.id : salesUser.id,
            expectedCloseDate:
              stage.isWon || stage.isLost ? daysAgo(randInt(5, 60)) : daysFromNow(randInt(15, 90)),
            closedAt: stage.isWon || stage.isLost ? daysAgo(randInt(1, 30)) : null,
          },
        });
        allDeals.push(deal);

        // Attach product to deal
        if (products.length > 0) {
          const prod = products[i % products.length];
          await prisma.dealProduct
            .create({
              data: {
                dealId: deal.id,
                productId: prod.id,
                quantity: randInt(1, 5),
                unitPrice: prod.unitPrice,
                discount: randInt(0, 15),
              },
            })
            .catch(() => {});
        }
      } catch (_) {
        /* skip */
      }
    }
    console.log(`  ✓ Deals: ${allDeals.length}`);
  }

  // ── Ticket Pipeline & Tickets (Service hub — conditional) ──
  if (config.hubs.service && config.ticketSubjects?.length > 0) {
    const ticketPipeline = await prisma.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: 'Support Ticket Pipeline',
        type: 'TICKET',
        isDefault: false,
      },
    });

    const ticketStageNames = ['New', 'In Progress', 'Waiting on Customer', 'Resolved', 'Closed'];
    const ticketStages = {};
    for (let i = 0; i < ticketStageNames.length; i++) {
      const s = await prisma.stage.create({
        data: {
          tenantId: tenant.id,
          pipelineId: ticketPipeline.id,
          name: ticketStageNames[i],
          order: i,
          color: ['#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#6B7280'][i],
          isClosed: i >= 3,
        },
      });
      ticketStages[ticketStageNames[i]] = s;
    }

    for (let i = 0; i < config.ticketSubjects.length; i++) {
      const stageName = ticketStageNames[i % ticketStageNames.length];
      const contact = allContacts[i % allContacts.length] || null;
      await prisma.ticket
        .create({
          data: {
            tenantId: tenant.id,
            subject: config.ticketSubjects[i],
            description: `Ticket raised regarding: ${config.ticketSubjects[i]}`,
            pipelineId: ticketPipeline.id,
            stageId: ticketStages[stageName].id,
            priority: pick(['HIGH', 'MEDIUM', 'LOW', 'URGENT']),
            contactId: contact?.id || null,
            assignedToId: supportUser.id,
          },
        })
        .catch(() => {});
    }
    console.log(`  ✓ Tickets: ${config.ticketSubjects.length}`);
  }

  // ── Activities (CRM — always seeded) ──
  const activityTypes = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK'];
  for (let i = 0; i < 10; i++) {
    const contact = allContacts[i % allContacts.length];
    const deal = allDeals.length > 0 ? allDeals[i % allDeals.length] : null;
    const type = activityTypes[i % activityTypes.length];
    await prisma.activity
      .create({
        data: {
          tenantId: tenant.id,
          type,
          subject: `${type === 'CALL' ? 'Follow-up call' : type === 'EMAIL' ? 'Sent proposal' : type === 'MEETING' ? 'Demo meeting' : type === 'NOTE' ? 'Client update' : 'Follow-up task'} - ${contact?.firstName || 'Contact'}`,
          description: `${type} activity with ${contact?.firstName} ${contact?.lastName}`,
          contactId: contact?.id || null,
          dealId: deal?.id || null,
          assignedToId: adminUser.id,
          createdById: adminUser.id,
          dueDate: daysAgo(randInt(1, 14)),
          completedAt: i < 6 ? daysAgo(randInt(0, 7)) : null,
        },
      })
      .catch(() => {});
  }
  console.log(`  ✓ Activities: 10`);

  // ── Calendar Events (conditional) ──
  if (config.hubs.calendar && config.calendarEvents?.length > 0) {
    for (let i = 0; i < config.calendarEvents.length; i++) {
      const startTime = i < 2 ? daysAgo(randInt(1, 7)) : daysFromNow(randInt(1, 14));
      startTime.setHours(9 + randInt(0, 8), 0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 1);

      await prisma.calendarEvent
        .create({
          data: {
            tenantId: tenant.id,
            organizerId: adminUser.id,
            title: config.calendarEvents[i],
            type: pick(['MEETING', 'CALL', 'TASK', 'EVENT']),
            startTime,
            endTime,
            timezone: 'Asia/Kolkata',
            status: i < 2 ? 'COMPLETED' : 'SCHEDULED',
            attendees: [adminUser.email, salesUser.email],
          },
        })
        .catch(() => {});
    }
    console.log(`  ✓ Calendar: ${config.calendarEvents.length} events`);
  }

  // ── Marketing Campaigns (conditional) ──
  if (config.hubs.marketing && config.campaigns?.length > 0) {
    for (const camp of config.campaigns) {
      await prisma.marketing_campaigns
        .create({
          data: {
            tenantId: tenant.id,
            name: camp.name,
            type: camp.campaignType || pick(['BROADCAST', 'PROMOTIONAL', 'NURTURE']),
            status: pick(['ACTIVE', 'COMPLETED', 'DRAFT']),
            channels: [camp.channel || 'email'],
            startDate: daysAgo(randInt(5, 30)),
            endDate: daysFromNow(randInt(10, 60)),
            budget: String(randInt(10000, 100000)),
            totalRecipients: randInt(100, 5000),
            sentCount: randInt(50, 4000),
            deliveredCount: randInt(40, 3500),
            openedCount: randInt(20, 2000),
            clickedCount: randInt(5, 500),
            createdById: adminUser.id,
          },
        })
        .catch(() => {});
    }
    console.log(`  ✓ Campaigns: ${config.campaigns.length}`);
  }

  // ── HR: Employees (conditional) ──
  if (config.hubs.hr && config.hrDepts?.length > 0) {
    const employees = [];
    for (let i = 0; i < config.hrDepts.length; i++) {
      const dept = config.hrDepts[i];
      const fn = FIRST_NAMES[(i * 2 + 3) % FIRST_NAMES.length];
      const ln = LAST_NAMES[(i * 3 + 2) % LAST_NAMES.length];
      const empEmail = `${fn.toLowerCase()}.${ln.toLowerCase()}.head@${config.domain}`;

      try {
        const emp = await prisma.employee.create({
          data: {
            tenantId: tenant.id,
            employeeId: `EMP${String(i + 1).padStart(3, '0')}`,
            firstName: fn,
            lastName: ln,
            email: empEmail,
            phone: `+91 9${randInt(100000000, 999999999)}`,
            role: `${dept} Head`,
            department: dept,
            joinDate: daysAgo(randInt(180, 1800)),
            salary: String(randInt(80000, 250000)),
            employmentType: 'FULL_TIME',
            status: 'ACTIVE',
          },
        });
        employees.push(emp);

        await prisma.leaveBalance.create({
          data: {
            tenantId: tenant.id,
            employeeId: emp.id,
            year: 2025,
            annual: 20,
            sick: 10,
            personal: 5,
            usedAnnual: randInt(0, 8),
            usedSick: randInt(0, 3),
            usedPersonal: randInt(0, 2),
          },
        });
      } catch (_) {
        /* skip */
      }
    }

    // Add 2 staff under first dept
    for (let i = 0; i < 2; i++) {
      const fn = FIRST_NAMES[(i + 7) % FIRST_NAMES.length];
      const ln = LAST_NAMES[(i + 9) % LAST_NAMES.length];
      try {
        const emp = await prisma.employee.create({
          data: {
            tenantId: tenant.id,
            employeeId: `EMP${String(config.hrDepts.length + i + 1).padStart(3, '0')}`,
            firstName: fn,
            lastName: ln,
            email: `${fn.toLowerCase()}.${ln.toLowerCase()}.staff@${config.domain}`,
            phone: `+91 9${randInt(100000000, 999999999)}`,
            role: 'Executive',
            department: config.hrDepts[0],
            managerId: employees[0]?.id,
            joinDate: daysAgo(randInt(30, 365)),
            salary: String(randInt(35000, 75000)),
            employmentType: 'FULL_TIME',
            status: 'ACTIVE',
          },
        });
        employees.push(emp);
      } catch (_) {
        /* skip */
      }
    }

    // Leave request
    if (employees.length > 0) {
      await prisma.leaveRequest
        .create({
          data: {
            tenantId: tenant.id,
            employeeId: employees[0].id,
            type: 'ANNUAL',
            startDate: daysFromNow(7),
            endDate: daysFromNow(11),
            days: 5,
            reason: 'Family vacation',
            status: 'PENDING',
          },
        })
        .catch(() => {});
    }
    console.log(`  ✓ HR: ${employees.length} employees + leave records`);
  }

  // ── Projects & Tasks (conditional) ──
  if (config.hubs.projects && config.projectNames?.length > 0) {
    for (let pi = 0; pi < config.projectNames.length; pi++) {
      const project = await prisma.project.create({
        data: {
          tenantId: tenant.id,
          name: config.projectNames[pi],
          description: `Strategic initiative: ${config.projectNames[pi]}`,
          status: pi === 0 ? 'IN_PROGRESS' : 'PLANNING',
          priority: pick(['HIGH', 'MEDIUM', 'URGENT']),
          startDate: daysAgo(randInt(10, 60)),
          endDate: daysFromNow(randInt(30, 120)),
          budget: String(randInt(500000, 5000000)),
          currency: 'INR',
          progress: pi === 0 ? randInt(20, 60) : 0,
          ownerId: adminUser.id,
        },
      });

      await prisma.projectMember
        .create({
          data: { projectId: project.id, userId: adminUser.id, role: 'OWNER' },
        })
        .catch(() => {});

      const taskTitles = [
        'Kickoff meeting',
        'Requirements gathering',
        'Design review',
        'Implementation',
        'QA testing',
        'Go-live',
      ];
      const taskStatuses = ['COMPLETED', 'COMPLETED', 'IN_PROGRESS', 'TODO', 'TODO', 'TODO'];
      for (let ti = 0; ti < taskTitles.length; ti++) {
        await prisma.task
          .create({
            data: {
              tenantId: tenant.id,
              title: `${taskTitles[ti]} - ${config.projectNames[pi]}`,
              projectId: project.id,
              status: pi === 0 ? taskStatuses[ti] : 'TODO',
              priority: ti === 0 ? 'HIGH' : 'MEDIUM',
              assigneeId: adminUser.id,
              createdById: adminUser.id,
              dueDate: daysFromNow(randInt(3, 30) + ti * 7),
            },
          })
          .catch(() => {});
      }
    }
    console.log(`  ✓ Projects: ${config.projectNames.length} with tasks`);
  }

  // ── Invoices (Finance/Commerce — conditional) ──
  if (config.hubs.finance || config.hubs.commerce) {
    const invoiceStatuses = ['PAID', 'PAID', 'SENT', 'OVERDUE', 'DRAFT'];
    const prefix = config.slug.toUpperCase().replace(/-/g, '').slice(0, 3);
    for (let i = 0; i < Math.min(5, allContacts.length); i++) {
      const contact = allContacts[i];
      const status = invoiceStatuses[i % invoiceStatuses.length];
      const amount = parseFloat(config.products[i % config.products.length]?.unitPrice || '5000');
      const gstRate = parseFloat(config.products[i % config.products.length]?.gstRate || '18');
      const taxAmount = (amount * gstRate) / 100;
      const total = amount + taxAmount;
      const issueDate = daysAgo(randInt(10, 60));
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 30);

      try {
        const invoice = await prisma.invoice.create({
          data: {
            tenantId: tenant.id,
            invoiceNumber: `${prefix}-INV-2025-${String(i + 1).padStart(4, '0')}`,
            contactId: contact.id,
            status,
            issueDate,
            dueDate,
            subtotal: String(amount.toFixed(2)),
            taxAmount: String(taxAmount.toFixed(2)),
            totalAmount: String(total.toFixed(2)),
            currency: 'INR',
            notes: 'Thank you for your business.',
          },
        });

        if (status === 'PAID') {
          await prisma.payment
            .create({
              data: {
                tenantId: tenant.id,
                invoiceId: invoice.id,
                amount: String(total.toFixed(2)),
                currency: 'INR',
                method: pick(['BANK_TRANSFER', 'UPI', 'CASH']),
                status: 'COMPLETED',
                processedAt: daysAgo(randInt(1, 10)),
              },
            })
            .catch(() => {});
        }
      } catch (_) {
        /* skip */
      }
    }
    console.log(`  ✓ Invoices: 5 with payments`);
  }

  // ── Wallet ──
  await prisma.wallets
    .create({
      data: {
        tenantId: tenant.id,
        balance: String(randInt(5000, 50000)),
        currency: 'INR',
      },
    })
    .catch(() => {});

  // ── Conversations + Messages (Inbox data) ──
  const industryKey = config.industry;
  const convTemplates = CONVERSATION_TEMPLATES[industryKey];

  if (convTemplates) {
    // Create old-model Channel records (1 per type: WHATSAPP, SMS, EMAIL)
    const channelMap = {};
    for (const chType of ['WHATSAPP', 'SMS', 'EMAIL']) {
      const ch = await prisma.channel.create({
        data: {
          tenantId: tenant.id,
          type: chType,
          name: `${config.name} - ${chType}`,
          provider: 'apidog',
          providerConfig: { baseUrl: APIDOG_BASE_URL },
          phoneNumber: chType !== 'EMAIL' ? config.phone : null,
          status: 'ACTIVE',
        },
      });
      channelMap[chType] = ch;
    }

    // Find ChannelAccount records (already created above)
    const channelAccounts = await prisma.channelAccount.findMany({
      where: { tenantId: tenant.id },
    });
    const caMap = {};
    for (const ca of channelAccounts) {
      // Map: WHATSAPP→WHATSAPP, SMS→SMS, EMAIL_SMTP→EMAIL
      const key = ca.type === 'EMAIL_SMTP' ? 'EMAIL' : ca.type;
      caMap[key] = ca;
    }

    // Status mapping: template status → both old + new model status values
    const statusMap = {
      OPEN: { old: 'OPEN', thread: 'OPEN' },
      PENDING: { old: 'PENDING', thread: 'PENDING' },
      RESOLVED: { old: 'RESOLVED', thread: 'RESOLVED' },
      CLOSED: { old: 'CLOSED', thread: 'CLOSED' },
    };

    // ChannelType → ChannelAccountType mapping for message_events.channel
    const caTypeMap = { WHATSAPP: 'WHATSAPP', SMS: 'SMS', EMAIL: 'EMAIL_SMTP' };

    let convCount = 0;
    let msgCount = 0;

    const channelGroups = [
      { key: 'whatsapp', chType: 'WHATSAPP' },
      { key: 'sms', chType: 'SMS' },
      { key: 'email', chType: 'EMAIL' },
    ];

    for (const { key, chType } of channelGroups) {
      const templates = convTemplates[key] || [];
      const channel = channelMap[chType];
      const ca = caMap[chType];
      if (!channel || !ca || templates.length === 0) continue;

      for (let ti = 0; ti < templates.length; ti++) {
        const tpl = templates[ti];
        const contact = allContacts[ti % allContacts.length];
        if (!contact) continue;

        const statuses = statusMap[tpl.status] || statusMap.OPEN;
        const lastMsg = tpl.messages[tpl.messages.length - 1];
        const lastInbound = [...tpl.messages].reverse().find((m) => m.dir === 'INBOUND');
        const unread =
          tpl.status === 'OPEN' ? tpl.messages.filter((m) => m.dir === 'INBOUND').length : 0;

        // Create Conversation (old model — inbox list queries)
        const conversation = await prisma.conversation.create({
          data: {
            tenantId: tenant.id,
            channelId: channel.id,
            channelType: chType,
            contactId: contact.id,
            contactPhone: contact.phone || null,
            contactName: `${contact.firstName} ${contact.lastName}`,
            status: statuses.old,
            assignedToId: tpl.purpose === 'SALES' ? salesUser.id : supportUser.id,
            lastCustomerMessageAt: lastInbound ? daysAgo(lastInbound.ago / 24) : null,
            lastMessagePreview: lastMsg.text.substring(0, 120),
            unreadCount: unread,
          },
        });

        // Create ConversationThread (new model — same ID as Conversation)
        await prisma.conversationThread.create({
          data: {
            id: conversation.id, // MUST match for dual-model compatibility
            tenantId: tenant.id,
            contactId: contact.id,
            contactPhone: chType !== 'EMAIL' ? contact.phone || null : null,
            contactEmail: chType === 'EMAIL' ? contact.email || null : null,
            status: statuses.thread,
            priority: tpl.priority || 'MEDIUM',
            purpose: tpl.purpose || 'GENERAL',
            assignedToId: tpl.purpose === 'SALES' ? salesUser.id : supportUser.id,
            lastMessageAt: daysAgo(lastMsg.ago / 24),
            lastCustomerMessageAt: lastInbound ? daysAgo(lastInbound.ago / 24) : null,
            messageCount: tpl.messages.length,
            lastMessagePreview: lastMsg.text.substring(0, 120),
            lastMessageChannel: caTypeMap[chType],
            unreadCount: unread,
          },
        });

        // Create message_events for each message in the conversation
        for (let mi = 0; mi < tpl.messages.length; mi++) {
          const msg = tpl.messages[mi];
          globalMsgCounter++;
          const sentAt = new Date(Date.now() - msg.ago * 3600 * 1000);
          const isOutbound = msg.dir === 'OUTBOUND';

          await prisma.message_events.create({
            data: {
              tenantId: tenant.id,
              threadId: conversation.id,
              channelAccountId: ca.id,
              channel: caTypeMap[chType],
              direction: msg.dir,
              contentType: chType === 'EMAIL' ? 'EMAIL' : 'TEXT',
              textContent: msg.text,
              subject: chType === 'EMAIL' ? `Re: ${tpl.messages[0].text.substring(0, 50)}` : null,
              status: isOutbound ? 'DELIVERED' : 'DELIVERED',
              sentAt,
              deliveredAt: new Date(sentAt.getTime() + 2000),
              readAt: isOutbound ? new Date(sentAt.getTime() + 30000) : null,
              idempotencyKey: `seed-${tenant.id}-${chType}-${ti}-${mi}`,
            },
          });
          msgCount++;
        }
        convCount++;
      }
    }
    console.log(`  ✓ Conversations: ${convCount} with ${msgCount} messages (WA/SMS/Email)`);
  }

  console.log(`  ✅ ${config.name} fully seeded!\n`);
  return tenant;
}

// ==================== MAIN ====================

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   NEXORA CRM — INDUSTRY TENANT SEEDER                ║');
  console.log('║   8 Industries × Hub-Specific Data × API Dog Mock     ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  const startTime = Date.now();

  for (const config of TENANT_CONFIGS) {
    await seedTenant(config);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║                 SEED COMPLETE!                        ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  Login with password: Demo@2025                       ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  1. PrimeView Realty      → admin@primeviewrealty.in  ║');
  console.log('║  2. SpiceCraft Restaurants → admin@spicecraftindia.com║');
  console.log('║  3. EduPrime Academy      → admin@eduprimeacademy.in  ║');
  console.log('║  4. LegalEdge Associates  → admin@legaledgelaw.in     ║');
  console.log('║  5. FitZone India         → admin@fitzoneindia.com    ║');
  console.log('║  6. PixelWave Digital     → admin@pixelwave.agency    ║');
  console.log('║  7. AutoPrime Motors      → admin@autoprimemotors.in  ║');
  console.log('║  8. TaxShield Advisors    → admin@taxshieldca.in      ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Completed in ${elapsed}s                              ║`);
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
