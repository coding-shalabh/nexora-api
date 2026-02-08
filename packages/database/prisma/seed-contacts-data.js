import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * COMPREHENSIVE CONTACTS & COMPANIES SEED
 * Creates 50+ contacts, 15 companies, and communication data
 * Supports WhatsApp, Email, SMS, and Voice channels
 */

// Indian first names
const firstNames = [
  'Aarav',
  'Vivaan',
  'Aditya',
  'Vihaan',
  'Arjun',
  'Sai',
  'Reyansh',
  'Ayaan',
  'Krishna',
  'Ishaan',
  'Aadhya',
  'Diya',
  'Pihu',
  'Ananya',
  'Kavya',
  'Saanvi',
  'Anika',
  'Myra',
  'Sara',
  'Navya',
  'Rajesh',
  'Suresh',
  'Mahesh',
  'Ramesh',
  'Ganesh',
  'Mukesh',
  'Rakesh',
  'Naresh',
  'Dinesh',
  'Hitesh',
  'Priya',
  'Sneha',
  'Pooja',
  'Neha',
  'Riya',
  'Anjali',
  'Deepika',
  'Shruti',
  'Pallavi',
  'Kavitha',
  'Vikram',
  'Karthik',
  'Rohit',
  'Amit',
  'Sumit',
  'Nikhil',
  'Rahul',
  'Varun',
  'Siddharth',
  'Aakash',
];

// Indian last names
const lastNames = [
  'Sharma',
  'Patel',
  'Gupta',
  'Singh',
  'Kumar',
  'Verma',
  'Reddy',
  'Iyer',
  'Nair',
  'Menon',
  'Joshi',
  'Agarwal',
  'Mishra',
  'Pandey',
  'Tiwari',
  'Saxena',
  'Kapoor',
  'Malhotra',
  'Khanna',
  'Chopra',
  'Rao',
  'Naidu',
  'Pillai',
  'Krishnan',
  'Venkatesh',
  'Subramanian',
  'Rajan',
  'Bhat',
  'Hegde',
  'Shetty',
  'Deshmukh',
  'Patil',
  'Kulkarni',
  'Jain',
  'Mehta',
  'Shah',
  'Thakur',
  'Chauhan',
  'Yadav',
  'Dubey',
];

// Indian cities with state codes
const cities = [
  { city: 'Mumbai', state: 'Maharashtra', stateCode: '27', pincode: '400001' },
  { city: 'Delhi', state: 'Delhi', stateCode: '07', pincode: '110001' },
  { city: 'Bangalore', state: 'Karnataka', stateCode: '29', pincode: '560001' },
  { city: 'Hyderabad', state: 'Telangana', stateCode: '36', pincode: '500001' },
  { city: 'Chennai', state: 'Tamil Nadu', stateCode: '33', pincode: '600001' },
  { city: 'Kolkata', state: 'West Bengal', stateCode: '19', pincode: '700001' },
  { city: 'Pune', state: 'Maharashtra', stateCode: '27', pincode: '411001' },
  { city: 'Ahmedabad', state: 'Gujarat', stateCode: '24', pincode: '380001' },
  { city: 'Jaipur', state: 'Rajasthan', stateCode: '08', pincode: '302001' },
  { city: 'Lucknow', state: 'Uttar Pradesh', stateCode: '09', pincode: '226001' },
  { city: 'Chandigarh', state: 'Punjab', stateCode: '03', pincode: '160001' },
  { city: 'Kochi', state: 'Kerala', stateCode: '32', pincode: '682001' },
  { city: 'Indore', state: 'Madhya Pradesh', stateCode: '23', pincode: '452001' },
  { city: 'Gurugram', state: 'Haryana', stateCode: '06', pincode: '122001' },
  { city: 'Noida', state: 'Uttar Pradesh', stateCode: '09', pincode: '201301' },
];

// Job titles
const jobTitles = [
  'Chief Executive Officer',
  'Chief Technology Officer',
  'Chief Financial Officer',
  'Chief Marketing Officer',
  'Vice President - Sales',
  'Vice President - Operations',
  'Director - Business Development',
  'Director - HR',
  'Senior Manager - IT',
  'Manager - Operations',
  'Manager - Marketing',
  'Manager - Finance',
  'Team Lead - Development',
  'Senior Software Engineer',
  'Product Manager',
  'Project Manager',
  'Business Analyst',
  'Sales Executive',
  'Marketing Executive',
  'HR Executive',
  'Consultant',
  'Advisor',
  'Founder',
  'Co-Founder',
  'Managing Partner',
];

// Departments
const departments = [
  'Executive',
  'Technology',
  'Finance',
  'Marketing',
  'Sales',
  'Operations',
  'Human Resources',
  'Customer Success',
  'Product',
  'Engineering',
  'Legal',
  'Administration',
];

