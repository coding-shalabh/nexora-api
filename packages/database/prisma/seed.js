import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ==================== PLATFORM SUPER ADMIN ====================
  // This is the Nexora CRM platform admin account (for managing the SaaS)
  const platformTenant = await prisma.tenant.upsert({
    where: { slug: 'nexora-platform' },
    update: {},
    create: {
      name: 'Nexora CRM Platform',
      slug: 'nexora-platform',
      domain: 'nexora.app',
      email: 'adminio@72orionx.com',
      phone: '+91 9876543210',
      timezone: 'Asia/Kolkata',
      currency: 'USD',
      locale: 'en-US',
      industry: 'Technology',
      size: '10-50',
      status: 'ACTIVE',
      settings: {
        branding: { primaryColor: '#6366f1' },
        isPlatformAdmin: true,
      },
    },
  });
  console.log('Created platform tenant:', platformTenant.name);

  // Create platform super admin user
  const platformPasswordHash = await bcrypt.hash('Helixcodeinc@2005', 12);
  const platformAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: platformTenant.id, email: 'adminio@72orionx.com' } },
    update: { passwordHash: platformPasswordHash },
    create: {
      tenantId: platformTenant.id,
      email: 'adminio@72orionx.com',
      firstName: 'Super',
      lastName: 'Admin',
      displayName: 'Platform Admin',
      phone: '+91 9876543210',
      passwordHash: platformPasswordHash,
      emailVerified: true,
      status: 'ACTIVE',
      settings: {
        preferences: { theme: 'system', language: 'en' },
        isPlatformSuperAdmin: true,
      },
    },
  });
  console.log('Created platform super admin:', platformAdmin.email);

  // Create platform workspace
  let platformWorkspace = await prisma.workspace.findFirst({
    where: { tenantId: platformTenant.id, isDefault: true },
  });

  if (!platformWorkspace) {
    platformWorkspace = await prisma.workspace.create({
      data: {
        tenantId: platformTenant.id,
        name: 'Platform Workspace',
        isDefault: true,
        status: 'ACTIVE',
      },
    });
    console.log('Created platform workspace:', platformWorkspace.name);
  }

  // Link platform admin to workspace
  await prisma.userWorkspace.upsert({
    where: { userId_workspaceId: { userId: platformAdmin.id, workspaceId: platformWorkspace.id } },
    update: {},
    create: { userId: platformAdmin.id, workspaceId: platformWorkspace.id },
  });

  // ==================== TEST CUSTOMER TENANT ====================
  // Create tenant (Test Customer - simulating a business using Nexora CRM)
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'helix-code' },
    update: {},
    create: {
      name: 'Helix Code Inc.',
      slug: 'helix-code',
      domain: '72orionx.com',
      email: 'hello@72orionx.com',
      phone: '+91 9876543210',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      locale: 'en-IN',
      industry: 'Technology',
      size: '10-50',
      status: 'ACTIVE',
      settings: {
        branding: { primaryColor: '#6366f1' },
      },
    },
  });
  console.log('Created tenant:', tenant.name);

  // Create workspace - use findFirst to find by tenant, then create if not exists
  let workspace = await prisma.workspace.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        tenantId: tenant.id,
        name: 'Main Workspace',
        isDefault: true,
        status: 'ACTIVE',
      },
    });
    console.log('Created workspace:', workspace.name);
  } else {
    console.log('Workspace exists:', workspace.name);
  }

  // Create permissions
  const permissionCodes = [
    // Wildcard for super admin
    { code: '*', name: 'Full Access', module: 'system' },
    // CRM permissions
    { code: 'crm:contacts:read', name: 'View Contacts', module: 'crm' },
    { code: 'crm:contacts:create', name: 'Create Contacts', module: 'crm' },
    { code: 'crm:contacts:update', name: 'Update Contacts', module: 'crm' },
    { code: 'crm:contacts:delete', name: 'Delete Contacts', module: 'crm' },
    { code: 'crm:companies:read', name: 'View Companies', module: 'crm' },
    { code: 'crm:companies:create', name: 'Create Companies', module: 'crm' },
    { code: 'crm:companies:update', name: 'Update Companies', module: 'crm' },
    { code: 'crm:companies:delete', name: 'Delete Companies', module: 'crm' },
    { code: 'crm:activities:read', name: 'View Activities', module: 'crm' },
    { code: 'crm:activities:create', name: 'Create Activities', module: 'crm' },
    { code: 'crm:activities:update', name: 'Update Activities', module: 'crm' },
    { code: 'crm:activities:delete', name: 'Delete Activities', module: 'crm' },
    { code: 'crm:segments:read', name: 'View Segments', module: 'crm' },
    { code: 'crm:segments:create', name: 'Create Segments', module: 'crm' },
    { code: 'crm:segments:update', name: 'Update Segments', module: 'crm' },
    { code: 'crm:segments:delete', name: 'Delete Segments', module: 'crm' },
    { code: 'crm:leads:read', name: 'View Leads', module: 'crm' },
    { code: 'crm:leads:create', name: 'Create Leads', module: 'crm' },
    { code: 'crm:leads:update', name: 'Update Leads', module: 'crm' },
    { code: 'crm:leads:delete', name: 'Delete Leads', module: 'crm' },
    // Pipeline permissions
    { code: 'pipeline:read', name: 'View Pipeline', module: 'pipeline' },
    { code: 'pipeline:leads:read', name: 'View Leads', module: 'pipeline' },
    { code: 'pipeline:leads:create', name: 'Create Leads', module: 'pipeline' },
    { code: 'pipeline:leads:update', name: 'Update Leads', module: 'pipeline' },
    { code: 'pipeline:leads:delete', name: 'Delete Leads', module: 'pipeline' },
    { code: 'pipeline:deals:read', name: 'View Deals', module: 'pipeline' },
    { code: 'pipeline:deals:create', name: 'Create Deals', module: 'pipeline' },
    { code: 'pipeline:deals:update', name: 'Update Deals', module: 'pipeline' },
    { code: 'pipeline:deals:delete', name: 'Delete Deals', module: 'pipeline' },
    { code: 'pipeline:products:read', name: 'View Products', module: 'pipeline' },
    { code: 'pipeline:products:create', name: 'Create Products', module: 'pipeline' },
    { code: 'pipeline:products:update', name: 'Update Products', module: 'pipeline' },
    { code: 'pipeline:products:delete', name: 'Delete Products', module: 'pipeline' },
    // Billing permissions
    { code: 'billing:quotes:read', name: 'View Quotes', module: 'billing' },
    { code: 'billing:quotes:create', name: 'Create Quotes', module: 'billing' },
    { code: 'billing:quotes:update', name: 'Update Quotes', module: 'billing' },
    { code: 'billing:quotes:delete', name: 'Delete Quotes', module: 'billing' },
    { code: 'billing:quotes:send', name: 'Send Quotes', module: 'billing' },
    { code: 'billing:invoices:read', name: 'View Invoices', module: 'billing' },
    { code: 'billing:invoices:create', name: 'Create Invoices', module: 'billing' },
    { code: 'billing:invoices:update', name: 'Update Invoices', module: 'billing' },
    { code: 'billing:invoices:delete', name: 'Delete Invoices', module: 'billing' },
    { code: 'billing:invoices:send', name: 'Send Invoices', module: 'billing' },
    { code: 'billing:payments:read', name: 'View Payments', module: 'billing' },
    { code: 'billing:payments:create', name: 'Create Payments', module: 'billing' },
    { code: 'billing:payments:refund', name: 'Refund Payments', module: 'billing' },
    // Inbox permissions
    { code: 'inbox:conversations:read', name: 'View Conversations', module: 'inbox' },
    { code: 'inbox:conversations:update', name: 'Update Conversations', module: 'inbox' },
    { code: 'inbox:conversations:assign', name: 'Assign Conversations', module: 'inbox' },
    { code: 'inbox:messages:send', name: 'Send Messages', module: 'inbox' },
    { code: 'inbox:templates:read', name: 'View Templates', module: 'inbox' },
    { code: 'inbox:templates:create', name: 'Create Templates', module: 'inbox' },
    { code: 'inbox:templates:update', name: 'Update Templates', module: 'inbox' },
    { code: 'inbox:templates:delete', name: 'Delete Templates', module: 'inbox' },
    { code: 'inbox:channels:read', name: 'View Channels', module: 'inbox' },
    // Settings permissions
    { code: 'settings:read', name: 'View Settings', module: 'settings' },
    { code: 'settings:update', name: 'Update Settings', module: 'settings' },
    { code: 'settings:users:read', name: 'View Users', module: 'settings' },
    { code: 'settings:users:create', name: 'Invite Users', module: 'settings' },
    { code: 'settings:users:update', name: 'Update Users', module: 'settings' },
    { code: 'settings:users:delete', name: 'Delete Users', module: 'settings' },
    { code: 'settings:billing:read', name: 'View Billing', module: 'settings' },
    { code: 'settings:billing:update', name: 'Update Billing', module: 'settings' },
    // Analytics permissions
    { code: 'analytics:read', name: 'View Analytics', module: 'analytics' },
  ];

  for (const perm of permissionCodes) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }
  console.log('Created permissions');

  // Create role
  const adminRole = await prisma.role.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'Admin' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: 'Admin',
      description: 'Full access to all features',
      isSystem: true,
    },
  });

  // Assign all permissions to admin role
  const permissions = await prisma.permission.findMany();
  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: perm.id },
    });
  }
  console.log('Created admin role with permissions');

  // Create user (Test Customer Admin)
  const passwordHash = await bcrypt.hash('Helixcodeinc@2005', 12);
  const user = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'hello@72orionx.com' } },
    update: {
      passwordHash,
    },
    create: {
      tenantId: tenant.id,
      email: 'hello@72orionx.com',
      firstName: 'Helix',
      lastName: 'Admin',
      displayName: 'Helix Admin',
      phone: '+91 9876543210',
      passwordHash,
      emailVerified: true,
      status: 'ACTIVE',
      settings: {
        preferences: { theme: 'system', language: 'en' },
      },
    },
  });

  // Link user to workspace
  await prisma.userWorkspace.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    update: {},
    create: { userId: user.id, workspaceId: workspace.id },
  });

  // Link user to role
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: {},
    create: { userId: user.id, roleId: adminRole.id },
  });
  console.log('Created user:', user.email);

  // Create Channel Accounts (new unified model)
  const whatsappChannel = await prisma.channelAccount.upsert({
    where: { id: 'whatsapp-channel-1' },
    update: {},
    create: {
      id: 'whatsapp-channel-1',
      tenantId: tenant.id,
      type: 'WHATSAPP',
      name: 'WhatsApp Business',
      phoneNumber: '+1 800 555 0100',
      provider: 'MSG91',
      status: 'ACTIVE',
      healthStatus: 'HEALTHY',
      verifiedAt: new Date(),
    },
  });

  const smsChannel = await prisma.channelAccount.upsert({
    where: { id: 'sms-channel-1' },
    update: {},
    create: {
      id: 'sms-channel-1',
      tenantId: tenant.id,
      type: 'SMS',
      name: 'SMS Gateway',
      phoneNumber: '+1 800 555 0101',
      senderId: 'ACMECO',
      provider: 'MSG91',
      status: 'ACTIVE',
      healthStatus: 'HEALTHY',
      verifiedAt: new Date(),
    },
  });

  const emailChannel = await prisma.channelAccount.upsert({
    where: { id: 'email-channel-1' },
    update: {},
    create: {
      id: 'email-channel-1',
      tenantId: tenant.id,
      type: 'EMAIL_SMTP',
      name: 'Helix Support Email',
      emailAddress: 'hello@72orionx.com',
      provider: 'SMTP',
      status: 'ACTIVE',
      healthStatus: 'HEALTHY',
      verifiedAt: new Date(),
    },
  });

  const voiceChannel = await prisma.channelAccount.upsert({
    where: { id: 'voice-channel-1' },
    update: {},
    create: {
      id: 'voice-channel-1',
      tenantId: tenant.id,
      type: 'VOICE',
      name: 'Voice Line',
      phoneNumber: '+1 800 555 0102',
      callerId: '+1 800 555 0102',
      provider: 'MSG91',
      status: 'ACTIVE',
      healthStatus: 'HEALTHY',
      recordingEnabled: true,
      verifiedAt: new Date(),
    },
  });
  console.log('Created channel accounts');

  // Create contacts with comprehensive data for testing
  const contactsData = [
    {
      firstName: 'John',
      lastName: 'Smith',
      phone: '+12345678900',
      email: 'john.smith@techvision.io',
      jobTitle: 'Chief Technology Officer',
      department: 'Technology',
      lifecycleStage: 'CUSTOMER',
      leadStatus: 'OPEN_DEAL',
      leadScore: 95,
      source: 'Website',
      linkedinUrl: 'https://linkedin.com/in/johnsmith',
      twitterUrl: 'https://twitter.com/johnsmith_tech',
      facebookUrl: 'https://facebook.com/johnsmith.cto',
      rating: 'HOT',
      priority: 'HIGH',
      address: '42, Electronic City Phase 1, Tech Park',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560100',
      gstin: '29AABCT1234A1Z5',
      customFields: {
        bio: 'Experienced CTO with 15+ years in enterprise software development. Led digital transformation initiatives at Fortune 500 companies. Passionate about cloud-native architectures and AI/ML integration.',
        interests: ['Cloud Computing', 'AI/ML', 'Digital Transformation', 'Microservices'],
        preferredContactTime: 'Morning (9 AM - 12 PM)',
        decisionMaker: true,
        budgetAuthority: '₹50 Lakhs+',
        lastMeetingNotes:
          'Very interested in our enterprise solution. Wants to see ROI projections before board presentation.',
        competitorProducts: ['Salesforce', 'Zoho CRM'],
        painPoints: ['Fragmented tools', 'Manual data entry', 'No unified customer view'],
        communicationPreference: 'Email',
      },
      sourceDetails: {
        campaign: 'Enterprise CRM 2024',
        medium: 'organic',
        landingPage: '/enterprise-solutions',
        referrer: 'google.com',
        firstTouchDate: '2024-09-15',
        utmSource: 'google',
        utmMedium: 'organic',
        utmCampaign: 'enterprise-crm-2024',
      },
      tags: ['Enterprise', 'High Value', 'Tech Industry', 'Decision Maker'],
    },
    {
      firstName: 'Sarah',
      lastName: 'Johnson',
      phone: '+12345678901',
      email: 'sarah.johnson@medicareplus.in',
      jobTitle: 'Chief Medical Officer',
      department: 'Medical',
      lifecycleStage: 'OPPORTUNITY',
      leadStatus: 'IN_PROGRESS',
      leadScore: 82,
      source: 'Trade Show',
      linkedinUrl: 'https://linkedin.com/in/drsarahjohnson',
      facebookUrl: 'https://facebook.com/dr.sarah.johnson',
      rating: 'WARM',
      priority: 'HIGH',
      address: 'Sector 44, Institutional Area, Tower B',
      city: 'Noida',
      state: 'Uttar Pradesh',
      country: 'India',
      postalCode: '201301',
      customFields: {
        bio: 'Dr. Sarah Johnson is an accomplished healthcare administrator with MD and MBA degrees. Oversees medical operations across 15 hospitals. Champion of healthcare digitization and patient-centric care.',
        interests: ['Healthcare IT', 'Telemedicine', 'Patient Engagement', 'Compliance'],
        preferredContactTime: 'Afternoon (2 PM - 5 PM)',
        decisionMaker: true,
        budgetAuthority: '₹1 Crore+',
        lastMeetingNotes:
          'Requested healthcare case studies. Very focused on HIPAA-like compliance and patient data security.',
        painPoints: [
          'Multiple disconnected systems',
          'Patient data scattered',
          'Compliance tracking',
        ],
        communicationPreference: 'Phone',
        specializations: ['Hospital Administration', 'Medical Operations', 'Quality Assurance'],
      },
      sourceDetails: {
        campaign: 'Healthcare Summit 2024',
        medium: 'event',
        eventName: 'India Healthcare Summit',
        eventDate: '2024-10-20',
        boothVisit: true,
        businessCardScanned: true,
        followUpPriority: 'High',
      },
      tags: ['Healthcare', 'High Value', 'Compliance Focused', 'Decision Maker'],
    },
    {
      firstName: 'Mike',
      lastName: 'Wilson',
      phone: '+12345678902',
      email: 'mike.wilson@quickmart.in',
      jobTitle: 'Head of Procurement',
      department: 'Operations',
      lifecycleStage: 'LEAD',
      leadStatus: 'NEW',
      leadScore: 65,
      source: 'Website',
      linkedinUrl: 'https://linkedin.com/in/mikewilson',
      rating: 'COLD',
      priority: 'MEDIUM',
      address: 'WeWork Galaxy, MG Road, Suite 501',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560001',
      customFields: {
        bio: 'Procurement specialist with expertise in B2B marketplace operations. 10+ years in supply chain optimization. Looking for tools to streamline vendor management and order tracking.',
        interests: ['Supply Chain', 'Vendor Management', 'Process Automation', 'Cost Optimization'],
        preferredContactTime: 'Late Morning (11 AM - 1 PM)',
        decisionMaker: false,
        reportsTo: 'COO - Rakesh Sharma',
        budgetAuthority: '₹20 Lakhs',
        lastMeetingNotes: 'Initial inquiry via website. Left voicemail, awaiting callback.',
        painPoints: [
          'Manual vendor tracking',
          'Order reconciliation issues',
          'Inventory sync delays',
        ],
        communicationPreference: 'WhatsApp',
      },
      sourceDetails: {
        campaign: 'B2B Solutions',
        medium: 'organic',
        landingPage: '/b2b-marketplace-crm',
        referrer: 'google.com',
        searchQuery: 'b2b procurement crm india',
        formSubmittedAt: '2024-11-28',
      },
      tags: ['E-commerce', 'B2B', 'Procurement', 'New Lead'],
    },
    {
      firstName: 'Emily',
      lastName: 'Brown',
      phone: '+12345678903',
      email: 'emily.brown@skyhighrealty.com',
      jobTitle: 'Sales Director',
      department: 'Sales',
      lifecycleStage: 'OPPORTUNITY',
      leadStatus: 'IN_PROGRESS',
      leadScore: 78,
      source: 'Website',
      linkedinUrl: 'https://linkedin.com/in/emilybrown',
      twitterUrl: 'https://twitter.com/emilybrown_realty',
      facebookUrl: 'https://facebook.com/emilybrown.realestate',
      rating: 'WARM',
      priority: 'HIGH',
      address: 'Brigade Gateway, Rajajinagar, Block A',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560055',
      customFields: {
        bio: 'Dynamic sales leader managing 200+ real estate agents across South India. Expert in luxury and commercial property sales. Seeking mobile-first CRM for field sales teams.',
        interests: ['Mobile CRM', 'Property Management', 'Lead Tracking', 'Agent Performance'],
        preferredContactTime: 'Morning (9 AM - 11 AM)',
        decisionMaker: true,
        budgetAuthority: '₹25 Lakhs',
        lastMeetingNotes:
          'Very keen on mobile app features. Needs offline sync for agents in remote areas. Pricing discussion positive.',
        teamSize: 200,
        painPoints: [
          'No offline mobile access',
          'Poor lead tracking',
          'Agent productivity metrics missing',
        ],
        communicationPreference: 'Phone',
        properties: ['Residential', 'Commercial', 'Luxury Villas'],
      },
      sourceDetails: {
        campaign: 'Real Estate CRM',
        medium: 'organic',
        landingPage: '/real-estate-crm',
        referrer: 'linkedin.com',
        firstTouchDate: '2024-10-05',
      },
      tags: ['Real Estate', 'High Value', 'Mobile First', 'Decision Maker'],
    },
    {
      firstName: 'David',
      lastName: 'Lee',
      phone: '+12345678904',
      email: 'david.lee@paysecure.io',
      jobTitle: 'VP Engineering',
      department: 'Engineering',
      lifecycleStage: 'CUSTOMER',
      leadStatus: 'OPEN_DEAL',
      leadScore: 92,
      source: 'Referral',
      linkedinUrl: 'https://linkedin.com/in/davidlee',
      twitterUrl: 'https://twitter.com/davidlee_fintech',
      facebookUrl: 'https://facebook.com/david.lee.fintech',
      rating: 'HOT',
      priority: 'HIGH',
      address: 'BHIVE Workspace, HSR Layout, 5th Floor',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560102',
      gstin: '29AABCP7890J1Z8',
      customFields: {
        bio: 'VP Engineering at PaySecure with 12+ years in fintech. Led engineering teams at Paytm and PhonePe. Strong advocate for API-first platforms and security-focused development.',
        interests: ['API Integration', 'Payment Security', 'Compliance', 'Automation'],
        preferredContactTime: 'Evening (5 PM - 7 PM)',
        decisionMaker: true,
        budgetAuthority: '₹30 Lakhs',
        lastMeetingNotes:
          'Existing customer - very satisfied. Provided testimonial. Interested in upsell to enterprise tier.',
        painPoints: ['API rate limits', 'Multi-currency support', 'Real-time reporting'],
        communicationPreference: 'Email',
        techStack: ['Node.js', 'Python', 'AWS', 'Kubernetes'],
        certifications: ['AWS Solutions Architect', 'PCI DSS'],
        nps: 9,
        testimonialProvided: true,
        referralsMade: 2,
      },
      sourceDetails: {
        campaign: 'Referral Program',
        medium: 'referral',
        referredBy: 'Amit Sharma - TechVision CTO',
        referralDate: '2024-06-15',
        conversionDate: '2024-07-20',
      },
      tags: ['Fintech', 'Customer', 'High Value', 'Referral Source', 'Testimonial'],
    },
    {
      firstName: 'Lisa',
      lastName: 'Garcia',
      phone: '+12345678905',
      email: 'lisa.garcia@spiceroute.in',
      jobTitle: 'Procurement Manager',
      department: 'Procurement',
      lifecycleStage: 'OPPORTUNITY',
      leadStatus: 'IN_PROGRESS',
      leadScore: 71,
      source: 'Partner Referral',
      linkedinUrl: 'https://linkedin.com/in/lisagarcia',
      rating: 'WARM',
      priority: 'MEDIUM',
      address: 'Connaught Place, Block F, 3rd Floor',
      city: 'New Delhi',
      state: 'Delhi',
      country: 'India',
      postalCode: '110001',
      customFields: {
        bio: 'Procurement manager at SpiceRoute Restaurants with expertise in vendor management for F&B industry. Managing procurement for 25+ restaurant outlets across North India.',
        interests: [
          'Vendor Management',
          'Inventory Control',
          'Cost Reduction',
          'Quality Assurance',
        ],
        preferredContactTime: 'Morning (10 AM - 12 PM)',
        decisionMaker: false,
        reportsTo: 'CFO - Arun Nair',
        budgetAuthority: '₹10 Lakhs',
        lastMeetingNotes:
          'Interested in multi-outlet management features. Wants loyalty program integration. Requested 15% discount for 3-year commitment.',
        painPoints: [
          'No centralized vendor database',
          'Manual reservation tracking',
          'Loyalty program fragmented',
        ],
        communicationPreference: 'Phone',
        outlets: 25,
        cuisineTypes: ['North Indian', 'South Indian', 'Chinese', 'Continental'],
      },
      sourceDetails: {
        campaign: 'Partner Program',
        medium: 'partner',
        partnerName: 'RestaurantTech Solutions',
        partnerContact: 'Priya Sharma',
        referralDate: '2024-09-10',
      },
      tags: ['Hospitality', 'F&B', 'Multi-Location', 'Partner Referral'],
    },
    {
      firstName: 'Robert',
      lastName: 'Martinez',
      phone: '+12345678906',
      email: 'robert.martinez@cloudnine.tech',
      jobTitle: 'Head of Sales',
      department: 'Sales',
      lifecycleStage: 'LEAD',
      leadStatus: 'ATTEMPTED_TO_CONTACT',
      leadScore: 58,
      source: 'LinkedIn',
      linkedinUrl: 'https://linkedin.com/in/robertmartinez',
      twitterUrl: 'https://twitter.com/robert_cloudnine',
      rating: 'COLD',
      priority: 'LOW',
      address: '15, Cyber Hub, DLF Phase 2',
      city: 'Gurugram',
      state: 'Haryana',
      country: 'India',
      postalCode: '122002',
      customFields: {
        bio: 'Sales leader at CloudNine Technologies, a cloud consulting firm. 8+ years in B2B tech sales. Looking for CRM with project management integration.',
        interests: ['Project Integration', 'Client Billing', 'Resource Management', 'Analytics'],
        preferredContactTime: 'Afternoon (3 PM - 5 PM)',
        decisionMaker: true,
        budgetAuthority: '₹15 Lakhs',
        lastMeetingNotes:
          'Demo conducted - impressed with automation. Also evaluating Salesforce. Need to differentiate on pricing and local support.',
        painPoints: [
          'No Jira integration',
          'Manual client billing',
          'Resource allocation tracking',
        ],
        communicationPreference: 'LinkedIn',
        competitors: ['Salesforce Enterprise', 'HubSpot'],
        evaluationCriteria: ['TCO', 'API capabilities', 'Local support', 'Integration options'],
      },
      sourceDetails: {
        campaign: 'LinkedIn Outreach Q4',
        medium: 'social',
        platform: 'LinkedIn',
        connectionDate: '2024-10-15',
        messagesSent: 3,
        responseReceived: true,
      },
      tags: ['Tech Services', 'Consulting', 'Competitive Deal', 'LinkedIn Lead'],
    },
    {
      firstName: 'Jennifer',
      lastName: 'Anderson',
      phone: '+12345678907',
      email: 'jennifer.anderson@buzzmedia.in',
      jobTitle: 'Marketing Director',
      department: 'Marketing',
      lifecycleStage: 'CUSTOMER',
      leadStatus: 'OPEN_DEAL',
      leadScore: 88,
      source: 'Cold Outreach',
      linkedinUrl: 'https://linkedin.com/in/jenniferanderson',
      twitterUrl: 'https://twitter.com/jennifer_digital',
      facebookUrl: 'https://facebook.com/jennifer.anderson.marketing',
      rating: 'HOT',
      priority: 'HIGH',
      address: 'Indiranagar 100 Feet Road, Sigma Tech Park',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560038',
      gstin: '29AABCB7890T1Z8',
      customFields: {
        bio: 'Marketing director specializing in digital campaigns for D2C brands. Expert in social media strategy and influencer marketing. 50+ brand launches managed successfully.',
        interests: [
          'Social Media CRM',
          'Marketing Automation',
          'Analytics',
          'Influencer Management',
        ],
        preferredContactTime: 'Late Afternoon (4 PM - 6 PM)',
        decisionMaker: true,
        budgetAuthority: '₹8 Lakhs',
        lastMeetingNotes:
          'Existing customer since 6 months. QBR scheduled. Contract renewal in 30 days - wants volume discount for adding 20 more users.',
        painPoints: [
          'Manual social tracking',
          'No campaign ROI visibility',
          'Influencer database scattered',
        ],
        communicationPreference: 'Email',
        socialPlatforms: ['Instagram', 'Facebook', 'Twitter', 'YouTube', 'LinkedIn'],
        clientsManaged: 15,
        nps: 8,
        contractEndDate: '2025-02-15',
        upsellPotential: '₹4.8 Lakhs (additional users)',
      },
      sourceDetails: {
        campaign: 'Cold Outreach Q2',
        medium: 'email',
        sequenceUsed: 'Digital Agency Sequence',
        emailsSent: 5,
        openRate: 80,
        replyReceived: true,
        meetingBookedDate: '2024-05-10',
        conversionDate: '2024-06-25',
      },
      tags: ['Digital Marketing', 'Customer', 'Agency', 'Renewal Due', 'Upsell Opportunity'],
    },
  ];

  // Create Tags first (for linking to contacts later)
  const allTagNames = [...new Set(contactsData.flatMap((c) => c.tags || []))];
  const tagColors = {
    Enterprise: '#6366f1',
    'High Value': '#f59e0b',
    'Tech Industry': '#3b82f6',
    'Decision Maker': '#10b981',
    Healthcare: '#ef4444',
    'Compliance Focused': '#8b5cf6',
    'E-commerce': '#ec4899',
    B2B: '#06b6d4',
    Procurement: '#84cc16',
    'New Lead': '#22c55e',
    'Real Estate': '#f97316',
    'Mobile First': '#14b8a6',
    Fintech: '#a855f7',
    Customer: '#059669',
    'Referral Source': '#0891b2',
    Testimonial: '#eab308',
    Hospitality: '#dc2626',
    'F&B': '#d946ef',
    'Multi-Location': '#64748b',
    'Partner Referral': '#7c3aed',
    'Tech Services': '#2563eb',
    Consulting: '#0d9488',
    'Competitive Deal': '#ea580c',
    'LinkedIn Lead': '#0077b5',
    'Digital Marketing': '#e11d48',
    Agency: '#9333ea',
    'Renewal Due': '#f43f5e',
    'Upsell Opportunity': '#16a34a',
  };

  const tags = {};
  for (const tagName of allTagNames) {
    const tag = await prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: tagName } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: tagName,
        color: tagColors[tagName] || '#6b7280',
      },
    });
    tags[tagName] = tag;
  }
  console.log('Created', allTagNames.length, 'tags');

  const contacts = [];
  for (const c of contactsData) {
    const contact = await prisma.contact.upsert({
      where: { id: `contact-${c.phone}` },
      update: {
        // Update all fields if contact exists
        firstName: c.firstName,
        lastName: c.lastName,
        displayName: `${c.firstName} ${c.lastName}`,
        phone: c.phone,
        email: c.email,
        source: c.source || 'Website',
        status: 'ACTIVE',
        marketingConsent: true,
        whatsappConsent: true,
        jobTitle: c.jobTitle,
        department: c.department,
        lifecycleStage: c.lifecycleStage,
        leadStatus: c.leadStatus,
        leadScore: c.leadScore,
        linkedinUrl: c.linkedinUrl,
        twitterUrl: c.twitterUrl,
        facebookUrl: c.facebookUrl,
        rating: c.rating,
        priority: c.priority,
        address: c.address,
        city: c.city,
        state: c.state,
        country: c.country,
        postalCode: c.postalCode,
        gstin: c.gstin,
        customFields: c.customFields,
        sourceDetails: c.sourceDetails,
        ownerId: user.id,
      },
      create: {
        id: `contact-${c.phone}`,
        tenantId: tenant.id,
        firstName: c.firstName,
        lastName: c.lastName,
        displayName: `${c.firstName} ${c.lastName}`,
        phone: c.phone,
        email: c.email,
        source: c.source || 'Website',
        status: 'ACTIVE',
        marketingConsent: true,
        whatsappConsent: true,
        jobTitle: c.jobTitle,
        department: c.department,
        lifecycleStage: c.lifecycleStage,
        leadStatus: c.leadStatus,
        leadScore: c.leadScore,
        linkedinUrl: c.linkedinUrl,
        twitterUrl: c.twitterUrl,
        facebookUrl: c.facebookUrl,
        rating: c.rating,
        priority: c.priority,
        address: c.address,
        city: c.city,
        state: c.state,
        country: c.country,
        postalCode: c.postalCode,
        gstin: c.gstin,
        customFields: c.customFields,
        sourceDetails: c.sourceDetails,
        ownerId: user.id,
      },
    });
    contacts.push(contact);

    // Link contact to tags
    if (c.tags && c.tags.length > 0) {
      for (const tagName of c.tags) {
        const tag = tags[tagName];
        if (tag) {
          await prisma.contactTag.upsert({
            where: { contactId_tagId: { contactId: contact.id, tagId: tag.id } },
            update: {},
            create: { contactId: contact.id, tagId: tag.id },
          });
        }
      }
    }
  }
  console.log('Created', contacts.length, 'contacts with tags');

  // Create demo companies with various business categories and all new fields
  const companiesData = [
    // Technology & Software
    {
      name: 'TechVision Solutions Pvt Ltd',
      domain: 'techvision.io',
      description:
        'Enterprise software development and cloud solutions provider specializing in digital transformation',
      industry: 'Technology',
      employeeCount: '51-200',
      annualRevenue: '₹10Cr - ₹50Cr',
      address: '42, Electronic City Phase 1',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560100',
      gstin: '29AABCT1234A1Z5',
      pan: 'AABCT1234A',
      legalName: 'TechVision Solutions Private Limited',
      stateCode: '29',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
      // New fields
      companyType: 'CUSTOMER',
      lifecycleStage: 'CUSTOMER',
      phone: '+91-80-41234567',
      email: 'contact@techvision.io',
      fax: '+91-80-41234568',
      totalRevenue: 2800000,
      dealsWonCount: 1,
      totalDealValue: 2800000,
      linkedinUrl: 'https://linkedin.com/company/techvision',
      facebookUrl: 'https://facebook.com/techvision',
      twitterUrl: 'https://twitter.com/techvision',
    },
    {
      name: 'CloudNine Technologies',
      domain: 'cloudnine.tech',
      description:
        'Cloud infrastructure and DevOps consulting firm helping businesses scale their operations',
      industry: 'Technology',
      employeeCount: '11-50',
      annualRevenue: '₹5Cr - ₹10Cr',
      address: '15, Cyber Hub, DLF Phase 2',
      city: 'Gurugram',
      state: 'Haryana',
      country: 'India',
      postalCode: '122002',
      gstin: '06AABCC5678B1Z3',
      pan: 'AABCC5678B',
      legalName: 'CloudNine Technologies LLP',
      stateCode: '06',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
      // New fields
      companyType: 'PROSPECT',
      lifecycleStage: 'OPPORTUNITY',
      phone: '+91-124-4567890',
      email: 'info@cloudnine.tech',
      totalRevenue: 0,
      dealsWonCount: 0,
      totalDealValue: 960000,
      linkedinUrl: 'https://linkedin.com/company/cloudnine-tech',
    },
    // Healthcare & Pharmaceuticals
    {
      name: 'MediCare Plus Hospitals',
      domain: 'medicareplus.in',
      description:
        'Multi-specialty hospital chain offering world-class healthcare services across North India',
      industry: 'Healthcare',
      employeeCount: '201-500',
      annualRevenue: '₹100Cr+',
      address: 'Sector 44, Institutional Area',
      city: 'Noida',
      state: 'Uttar Pradesh',
      country: 'India',
      postalCode: '201301',
      gstin: '09AABCM9012C1Z1',
      pan: 'AABCM9012C',
      legalName: 'MediCare Plus Healthcare Pvt Ltd',
      stateCode: '09',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
      // New fields
      companyType: 'PROSPECT',
      lifecycleStage: 'OPPORTUNITY',
      phone: '+91-120-4567890',
      email: 'business@medicareplus.in',
      totalRevenue: 0,
      dealsWonCount: 0,
      totalDealValue: 4500000,
      linkedinUrl: 'https://linkedin.com/company/medicareplus',
    },
    {
      name: 'PharmaTrust Labs',
      domain: 'pharmatrust.com',
      description:
        'Pharmaceutical manufacturing company specializing in generic medicines and APIs',
      industry: 'Pharmaceuticals',
      employeeCount: '501-1000',
      annualRevenue: '₹100Cr+',
      address: 'MIDC Industrial Estate',
      city: 'Aurangabad',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '431136',
      gstin: '27AABCP3456D1Z7',
      pan: 'AABCP3456D',
      legalName: 'PharmaTrust Laboratories Pvt Ltd',
      stateCode: '27',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
      // New fields - Lost customer
      companyType: 'OTHER',
      lifecycleStage: 'CHURNED',
      phone: '+91-240-2345678',
      email: 'procurement@pharmatrust.com',
      totalRevenue: 0,
      dealsWonCount: 0,
      totalDealValue: 0,
    },
    // Manufacturing & Industrial
    {
      name: 'SteelForge Industries',
      domain: 'steelforge.co.in',
      description:
        'Heavy machinery and steel fabrication company serving automotive and construction sectors',
      industry: 'Manufacturing',
      employeeCount: '201-500',
      annualRevenue: '₹50Cr - ₹100Cr',
      address: 'Plot 78, Industrial Area Phase II',
      city: 'Ludhiana',
      state: 'Punjab',
      country: 'India',
      postalCode: '141003',
      gstin: '03AABCS7890E1Z2',
      pan: 'AABCS7890E',
      legalName: 'SteelForge Industries Limited',
      stateCode: '03',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    {
      name: 'GreenPack Solutions',
      domain: 'greenpack.in',
      description:
        'Eco-friendly packaging manufacturer providing sustainable solutions for FMCG companies',
      industry: 'Manufacturing',
      employeeCount: '51-200',
      annualRevenue: '₹10Cr - ₹50Cr',
      address: 'Chakan Industrial Area',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '410501',
      gstin: '27AABCG1234F1Z9',
      pan: 'AABCG1234F',
      legalName: 'GreenPack Solutions Pvt Ltd',
      stateCode: '27',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    // Retail & E-commerce
    {
      name: 'FashionHub Retail',
      domain: 'fashionhub.co.in',
      description: 'Multi-brand fashion retail chain with 50+ stores across metro cities',
      industry: 'Retail',
      employeeCount: '501-1000',
      annualRevenue: '₹100Cr+',
      address: 'Phoenix MarketCity, 4th Floor',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '400070',
      gstin: '27AABCF5678G1Z6',
      pan: 'AABCF5678G',
      legalName: 'FashionHub Retail India Pvt Ltd',
      stateCode: '27',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    {
      name: 'QuickMart Online',
      domain: 'quickmart.in',
      description: 'B2B e-commerce platform for wholesale grocery and FMCG distribution',
      industry: 'E-commerce',
      employeeCount: '51-200',
      annualRevenue: '₹50Cr - ₹100Cr',
      address: 'WeWork Galaxy, MG Road',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560001',
      gstin: '29AABCQ9012H1Z4',
      pan: 'AABCQ9012H',
      legalName: 'QuickMart Commerce Pvt Ltd',
      stateCode: '29',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    // Financial Services
    {
      name: 'WealthWise Advisors',
      domain: 'wealthwise.in',
      description:
        'SEBI registered investment advisory firm specializing in wealth management and portfolio services',
      industry: 'Financial Services',
      employeeCount: '11-50',
      annualRevenue: '₹5Cr - ₹10Cr',
      address: 'Nariman Point, Express Towers',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '400021',
      gstin: '27AABCW3456I1Z1',
      pan: 'AABCW3456I',
      legalName: 'WealthWise Financial Advisors LLP',
      stateCode: '27',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
      // New fields
      companyType: 'PROSPECT',
      lifecycleStage: 'LEAD',
      phone: '+91-22-67890123',
      email: 'business@wealthwise.in',
      totalRevenue: 0,
      dealsWonCount: 0,
      totalDealValue: 900000,
      linkedinUrl: 'https://linkedin.com/company/wealthwise-advisors',
    },
    {
      name: 'PaySecure Fintech',
      domain: 'paysecure.io',
      description: 'Digital payment solutions and merchant services provider with RBI license',
      industry: 'Fintech',
      employeeCount: '51-200',
      annualRevenue: '₹10Cr - ₹50Cr',
      address: 'BHIVE Workspace, HSR Layout',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560102',
      gstin: '29AABCP7890J1Z8',
      pan: 'AABCP7890J',
      legalName: 'PaySecure Fintech Pvt Ltd',
      stateCode: '29',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
      // New fields - CUSTOMER
      companyType: 'CUSTOMER',
      lifecycleStage: 'CUSTOMER',
      phone: '+91-80-45678901',
      email: 'enterprise@paysecure.io',
      totalRevenue: 1500000,
      dealsWonCount: 1,
      totalDealValue: 1500000,
      linkedinUrl: 'https://linkedin.com/company/paysecure',
      twitterUrl: 'https://twitter.com/paysecure',
    },
    // Real Estate & Construction
    {
      name: 'SkyHigh Realty',
      domain: 'skyhighrealty.com',
      description:
        'Premium residential and commercial real estate developer with projects across South India',
      industry: 'Real Estate',
      employeeCount: '201-500',
      annualRevenue: '₹100Cr+',
      address: 'Brigade Gateway, Rajajinagar',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560055',
      gstin: '29AABCS1234K1Z5',
      pan: 'AABCS1234K',
      legalName: 'SkyHigh Realty Developers Pvt Ltd',
      stateCode: '29',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
      // New fields
      companyType: 'PROSPECT',
      lifecycleStage: 'OPPORTUNITY',
      phone: '+91-80-23456789',
      email: 'sales@skyhighrealty.com',
      totalRevenue: 0,
      dealsWonCount: 0,
      totalDealValue: 1800000,
      linkedinUrl: 'https://linkedin.com/company/skyhigh-realty',
      facebookUrl: 'https://facebook.com/skyhighrealty',
    },
    {
      name: 'BuildRight Constructions',
      domain: 'buildright.co.in',
      description:
        'Infrastructure construction company specializing in highways, bridges, and government projects',
      industry: 'Construction',
      employeeCount: '501-1000',
      annualRevenue: '₹100Cr+',
      address: 'Banjara Hills, Road No. 12',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      postalCode: '500034',
      gstin: '36AABCB5678L1Z2',
      pan: 'AABCB5678L',
      legalName: 'BuildRight Infrastructure Pvt Ltd',
      stateCode: '36',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    // Education & EdTech
    {
      name: 'LearnSmart Academy',
      domain: 'learnsmart.edu.in',
      description: 'K-12 education chain with CBSE and IB curriculum schools across 8 cities',
      industry: 'Education',
      employeeCount: '501-1000',
      annualRevenue: '₹50Cr - ₹100Cr',
      address: 'Jubilee Hills, Plot 45',
      city: 'Hyderabad',
      state: 'Telangana',
      country: 'India',
      postalCode: '500033',
      gstin: '36AABCL9012M1Z9',
      pan: 'AABCL9012M',
      legalName: 'LearnSmart Educational Trust',
      stateCode: '36',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    {
      name: 'SkillUp EdTech',
      domain: 'skillup.io',
      description:
        'Online learning platform offering professional certification courses and corporate training',
      industry: 'EdTech',
      employeeCount: '51-200',
      annualRevenue: '₹10Cr - ₹50Cr',
      address: '91 Springboard, Koramangala',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560034',
      gstin: '29AABCS3456N1Z6',
      pan: 'AABCS3456N',
      legalName: 'SkillUp Learning Solutions Pvt Ltd',
      stateCode: '29',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    // Food & Hospitality
    {
      name: 'SpiceRoute Restaurants',
      domain: 'spiceroute.in',
      description: 'Chain of authentic Indian cuisine restaurants with presence in major cities',
      industry: 'Food & Beverage',
      employeeCount: '201-500',
      annualRevenue: '₹10Cr - ₹50Cr',
      address: 'Connaught Place, Block F',
      city: 'New Delhi',
      state: 'Delhi',
      country: 'India',
      postalCode: '110001',
      gstin: '07AABCS7890O1Z3',
      pan: 'AABCS7890O',
      legalName: 'SpiceRoute Hospitality Pvt Ltd',
      stateCode: '07',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    {
      name: 'FreshFarm Organics',
      domain: 'freshfarm.co.in',
      description:
        'Organic food products and farm-to-table delivery service for health-conscious consumers',
      industry: 'Food & Agriculture',
      employeeCount: '51-200',
      annualRevenue: '₹5Cr - ₹10Cr',
      address: 'Whitefield Main Road',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560066',
      gstin: '29AABCF1234P1Z0',
      pan: 'AABCF1234P',
      legalName: 'FreshFarm Organic Foods Pvt Ltd',
      stateCode: '29',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    // Logistics & Transportation
    {
      name: 'SwiftLogix Shipping',
      domain: 'swiftlogix.in',
      description:
        'End-to-end logistics and supply chain management company with pan-India network',
      industry: 'Logistics',
      employeeCount: '201-500',
      annualRevenue: '₹50Cr - ₹100Cr',
      address: 'JNPT Road, Uran',
      city: 'Navi Mumbai',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '400702',
      gstin: '27AABCS5678Q1Z7',
      pan: 'AABCS5678Q',
      legalName: 'SwiftLogix Logistics Pvt Ltd',
      stateCode: '27',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    {
      name: 'RoadRunner Transports',
      domain: 'roadrunner.co.in',
      description: 'Fleet management and inter-city transportation services for B2B clients',
      industry: 'Transportation',
      employeeCount: '51-200',
      annualRevenue: '₹10Cr - ₹50Cr',
      address: 'NH-8, Manesar Industrial Area',
      city: 'Gurugram',
      state: 'Haryana',
      country: 'India',
      postalCode: '122051',
      gstin: '06AABCR9012R1Z4',
      pan: 'AABCR9012R',
      legalName: 'RoadRunner Transport Services Pvt Ltd',
      stateCode: '06',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    // Media & Entertainment
    {
      name: 'PixelPerfect Studios',
      domain: 'pixelperfect.studio',
      description:
        'Creative agency specializing in video production, animation, and digital content',
      industry: 'Media & Entertainment',
      employeeCount: '11-50',
      annualRevenue: '₹5Cr - ₹10Cr',
      address: 'Film City Complex, Goregaon East',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '400065',
      gstin: '27AABCP3456S1Z1',
      pan: 'AABCP3456S',
      legalName: 'PixelPerfect Media Studios LLP',
      stateCode: '27',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    {
      name: 'BuzzMedia Digital',
      domain: 'buzzmedia.in',
      description: 'Digital marketing and social media management agency for D2C brands',
      industry: 'Digital Marketing',
      employeeCount: '11-50',
      annualRevenue: '₹1Cr - ₹5Cr',
      address: 'Indiranagar 100 Feet Road',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560038',
      gstin: '29AABCB7890T1Z8',
      pan: 'AABCB7890T',
      legalName: 'BuzzMedia Digital Solutions Pvt Ltd',
      stateCode: '29',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
      // New fields - CUSTOMER
      companyType: 'CUSTOMER',
      lifecycleStage: 'CUSTOMER',
      phone: '+91-80-34567890',
      email: 'accounts@buzzmedia.in',
      totalRevenue: 480000,
      dealsWonCount: 1,
      totalDealValue: 480000,
      linkedinUrl: 'https://linkedin.com/company/buzzmedia-digital',
      twitterUrl: 'https://twitter.com/buzzmedia_in',
      facebookUrl: 'https://facebook.com/buzzmediadigital',
    },
    // Energy & Utilities
    {
      name: 'SolarBright Energy',
      domain: 'solarbright.in',
      description:
        'Solar power installation and renewable energy solutions for residential and commercial sectors',
      industry: 'Renewable Energy',
      employeeCount: '51-200',
      annualRevenue: '₹10Cr - ₹50Cr',
      address: 'Okhla Industrial Estate',
      city: 'New Delhi',
      state: 'Delhi',
      country: 'India',
      postalCode: '110020',
      gstin: '07AABCS1234U1Z5',
      pan: 'AABCS1234U',
      legalName: 'SolarBright Energy Solutions Pvt Ltd',
      stateCode: '07',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    // Automotive
    {
      name: 'AutoParts Express',
      domain: 'autopartsexpress.in',
      description:
        'B2B automotive spare parts distributor and OEM supplier for major car manufacturers',
      industry: 'Automotive',
      employeeCount: '51-200',
      annualRevenue: '₹50Cr - ₹100Cr',
      address: 'Ambattur Industrial Estate',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      postalCode: '600058',
      gstin: '33AABCA5678V1Z2',
      pan: 'AABCA5678V',
      legalName: 'AutoParts Express India Pvt Ltd',
      stateCode: '33',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    // Textiles & Apparel
    {
      name: 'FabricWorld Textiles',
      domain: 'fabricworld.co.in',
      description:
        'Textile manufacturing and export company specializing in cotton and silk fabrics',
      industry: 'Textiles',
      employeeCount: '501-1000',
      annualRevenue: '₹100Cr+',
      address: 'Ring Road, Surat Textile Market',
      city: 'Surat',
      state: 'Gujarat',
      country: 'India',
      postalCode: '395002',
      gstin: '24AABCF9012W1Z9',
      pan: 'AABCF9012W',
      legalName: 'FabricWorld Textiles Industries Ltd',
      stateCode: '24',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    // Agriculture & AgriTech
    {
      name: 'AgriGrow Technologies',
      domain: 'agrigrow.in',
      description:
        'AgriTech startup providing precision farming solutions and IoT-based crop monitoring',
      industry: 'Agriculture Technology',
      employeeCount: '11-50',
      annualRevenue: '₹1Cr - ₹5Cr',
      address: 'IIT Research Park',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      postalCode: '600113',
      gstin: '33AABCA3456X1Z6',
      pan: 'AABCA3456X',
      legalName: 'AgriGrow Technologies Pvt Ltd',
      stateCode: '33',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    // Professional Services
    {
      name: 'LegalEase Partners',
      domain: 'legalease.co.in',
      description:
        'Full-service law firm specializing in corporate law, M&A, and intellectual property',
      industry: 'Legal Services',
      employeeCount: '51-200',
      annualRevenue: '₹10Cr - ₹50Cr',
      address: 'Maker Chambers IV, Nariman Point',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '400021',
      gstin: '27AABCL7890Y1Z3',
      pan: 'AABCL7890Y',
      legalName: 'LegalEase Associates LLP',
      stateCode: '27',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    // Travel & Tourism
    {
      name: 'Wanderlust Travels',
      domain: 'wanderlusttravels.in',
      description:
        'Premium travel agency offering curated tour packages and corporate travel management',
      industry: 'Travel & Tourism',
      employeeCount: '11-50',
      annualRevenue: '₹5Cr - ₹10Cr',
      address: 'MG Road, Brigade Corner',
      city: 'Bangalore',
      state: 'Karnataka',
      country: 'India',
      postalCode: '560001',
      gstin: '29AABCW1234Z1Z0',
      pan: 'AABCW1234Z',
      legalName: 'Wanderlust Travels & Tours Pvt Ltd',
      stateCode: '29',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    // Consulting
    {
      name: 'StrategyFirst Consulting',
      domain: 'strategyfirst.in',
      description:
        'Management consulting firm helping businesses with strategy, operations, and digital transformation',
      industry: 'Consulting',
      employeeCount: '11-50',
      annualRevenue: '₹5Cr - ₹10Cr',
      address: 'One Horizon Center, Golf Course Road',
      city: 'Gurugram',
      state: 'Haryana',
      country: 'India',
      postalCode: '122002',
      gstin: '06AABCS5678A2Z7',
      pan: 'AABCS5678A',
      legalName: 'StrategyFirst Management Consultants LLP',
      stateCode: '06',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    // Jewelry & Luxury
    {
      name: 'GoldenCraft Jewellers',
      domain: 'goldencraft.in',
      description:
        'Premium jewelry manufacturer and retailer with heritage designs and contemporary collections',
      industry: 'Jewelry & Luxury',
      employeeCount: '51-200',
      annualRevenue: '₹50Cr - ₹100Cr',
      address: 'Zaveri Bazaar, Kalbadevi',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '400002',
      gstin: '27AABCG9012B2Z4',
      pan: 'AABCG9012B',
      legalName: 'GoldenCraft Jewellers Pvt Ltd',
      stateCode: '27',
      gstRegistrationType: 'Regular',
      isGstRegistered: true,
    },
    // International Company (US)
    {
      name: 'GlobalTech Inc',
      domain: 'globaltech.com',
      description: 'US-based technology company looking to expand operations in Indian market',
      industry: 'Technology',
      employeeCount: '1000+',
      annualRevenue: '$100M+',
      address: '100 Market Street, Suite 500',
      city: 'San Francisco',
      state: 'California',
      country: 'United States',
      postalCode: '94102',
      gstin: null,
      pan: null,
      legalName: 'GlobalTech Inc',
      stateCode: null,
      gstRegistrationType: null,
      isGstRegistered: false,
    },
  ];

  const companies = [];
  for (const c of companiesData) {
    const company = await prisma.company.upsert({
      where: { id: `company-${c.domain}` },
      update: {},
      create: {
        id: `company-${c.domain}`,
        tenantId: tenant.id,
        name: c.name,
        domain: c.domain,
        description: c.description,
        industry: c.industry,
        employeeCount: c.employeeCount,
        address: c.address,
        city: c.city,
        state: c.state,
        country: c.country,
        postalCode: c.postalCode,
        gstin: c.gstin,
        pan: c.pan,
        legalName: c.legalName,
        isGstRegistered: c.isGstRegistered || false,
        ownerId: user.id,
        phone: c.phone || null,
        email: c.email || null,
        linkedinUrl: c.linkedinUrl || null,
        facebookUrl: c.facebookUrl || null,
        twitterUrl: c.twitterUrl || null,
      },
    });
    companies.push(company);
  }
  console.log('Created', companies.length, 'companies');

  // Link some contacts to companies
  const contactCompanyLinks = [
    { contactIndex: 0, companyIndex: 0 }, // John Smith -> TechVision
    { contactIndex: 1, companyIndex: 2 }, // Sarah Johnson -> MediCare Plus
    { contactIndex: 2, companyIndex: 7 }, // Mike Wilson -> QuickMart
    { contactIndex: 3, companyIndex: 10 }, // Emily Brown -> SkyHigh Realty
    { contactIndex: 4, companyIndex: 9 }, // David Lee -> PaySecure Fintech
    { contactIndex: 5, companyIndex: 14 }, // Lisa Garcia -> SpiceRoute
    { contactIndex: 6, companyIndex: 1 }, // Robert Martinez -> CloudNine
    { contactIndex: 7, companyIndex: 19 }, // Jennifer Anderson -> BuzzMedia
  ];

  for (const link of contactCompanyLinks) {
    await prisma.contact.update({
      where: { id: contacts[link.contactIndex].id },
      data: { companyId: companies[link.companyIndex].id },
    });
  }
  console.log('Linked contacts to companies');

  // Create demo activities with all fields filled
  const activitiesData = [
    // CALL activities
    {
      type: 'CALL',
      subject: 'Initial Discovery Call with TechVision',
      description:
        'Discussed their current software infrastructure, pain points with legacy systems, and requirements for cloud migration. Client showed strong interest in our enterprise solution. Follow-up meeting scheduled for next week.',
      contactIndex: 0,
      companyIndex: 0,
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      priority: 'HIGH',
      callOutcome: 'Connected',
      callDuration: 45,
    },
    {
      type: 'CALL',
      subject: 'Follow-up Call - MediCare Plus Demo',
      description:
        'Followed up on the product demo conducted last week. Sarah confirmed the decision-making committee will review our proposal. She requested additional case studies from healthcare sector.',
      contactIndex: 1,
      companyIndex: 2,
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      priority: 'HIGH',
      callOutcome: 'Connected',
      callDuration: 28,
    },
    {
      type: 'CALL',
      subject: 'Cold Call - QuickMart Online',
      description:
        'Attempted to reach the procurement head to discuss our B2B marketplace integration solutions. Left voicemail with callback details.',
      contactIndex: 2,
      companyIndex: 7,
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000), // tomorrow
      completedAt: null,
      priority: 'MEDIUM',
      callOutcome: 'Voicemail',
      callDuration: 2,
    },
    {
      type: 'CALL',
      subject: 'Pricing Discussion - SkyHigh Realty',
      description:
        'Discussed enterprise pricing tiers and volume discounts for their 200+ agent team. Emily is keen but needs approval from the CFO. Promised to send revised quote by EOD.',
      contactIndex: 3,
      companyIndex: 10,
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      priority: 'HIGH',
      callOutcome: 'Connected',
      callDuration: 35,
    },
    {
      type: 'CALL',
      subject: 'Support Call - PaySecure Integration Issue',
      description:
        'David reported API timeout issues during peak hours. Escalated to engineering team for investigation. Temporary workaround suggested - increase timeout to 60s.',
      contactIndex: 4,
      companyIndex: 9,
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      priority: 'URGENT',
      callOutcome: 'Connected',
      callDuration: 22,
    },
    // MEETING activities
    {
      type: 'MEETING',
      subject: 'Product Demo - CloudNine Technologies',
      description:
        'Conducted comprehensive product demonstration covering all CRM modules. Robert was impressed with the automation capabilities. Attendees included their CTO and two senior developers. Q&A session lasted 30 minutes.',
      contactIndex: 6,
      companyIndex: 1,
      dueDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      priority: 'HIGH',
      meetingLocation: 'CloudNine Technologies, Cyber Hub, DLF Phase 2, Gurugram',
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      attendees: JSON.stringify([
        { name: 'Robert Martinez', email: 'robert.martinez@tech.co', role: 'Head of Sales' },
        { name: 'John Doe', email: 'admin@acme.com', role: 'Account Executive' },
        { name: 'Raj Kumar', email: 'raj.kumar@cloudnine.tech', role: 'CTO' },
        { name: 'Priya Sharma', email: 'priya.sharma@cloudnine.tech', role: 'Senior Developer' },
      ]),
    },
    {
      type: 'MEETING',
      subject: 'Quarterly Business Review - BuzzMedia Digital',
      description:
        'Reviewed Q3 performance metrics, discussed upcoming feature requests, and presented our product roadmap. Jennifer expressed interest in the new analytics dashboard. Contract renewal discussion initiated.',
      contactIndex: 7,
      companyIndex: 19,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      completedAt: null,
      priority: 'HIGH',
      meetingLocation: 'Virtual Meeting',
      meetingUrl: 'https://zoom.us/j/1234567890',
      attendees: JSON.stringify([
        {
          name: 'Jennifer Anderson',
          email: 'jennifer.anderson@sales.net',
          role: 'Marketing Director',
        },
        { name: 'John Doe', email: 'admin@acme.com', role: 'Account Executive' },
        { name: 'Vikram Singh', email: 'vikram@buzzmedia.in', role: 'CEO' },
      ]),
    },
    {
      type: 'MEETING',
      subject: 'Contract Negotiation - SpiceRoute Restaurants',
      description:
        'Negotiated multi-year contract terms including pricing, SLA, and support coverage. Lisa requested 15% discount for 3-year commitment. Need to get approval from management.',
      contactIndex: 5,
      companyIndex: 14,
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      completedAt: null,
      priority: 'HIGH',
      meetingLocation: 'SpiceRoute HQ, Connaught Place, New Delhi',
      meetingUrl: null,
      attendees: JSON.stringify([
        { name: 'Lisa Garcia', email: 'lisa.garcia@business.org', role: 'Procurement Manager' },
        { name: 'John Doe', email: 'admin@acme.com', role: 'Account Executive' },
        { name: 'Arun Nair', email: 'arun@spiceroute.in', role: 'CFO' },
        { name: 'Meera Patel', email: 'meera@spiceroute.in', role: 'COO' },
      ]),
    },
    {
      type: 'MEETING',
      subject: 'Onboarding Kickoff - WealthWise Advisors',
      description:
        'Initial onboarding meeting to set up their CRM instance. Covered user management, data migration requirements, and training schedule. Client team was very engaged.',
      contactIndex: 0,
      companyIndex: 8,
      dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      priority: 'MEDIUM',
      meetingLocation: 'Virtual Meeting',
      meetingUrl: 'https://teams.microsoft.com/l/meetup-join/abc123',
      attendees: JSON.stringify([
        { name: 'John Smith', email: 'john.smith@example.com', role: 'IT Head' },
        { name: 'John Doe', email: 'admin@acme.com', role: 'Account Executive' },
        { name: 'Sneha Gupta', email: 'sneha@wealthwise.in', role: 'Operations Manager' },
      ]),
    },
    // TASK activities
    {
      type: 'TASK',
      subject: 'Prepare Custom Proposal for TechVision',
      description:
        'Create detailed proposal document including:\n- Solution architecture diagram\n- Pricing breakdown with volume discounts\n- Implementation timeline (12 weeks)\n- ROI projections based on their current setup\n- Case studies from similar tech companies',
      contactIndex: 0,
      companyIndex: 0,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      completedAt: null,
      priority: 'HIGH',
    },
    {
      type: 'TASK',
      subject: 'Send Healthcare Case Studies to MediCare Plus',
      description:
        'Compile and send relevant healthcare industry case studies as requested by Sarah. Include:\n1. Apollo Hospitals implementation story\n2. Max Healthcare ROI metrics\n3. Customer testimonial videos',
      contactIndex: 1,
      companyIndex: 2,
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      completedAt: null,
      priority: 'HIGH',
    },
    {
      type: 'TASK',
      subject: 'Update CRM Records - QuickMart',
      description:
        'Update all contact information and notes after the discovery call. Add new stakeholders identified during the meeting. Update deal stage to Qualified.',
      contactIndex: 2,
      companyIndex: 7,
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      priority: 'LOW',
    },
    {
      type: 'TASK',
      subject: 'Follow Up on Contract - SteelForge Industries',
      description:
        'Send follow-up email regarding the pending contract. They have been reviewing internally for 2 weeks now. Check if they need any additional information or clarification.',
      contactIndex: 3,
      companyIndex: 4,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      completedAt: null,
      priority: 'MEDIUM',
    },
    {
      type: 'TASK',
      subject: 'Schedule Training Sessions - GreenPack Solutions',
      description:
        'Coordinate with the training team to schedule user training sessions:\n- Admin training (2 hours)\n- Sales team training (4 hours)\n- Support team training (3 hours)\nPreferred dates: Next week Monday-Wednesday',
      contactIndex: 4,
      companyIndex: 5,
      dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      completedAt: null,
      priority: 'MEDIUM',
    },
    {
      type: 'TASK',
      subject: 'Renewal Reminder - FashionHub Retail',
      description:
        'Contract expires in 30 days. Prepare renewal proposal with:\n- Updated pricing (5% increase)\n- New features launched this year\n- Loyalty discount offer (10% for 2-year renewal)\n- Schedule renewal discussion call',
      contactIndex: 5,
      companyIndex: 6,
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      completedAt: null,
      priority: 'HIGH',
    },
    // NOTE activities
    {
      type: 'NOTE',
      subject: 'Meeting Notes - TechVision Solutions',
      description:
        'Key takeaways from the discovery call:\n\n1. Current Pain Points:\n   - Using 5 different tools for sales, marketing, and support\n   - No unified customer view\n   - Manual data entry causing delays\n\n2. Requirements:\n   - All-in-one platform\n   - API integrations with existing ERP (SAP)\n   - Mobile app for field sales team\n   - Custom reporting dashboard\n\n3. Decision Makers:\n   - CEO: Rajesh Sharma (final approval)\n   - CTO: Vikram Mehta (technical evaluation)\n   - CFO: Priya Nair (budget approval)\n\n4. Budget: ₹25-30 lakhs annually\n5. Timeline: Want to go live by Q1 2025\n\n6. Competition: Also evaluating Salesforce and Zoho',
      contactIndex: 0,
      companyIndex: 0,
      dueDate: null,
      completedAt: null,
      priority: 'MEDIUM',
    },
    {
      type: 'NOTE',
      subject: 'Competitive Intelligence - CloudNine vs Salesforce',
      description:
        'Robert mentioned they are also evaluating Salesforce Enterprise. Key differentiators to highlight in next meeting:\n\n✅ Our Advantages:\n- 40% lower TCO over 3 years\n- No per-user pricing for read-only users\n- India-based support (same timezone)\n- Native WhatsApp integration\n- GST-compliant invoicing built-in\n\n⚠️ Their Concerns:\n- Brand recognition of Salesforce\n- Worried about vendor stability\n- Need references from similar companies\n\n📋 Action Items:\n- Share customer reference from Infosys\n- Arrange call with existing CloudNine customer\n- Prepare ROI comparison document',
      contactIndex: 6,
      companyIndex: 1,
      dueDate: null,
      completedAt: null,
      priority: 'HIGH',
    },
    {
      type: 'NOTE',
      subject: 'Customer Feedback - PaySecure Integration',
      description:
        'Feedback from David after resolving the API issue:\n\n"The engineering team was very responsive. The fix was deployed within 24 hours of reporting. This kind of support is exactly what we need for our fintech operations."\n\nThis is a great testimonial opportunity. Follow up for:\n- Video testimonial\n- Case study participation\n- G2/Capterra review',
      contactIndex: 4,
      companyIndex: 9,
      dueDate: null,
      completedAt: null,
      priority: 'LOW',
    },
    {
      type: 'NOTE',
      subject: 'Industry Research - Healthcare CRM Trends',
      description:
        'Research notes for healthcare sector pitch:\n\n1. Market Size: Healthcare CRM market in India expected to reach $500M by 2026\n\n2. Key Trends:\n   - Telemedicine integration demand up 300% post-COVID\n   - Patient engagement portals becoming standard\n   - HIPAA-like compliance requirements emerging\n\n3. Top Competitors in Healthcare:\n   - Salesforce Health Cloud\n   - Freshworks (entering market)\n   - Custom solutions by TCS/Infosys\n\n4. Our Differentiators:\n   - ABDM (Ayushman Bharat Digital Mission) integration\n   - Aadhaar-based patient verification\n   - Multi-location clinic management\n   - Insurance claim tracking',
      contactIndex: 1,
      companyIndex: 2,
      dueDate: null,
      completedAt: null,
      priority: 'MEDIUM',
    },
    // EMAIL activities
    {
      type: 'EMAIL',
      subject: 'Proposal Sent - TechVision Solutions Enterprise Plan',
      description:
        'Sent comprehensive proposal to John Smith covering:\n\nPackage: Enterprise Plan (200 users)\nPricing: ₹28,00,000/year (₹1,166/user/month)\nDiscount: 15% early bird discount applied\nValidity: 30 days\n\nIncludes:\n- Unlimited contacts\n- Custom workflows\n- API access (100K calls/day)\n- Dedicated success manager\n- 24/7 priority support\n- Custom integrations (up to 5)\n- On-site training (3 days)\n\nAttachments:\n1. Detailed proposal (PDF)\n2. ROI calculator (Excel)\n3. Implementation timeline (PDF)\n4. Customer references (PDF)',
      contactIndex: 0,
      companyIndex: 0,
      dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      priority: 'HIGH',
    },
    {
      type: 'EMAIL',
      subject: 'Welcome Email - New Customer Onboarding',
      description:
        'Sent welcome email to PaySecure Fintech with:\n\n1. Login credentials for admin portal\n2. Getting started guide\n3. Video tutorial links\n4. Support escalation matrix\n5. Dedicated success manager contact\n6. First training session schedule\n\nCC: Implementation team, Success manager',
      contactIndex: 4,
      companyIndex: 9,
      dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      priority: 'MEDIUM',
    },
    {
      type: 'EMAIL',
      subject: 'Meeting Invite - QBR with BuzzMedia Digital',
      description:
        'Sent calendar invite for Quarterly Business Review:\n\nDate: [2 days from now]\nTime: 3:00 PM - 4:30 PM IST\nLocation: Zoom\n\nAgenda:\n1. Q3 usage metrics review (15 min)\n2. Feature adoption analysis (15 min)\n3. Upcoming roadmap preview (20 min)\n4. Support ticket analysis (10 min)\n5. Renewal discussion (20 min)\n6. Q&A (10 min)\n\nPre-read materials attached:\n- Q3 usage report\n- Feature release notes\n- 2025 roadmap preview',
      contactIndex: 7,
      companyIndex: 19,
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      completedAt: new Date(),
      priority: 'HIGH',
    },
    {
      type: 'EMAIL',
      subject: 'Follow-up: Pending Documents Required',
      description:
        'Sent reminder to SkyHigh Realty for pending documents:\n\n1. Signed MSA (Master Service Agreement)\n2. KYC documents (Company PAN, GST certificate)\n3. Authorized signatory details\n4. Billing address confirmation\n5. Technical POC contact details\n\nDeadline: End of this week\nNote: Contract activation blocked until documents received',
      contactIndex: 3,
      companyIndex: 10,
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      completedAt: null,
      priority: 'MEDIUM',
    },
    {
      type: 'EMAIL',
      subject: 'Product Update Newsletter - December 2024',
      description:
        'Sent monthly product update newsletter to all active customers:\n\nHighlights:\n🚀 New Features:\n- AI-powered lead scoring\n- WhatsApp Business API v2.0\n- Advanced reporting templates\n- Bulk SMS campaigns\n\n🔧 Improvements:\n- 50% faster dashboard loading\n- Enhanced mobile app\n- New Zapier integrations\n\n📅 Upcoming:\n- Webinar: "2025 CRM Trends" (Jan 15)\n- Feature request voting now open\n- Annual conference dates announced\n\nRecipient: lisa.garcia@business.org',
      contactIndex: 5,
      companyIndex: 14,
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      priority: 'LOW',
    },
    // Additional varied activities
    {
      type: 'CALL',
      subject: 'Upsell Discussion - SkillUp EdTech',
      description:
        'Called to discuss upgrading from Professional to Enterprise plan. They have grown from 50 to 150 users in 6 months. Need more API calls and custom integrations.',
      contactIndex: 6,
      companyIndex: 13,
      dueDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      priority: 'HIGH',
      callOutcome: 'Connected',
      callDuration: 38,
    },
    {
      type: 'MEETING',
      subject: 'Technical Deep Dive - SwiftLogix Shipping',
      description:
        'Technical architecture review meeting with their IT team. Discussed API integration with their WMS (Warehouse Management System) and ERP. Need to provide custom connector documentation.',
      contactIndex: 7,
      companyIndex: 16,
      dueDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      priority: 'MEDIUM',
      meetingLocation: 'SwiftLogix Office, JNPT Road, Navi Mumbai',
      meetingUrl: null,
      attendees: JSON.stringify([
        { name: 'Jennifer Anderson', email: 'jennifer.anderson@sales.net', role: 'Technical Lead' },
        { name: 'John Doe', email: 'admin@acme.com', role: 'Solutions Architect' },
        { name: 'Rahul Verma', email: 'rahul@swiftlogix.in', role: 'IT Director' },
      ]),
    },
    {
      type: 'TASK',
      subject: 'Prepare Demo Environment - AutoParts Express',
      description:
        'Set up customized demo environment with:\n- Sample product catalog (500 SKUs)\n- Dealer management workflow\n- Order tracking dashboard\n- Inventory sync simulation\n- Custom fields for automotive industry',
      contactIndex: 0,
      companyIndex: 21,
      dueDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
      completedAt: null,
      priority: 'MEDIUM',
    },
    {
      type: 'NOTE',
      subject: 'Expansion Opportunity - GoldenCraft Jewellers',
      description:
        'Potential for significant expansion:\n\nCurrent Status:\n- Using basic plan with 20 users\n- 4 retail stores connected\n\nExpansion Plans:\n- Opening 6 new stores in 2025\n- Need inventory management\n- Want omnichannel customer view\n- Interested in loyalty program integration\n\nEstimated Deal Size: ₹15 lakhs/year\n\nNext Steps:\n- Schedule store visit\n- Prepare retail-specific demo\n- Connect with retail vertical team',
      contactIndex: 1,
      companyIndex: 28,
      dueDate: null,
      completedAt: null,
      priority: 'HIGH',
    },
    {
      type: 'EMAIL',
      subject: 'Reference Request Acknowledgment',
      description:
        'Responded to reference request from BuildRight Constructions:\n\nProvided references:\n1. L&T Construction - Implementation success story\n2. Shapoorji Pallonji - 2-year customer testimonial\n3. Godrej Properties - Video testimonial link\n\nScheduled call with L&T reference for next week.',
      contactIndex: 2,
      companyIndex: 11,
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      priority: 'MEDIUM',
    },
  ];

  // Create activities
  for (const activity of activitiesData) {
    await prisma.activity.create({
      data: {
        tenantId: tenant.id,
        type: activity.type,
        subject: activity.subject,
        description: activity.description,
        contactId: contacts[activity.contactIndex].id,
        companyId: companies[activity.companyIndex].id,
        dueDate: activity.dueDate,
        completedAt: activity.completedAt,
        priority: activity.priority,
        callOutcome: activity.callOutcome || null,
        callDuration: activity.callDuration || null,
        meetingLocation: activity.meetingLocation || null,
        meetingUrl: activity.meetingUrl || null,
        attendees: activity.attendees ? JSON.parse(activity.attendees) : null,
        assignedToId: user.id,
        createdById: user.id,
      },
    });
  }
  console.log('Created', activitiesData.length, 'activities');

  // Skip seeding demo conversations - data should only come from connected channels
  // To enable demo conversations, set SEED_DEMO_CONVERSATIONS=true in environment
  const seedDemoConversations = process.env.SEED_DEMO_CONVERSATIONS === 'true';

  const conversationsData = seedDemoConversations
    ? [
        {
          contactIndex: 0,
          channelAccountId: whatsappChannel.id,
          channelType: 'WHATSAPP',
          status: 'OPEN',
          priority: 'HIGH',
          assignedToId: user.id,
          messages: [
            {
              direction: 'INBOUND',
              content: 'Hi, I saw your product on your website and I am interested.',
              minutesAgo: 35,
            },
            {
              direction: 'OUTBOUND',
              content:
                'Hello! Thank you for reaching out. I would be happy to help you learn more about our products. Which specific product caught your attention?',
              minutesAgo: 33,
            },
            {
              direction: 'INBOUND',
              content: 'I would like to know more about your enterprise plan.',
              minutesAgo: 30,
            },
            {
              direction: 'OUTBOUND',
              content:
                'Great choice! Our Enterprise plan includes unlimited users, priority support, custom integrations, and dedicated account management. Would you like to schedule a demo?',
              minutesAgo: 28,
            },
            {
              direction: 'INBOUND',
              content: 'Yes please! What times are available this week?',
              minutesAgo: 2,
            },
          ],
        },
        {
          contactIndex: 1,
          channelAccountId: emailChannel.id,
          channelType: 'EMAIL_SMTP',
          status: 'OPEN',
          priority: 'MEDIUM',
          assignedToId: user.id,
          messages: [
            {
              direction: 'INBOUND',
              content:
                'Hi Team,\n\nI would like to schedule a demo of your product. We are a mid-sized company looking for a CRM solution.\n\nBest regards,\nSarah Johnson',
              minutesAgo: 120,
              subject: 'Product Demo Request',
            },
            {
              direction: 'OUTBOUND',
              content:
                'Hi Sarah,\n\nThank you for your interest! I would be happy to schedule a demo for you. How does Thursday at 2 PM EST work for you?\n\nBest,\nJohn from Sales',
              minutesAgo: 90,
              subject: 'Re: Product Demo Request',
            },
            {
              direction: 'INBOUND',
              content:
                'Hi John,\n\nThursday at 2 PM works perfectly. Thanks for scheduling!\n\nBest,\nSarah',
              minutesAgo: 15,
              subject: 'Re: Product Demo Request',
            },
          ],
        },
        {
          contactIndex: 2,
          channelAccountId: smsChannel.id,
          channelType: 'SMS',
          status: 'OPEN',
          priority: 'LOW',
          assignedToId: null,
          messages: [
            {
              direction: 'OUTBOUND',
              content: 'Your OTP is 847291. Valid for 5 minutes. - ACME Corp',
              minutesAgo: 60,
            },
            { direction: 'INBOUND', content: 'Got it, thanks!', minutesAgo: 58 },
          ],
        },
        {
          contactIndex: 3,
          channelAccountId: whatsappChannel.id,
          channelType: 'WHATSAPP',
          status: 'PENDING',
          priority: 'HIGH',
          assignedToId: null,
          messages: [
            {
              direction: 'INBOUND',
              content: 'Hello, I have a question about my order #12345',
              minutesAgo: 180,
            },
            { direction: 'INBOUND', content: 'Anyone there?', minutesAgo: 120 },
            { direction: 'INBOUND', content: 'Still waiting for a response...', minutesAgo: 45 },
          ],
        },
        {
          contactIndex: 4,
          channelAccountId: whatsappChannel.id,
          channelType: 'WHATSAPP',
          status: 'RESOLVED',
          priority: 'MEDIUM',
          assignedToId: user.id,
          messages: [
            {
              direction: 'INBOUND',
              content: 'Hi, I need help with my subscription',
              minutesAgo: 300,
            },
            {
              direction: 'OUTBOUND',
              content: 'Hi David! I can help you with that. What seems to be the issue?',
              minutesAgo: 295,
            },
            {
              direction: 'INBOUND',
              content: 'I want to upgrade to the business plan',
              minutesAgo: 290,
            },
            {
              direction: 'OUTBOUND',
              content:
                'I have upgraded your account to the Business plan. You should see the changes reflected immediately. Is there anything else I can help you with?',
              minutesAgo: 285,
            },
            { direction: 'INBOUND', content: 'Thanks for the quick response!', minutesAgo: 280 },
          ],
        },
        {
          contactIndex: 5,
          channelAccountId: emailChannel.id,
          channelType: 'EMAIL_SMTP',
          status: 'OPEN',
          priority: 'HIGH',
          assignedToId: user.id,
          messages: [
            {
              direction: 'INBOUND',
              content:
                'Dear Support,\n\nI am experiencing issues with the integration. The API returns 500 errors intermittently.\n\nPlease advise.\n\nLisa Garcia',
              minutesAgo: 45,
              subject: 'API Integration Issue',
            },
          ],
        },
        {
          contactIndex: 6,
          channelAccountId: whatsappChannel.id,
          channelType: 'WHATSAPP',
          status: 'OPEN',
          priority: 'MEDIUM',
          assignedToId: user.id,
          messages: [
            { direction: 'INBOUND', content: 'Can you send me the pricing sheet?', minutesAgo: 20 },
            {
              direction: 'OUTBOUND',
              content:
                'Of course! Here is our latest pricing sheet. Let me know if you have any questions.',
              minutesAgo: 18,
            },
            {
              direction: 'INBOUND',
              content: 'This looks good. What about volume discounts?',
              minutesAgo: 5,
            },
          ],
        },
        {
          contactIndex: 7,
          channelAccountId: smsChannel.id,
          channelType: 'SMS',
          status: 'CLOSED',
          priority: 'LOW',
          assignedToId: user.id,
          messages: [
            {
              direction: 'OUTBOUND',
              content:
                'Hi Jennifer, your appointment is confirmed for tomorrow at 10 AM. Reply YES to confirm.',
              minutesAgo: 1440,
            },
            { direction: 'INBOUND', content: 'YES', minutesAgo: 1435 },
            {
              direction: 'OUTBOUND',
              content: 'Great! See you tomorrow. Reply CANCEL if you need to reschedule.',
              minutesAgo: 1430,
            },
          ],
        },
        // More Email Conversations
        {
          contactIndex: 0,
          channelAccountId: emailChannel.id,
          channelType: 'EMAIL_SMTP',
          status: 'OPEN',
          priority: 'HIGH',
          assignedToId: user.id,
          messages: [
            {
              direction: 'INBOUND',
              content:
                'Dear Support Team,\n\nOur team is evaluating your CRM solution for our 500+ employee organization. We have specific requirements around GDPR compliance and data residency.\n\nCould we schedule a call to discuss?\n\nBest regards,\nEmma Thompson\nCTO, GlobalTech Inc.',
              minutesAgo: 25,
              subject: 'Enterprise Inquiry - GDPR Compliance',
            },
          ],
        },
        {
          contactIndex: 1,
          channelAccountId: emailChannel.id,
          channelType: 'EMAIL_SMTP',
          status: 'OPEN',
          priority: 'MEDIUM',
          assignedToId: user.id,
          messages: [
            {
              direction: 'INBOUND',
              content:
                'Hi,\n\nI noticed my invoice from last month has an incorrect amount. The subscription shows $299 but I should be on the $199 plan.\n\nPlease advise.\n\nThanks,\nRobert Chen',
              minutesAgo: 180,
              subject: 'Billing Issue - Incorrect Invoice Amount',
            },
            {
              direction: 'OUTBOUND',
              content:
                'Hi Robert,\n\nThank you for bringing this to our attention. I have reviewed your account and you are correct - there was an error in the billing.\n\nI have issued a credit of $100 to your account which will be applied to your next invoice.\n\nPlease let me know if you have any other questions.\n\nBest,\nBilling Team',
              minutesAgo: 60,
              subject: 'Re: Billing Issue - Incorrect Invoice Amount',
            },
          ],
        },
        {
          contactIndex: 6,
          channelAccountId: emailChannel.id,
          channelType: 'EMAIL_SMTP',
          status: 'PENDING',
          priority: 'HIGH',
          assignedToId: null,
          messages: [
            {
              direction: 'INBOUND',
              content:
                'Hello,\n\nWe are interested in becoming a reseller partner for your CRM solution in the APAC region.\n\nOur company has been in the software distribution business for 15 years with a strong network across Southeast Asia.\n\nPlease share partnership details.\n\nRegards,\nAlex Wang\nBD Director, TechDistro Asia',
              minutesAgo: 50,
              subject: 'Partnership Inquiry - APAC Reseller',
            },
          ],
        },
        {
          contactIndex: 7,
          channelAccountId: emailChannel.id,
          channelType: 'EMAIL_SMTP',
          status: 'OPEN',
          priority: 'LOW',
          assignedToId: user.id,
          messages: [
            {
              direction: 'INBOUND',
              content:
                'Hi Team,\n\nJust wanted to send a quick note to say how much we love using Nexora! The new pipeline feature has really streamlined our sales process.\n\nKeep up the great work!\n\nCheers,\nMike Davis',
              minutesAgo: 200,
              subject: 'Feedback - Loving the Product!',
            },
            {
              direction: 'OUTBOUND',
              content:
                'Hi Mike,\n\nThank you so much for the kind words! It means a lot to our team to hear that Nexora is making a positive impact on your workflow.\n\nWe are always working on new features - stay tuned for some exciting updates coming next month!\n\nBest,\nThe Nexora Team',
              minutesAgo: 150,
              subject: 'Re: Feedback - Loving the Product!',
            },
          ],
        },
        {
          contactIndex: 2,
          channelAccountId: emailChannel.id,
          channelType: 'EMAIL_SMTP',
          status: 'OPEN',
          priority: 'URGENT',
          assignedToId: user.id,
          messages: [
            {
              direction: 'INBOUND',
              content:
                'URGENT: Our entire sales team cannot access the CRM since this morning. We have critical meetings today and need this resolved ASAP.\n\nError message: "Authentication failed"\n\nPlease help immediately!\n\n- Kevin O\'Brien\nSales Director',
              minutesAgo: 8,
              subject: 'URGENT - System Down - Cannot Access CRM',
            },
          ],
        },
        {
          contactIndex: 3,
          channelAccountId: emailChannel.id,
          channelType: 'EMAIL_SMTP',
          status: 'RESOLVED',
          priority: 'MEDIUM',
          assignedToId: user.id,
          messages: [
            {
              direction: 'INBOUND',
              content:
                'Hi,\n\nCan you please send me the API documentation? I want to integrate your CRM with our internal tools.\n\nThanks,\nPriya Sharma',
              minutesAgo: 500,
              subject: 'Request for API Documentation',
            },
            {
              direction: 'OUTBOUND',
              content:
                'Hi Priya,\n\nHere is the link to our API documentation: https://docs.nexora.com/api\n\nThe documentation includes authentication guides, endpoint references, and code examples in multiple languages.\n\nLet me know if you need any help with the integration!\n\nBest,\nTech Support',
              minutesAgo: 480,
              subject: 'Re: Request for API Documentation',
            },
            {
              direction: 'INBOUND',
              content: 'Got it, thanks! This is exactly what I needed.',
              minutesAgo: 450,
              subject: 'Re: Request for API Documentation',
            },
          ],
        },
      ]
    : []; // Empty array if demo conversations disabled

  if (conversationsData.length > 0) {
    for (const convData of conversationsData) {
      const contact = contacts[convData.contactIndex];
      const lastMessage = convData.messages[convData.messages.length - 1];
      const lastMessageAt = new Date(Date.now() - lastMessage.minutesAgo * 60 * 1000);

      // Create conversation thread
      const thread = await prisma.conversationThread.create({
        data: {
          tenantId: tenant.id,
          contactId: contact.id,
          contactPhone: contact.phone,
          contactEmail: contact.email,
          status: convData.status,
          priority: convData.priority,
          assignedToId: convData.assignedToId,
          lastMessageAt,
          lastMessagePreview: lastMessage.content.substring(0, 100),
          lastMessageChannel: convData.channelType,
          unreadCount:
            convData.messages.filter((m) => m.direction === 'INBOUND').length > 0
              ? Math.min(
                  convData.messages.filter((m) => m.direction === 'INBOUND').slice(-2).length,
                  3
                )
              : 0,
          messageCount: convData.messages.length,
          lastCustomerMessageAt: lastMessageAt,
        },
      });

      // Create messages for this thread
      for (const msg of convData.messages) {
        const sentAt = new Date(Date.now() - msg.minutesAgo * 60 * 1000);
        const contentType = msg.subject ? 'EMAIL' : 'TEXT';

        await prisma.messageEvent.create({
          data: {
            tenantId: tenant.id,
            threadId: thread.id,
            channelAccountId: convData.channelAccountId,
            channel: convData.channelType,
            direction: msg.direction,
            contentType,
            textContent: msg.content,
            subject: msg.subject || null,
            status: msg.direction === 'OUTBOUND' ? 'DELIVERED' : 'READ',
            sentAt,
            deliveredAt: msg.direction === 'OUTBOUND' ? sentAt : null,
            readAt: msg.direction === 'INBOUND' ? sentAt : null,
          },
        });
      }
    }
    console.log('Created', conversationsData.length, 'conversation threads with messages');
  } else {
    console.log('Skipping demo conversations (set SEED_DEMO_CONVERSATIONS=true to enable)');
  }

  // Create sales pipeline with stages
  let salesPipeline = await prisma.pipeline.findFirst({
    where: { tenantId: tenant.id, name: 'Sales Pipeline', type: 'DEAL' },
  });
  if (!salesPipeline) {
    salesPipeline = await prisma.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: 'Sales Pipeline',
        description: 'Main sales deal pipeline',
        type: 'DEAL',
        isDefault: true,
      },
    });
  }

  const stages = [
    { name: 'Lead In', order: 0, probability: 10, color: '#6366f1' },
    { name: 'Qualified', order: 1, probability: 25, color: '#8b5cf6' },
    { name: 'Proposal', order: 2, probability: 50, color: '#a855f7' },
    { name: 'Negotiation', order: 3, probability: 75, color: '#d946ef' },
    { name: 'Won', order: 4, probability: 100, color: '#22c55e', isWon: true },
    { name: 'Lost', order: 5, probability: 0, color: '#ef4444', isLost: true },
  ];

  for (const stage of stages) {
    const existingStage = await prisma.stage.findFirst({
      where: { pipelineId: salesPipeline.id, name: stage.name },
    });
    if (!existingStage) {
      await prisma.stage.create({
        data: {
          tenantId: tenant.id,
          pipelineId: salesPipeline.id,
          name: stage.name,
          order: stage.order,
          probability: stage.probability,
          color: stage.color,
          isWon: stage.isWon || false,
          isLost: stage.isLost || false,
        },
      });
    }
  }
  console.log('Created sales pipeline with', stages.length, 'stages');

  // Fetch created stages for deal creation
  const createdStages = await prisma.stage.findMany({
    where: { pipelineId: salesPipeline.id },
    orderBy: { order: 'asc' },
  });

  const stageMap = {};
  for (const stage of createdStages) {
    stageMap[stage.name] = stage;
  }

  // Create deals connected to contacts and companies
  const dealsData = [
    // Won Deals
    {
      name: 'TechVision Enterprise CRM Implementation',
      amount: 2800000,
      currency: 'INR',
      stageName: 'Won',
      contactIndex: 0,
      companyIndex: 0,
      expectedCloseDate: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      description:
        'Enterprise CRM solution with 200 users, custom integrations with SAP ERP, dedicated success manager, and 24/7 priority support.',
      wonReason: 'Best value for price with local support',
    },
    {
      name: 'PaySecure Fintech - 2 Year Contract',
      amount: 1500000,
      currency: 'INR',
      stageName: 'Won',
      contactIndex: 4,
      companyIndex: 9,
      expectedCloseDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      description:
        'Two-year enterprise agreement including payment gateway integration, custom dashboards, and compliance modules.',
      wonReason: 'Strong API capabilities and fintech integrations',
    },
    {
      name: 'BuzzMedia Digital - Annual Subscription',
      amount: 480000,
      currency: 'INR',
      stageName: 'Won',
      contactIndex: 7,
      companyIndex: 19,
      expectedCloseDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      description:
        'Professional plan for 50 users with social media integrations and marketing automation.',
      wonReason: 'Native social media integrations',
    },
    // Negotiation Stage
    {
      name: 'MediCare Plus Hospital Chain - Multi-Location CRM',
      amount: 4500000,
      currency: 'INR',
      stageName: 'Negotiation',
      contactIndex: 1,
      companyIndex: 2,
      expectedCloseDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'Multi-location CRM deployment for 15 hospitals, patient engagement portal, telemedicine integration, and ABDM compliance.',
    },
    {
      name: 'SkyHigh Realty - Real Estate CRM',
      amount: 1800000,
      currency: 'INR',
      stageName: 'Negotiation',
      contactIndex: 3,
      companyIndex: 10,
      expectedCloseDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'Property management CRM with inventory tracking, lead management, and customer portal for 200+ agents.',
    },
    {
      name: 'SpiceRoute Restaurants - Chain Management',
      amount: 750000,
      currency: 'INR',
      stageName: 'Negotiation',
      contactIndex: 5,
      companyIndex: 14,
      expectedCloseDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'Multi-outlet restaurant management with reservation system, customer loyalty program, and feedback management.',
    },
    // Proposal Stage
    {
      name: 'CloudNine Technologies - DevOps CRM',
      amount: 960000,
      currency: 'INR',
      stageName: 'Proposal',
      contactIndex: 6,
      companyIndex: 1,
      expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'CRM with Jira and GitHub integrations, project tracking, and client billing automation for tech consulting.',
    },
    {
      name: 'FashionHub Retail - Omnichannel CRM',
      amount: 2200000,
      currency: 'INR',
      stageName: 'Proposal',
      contactIndex: 5,
      companyIndex: 6,
      expectedCloseDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'Omnichannel retail CRM with POS integration, inventory sync, and customer 360 view for 50+ stores.',
    },
    {
      name: 'SwiftLogix Shipping - Logistics CRM',
      amount: 1350000,
      currency: 'INR',
      stageName: 'Proposal',
      contactIndex: 7,
      companyIndex: 16,
      expectedCloseDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'Fleet management CRM with tracking integration, client portal, and automated billing.',
    },
    {
      name: 'GoldenCraft Jewellers - Retail Expansion',
      amount: 1500000,
      currency: 'INR',
      stageName: 'Proposal',
      contactIndex: 1,
      companyIndex: 28,
      expectedCloseDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'CRM for 10 retail stores with inventory management, customer loyalty, and high-value client management.',
    },
    // Qualified Stage
    {
      name: 'QuickMart Online - B2B Marketplace CRM',
      amount: 1100000,
      currency: 'INR',
      stageName: 'Qualified',
      contactIndex: 2,
      companyIndex: 7,
      expectedCloseDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'B2B marketplace CRM with vendor management, order tracking, and analytics dashboard.',
    },
    {
      name: 'SteelForge Industries - Manufacturing CRM',
      amount: 1650000,
      currency: 'INR',
      stageName: 'Qualified',
      contactIndex: 3,
      companyIndex: 4,
      expectedCloseDate: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'Industrial CRM with dealer management, service tracking, and warranty management.',
    },
    {
      name: 'SkillUp EdTech - Student Management',
      amount: 650000,
      currency: 'INR',
      stageName: 'Qualified',
      contactIndex: 6,
      companyIndex: 13,
      expectedCloseDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'EdTech CRM with student lifecycle management, enrollment tracking, and alumni engagement.',
    },
    {
      name: 'AutoParts Express - Dealer Network CRM',
      amount: 1800000,
      currency: 'INR',
      stageName: 'Qualified',
      contactIndex: 0,
      companyIndex: 21,
      expectedCloseDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'Automotive dealer CRM with parts catalog integration, warranty tracking, and service scheduling.',
    },
    // Lead In Stage
    {
      name: 'WealthWise Advisors - Wealth Management CRM',
      amount: 900000,
      currency: 'INR',
      stageName: 'Lead In',
      contactIndex: 0,
      companyIndex: 8,
      expectedCloseDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'SEBI-compliant CRM for investment advisors with portfolio tracking and client reporting.',
    },
    {
      name: 'GreenPack Solutions - Sustainability CRM',
      amount: 550000,
      currency: 'INR',
      stageName: 'Lead In',
      contactIndex: 4,
      companyIndex: 5,
      expectedCloseDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'CRM for packaging company with supplier management and sustainability metrics tracking.',
    },
    {
      name: 'BuildRight Constructions - Project CRM',
      amount: 2100000,
      currency: 'INR',
      stageName: 'Lead In',
      contactIndex: 2,
      companyIndex: 11,
      expectedCloseDate: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'Construction project CRM with milestone tracking, subcontractor management, and document management.',
    },
    {
      name: 'SolarBright Energy - Renewable CRM',
      amount: 750000,
      currency: 'INR',
      stageName: 'Lead In',
      contactIndex: 3,
      companyIndex: 20,
      expectedCloseDate: new Date(Date.now() + 80 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'Solar installation CRM with lead management, project tracking, and maintenance scheduling.',
    },
    {
      name: 'GlobalTech Inc - India Expansion',
      amount: 5000000,
      currency: 'INR',
      stageName: 'Lead In',
      contactIndex: 0,
      companyIndex: 28,
      expectedCloseDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      closedAt: null,
      description:
        'Enterprise CRM deployment for US company expanding to India, multi-currency support, compliance features.',
    },
    // Lost Deals
    {
      name: 'PharmaTrust Labs - Pharmaceutical CRM',
      amount: 3200000,
      currency: 'INR',
      stageName: 'Lost',
      contactIndex: 1,
      companyIndex: 3,
      expectedCloseDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      description:
        'Lost to Salesforce Health Cloud. Client prioritized global brand recognition over local support.',
      lostReason: 'Competitor - Better Brand Recognition',
      competitor: 'Salesforce Health Cloud',
    },
    {
      name: 'FabricWorld Textiles - Export Management',
      amount: 1400000,
      currency: 'INR',
      stageName: 'Lost',
      contactIndex: 2,
      companyIndex: 22,
      expectedCloseDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      description: 'Budget constraints due to economic slowdown. Deal postponed indefinitely.',
      lostReason: 'Budget - Economic Constraints',
    },
  ];

  // Create deals
  for (const deal of dealsData) {
    const stage = stageMap[deal.stageName];
    await prisma.deal.create({
      data: {
        tenantId: tenant.id,
        pipelineId: salesPipeline.id,
        stageId: stage.id,
        name: deal.name,
        amount: deal.amount,
        currency: deal.currency,
        expectedCloseDate: deal.expectedCloseDate,
        closedAt: deal.closedAt,
        notes: deal.description || deal.wonReason || deal.lostReason || null,
        contactId: contacts[deal.contactIndex]?.id || null,
        companyId: companies[deal.companyIndex]?.id || null,
        ownerId: user.id,
        probability: stage.probability || null,
      },
    });
  }
  console.log('Created', dealsData.length, 'deals');

  // Create ticket pipeline
  let ticketPipeline = await prisma.pipeline.findFirst({
    where: { tenantId: tenant.id, name: 'Support Pipeline', type: 'TICKET' },
  });
  if (!ticketPipeline) {
    ticketPipeline = await prisma.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: 'Support Pipeline',
        type: 'TICKET',
        isDefault: true,
      },
    });
  }

  // Create ticket stages
  const ticketStagesData = [
    { name: 'New', order: 0, color: '#3B82F6' },
    { name: 'Open', order: 1, color: '#F59E0B' },
    { name: 'In Progress', order: 2, color: '#8B5CF6' },
    { name: 'Waiting on Customer', order: 3, color: '#EF4444' },
    { name: 'Resolved', order: 4, color: '#10B981', isWon: true },
    { name: 'Closed', order: 5, color: '#6B7280', isLost: true },
  ];

  const ticketStages = [];
  for (const stage of ticketStagesData) {
    let existingStage = await prisma.stage.findFirst({
      where: { pipelineId: ticketPipeline.id, name: stage.name },
    });
    if (!existingStage) {
      existingStage = await prisma.stage.create({
        data: {
          tenantId: tenant.id,
          pipelineId: ticketPipeline.id,
          name: stage.name,
          order: stage.order,
          color: stage.color,
          isWon: stage.isWon || false,
          isLost: stage.isLost || false,
        },
      });
    }
    ticketStages.push(existingStage);
  }
  console.log('Created ticket pipeline with', ticketStages.length, 'stages');

  // Create tickets for contacts
  const ticketsData = [
    // TechVision - John Smith (Customer)
    {
      subject: 'API Integration Issue - Timeout Errors',
      description:
        'Getting timeout errors when making API calls during peak hours. Server returns 504 Gateway Timeout after 30 seconds. This is affecting our production environment.',
      contactIndex: 0,
      priority: 'HIGH',
      category: 'Technical',
      subcategory: 'API',
      stageIndex: 4, // Resolved
      resolvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      closeReason: 'Increased server timeout limits and optimized API queries',
    },
    {
      subject: 'Request for Custom Dashboard Widget',
      description:
        'We need a custom widget on the dashboard that shows real-time sales metrics with comparison to last month. Should include graphs and KPIs.',
      contactIndex: 0,
      priority: 'MEDIUM',
      category: 'Feature Request',
      subcategory: 'Dashboard',
      stageIndex: 2, // In Progress
    },
    // MediCare Plus - Sarah Johnson
    {
      subject: 'Data Import Failed - CSV Format',
      description:
        'Attempted to import 5000 patient records via CSV but getting validation errors. Error message says "Invalid date format in column 4".',
      contactIndex: 1,
      priority: 'HIGH',
      category: 'Technical',
      subcategory: 'Data Import',
      stageIndex: 3, // Waiting on Customer
    },
    {
      subject: 'HIPAA Compliance Documentation Needed',
      description:
        'Our compliance team requires HIPAA compliance documentation and SOC 2 certification details before we can proceed with the deal.',
      contactIndex: 1,
      priority: 'URGENT',
      category: 'Compliance',
      subcategory: 'Documentation',
      stageIndex: 1, // Open
    },
    // QuickMart - Mike Wilson
    {
      subject: 'Billing Query - Invoice Discrepancy',
      description:
        'The last invoice shows charges for 50 users but we only have 35 active users. Need clarification and adjustment.',
      contactIndex: 2,
      priority: 'MEDIUM',
      category: 'Billing',
      subcategory: 'Invoice',
      stageIndex: 1, // Open
    },
    // SkyHigh Realty - Emily Brown
    {
      subject: 'Mobile App Sync Issues',
      description:
        'Our field agents report that the mobile app is not syncing data when they have poor connectivity. Data entered offline is lost when they reconnect.',
      contactIndex: 3,
      priority: 'HIGH',
      category: 'Technical',
      subcategory: 'Mobile App',
      stageIndex: 2, // In Progress
    },
    {
      subject: 'Training Request - New Sales Team',
      description:
        'We have 15 new sales agents joining next week. Need to schedule onboarding training sessions for them.',
      contactIndex: 3,
      priority: 'MEDIUM',
      category: 'Training',
      subcategory: 'Onboarding',
      stageIndex: 0, // New
    },
    // PaySecure - David Lee (Customer)
    {
      subject: 'Payment Gateway Integration Failure',
      description:
        'Integration with Razorpay is failing intermittently. Transactions are timing out and customers are getting double-charged in some cases.',
      contactIndex: 4,
      priority: 'URGENT',
      category: 'Technical',
      subcategory: 'Integration',
      stageIndex: 4, // Resolved
      resolvedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      subject: 'Feature Request - Multi-currency Support',
      description:
        'We need support for USD and EUR transactions along with INR. This is critical for our international expansion.',
      contactIndex: 4,
      priority: 'HIGH',
      category: 'Feature Request',
      subcategory: 'Payments',
      stageIndex: 2, // In Progress
    },
    // SpiceRoute - Lisa Garcia
    {
      subject: 'Reservation System Not Sending Confirmations',
      description:
        'Customers are not receiving email confirmations after making table reservations. This started happening 2 days ago.',
      contactIndex: 5,
      priority: 'HIGH',
      category: 'Technical',
      subcategory: 'Email',
      stageIndex: 1, // Open
    },
    // CloudNine - Robert Martinez
    {
      subject: 'Demo Environment Setup Required',
      description:
        'Need a demo environment set up with sample data for our upcoming board presentation. Required by end of this week.',
      contactIndex: 6,
      priority: 'MEDIUM',
      category: 'Sales Support',
      subcategory: 'Demo',
      stageIndex: 0, // New
    },
    // BuzzMedia - Jennifer Anderson (Customer)
    {
      subject: 'Social Media Integration - Instagram API',
      description:
        'Instagram posts are not being pulled into the CRM since yesterday. Facebook and Twitter integrations are working fine.',
      contactIndex: 7,
      priority: 'MEDIUM',
      category: 'Technical',
      subcategory: 'Integration',
      stageIndex: 4, // Resolved
      resolvedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      closedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      closeReason: 'Instagram API token was expired - regenerated and updated',
    },
    {
      subject: 'Contract Renewal Discussion',
      description:
        'Annual contract expires in 30 days. Want to discuss renewal terms and potential volume discount for adding more users.',
      contactIndex: 7,
      priority: 'LOW',
      category: 'Sales',
      subcategory: 'Renewal',
      stageIndex: 1, // Open
    },
  ];

  // Map stageIndex to TicketStatus (OPEN, IN_PROGRESS, WAITING, RESOLVED, CLOSED)
  const stageToStatus = ['OPEN', 'OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'];

  // Create tickets
  for (const ticket of ticketsData) {
    await prisma.ticket.create({
      data: {
        tenantId: tenant.id,
        subject: ticket.subject,
        description: ticket.description,
        priority: ticket.priority,
        category: ticket.category,
        status: stageToStatus[ticket.stageIndex] || 'OPEN',
        contactId: contacts[ticket.contactIndex]?.id || null,
        assignedTo: user.id,
        resolvedAt: ticket.resolvedAt || null,
        closedAt: ticket.closedAt || null,
      },
    });
  }
  console.log('Created', ticketsData.length, 'tickets');

  // Skip wallet creation - model doesn't exist in Railway schema
  console.log('Skipped wallet (model not in Railway schema)');

  // ==================== EMAIL CREDIT PLANS ====================
  const emailPlansData = [
    {
      name: 'Starter',
      slug: 'starter',
      emails: 5000,
      priceInr: 29900,
      priceUsd: 399,
      pricePerEmail: 0.06,
      description: 'Perfect for small businesses getting started with email marketing',
      features: ['5,000 emails', 'Basic templates', 'Email support', '30-day validity'],
      isPopular: false,
      sortOrder: 1,
      isActive: true,
    },
    {
      name: 'Growth',
      slug: 'growth',
      emails: 25000,
      priceInr: 79900,
      priceUsd: 999,
      pricePerEmail: 0.032,
      description: 'Ideal for growing businesses with regular campaigns',
      features: [
        '25,000 emails',
        'All templates',
        'Priority support',
        'Analytics dashboard',
        '60-day validity',
      ],
      isPopular: true,
      sortOrder: 2,
      isActive: true,
    },
    {
      name: 'Pro',
      slug: 'pro',
      emails: 100000,
      priceInr: 199900,
      priceUsd: 2499,
      pricePerEmail: 0.02,
      description: 'For businesses with high-volume email needs',
      features: [
        '100,000 emails',
        'Custom templates',
        'API access',
        'Dedicated support',
        'Advanced analytics',
        '90-day validity',
      ],
      isPopular: false,
      sortOrder: 3,
      isActive: true,
    },
    {
      name: 'Enterprise',
      slug: 'enterprise',
      emails: 500000,
      priceInr: 499900,
      priceUsd: 5999,
      pricePerEmail: 0.01,
      description: 'Enterprise-grade solution for large organizations',
      features: [
        '500,000 emails',
        'White-label sending',
        'Custom domain',
        'SLA guarantee',
        'Account manager',
        '1-year validity',
      ],
      isPopular: false,
      sortOrder: 4,
      isActive: true,
    },
  ];

  for (const plan of emailPlansData) {
    await prisma.emailCreditPlan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
  }
  console.log('Created', emailPlansData.length, 'email credit plans');

  // Create initial email credit balance for test tenant
  await prisma.emailCreditBalance.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      totalCredits: 1000,
      usedCredits: 0,
      freeQuota: 500,
      freeUsedThisMonth: 0,
    },
  });
  console.log('Created email credit balance for test tenant');

  // ==================== SLA POLICIES ====================
  // SLA Policies are required for Ticket creation
  const slaPoliciesData = [
    {
      name: 'Low Priority SLA',
      description: 'SLA for low priority tickets - relaxed response times',
      priority: 'LOW',
      firstResponseTime: 480, // 8 hours
      resolutionTime: 2880, // 48 hours
      escalationEnabled: false,
      useBusinessHours: true,
      isActive: true,
      isDefault: true,
    },
    {
      name: 'Medium Priority SLA',
      description: 'SLA for medium priority tickets - standard response times',
      priority: 'MEDIUM',
      firstResponseTime: 240, // 4 hours
      resolutionTime: 1440, // 24 hours
      escalationEnabled: true,
      escalationConfig: {
        levels: [{ minutes: 360, notifyUsers: [], notifyTeams: ['support-leads'] }],
      },
      useBusinessHours: true,
      isActive: true,
      isDefault: true,
    },
    {
      name: 'High Priority SLA',
      description: 'SLA for high priority tickets - fast response required',
      priority: 'HIGH',
      firstResponseTime: 60, // 1 hour
      resolutionTime: 480, // 8 hours
      escalationEnabled: true,
      escalationConfig: {
        levels: [
          { minutes: 90, notifyUsers: [], notifyTeams: ['support-leads'] },
          { minutes: 180, notifyUsers: [], notifyTeams: ['managers'] },
        ],
      },
      useBusinessHours: true,
      isActive: true,
      isDefault: true,
    },
    {
      name: 'Urgent Priority SLA',
      description: 'SLA for urgent/critical tickets - immediate attention required',
      priority: 'URGENT',
      firstResponseTime: 15, // 15 minutes
      resolutionTime: 120, // 2 hours
      escalationEnabled: true,
      escalationConfig: {
        levels: [
          { minutes: 30, notifyUsers: [], notifyTeams: ['support-leads'] },
          { minutes: 60, notifyUsers: [], notifyTeams: ['managers'] },
          { minutes: 90, notifyUsers: [], notifyTeams: ['executives'] },
        ],
      },
      useBusinessHours: false, // 24/7 for urgent
      isActive: true,
      isDefault: true,
    },
  ];

  for (const sla of slaPoliciesData) {
    await prisma.sLAPolicy.upsert({
      where: { tenantId_priority: { tenantId: tenant.id, priority: sla.priority } },
      update: sla,
      create: { tenantId: tenant.id, ...sla },
    });
  }
  console.log('Created', slaPoliciesData.length, 'SLA policies');

  // ==================== PRODUCTS ====================
  const productsData = [
    {
      name: 'Nexora CRM - Starter',
      sku: 'CRM-STARTER',
      description: 'Entry-level CRM package for small teams (up to 5 users)',
      unitPrice: 4999,
      currency: 'INR',
      taxRate: 18,
      category: 'Software',
      type: 'SUBSCRIPTION',
      isActive: true,
    },
    {
      name: 'Nexora CRM - Professional',
      sku: 'CRM-PRO',
      description: 'Professional CRM with advanced features (up to 25 users)',
      unitPrice: 14999,
      currency: 'INR',
      taxRate: 18,
      category: 'Software',
      type: 'SUBSCRIPTION',
      isActive: true,
    },
    {
      name: 'Nexora CRM - Enterprise',
      sku: 'CRM-ENT',
      description: 'Enterprise CRM with unlimited users and premium support',
      unitPrice: 49999,
      currency: 'INR',
      taxRate: 18,
      category: 'Software',
      type: 'SUBSCRIPTION',
      isActive: true,
    },
    {
      name: 'WhatsApp Business Integration',
      sku: 'INT-WHATSAPP',
      description: 'WhatsApp Business API integration for messaging',
      unitPrice: 2999,
      currency: 'INR',
      taxRate: 18,
      category: 'Add-on',
      type: 'SUBSCRIPTION',
      isActive: true,
    },
    {
      name: 'Email Marketing Add-on',
      sku: 'INT-EMAIL',
      description: 'Bulk email marketing with 10,000 emails/month',
      unitPrice: 1999,
      currency: 'INR',
      taxRate: 18,
      category: 'Add-on',
      type: 'SUBSCRIPTION',
      isActive: true,
    },
    {
      name: 'Custom Integration Setup',
      sku: 'SVC-INTEGRATION',
      description: 'One-time custom API integration setup',
      unitPrice: 25000,
      currency: 'INR',
      taxRate: 18,
      category: 'Service',
      type: 'SERVICE',
      isActive: true,
    },
    {
      name: 'Training Session (4 hours)',
      sku: 'SVC-TRAINING-4H',
      description: 'Remote training session for your team',
      unitPrice: 15000,
      currency: 'INR',
      taxRate: 18,
      category: 'Service',
      type: 'SERVICE',
      isActive: true,
    },
    {
      name: 'Premium Support Package',
      sku: 'SUP-PREMIUM',
      description: '24/7 priority support with dedicated account manager',
      unitPrice: 9999,
      currency: 'INR',
      taxRate: 18,
      category: 'Support',
      type: 'SUBSCRIPTION',
      isActive: true,
    },
  ];

  const products = [];
  for (const product of productsData) {
    const created = await prisma.product.upsert({
      where: { tenantId_sku: { tenantId: tenant.id, sku: product.sku } },
      update: product,
      create: { tenantId: tenant.id, ...product },
    });
    products.push(created);
  }
  console.log('Created', products.length, 'products');

  // ==================== QUOTES ====================
  const quotesData = [
    {
      quoteNumber: 'QT-2026-001',
      title: 'CRM Implementation for TechStart Solutions',
      contactIndex: 0,
      companyIndex: 0,
      status: 'SENT',
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      terms: 'Payment due within 30 days of acceptance. Annual subscription renews automatically.',
      notes: 'Includes 2 hours of free onboarding support.',
      lines: [
        { productIndex: 1, quantity: 1, discount: 10, discountType: 'PERCENTAGE' }, // CRM Pro
        { productIndex: 3, quantity: 1, discount: 0 }, // WhatsApp
        { productIndex: 6, quantity: 2, discount: 0 }, // Training x2
      ],
    },
    {
      quoteNumber: 'QT-2026-002',
      title: 'Enterprise CRM Package for GlobalTech Industries',
      contactIndex: 1,
      companyIndex: 1,
      status: 'ACCEPTED',
      validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      terms: 'Net 45 payment terms. Includes annual maintenance and support.',
      notes: 'Volume discount applied for enterprise package.',
      lines: [
        { productIndex: 2, quantity: 1, discount: 15, discountType: 'PERCENTAGE' }, // Enterprise
        { productIndex: 3, quantity: 1, discount: 0 }, // WhatsApp
        { productIndex: 4, quantity: 1, discount: 0 }, // Email
        { productIndex: 5, quantity: 1, discount: 0 }, // Custom Integration
        { productIndex: 7, quantity: 1, discount: 0 }, // Premium Support
      ],
    },
    {
      quoteNumber: 'QT-2026-003',
      title: 'Starter Package for SmallBiz Co',
      contactIndex: 2,
      companyIndex: 2,
      status: 'DRAFT',
      validUntil: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      terms: 'Monthly billing. Cancel anytime with 30-day notice.',
      notes: 'Recommended starter package for growing businesses.',
      lines: [
        { productIndex: 0, quantity: 1, discount: 0 }, // Starter
        { productIndex: 4, quantity: 1, discount: 0 }, // Email
      ],
    },
    {
      quoteNumber: 'QT-2026-004',
      title: 'Integration Services for DataDriven Analytics',
      contactIndex: 4,
      companyIndex: 4,
      status: 'VIEWED',
      validUntil: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      terms: 'Service to be delivered within 2 weeks of payment.',
      notes: 'Includes Salesforce and HubSpot integration.',
      lines: [
        { productIndex: 5, quantity: 2, discount: 5, discountType: 'PERCENTAGE' }, // 2x Integration
        { productIndex: 6, quantity: 1, discount: 0 }, // Training
      ],
    },
    {
      quoteNumber: 'QT-2026-005',
      title: 'Annual Renewal for FinServe Corp',
      contactIndex: 5,
      companyIndex: 5,
      status: 'EXPIRED',
      issueDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      validUntil: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      terms: 'Annual renewal at discounted rate.',
      notes: 'Loyalty discount of 20% applied.',
      lines: [
        { productIndex: 1, quantity: 1, discount: 20, discountType: 'PERCENTAGE' }, // Pro with loyalty
        { productIndex: 7, quantity: 1, discount: 10, discountType: 'PERCENTAGE' }, // Support
      ],
    },
  ];

  for (const quote of quotesData) {
    // Calculate line totals and quote total
    let subtotal = 0;
    const quoteLines = quote.lines.map((line, index) => {
      const product = products[line.productIndex];
      const unitPrice = parseFloat(product.unitPrice);
      const qty = line.quantity;
      let lineDiscount = 0;
      if (line.discount) {
        if (line.discountType === 'PERCENTAGE') {
          lineDiscount = (unitPrice * qty * line.discount) / 100;
        } else {
          lineDiscount = line.discount;
        }
      }
      const lineTotal = unitPrice * qty - lineDiscount;
      subtotal += lineTotal;
      return {
        productId: product.id,
        description: product.name,
        quantity: qty,
        unitPrice: unitPrice,
        discount: lineDiscount,
        discountType: line.discountType || null,
        tax: 0,
        total: lineTotal,
        sortOrder: index,
      };
    });

    const taxAmount = subtotal * 0.18; // 18% GST
    const total = subtotal + taxAmount;

    // Check if quote already exists
    const existingQuote = await prisma.quote.findFirst({
      where: { tenantId: tenant.id, quoteNumber: quote.quoteNumber },
    });

    if (!existingQuote) {
      await prisma.quote.create({
        data: {
          tenantId: tenant.id,
          quoteNumber: quote.quoteNumber,
          title: quote.title,
          contactId: contacts[quote.contactIndex]?.id || null,
          companyId: companies[quote.companyIndex]?.id || null,
          issueDate: quote.issueDate || new Date(),
          validUntil: quote.validUntil,
          subtotal: subtotal,
          discount: 0,
          tax: taxAmount,
          total: total,
          currency: 'INR',
          terms: quote.terms,
          notes: quote.notes,
          status: quote.status,
          createdById: user.id,
          lines: {
            create: quoteLines,
          },
        },
      });
    }
  }
  console.log('Created quotes with line items (skipped existing)');

  // ==================== TASKS ====================
  const tasksData = [
    {
      title: 'Follow up with TechStart Solutions on CRM demo',
      description: 'Schedule a follow-up call to discuss their requirements after the initial demo',
      status: 'TODO',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      contactIndex: 0,
      companyIndex: 0,
    },
    {
      title: 'Prepare proposal for GlobalTech Industries',
      description: 'Create detailed proposal with custom integration requirements and timeline',
      status: 'IN_PROGRESS',
      priority: 'URGENT',
      dueDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      contactIndex: 1,
      companyIndex: 1,
    },
    {
      title: 'Send onboarding materials to new client',
      description: 'Email welcome kit, documentation, and training schedule to SmallBiz Co',
      status: 'DONE',
      priority: 'MEDIUM',
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      contactIndex: 2,
      companyIndex: 2,
    },
    {
      title: 'Review support ticket escalations',
      description: 'Check all HIGH priority tickets escalated in the last 24 hours',
      status: 'TODO',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 4 * 60 * 60 * 1000),
    },
    {
      title: 'Update pricing documentation',
      description: 'Revise product pricing sheet with new Q1 rates',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    },
    {
      title: 'Schedule quarterly business review',
      description: 'Set up QBR meeting with DataDriven Analytics team',
      status: 'TODO',
      priority: 'LOW',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      contactIndex: 4,
      companyIndex: 4,
    },
    {
      title: 'Complete API documentation update',
      description: 'Add new webhook endpoints to developer documentation',
      status: 'REVIEW',
      priority: 'MEDIUM',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    },
    {
      title: 'Prepare monthly sales report',
      description: 'Compile sales metrics and pipeline analysis for management review',
      status: 'TODO',
      priority: 'HIGH',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    {
      title: 'Call Emily Brown about renewal',
      description: 'Discuss contract renewal options and new features available',
      status: 'TODO',
      priority: 'MEDIUM',
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      contactIndex: 3,
      companyIndex: 3,
    },
    {
      title: 'Test new WhatsApp integration',
      description: 'Verify MSG91 webhook configuration is working correctly',
      status: 'DONE',
      priority: 'HIGH',
      dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  ];

  for (const task of tasksData) {
    await prisma.task.create({
      data: {
        tenantId: tenant.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        completedAt: task.completedAt || null,
        assignedToId: user.id,
        contactId: task.contactIndex !== undefined ? contacts[task.contactIndex]?.id : null,
        companyId: task.companyIndex !== undefined ? companies[task.companyIndex]?.id : null,
        createdById: user.id,
      },
    });
  }
  console.log('Created', tasksData.length, 'tasks');

  // ==================== PROJECTS ====================
  const projectsData = [
    {
      name: 'CRM Implementation - GlobalTech',
      description:
        'Full CRM deployment for GlobalTech Industries including data migration and training',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      progress: 65,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      budget: 500000,
      spent: 325000,
      contactIndex: 1,
      companyIndex: 1,
    },
    {
      name: 'WhatsApp Integration Rollout',
      description: 'Deploy WhatsApp Business API integration across all client accounts',
      status: 'PLANNING',
      priority: 'MEDIUM',
      progress: 15,
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      budget: 150000,
      spent: 0,
    },
    {
      name: 'Q1 Marketing Campaign',
      description: 'Digital marketing campaign for Q1 2026 lead generation',
      status: 'COMPLETED',
      priority: 'HIGH',
      progress: 100,
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      budget: 200000,
      spent: 185000,
    },
    {
      name: 'Mobile App Development',
      description: 'Native mobile app for iOS and Android platforms',
      status: 'ON_HOLD',
      priority: 'LOW',
      progress: 30,
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000),
      budget: 1000000,
      spent: 300000,
    },
    {
      name: 'Data Migration - FinServe Corp',
      description: 'Migrate legacy CRM data to Nexora platform',
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
      progress: 45,
      startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
      budget: 250000,
      spent: 112500,
      contactIndex: 5,
      companyIndex: 5,
    },
    {
      name: 'Support Portal Redesign',
      description: 'Redesign customer support portal with new knowledge base',
      status: 'PLANNING',
      priority: 'MEDIUM',
      progress: 10,
      startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      dueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      budget: 350000,
      spent: 0,
    },
  ];

  for (const project of projectsData) {
    await prisma.project.create({
      data: {
        tenantId: tenant.id,
        name: project.name,
        description: project.description,
        status: project.status,
        priority: project.priority,
        progress: project.progress,
        startDate: project.startDate,
        endDate: project.endDate || null,
        dueDate: project.dueDate,
        completedAt: project.completedAt || null,
        budget: project.budget,
        spent: project.spent,
        currency: 'INR',
        managerId: user.id,
        contactId: project.contactIndex !== undefined ? contacts[project.contactIndex]?.id : null,
        companyId: project.companyIndex !== undefined ? companies[project.companyIndex]?.id : null,
        createdById: user.id,
        visibility: 'TEAM',
      },
    });
  }
  console.log('Created', projectsData.length, 'projects');

  // ==================== CALENDAR EVENTS ====================
  const calendarEventsData = [
    {
      title: 'Demo Call - TechStart Solutions',
      description: 'Product demo for the sales team at TechStart',
      type: 'CALL',
      startTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000), // 2 days, 10 AM
      endTime: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000), // 1 hour
      status: 'CONFIRMED',
      contactIndex: 0,
      companyIndex: 0,
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
    },
    {
      title: 'Weekly Team Standup',
      description: 'Weekly sync with the sales and support team',
      type: 'MEETING',
      startTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000), // Tomorrow 9 AM
      endTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000 + 9.5 * 60 * 60 * 1000), // 30 mins
      status: 'CONFIRMED',
      location: 'Conference Room A',
      isRecurring: true,
      recurrence: { frequency: 'WEEKLY', interval: 1, daysOfWeek: ['MO'] },
    },
    {
      title: 'Quarterly Business Review - GlobalTech',
      description: 'Q1 QBR with GlobalTech Industries leadership team',
      type: 'MEETING',
      startTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000), // 1 week, 2 PM
      endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000), // 2 hours
      status: 'CONFIRMED',
      contactIndex: 1,
      companyIndex: 1,
      location: 'GlobalTech HQ, Building 5',
    },
    {
      title: 'Training Session - SmallBiz Co',
      description: 'Remote training for new CRM users',
      type: 'MEETING',
      startTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000), // 3 days, 11 AM
      endTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000), // 4 hours
      status: 'TENTATIVE',
      contactIndex: 2,
      companyIndex: 2,
      meetingUrl: 'https://zoom.us/j/123456789',
    },
    {
      title: 'Follow-up Call - Emily Brown',
      description: 'Discuss renewal terms and new requirements',
      type: 'CALL',
      startTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000), // 5 days, 3 PM
      endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000 + 15.5 * 60 * 60 * 1000), // 30 mins
      status: 'CONFIRMED',
      contactIndex: 3,
      companyIndex: 3,
    },
    {
      title: 'Product Roadmap Review',
      description: 'Internal review of Q2 product roadmap with engineering',
      type: 'MEETING',
      startTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000), // 4 days, 10 AM
      endTime: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000), // 2 hours
      status: 'CONFIRMED',
      location: 'Virtual - Teams',
      meetingUrl: 'https://teams.microsoft.com/meet/12345',
    },
    {
      title: 'Contract Signing - DataDriven',
      description: 'Virtual signing of annual contract',
      type: 'MEETING',
      startTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000), // 10 days, 11 AM
      endTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000 + 11.5 * 60 * 60 * 1000), // 30 mins
      status: 'TENTATIVE',
      contactIndex: 4,
      companyIndex: 4,
    },
    {
      title: 'Team Offsite Planning',
      description: 'Planning session for annual team offsite event',
      type: 'MEETING',
      startTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000), // 2 weeks, 2 PM
      endTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000 + 16 * 60 * 60 * 1000), // 2 hours
      status: 'CONFIRMED',
      location: 'Conference Room B',
    },
    {
      title: 'Reminder: Submit expense reports',
      description: 'Monthly expense reports due',
      type: 'REMINDER',
      startTime: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
      endTime: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000),
      allDay: false,
      status: 'CONFIRMED',
    },
    {
      title: 'Company Holiday - Republic Day',
      description: 'Office closed for Republic Day',
      type: 'OUT_OF_OFFICE',
      startTime: new Date('2026-01-26T00:00:00'),
      endTime: new Date('2026-01-26T23:59:59'),
      allDay: true,
      status: 'CONFIRMED',
    },
  ];

  for (const event of calendarEventsData) {
    await prisma.calendarEvent.create({
      data: {
        tenantId: tenant.id,
        title: event.title,
        description: event.description,
        type: event.type,
        startTime: event.startTime,
        endTime: event.endTime,
        allDay: event.allDay || false,
        timezone: 'Asia/Kolkata',
        location: event.location || null,
        meetingUrl: event.meetingUrl || null,
        isRecurring: event.isRecurring || false,
        recurrence: event.recurrence || null,
        organizerId: user.id,
        contactId: event.contactIndex !== undefined ? contacts[event.contactIndex]?.id : null,
        companyId: event.companyIndex !== undefined ? companies[event.companyIndex]?.id : null,
        status: event.status,
        color: event.type === 'CALL' ? '#22c55e' : event.type === 'MEETING' ? '#3b82f6' : '#f59e0b',
      },
    });
  }
  console.log('Created', calendarEventsData.length, 'calendar events');

  console.log('\n✅ Database seeded successfully!');
  console.log('\nLogin credentials:');
  console.log('  Email: admin@acme.com');
  console.log('  Password: demo123456');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