// Contact sources
const sources = [
  'WEBSITE',
  'REFERRAL',
  'SOCIAL',
  'EVENT',
  'PHONE_CALL',
  'ADVERTISEMENT',
  'EMAIL',
  'PARTNER',
  'OTHER',
];

// Industries
const industries = [
  'Information Technology',
  'Financial Services',
  'Healthcare',
  'Education',
  'Manufacturing',
  'Retail & E-commerce',
  'Real Estate',
  'Hospitality',
  'Media & Entertainment',
  'Logistics',
  'Automotive',
  'Pharma & Life Sciences',
  'FMCG',
  'Telecommunications',
  'Energy & Utilities',
];

// Company types with names
const companyData = [
  {
    name: 'TechVision Solutions Pvt Ltd',
    domain: 'techvision.io',
    industry: 'Information Technology',
    size: '51-200',
  },
  {
    name: 'Innovate Digital Agency',
    domain: 'innovatedigital.in',
    industry: 'Media & Entertainment',
    size: '11-50',
  },
  {
    name: 'StartupHub Ventures',
    domain: 'startuphub.vc',
    industry: 'Financial Services',
    size: '1-10',
  },
  {
    name: 'HealthFirst Clinics',
    domain: 'healthfirst.co.in',
    industry: 'Healthcare',
    size: '201-500',
  },
  { name: 'EduLearn Academy', domain: 'edulearn.edu.in', industry: 'Education', size: '51-200' },
  {
    name: 'GreenEarth Manufacturing',
    domain: 'greenearth.co.in',
    industry: 'Manufacturing',
    size: '501-1000',
  },
  {
    name: 'ShopEase Retail',
    domain: 'shopease.in',
    industry: 'Retail & E-commerce',
    size: '201-500',
  },
  {
    name: 'BuildRight Properties',
    domain: 'buildright.in',
    industry: 'Real Estate',
    size: '11-50',
  },
  {
    name: 'TravelJoy Hospitality',
    domain: 'traveljoy.com',
    industry: 'Hospitality',
    size: '101-200',
  },
  { name: 'SwiftLogix Transport', domain: 'swiftlogix.in', industry: 'Logistics', size: '51-200' },
  {
    name: 'AutoDrive Motors',
    domain: 'autodrive.co.in',
    industry: 'Automotive',
    size: '1001-5000',
  },
  {
    name: 'MedCure Pharma',
    domain: 'medcure.in',
    industry: 'Pharma & Life Sciences',
    size: '201-500',
  },
  { name: 'FreshBite Foods', domain: 'freshbite.in', industry: 'FMCG', size: '101-200' },
  {
    name: 'ConnectTel Solutions',
    domain: 'connecttel.in',
    industry: 'Telecommunications',
    size: '501-1000',
  },
  {
    name: 'PowerGrid Energy',
    domain: 'powergrid.co.in',
    industry: 'Energy & Utilities',
    size: '1001-5000',
  },
];

// Helper functions
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generatePhone() {
  const prefixes = [
    '98',
    '99',
    '97',
    '96',
    '95',
    '94',
    '93',
    '92',
    '91',
    '90',
    '88',
    '87',
    '86',
    '85',
    '84',
    '70',
    '72',
    '73',
    '74',
    '75',
    '76',
    '77',
    '78',
    '79',
  ];
  return `+91 ${randomItem(prefixes)}${String(randomInt(10000000, 99999999))}`;
}

function generateGSTIN(stateCode) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const pan = Array(5)
    .fill()
    .map(() => chars[Math.floor(Math.random() * chars.length)])
    .join('');
  const nums = String(randomInt(1000, 9999));
  return `${stateCode}${pan}${nums}A1Z${randomInt(1, 9)}`;
}

async function main() {
  console.log('Starting comprehensive contacts & companies seed...\n');

  // Get existing tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'nexora-platform' },
  });

  if (!tenant) {
    console.error('Tenant not found. Run seed.js first.');
    process.exit(1);
  }

  console.log('Using tenant:', tenant.name, '\n');

  // Get existing users for assignment
  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id },
  });

  if (users.length === 0) {
    console.error('No users found. Run seed.js first.');
    process.exit(1);
  }

  console.log(`Found ${users.length} users for assignment\n`);

  // ==================== 1. CREATE COMPANIES ====================
  console.log('Creating companies...');
  const companies = [];

  for (let i = 0; i < companyData.length; i++) {
    const data = companyData[i];
    const location = randomItem(cities);
    const companyId = `company-${i + 1}-${tenant.id}`;

    const company = await prisma.company.upsert({
      where: { id: companyId },
      update: {},
      create: {
        id: companyId,
        tenantId: tenant.id,
        name: data.name,
        domain: data.domain,
        industry: data.industry,
        employeeCount: data.size,
        annualRevenue: randomItem([
          '₹10-50 Lakhs',
          '₹50 Lakhs-1 Cr',
          '₹1-5 Cr',
          '₹5-10 Cr',
          '₹10-50 Cr',
          '₹50-100 Cr',
          '₹100+ Cr',
        ]),
        address: `${randomInt(1, 500)}, ${randomItem(['MG Road', 'Station Road', 'Ring Road', 'Main Street', 'Park Avenue', 'Lake View', 'Hill Side', 'Green Park'])}`,
        city: location.city,
        state: location.state,
        country: 'India',
        postalCode: location.pincode,
        phone: generatePhone(),
        email: `contact@${data.domain}`,
        companyType: randomItem(['PROSPECT', 'CUSTOMER', 'PARTNER', 'VENDOR']),
        lifecycleStage: randomItem(['LEAD', 'QUALIFIED', 'OPPORTUNITY', 'CUSTOMER']),
        websiteUrl: `https://${data.domain}`,
        linkedinUrl: `https://linkedin.com/company/${data.domain.split('.')[0]}`,
        gstin: generateGSTIN(location.stateCode),
        stateCode: location.stateCode,
        foundedYear: randomInt(1990, 2023),
        timezone: 'Asia/Kolkata',
        preferredLanguage: 'en-IN',
      },
    });
    companies.push(company);
  }
  console.log(`  Created ${companies.length} companies\n`);

  // ==================== 2. CREATE TAGS ====================
  console.log('Creating tags...');
  const tagData = [
    { name: 'VIP Customer', color: '#f59e0b' },
    { name: 'Hot Lead', color: '#ef4444' },
    { name: 'Decision Maker', color: '#8b5cf6' },
    { name: 'Enterprise', color: '#3b82f6' },
    { name: 'SMB', color: '#22c55e' },
    { name: 'Startup', color: '#06b6d4' },
    { name: 'WhatsApp Active', color: '#25d366' },
    { name: 'Email Subscriber', color: '#ea4335' },
    { name: 'SMS Opted-In', color: '#ff6b00' },
    { name: 'Voice Preferred', color: '#9333ea' },
    { name: 'High Value', color: '#fbbf24' },
    { name: 'Needs Follow-up', color: '#f97316' },
    { name: 'Renewal Due', color: '#ec4899' },
    { name: 'At Risk', color: '#dc2626' },
    { name: 'Referral Source', color: '#10b981' },
  ];

  const tags = [];
  for (const tag of tagData) {
    const t = await prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: tag.name } },
      update: {},
      create: { tenantId: tenant.id, ...tag },
    });
    tags.push(t);
  }
  console.log(`  Created ${tags.length} tags\n`);

  // ==================== 3. CREATE CONTACTS ====================
  console.log('Creating contacts...');
  const contacts = [];
  const usedNames = new Set();

  // Generate 55 unique contacts
  for (let i = 0; i < 55; i++) {
    let firstName, lastName, fullName;

    // Ensure unique names
    do {
      firstName = randomItem(firstNames);
      lastName = randomItem(lastNames);
      fullName = `${firstName} ${lastName}`;
    } while (usedNames.has(fullName));
    usedNames.add(fullName);

    const company = i < 45 ? companies[i % companies.length] : null; // 45 have companies, 10 standalone
    const location = company
      ? cities.find((c) => c.city === company.city) || randomItem(cities)
      : randomItem(cities);
    const owner = randomItem(users);
    const contactId = `contact-${i + 1}-${tenant.id}`;

    // Determine lifecycle and lead status based on index for variety
    const lifecycleStages = [
      'SUBSCRIBER',
      'LEAD',
      'MQL',
      'SQL',
      'OPPORTUNITY',
      'CUSTOMER',
      'EVANGELIST',
    ];
    const leadStatuses = [
      'NEW',
      'OPEN',
      'IN_PROGRESS',
      'CONNECTED',
      'UNQUALIFIED',
      'OPEN_DEAL',
      'ATTEMPTED_TO_CONTACT',
      'BAD_TIMING',
    ];
    const ratings = ['HOT', 'WARM', 'COLD'];
    const priorities = ['HIGH', 'MEDIUM', 'LOW'];

    // Communication consents - varied distribution
    const hasWhatsApp = Math.random() > 0.2; // 80% have WhatsApp
    const hasEmail = Math.random() > 0.1; // 90% have email consent
    const hasSMS = Math.random() > 0.4; // 60% have SMS
    const hasVoice = Math.random() > 0.5; // 50% have voice

    const emailDomain = company
      ? company.domain
      : randomItem(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'rediffmail.com']);

    const contactData = {
      id: contactId,
      tenantId: tenant.id,
      firstName,
      lastName,
      displayName: fullName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${emailDomain}`,
      phone: generatePhone(),
      mobilePhone: generatePhone(),
      jobTitle: randomItem(jobTitles),
      department: randomItem(departments),
      source: randomItem(sources),
      status: 'ACTIVE',
      lifecycleStage: randomItem(lifecycleStages),
      leadStatus: randomItem(leadStatuses),
      leadScore: randomInt(10, 100),
      rating: randomItem(ratings),
      priority: randomItem(priorities),
      ownerId: owner.id,
      marketingConsent: hasEmail,
      whatsappConsent: hasWhatsApp,
      emailConsent: hasEmail,
      smsConsent: hasSMS,
      voiceConsent: hasVoice,
      salutation: randomItem(['Mr.', 'Ms.', 'Mrs.', 'Dr.', '']),
      preferredLanguage: randomItem(['en', 'hi', 'ta', 'te', 'mr', 'gu', 'kn', 'ml', 'bn', 'pa']),
      preferredContactMethod: hasWhatsApp
        ? 'WHATSAPP'
        : hasEmail
          ? 'EMAIL'
          : hasSMS
            ? 'SMS'
            : 'PHONE',
      billingAddress: `${randomInt(1, 500)}, ${randomItem(['MG Road', 'Station Road', 'Ring Road', 'Main Street', 'Park Avenue'])}`,
      billingCity: location.city,
      billingState: location.state,
      billingStateCode: location.stateCode,
      billingPincode: location.pincode,
      emailCount: hasEmail ? randomInt(0, 50) : 0,
      callCount: hasVoice ? randomInt(0, 20) : 0,
      meetingCount: randomInt(0, 10),
      outreachCount: randomInt(0, 30),
      broadcastCount: hasWhatsApp || hasSMS ? randomInt(0, 15) : 0,
      marketingEmailCount: hasEmail ? randomInt(0, 25) : 0,
      marketingEmailOpenCount: hasEmail ? randomInt(0, 15) : 0,
      marketingEmailClickCount: hasEmail ? randomInt(0, 8) : 0,
      sequenceCount: randomInt(0, 5),
      lastActivityAt: new Date(Date.now() - randomInt(0, 30) * 24 * 60 * 60 * 1000),
      lastContactedDate: new Date(Date.now() - randomInt(0, 15) * 24 * 60 * 60 * 1000),
      lastEngagementDate: new Date(Date.now() - randomInt(0, 7) * 24 * 60 * 60 * 1000),
      lastEngagementType: randomItem(['EMAIL', 'WHATSAPP', 'CALL', 'MEETING', 'SMS']),
      linkedinUrl:
        Math.random() > 0.3
          ? `https://linkedin.com/in/${firstName.toLowerCase()}${lastName.toLowerCase()}${randomInt(1, 999)}`
          : null,
      twitterUrl:
        Math.random() > 0.6
          ? `https://twitter.com/${firstName.toLowerCase()}_${randomInt(1, 999)}`
          : null,
      isQualified: Math.random() > 0.5,
      contactUnworked: Math.random() > 0.7,
      isTargetAccount: company ? Math.random() > 0.6 : false,
      expectedRevenue: Math.random() > 0.5 ? randomInt(10000, 5000000) : null,
      likelihoodToClose: randomInt(10, 100),
    };

    // Add company relation if company exists
    if (company) {
      contactData.companyId = company.id;
    }

    const contact = await prisma.contact.upsert({
      where: { id: contactId },
      update: {},
      create: contactData,
    });
    contacts.push(contact);
  }
  console.log(`  Created ${contacts.length} contacts\n`);

  // ==================== 4. ASSIGN TAGS TO CONTACTS ====================
  console.log('Assigning tags to contacts...');

  const whatsappTag = tags.find((t) => t.name === 'WhatsApp Active');
  const emailTag = tags.find((t) => t.name === 'Email Subscriber');
  const smsTag = tags.find((t) => t.name === 'SMS Opted-In');
  const voiceTag = tags.find((t) => t.name === 'Voice Preferred');
  const vipTag = tags.find((t) => t.name === 'VIP Customer');
  const hotLeadTag = tags.find((t) => t.name === 'Hot Lead');
  const enterpriseTag = tags.find((t) => t.name === 'Enterprise');

  const tagAssignments = [];

  for (const contact of contacts) {
    // Tag based on communication preferences
    if (contact.whatsappConsent && whatsappTag) {
      tagAssignments.push({ contactId: contact.id, tagId: whatsappTag.id });
    }
    if (contact.emailConsent && emailTag) {
      tagAssignments.push({ contactId: contact.id, tagId: emailTag.id });
    }
    if (contact.smsConsent && smsTag) {
      tagAssignments.push({ contactId: contact.id, tagId: smsTag.id });
    }
    if (contact.voiceConsent && voiceTag) {
      tagAssignments.push({ contactId: contact.id, tagId: voiceTag.id });
    }

    // Random VIP, Hot Lead, Enterprise tags
    if (contact.leadScore > 85 && vipTag) {
      tagAssignments.push({ contactId: contact.id, tagId: vipTag.id });
    }
    if (contact.rating === 'HOT' && hotLeadTag) {
      tagAssignments.push({ contactId: contact.id, tagId: hotLeadTag.id });
    }
    if (contact.isTargetAccount && enterpriseTag) {
      tagAssignments.push({ contactId: contact.id, tagId: enterpriseTag.id });
    }
  }

  await prisma.contactTag.createMany({
    data: tagAssignments,
    skipDuplicates: true,
  });
  console.log(`  Assigned ${tagAssignments.length} tags to contacts\n`);

  // ==================== 5. CREATE CHANNEL ACCOUNTS ====================
  console.log('Creating channel accounts...');

  // WhatsApp Channel Account
  const whatsappChannel = await prisma.channelAccount.upsert({
    where: { id: `wa-channel-${tenant.id}` },
    update: {},
    create: {
      id: `wa-channel-${tenant.id}`,
      tenantId: tenant.id,
      type: 'WHATSAPP',
      name: 'Main WhatsApp Business',
      provider: 'MSG91',
      phoneNumber: '+91 9876500001',
      status: 'ACTIVE',
      healthStatus: 'HEALTHY',
      isDefault: true,
      businessDisplayName: 'Helix Code Support',
      businessVerified: true,
    },
  });

  // Email Channel Account
  const emailChannel = await prisma.channelAccount.upsert({
    where: { id: `email-channel-${tenant.id}` },
    update: {},
    create: {
      id: `email-channel-${tenant.id}`,
      tenantId: tenant.id,
      type: 'EMAIL_SMTP',
      name: 'Main Email Account',
      provider: 'RESEND',
      emailAddress: 'support@72orionx.com',
      status: 'ACTIVE',
      healthStatus: 'HEALTHY',
      isDefault: true,
    },
  });

  // SMS Channel Account
  const smsChannel = await prisma.channelAccount.upsert({
    where: { id: `sms-channel-${tenant.id}` },
    update: {},
    create: {
      id: `sms-channel-${tenant.id}`,
      tenantId: tenant.id,
      type: 'SMS',
      name: 'Main SMS Gateway',
      provider: 'MSG91',
      senderId: 'HELIXC',
      status: 'ACTIVE',
      healthStatus: 'HEALTHY',
      isDefault: true,
    },
  });

  // Voice Channel Account
  const voiceChannel = await prisma.channelAccount.upsert({
    where: { id: `voice-channel-${tenant.id}` },
    update: {},
    create: {
      id: `voice-channel-${tenant.id}`,
      tenantId: tenant.id,
      type: 'VOICE',
      name: 'Main Voice Line',
      provider: 'TELECMI',
      callerId: '+91 1800123456',
      status: 'ACTIVE',
      healthStatus: 'HEALTHY',
      isDefault: true,
      recordingEnabled: true,
    },
  });

  console.log('  Created 4 channel accounts (WhatsApp, Email, SMS, Voice)\n');

  // ==================== 5B. CREATE CHANNELS (for inbox filtering) ====================
  console.log('Creating channels for inbox...');

  // Channel model is different from ChannelAccount - used for inbox filtering
  const waChannel = await prisma.channel.upsert({
    where: { id: `channel-wa-${tenant.id}` },
    update: {},
    create: {
      id: `channel-wa-${tenant.id}`,
      tenantId: tenant.id,
      type: 'WHATSAPP',
      name: 'WhatsApp Business',
      provider: 'MSG91',
      phoneNumber: '+91 9876500001',
      status: 'ACTIVE',
    },
  });

  const emailChChannel = await prisma.channel.upsert({
    where: { id: `channel-email-${tenant.id}` },
    update: {},
    create: {
      id: `channel-email-${tenant.id}`,
      tenantId: tenant.id,
      type: 'EMAIL',
      name: 'Email Channel',
      provider: 'RESEND',
      status: 'ACTIVE',
    },
  });

  const smsChChannel = await prisma.channel.upsert({
    where: { id: `channel-sms-${tenant.id}` },
    update: {},
    create: {
      id: `channel-sms-${tenant.id}`,
      tenantId: tenant.id,
      type: 'SMS',
      name: 'SMS Gateway',
      provider: 'MSG91',
      status: 'ACTIVE',
    },
  });

  console.log('  Created 3 channels (WhatsApp, Email, SMS)\n');

  // ==================== 6. CREATE CONVERSATIONS (for inbox) ====================
  console.log('Creating conversations for inbox...');

  const conversations = [];
  const selectedContacts = contacts.filter(
    (c) => c.whatsappConsent || c.emailConsent || c.smsConsent
  );

  // Create 30 Conversation records (queried by inbox)
  for (let i = 0; i < Math.min(30, selectedContacts.length); i++) {
    const contact = selectedContacts[i];
    const channelType = contact.whatsappConsent
      ? 'WHATSAPP'
      : contact.emailConsent
        ? 'EMAIL'
        : 'SMS';
    const channelId =
      channelType === 'WHATSAPP'
        ? waChannel.id
        : channelType === 'EMAIL'
          ? emailChChannel.id
          : smsChChannel.id;
    const assignee = randomItem(users);
    const convId = `conv-${i + 1}-${tenant.id}`;

    const conversation = await prisma.conversation.upsert({
      where: { id: convId },
      update: {},
      create: {
        id: convId,
        tenantId: tenant.id,
        channelId: channelId,
        channelType: channelType,
        contactId: contact.id,
        contactPhone: contact.phone,
        contactName: `${contact.firstName} ${contact.lastName}`,
        status: randomItem(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']),
        assignedToId: assignee.id,
        lastCustomerMessageAt: new Date(Date.now() - randomInt(0, 5) * 24 * 60 * 60 * 1000),
        lastMessagePreview: randomItem([
          'Thank you for your response!',
          'I have a question about the pricing...',
          'Can you help me with this issue?',
          'Looking forward to our call tomorrow',
          'Please find the attached document',
          'Great, let me know if you need anything else',
          "I'll get back to you shortly",
          'Thanks for reaching out!',
        ]),
        unreadCount: randomInt(0, 5),
      },
    });
    conversations.push(conversation);
  }
  console.log(`  Created ${conversations.length} conversations for inbox\n`);

  // ==================== 7. CREATE CONVERSATION THREADS ====================
  console.log('Creating conversation threads...');

  const threads = [];

  // Create 30 conversation threads
  for (let i = 0; i < Math.min(30, selectedContacts.length); i++) {
    const contact = selectedContacts[i];
    const channel = contact.whatsappConsent
      ? 'WHATSAPP'
      : contact.emailConsent
        ? 'EMAIL_SMTP'
        : 'SMS';
    const assignee = randomItem(users);
    const threadId = `thread-${i + 1}-${tenant.id}`;

    const thread = await prisma.conversationThread.upsert({
      where: { id: threadId },
      update: {},
      create: {
        id: threadId,
        tenantId: tenant.id,
        contactId: contact.id,
        contactPhone: contact.phone,
        contactEmail: contact.email,
        status: randomItem(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']),
        priority: randomItem(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
        purpose: randomItem(['GENERAL', 'SALES', 'SUPPORT', 'SERVICE', 'MARKETING']),
        assignedToId: assignee.id,
        assignedAt: new Date(Date.now() - randomInt(0, 7) * 24 * 60 * 60 * 1000),
        lastMessageAt: new Date(Date.now() - randomInt(0, 3) * 24 * 60 * 60 * 1000),
        lastCustomerMessageAt: new Date(Date.now() - randomInt(0, 5) * 24 * 60 * 60 * 1000),
        lastAgentMessageAt: new Date(Date.now() - randomInt(0, 2) * 24 * 60 * 60 * 1000),
        unreadCount: randomInt(0, 5),
        messageCount: randomInt(2, 20),
        lastMessagePreview: randomItem([
          'Thank you for your response!',
          'I have a question about the pricing...',
          'Can you help me with this issue?',
          'Looking forward to our call tomorrow',
          'Please find the attached document',
          'Great, let me know if you need anything else',
          "I'll get back to you shortly",
          'Thanks for reaching out!',
        ]),
        lastMessageChannel: channel,
        isStarred: Math.random() > 0.8,
      },
    });
    threads.push(thread);
  }
  console.log(`  Created ${threads.length} conversation threads\n`);

  // ==================== 7. CREATE MESSAGE EVENTS ====================
  console.log('Creating message events...');

  const messageTemplates = {
    WHATSAPP: [
      {
        content: 'Hi {name}, thank you for contacting us! How can we help you today?',
        type: 'OUTBOUND',
      },
      { content: 'I need help with my subscription', type: 'INBOUND' },
      {
        content: "Sure, I'd be happy to help. Can you share your account email?",
        type: 'OUTBOUND',
      },
      { content: "It's {email}", type: 'INBOUND' },
      {
        content: 'Great, I found your account. What specific issue are you facing?',
        type: 'OUTBOUND',
      },
      { content: "I can't access the dashboard", type: 'INBOUND' },
      { content: 'Let me check that for you. One moment please.', type: 'OUTBOUND' },
      { content: "I've reset your access. Please try logging in again.", type: 'OUTBOUND' },
      { content: "It's working now, thank you!", type: 'INBOUND' },
      { content: 'Wonderful! Is there anything else I can help you with?', type: 'OUTBOUND' },
    ],
    EMAIL_SMTP: [
      {
        subject: 'Welcome to Nexora CRM!',
        content: 'Dear {name}, Thank you for signing up...',
        type: 'OUTBOUND',
      },
      {
        subject: 'Re: Welcome to Nexora CRM!',
        content: 'Thank you for the warm welcome...',
        type: 'INBOUND',
      },
      {
        subject: 'Your Monthly Report is Ready',
        content: 'Hi {name}, Your monthly analytics report is now available...',
        type: 'OUTBOUND',
      },
      {
        subject: 'Question about Features',
        content: 'Hi team, I wanted to ask about...',
        type: 'INBOUND',
      },
      {
        subject: 'Re: Question about Features',
        content: "Hi {name}, Great question! Here's how it works...",
        type: 'OUTBOUND',
      },
      {
        subject: 'Subscription Renewal Reminder',
        content: 'Dear {name}, Your subscription is due for renewal...',
        type: 'OUTBOUND',
      },
      {
        subject: 'Invoice #INV-2024-001',
        content: 'Please find attached your invoice...',
        type: 'OUTBOUND',
      },
    ],
    SMS: [
      { content: 'Hi {name}, your OTP is 123456. Valid for 10 mins.', type: 'OUTBOUND' },
      { content: 'Your appointment is confirmed for tomorrow at 3 PM.', type: 'OUTBOUND' },
      { content: 'Payment of Rs.5000 received. Thank you!', type: 'OUTBOUND' },
      { content: 'Your order #ORD123 has been shipped!', type: 'OUTBOUND' },
      { content: 'Reminder: Meeting with {company} at 2 PM today.', type: 'OUTBOUND' },
    ],
  };

  let messageCount = 0;

  for (const thread of threads) {
    const contact = contacts.find((c) => c.id === thread.contactId);
    const channel = thread.lastMessageChannel || 'WHATSAPP';
    const channelAccount =
      channel === 'WHATSAPP'
        ? whatsappChannel
        : channel === 'EMAIL_SMTP'
          ? emailChannel
          : smsChannel;
    const templates = messageTemplates[channel] || messageTemplates.WHATSAPP;

    // Create 3-8 messages per thread
    const numMessages = randomInt(3, 8);

    for (let j = 0; j < numMessages; j++) {
      const template = templates[j % templates.length];
      const messageId = `msg-${thread.id}-${j + 1}`;
      const isInbound = template.type === 'INBOUND';

      const textContent = template.content
        .replace('{name}', contact?.firstName || 'Customer')
        .replace('{email}', contact?.email || 'customer@example.com')
        .replace('{company}', 'Helix Code');

      await prisma.message_events.upsert({
        where: { id: messageId },
        update: {},
        create: {
          id: messageId,
          tenantId: tenant.id,
          threadId: thread.id,
          channelAccountId: channelAccount.id,
          channel: channel,
          direction: isInbound ? 'INBOUND' : 'OUTBOUND',
          contentType: 'TEXT',
          textContent,
          subject: template.subject || null,
          status: randomItem(['SENT', 'DELIVERED', 'READ']),
          sentAt: new Date(Date.now() - randomInt(0, 7 * 24 * 60) * 60 * 1000),
          deliveredAt: new Date(Date.now() - randomInt(0, 7 * 24 * 59) * 60 * 1000),
          readAt:
            Math.random() > 0.3
              ? new Date(Date.now() - randomInt(0, 7 * 24 * 58) * 60 * 1000)
              : null,
        },
      });
      messageCount++;
    }
  }
  console.log(`  Created ${messageCount} message events\n`);

  // ==================== 8. CREATE ACTIVITIES ====================
  console.log('Creating activities...');

  const activityTypes = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK', 'WHATSAPP_SENT', 'SMS_SENT'];
  let activityCount = 0;

  for (const contact of contacts.slice(0, 40)) {
    const numActivities = randomInt(1, 5);

    for (let j = 0; j < numActivities; j++) {
      const activityType = randomItem(activityTypes);
      const assignee = randomItem(users);
      const activityId = `activity-${contact.id}-${j + 1}`;

      await prisma.activity.upsert({
        where: { id: activityId },
        update: {},
        create: {
          id: activityId,
          tenantId: tenant.id,
          type: activityType,
          subject: randomItem([
            'Initial discovery call',
            'Follow-up email sent',
            'Product demo scheduled',
            'Pricing discussion',
            'Contract review meeting',
            'Onboarding call',
            'Support ticket resolved',
            'Quarterly review',
            'WhatsApp follow-up',
            'SMS notification sent',
          ]),
          description: `${activityType} activity with ${contact.firstName} ${contact.lastName}`,
          contactId: contact.id,
          companyId: contact.companyId,
          assignedToId: assignee.id,
          createdById: assignee.id,
          priority: randomItem(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
          channel:
            activityType === 'WHATSAPP_SENT'
              ? 'WHATSAPP'
              : activityType === 'SMS_SENT'
                ? 'SMS'
                : activityType === 'EMAIL'
                  ? 'EMAIL'
                  : activityType === 'CALL'
                    ? 'VOICE'
                    : null,
          dueDate:
            Math.random() > 0.5
              ? new Date(Date.now() + randomInt(1, 14) * 24 * 60 * 60 * 1000)
              : null,
          completedAt:
            Math.random() > 0.4
              ? new Date(Date.now() - randomInt(0, 7) * 24 * 60 * 60 * 1000)
              : null,
          callDuration: activityType === 'CALL' ? randomInt(60, 1800) : null,
          callOutcome:
            activityType === 'CALL'
              ? randomItem(['ANSWERED', 'NO_ANSWER', 'VOICEMAIL', 'BUSY', 'WRONG_NUMBER'])
              : null,
        },
      });
      activityCount++;
    }
  }
  console.log(`  Created ${activityCount} activities\n`);

  // ==================== 9. CREATE CALL SESSIONS ====================
  console.log('Creating call sessions...');

  const callContacts = contacts.filter((c) => c.voiceConsent).slice(0, 20);
  let callCount = 0;

  for (const contact of callContacts) {
    const numCalls = randomInt(1, 3);

    for (let j = 0; j < numCalls; j++) {
      const agent = randomItem(users);
      const callId = `call-${contact.id}-${j + 1}`;
      const startTime = new Date(Date.now() - randomInt(1, 30) * 24 * 60 * 60 * 1000);
      const duration = randomInt(30, 1800);

      await prisma.callSession.upsert({
        where: { id: callId },
        update: {},
        create: {
          id: callId,
          tenantId: tenant.id,
          channelAccountId: voiceChannel.id,
          contactId: contact.id,
          threadId: threads[callCount % threads.length]?.id || null,
          agentId: agent.id,
          direction: randomItem(['INBOUND', 'OUTBOUND']),
          status: randomItem(['COMPLETED', 'MISSED', 'BUSY', 'FAILED', 'CANCELLED']),
          fromNumber: contact.phone,
          toNumber: voiceChannel.callerId,
          initiatedAt: startTime,
          answeredAt: new Date(startTime.getTime() + 5000),
          endedAt: new Date(startTime.getTime() + duration * 1000),
          duration,
          recordingUrl: Math.random() > 0.3 ? `https://recordings.example.com/${callId}.mp3` : null,
          recordingDuration: duration,
          disposition: randomItem([
            'INTERESTED',
            'NOT_INTERESTED',
            'CALLBACK',
            'DO_NOT_CALL',
            'FOLLOW_UP',
            null,
          ]),
          notes:
            Math.random() > 0.3
              ? {
                  content: randomItem([
                    'Customer inquired about enterprise pricing',
                    'Scheduled follow-up demo',
                    'Resolved billing question',
                    'Left voicemail with callback number',
                    'Customer requested product documentation',
                  ]),
                }
              : null,
        },
      });
      callCount++;
    }
  }
  console.log(`  Created ${callCount} call sessions\n`);

  // ==================== SUMMARY ====================
  console.log('='.repeat(50));
  console.log('SEED COMPLETE!');
  console.log('='.repeat(50));
  console.log(`Companies: ${companies.length}`);
  console.log(`Contacts: ${contacts.length}`);
  console.log(`Tags: ${tags.length}`);
  console.log(`Tag Assignments: ${tagAssignments.length}`);
  console.log(`Conversation Threads: ${threads.length}`);
  console.log(`Messages: ${messageCount}`);
  console.log(`Activities: ${activityCount}`);
  console.log(`Call Sessions: ${callCount}`);
  console.log('='.repeat(50));

  console.log('\nChannel Distribution:');
  const waContacts = contacts.filter((c) => c.whatsappConsent).length;
  const emailContacts = contacts.filter((c) => c.emailConsent).length;
  const smsContacts = contacts.filter((c) => c.smsConsent).length;
  const voiceContacts = contacts.filter((c) => c.voiceConsent).length;
  console.log(
    `  WhatsApp Opted-In: ${waContacts} (${Math.round((waContacts / contacts.length) * 100)}%)`
  );
  console.log(
    `  Email Opted-In: ${emailContacts} (${Math.round((emailContacts / contacts.length) * 100)}%)`
  );
  console.log(
    `  SMS Opted-In: ${smsContacts} (${Math.round((smsContacts / contacts.length) * 100)}%)`
  );
  console.log(
    `  Voice Opted-In: ${voiceContacts} (${Math.round((voiceContacts / contacts.length) * 100)}%)`
  );
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
