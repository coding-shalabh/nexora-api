import { prisma as defaultPrisma } from '@crm360/database';

// ---------------------------------------------------------------------------
// Industry seed data — realistic Indian business data for 28 industries
// ---------------------------------------------------------------------------
const INDUSTRY_SEED_DATA = {
  saas: {
    pipelineName: 'Sales Pipeline',
    pipelineStages: [
      'Trial Started',
      'Demo Booked',
      'Demo Done',
      'Proposal Sent',
      'Negotiation',
      'Won',
      'Lost',
    ],
    contacts: [
      {
        firstName: 'Rahul',
        lastName: 'Sharma',
        email: 'rahul@techstartup.in',
        company: 'TechStartup India',
        phone: '+91-9876543210',
      },
      {
        firstName: 'Priya',
        lastName: 'Mehta',
        email: 'priya@cloudco.in',
        company: 'CloudCo Solutions',
        phone: '+91-9876543211',
      },
      {
        firstName: 'Vikram',
        lastName: 'Singh',
        email: 'vikram@saastech.in',
        company: 'SaasTech',
        phone: '+91-9876543212',
      },
      {
        firstName: 'Anita',
        lastName: 'Patel',
        email: 'anita@digitalhub.in',
        company: 'Digital Hub',
        phone: '+91-9876543213',
      },
      {
        firstName: 'Suresh',
        lastName: 'Kumar',
        email: 'suresh@innotech.in',
        company: 'InnoTech',
        phone: '+91-9876543214',
      },
      {
        firstName: 'Deepa',
        lastName: 'Nair',
        email: 'deepa@softwarepro.in',
        company: 'SoftwarePro',
        phone: '+91-9876543215',
      },
      {
        firstName: 'Arjun',
        lastName: 'Reddy',
        email: 'arjun@techwave.in',
        company: 'TechWave',
        phone: '+91-9876543216',
      },
      {
        firstName: 'Kavya',
        lastName: 'Rao',
        email: 'kavya@devtools.in',
        company: 'DevTools India',
        phone: '+91-9876543217',
      },
    ],
    deals: [
      { name: 'TechStartup - Growth Plan Annual', amount: 59988 },
      { name: 'CloudCo - Enterprise License', amount: 155988 },
      { name: 'Digital Hub - Starter Upgrade', amount: 23988 },
      { name: 'InnoTech - Team Plan', amount: 47988 },
      { name: 'TechWave - Enterprise Q2', amount: 155988 },
      { name: 'DevTools - Annual Contract', amount: 59988 },
    ],
  },

  it_services: {
    pipelineName: 'Projects Pipeline',
    pipelineStages: ['Inquiry', 'Discovery Call', 'Proposal', 'SOW Sent', 'Won', 'Lost'],
    contacts: [
      {
        firstName: 'Manish',
        lastName: 'Gupta',
        email: 'manish@infosystems.in',
        company: 'InfoSystems Ltd',
        phone: '+91-9876543220',
      },
      {
        firstName: 'Sunita',
        lastName: 'Verma',
        email: 'sunita@itconsult.in',
        company: 'IT Consult India',
        phone: '+91-9876543221',
      },
      {
        firstName: 'Rajesh',
        lastName: 'Pandey',
        email: 'rajesh@techsolutions.in',
        company: 'Tech Solutions',
        phone: '+91-9876543222',
      },
      {
        firstName: 'Pooja',
        lastName: 'Mishra',
        email: 'pooja@datatech.in',
        company: 'DataTech',
        phone: '+91-9876543223',
      },
      {
        firstName: 'Anil',
        lastName: 'Joshi',
        email: 'anil@networksys.in',
        company: 'Network Systems',
        phone: '+91-9876543224',
      },
      {
        firstName: 'Ritu',
        lastName: 'Saxena',
        email: 'ritu@cloudsolutions.in',
        company: 'Cloud Solutions',
        phone: '+91-9876543225',
      },
      {
        firstName: 'Kiran',
        lastName: 'Bhat',
        email: 'kiran@digitalops.in',
        company: 'Digital Ops',
        phone: '+91-9876543226',
      },
      {
        firstName: 'Amit',
        lastName: 'Tiwari',
        email: 'amit@systemsco.in',
        company: 'Systems Co',
        phone: '+91-9876543227',
      },
    ],
    deals: [
      { name: 'InfoSystems - Cloud Migration Project', amount: 450000 },
      { name: 'Tech Solutions - ERP Implementation', amount: 1200000 },
      { name: 'DataTech - Data Analytics Setup', amount: 350000 },
      { name: 'Network Systems - Infrastructure Upgrade', amount: 800000 },
      { name: 'Digital Ops - Security Audit', amount: 250000 },
      { name: 'Systems Co - DevOps Consulting', amount: 600000 },
    ],
  },

  marketing_agency: {
    pipelineName: 'Client Pipeline',
    pipelineStages: ['Lead', 'Brief Received', 'Proposal', 'Negotiation', 'Signed', 'Lost'],
    contacts: [
      {
        firstName: 'Neha',
        lastName: 'Kapoor',
        email: 'neha@brandco.in',
        company: 'Brand Co',
        phone: '+91-9876543230',
      },
      {
        firstName: 'Sanjay',
        lastName: 'Malhotra',
        email: 'sanjay@retailchain.in',
        company: 'Retail Chain India',
        phone: '+91-9876543231',
      },
      {
        firstName: 'Divya',
        lastName: 'Chopra',
        email: 'divya@fashionhouse.in',
        company: 'Fashion House',
        phone: '+91-9876543232',
      },
      {
        firstName: 'Rohit',
        lastName: 'Aggarwal',
        email: 'rohit@fmcgbrand.in',
        company: 'FMCG Brand',
        phone: '+91-9876543233',
      },
      {
        firstName: 'Simran',
        lastName: 'Bedi',
        email: 'simran@edtech.in',
        company: 'EdTech India',
        phone: '+91-9876543234',
      },
      {
        firstName: 'Gaurav',
        lastName: 'Taneja',
        email: 'gaurav@fintech.in',
        company: 'FinTech Brand',
        phone: '+91-9876543235',
      },
      {
        firstName: 'Meera',
        lastName: 'Iyer',
        email: 'meera@healthcare.in',
        company: 'Healthcare Co',
        phone: '+91-9876543236',
      },
      {
        firstName: 'Nitin',
        lastName: 'Sethi',
        email: 'nitin@realestate.in',
        company: 'Real Estate Co',
        phone: '+91-9876543237',
      },
    ],
    deals: [
      { name: 'Brand Co - 360 Campaign Q1', amount: 480000 },
      { name: 'Retail Chain - Festive Campaign', amount: 320000 },
      { name: 'Fashion House - Brand Refresh', amount: 850000 },
      { name: 'EdTech India - Performance Marketing', amount: 240000 },
      { name: 'FinTech Brand - Social Media Retainer', amount: 180000 },
      { name: 'Healthcare Co - Content Strategy', amount: 150000 },
    ],
  },

  healthcare: {
    pipelineName: 'Patient Pipeline',
    pipelineStages: ['New Patient', 'Consultation', 'Treatment', 'Follow-up', 'Discharged'],
    contacts: [
      {
        firstName: 'Amit',
        lastName: 'Sharma',
        email: 'amit.sharma.health@gmail.com',
        company: null,
        phone: '+91-9876543240',
      },
      {
        firstName: 'Sunita',
        lastName: 'Patel',
        email: 'sunita.patel.health@gmail.com',
        company: null,
        phone: '+91-9876543241',
      },
      {
        firstName: 'Rajesh',
        lastName: 'Verma',
        email: 'rajesh.verma.health@gmail.com',
        company: null,
        phone: '+91-9876543242',
      },
      {
        firstName: 'Priya',
        lastName: 'Singh',
        email: 'priya.singh.health@gmail.com',
        company: null,
        phone: '+91-9876543243',
      },
      {
        firstName: 'Mohan',
        lastName: 'Kumar',
        email: 'mohan.kumar.health@gmail.com',
        company: null,
        phone: '+91-9876543244',
      },
      {
        firstName: 'Anjali',
        lastName: 'Gupta',
        email: 'anjali.gupta.health@gmail.com',
        company: null,
        phone: '+91-9876543245',
      },
      {
        firstName: 'Vikram',
        lastName: 'Nair',
        email: 'vikram.nair.health@gmail.com',
        company: null,
        phone: '+91-9876543246',
      },
      {
        firstName: 'Kavita',
        lastName: 'Rao',
        email: 'kavita.rao.health@gmail.com',
        company: null,
        phone: '+91-9876543247',
      },
    ],
    deals: [
      { name: 'Annual Health Package - Sharma Family', amount: 25000 },
      { name: 'Corporate Health Program - 50 employees', amount: 125000 },
      { name: 'Premium Wellness Package - Patel', amount: 35000 },
      { name: 'Physiotherapy Package - Verma', amount: 15000 },
      { name: 'Dental Care Annual - Kumar Family', amount: 28000 },
      { name: 'Diagnostic Package - Gupta', amount: 8500 },
    ],
  },

  real_estate: {
    pipelineName: 'Property Pipeline',
    pipelineStages: ['Inquiry', 'Site Visit', 'Shortlisted', 'Negotiation', 'Agreement', 'Closed'],
    contacts: [
      {
        firstName: 'Ramesh',
        lastName: 'Agarwal',
        email: 'ramesh.agarwal.re@gmail.com',
        company: null,
        phone: '+91-9876543250',
      },
      {
        firstName: 'Seema',
        lastName: 'Jain',
        email: 'seema.jain.re@gmail.com',
        company: null,
        phone: '+91-9876543251',
      },
      {
        firstName: 'Harish',
        lastName: 'Chandra',
        email: 'harish.chandra.re@gmail.com',
        company: null,
        phone: '+91-9876543252',
      },
      {
        firstName: 'Lalita',
        lastName: 'Mehta',
        email: 'lalita.mehta.re@gmail.com',
        company: null,
        phone: '+91-9876543253',
      },
      {
        firstName: 'Prakash',
        lastName: 'Shetty',
        email: 'prakash.shetty.re@gmail.com',
        company: null,
        phone: '+91-9876543254',
      },
      {
        firstName: 'Asha',
        lastName: 'Kulkarni',
        email: 'asha.kulkarni.re@gmail.com',
        company: null,
        phone: '+91-9876543255',
      },
      {
        firstName: 'Deepak',
        lastName: 'Menon',
        email: 'deepak.menon.re@gmail.com',
        company: null,
        phone: '+91-9876543256',
      },
      {
        firstName: 'Vandana',
        lastName: 'Tripathi',
        email: 'vandana.tripathi.re@gmail.com',
        company: null,
        phone: '+91-9876543257',
      },
    ],
    deals: [
      { name: '3BHK Apartment - Powai Mumbai', amount: 18500000 },
      { name: 'Commercial Office - BKC', amount: 45000000 },
      { name: '2BHK Flat - Pune Kothrud', amount: 8500000 },
      { name: 'Villa Plot - Lonavala', amount: 12000000 },
      { name: 'Retail Shop - Andheri West', amount: 22000000 },
      { name: '1BHK Investor Unit - Thane', amount: 5500000 },
    ],
  },

  education: {
    pipelineName: 'Enrollment Pipeline',
    pipelineStages: ['Inquiry', 'Counseling', 'Application', 'Admission', 'Enrolled'],
    contacts: [
      {
        firstName: 'Rohan',
        lastName: 'Desai',
        email: 'rohan.desai.edu@gmail.com',
        company: null,
        phone: '+91-9876543260',
      },
      {
        firstName: 'Nisha',
        lastName: 'Pillai',
        email: 'nisha.pillai.edu@gmail.com',
        company: null,
        phone: '+91-9876543261',
      },
      {
        firstName: 'Siddharth',
        lastName: 'Bajaj',
        email: 'siddharth.bajaj.edu@gmail.com',
        company: null,
        phone: '+91-9876543262',
      },
      {
        firstName: 'Tanya',
        lastName: 'Khanna',
        email: 'tanya.khanna.edu@gmail.com',
        company: null,
        phone: '+91-9876543263',
      },
      {
        firstName: 'Kunal',
        lastName: 'Shah',
        email: 'kunal.shah.edu@gmail.com',
        company: null,
        phone: '+91-9876543264',
      },
      {
        firstName: 'Ishita',
        lastName: 'Banerjee',
        email: 'ishita.banerjee.edu@gmail.com',
        company: null,
        phone: '+91-9876543265',
      },
      {
        firstName: 'Harsh',
        lastName: 'Bhatt',
        email: 'harsh.bhatt.edu@gmail.com',
        company: null,
        phone: '+91-9876543266',
      },
      {
        firstName: 'Ridhi',
        lastName: 'Joshi',
        email: 'ridhi.joshi.edu@gmail.com',
        company: null,
        phone: '+91-9876543267',
      },
    ],
    deals: [
      { name: 'MBA Program 2025 - Desai', amount: 850000 },
      { name: 'Engineering BTech 4yr - Bajaj', amount: 600000 },
      { name: 'Online Certification - Data Science', amount: 45000 },
      { name: 'Executive MBA - Shah', amount: 1200000 },
      { name: 'B.Com Honors Program - Banerjee', amount: 240000 },
      { name: 'Diploma in Design - Pillai', amount: 185000 },
    ],
  },

  financial_services: {
    pipelineName: 'Client Pipeline',
    pipelineStages: ['Lead', 'KYC', 'Portfolio Review', 'Proposal', 'Onboarded'],
    contacts: [
      {
        firstName: 'Arun',
        lastName: 'Krishnan',
        email: 'arun.krishnan.fin@gmail.com',
        company: 'Krishnan Group',
        phone: '+91-9876543270',
      },
      {
        firstName: 'Bharti',
        lastName: 'Wadhwa',
        email: 'bharti.wadhwa.fin@gmail.com',
        company: null,
        phone: '+91-9876543271',
      },
      {
        firstName: 'Chetan',
        lastName: 'Parikh',
        email: 'chetan.parikh.fin@gmail.com',
        company: 'Parikh Industries',
        phone: '+91-9876543272',
      },
      {
        firstName: 'Divyesh',
        lastName: 'Modi',
        email: 'divyesh.modi.fin@gmail.com',
        company: null,
        phone: '+91-9876543273',
      },
      {
        firstName: 'Esha',
        lastName: 'Bhavsar',
        email: 'esha.bhavsar.fin@gmail.com',
        company: null,
        phone: '+91-9876543274',
      },
      {
        firstName: 'Falguni',
        lastName: 'Thakkar',
        email: 'falguni.thakkar.fin@gmail.com',
        company: 'Thakkar Exports',
        phone: '+91-9876543275',
      },
      {
        firstName: 'Girish',
        lastName: 'Dalal',
        email: 'girish.dalal.fin@gmail.com',
        company: null,
        phone: '+91-9876543276',
      },
      {
        firstName: 'Heena',
        lastName: 'Zaveri',
        email: 'heena.zaveri.fin@gmail.com',
        company: null,
        phone: '+91-9876543277',
      },
    ],
    deals: [
      { name: 'Krishnan Group - Wealth Management Portfolio', amount: 5000000 },
      { name: 'Parikh Industries - Corporate FD', amount: 10000000 },
      { name: 'HNI Portfolio - Thakkar Exports', amount: 7500000 },
      { name: 'Mutual Fund SIP Setup - Wadhwa', amount: 120000 },
      { name: 'Term Insurance Package - Modi', amount: 85000 },
      { name: 'Retirement Planning - Dalal', amount: 2500000 },
    ],
  },

  retail: {
    pipelineName: 'Sales Pipeline',
    pipelineStages: ['Lead', 'Quote Sent', 'Negotiation', 'Order Placed', 'Fulfilled'],
    contacts: [
      {
        firstName: 'Sunil',
        lastName: 'Khatri',
        email: 'sunil.khatri@retailbiz.in',
        company: 'Khatri Stores',
        phone: '+91-9876543280',
      },
      {
        firstName: 'Mamta',
        lastName: 'Sood',
        email: 'mamta.sood@boutique.in',
        company: 'Mamta Boutique',
        phone: '+91-9876543281',
      },
      {
        firstName: 'Amar',
        lastName: 'Rawat',
        email: 'amar.rawat@supermart.in',
        company: 'Super Mart',
        phone: '+91-9876543282',
      },
      {
        firstName: 'Priti',
        lastName: 'Dhawan',
        email: 'priti.dhawan@fashionzone.in',
        company: 'Fashion Zone',
        phone: '+91-9876543283',
      },
      {
        firstName: 'Ramesh',
        lastName: 'Lal',
        email: 'ramesh.lal@groceryking.in',
        company: 'Grocery King',
        phone: '+91-9876543284',
      },
      {
        firstName: 'Geeta',
        lastName: 'Batra',
        email: 'geeta.batra@lifestyle.in',
        company: 'Lifestyle Store',
        phone: '+91-9876543285',
      },
      {
        firstName: 'Hardev',
        lastName: 'Sidhu',
        email: 'hardev.sidhu@electronics.in',
        company: 'Sidhu Electronics',
        phone: '+91-9876543286',
      },
      {
        firstName: 'Indu',
        lastName: 'Nanda',
        email: 'indu.nanda@homegoods.in',
        company: 'Home Goods',
        phone: '+91-9876543287',
      },
    ],
    deals: [
      { name: 'Khatri Stores - Festival Stock Order', amount: 850000 },
      { name: 'Super Mart - Annual Supply Contract', amount: 2400000 },
      { name: 'Fashion Zone - Summer Collection', amount: 320000 },
      { name: 'Grocery King - FMCG Monthly', amount: 650000 },
      { name: 'Sidhu Electronics - Bulk Purchase', amount: 1200000 },
      { name: 'Home Goods - New Store Opening', amount: 450000 },
    ],
  },

  hospitality: {
    pipelineName: 'Booking Pipeline',
    pipelineStages: ['Inquiry', 'Quote Sent', 'Confirmed', 'Checked In', 'Completed'],
    contacts: [
      {
        firstName: 'Vikas',
        lastName: 'Oberoi',
        email: 'vikas.oberoi@gmail.com',
        company: 'Oberoi Enterprises',
        phone: '+91-9876543290',
      },
      {
        firstName: 'Nidhi',
        lastName: 'Tandon',
        email: 'nidhi.tandon@gmail.com',
        company: null,
        phone: '+91-9876543291',
      },
      {
        firstName: 'Saurabh',
        lastName: 'Bahl',
        email: 'saurabh.bahl@events.in',
        company: 'Bahl Events',
        phone: '+91-9876543292',
      },
      {
        firstName: 'Trupti',
        lastName: 'Deshpande',
        email: 'trupti.deshpande@gmail.com',
        company: null,
        phone: '+91-9876543293',
      },
      {
        firstName: 'Umesh',
        lastName: 'Gokhale',
        email: 'umesh.gokhale@corporatetravel.in',
        company: 'Corporate Travel Co',
        phone: '+91-9876543294',
      },
      {
        firstName: 'Vaibhav',
        lastName: 'Chitnis',
        email: 'vaibhav.chitnis@gmail.com',
        company: null,
        phone: '+91-9876543295',
      },
      {
        firstName: 'Waheeda',
        lastName: 'Khan',
        email: 'waheeda.khan@gmail.com',
        company: null,
        phone: '+91-9876543296',
      },
      {
        firstName: 'Xavier',
        lastName: 'Fernandes',
        email: 'xavier.fernandes@weddings.in',
        company: 'Royal Weddings',
        phone: '+91-9876543297',
      },
    ],
    deals: [
      { name: 'Oberoi Enterprises - Annual Corporate Rate', amount: 1200000 },
      { name: 'Bahl Events - New Year Gala Package', amount: 850000 },
      { name: 'Royal Weddings - Grand Wedding Package', amount: 2500000 },
      { name: 'Corporate Travel Co - Q1 Block Booking', amount: 650000 },
      { name: 'Team Offsite Package - 50 pax', amount: 350000 },
      { name: 'Conference Hall Booking - 2 days', amount: 120000 },
    ],
  },

  manufacturing: {
    pipelineName: 'Order Pipeline',
    pipelineStages: ['RFQ', 'Sampling', 'Negotiation', 'Purchase Order', 'Production', 'Delivered'],
    contacts: [
      {
        firstName: 'Yogesh',
        lastName: 'Patil',
        email: 'yogesh.patil@autoparts.in',
        company: 'Auto Parts India',
        phone: '+91-9876543300',
      },
      {
        firstName: 'Zara',
        lastName: 'Sheikh',
        email: 'zara.sheikh@textilemills.in',
        company: 'Textile Mills',
        phone: '+91-9876543301',
      },
      {
        firstName: 'Abhijit',
        lastName: 'Kulkarni',
        email: 'abhijit.kulkarni@packaging.in',
        company: 'Packaging Co',
        phone: '+91-9876543302',
      },
      {
        firstName: 'Bhavana',
        lastName: 'Sawant',
        email: 'bhavana.sawant@electronics.in',
        company: 'Electronics Mfg',
        phone: '+91-9876543303',
      },
      {
        firstName: 'Chandrakant',
        lastName: 'Desai',
        email: 'chandrakant.desai@pharma.in',
        company: 'Pharma Industries',
        phone: '+91-9876543304',
      },
      {
        firstName: 'Deepika',
        lastName: 'Gawde',
        email: 'deepika.gawde@chemicals.in',
        company: 'Chemical Works',
        phone: '+91-9876543305',
      },
      {
        firstName: 'Eknath',
        lastName: 'Mane',
        email: 'eknath.mane@steel.in',
        company: 'Steel Industries',
        phone: '+91-9876543306',
      },
      {
        firstName: 'Fatima',
        lastName: 'Ansari',
        email: 'fatima.ansari@garments.in',
        company: 'Garment Factory',
        phone: '+91-9876543307',
      },
    ],
    deals: [
      { name: 'Auto Parts India - Q2 Order', amount: 4500000 },
      { name: 'Textile Mills - Fabric Supply Annual', amount: 8000000 },
      { name: 'Electronics Mfg - Component Contract', amount: 3200000 },
      { name: 'Pharma Industries - API Supply', amount: 12000000 },
      { name: 'Steel Industries - Raw Material', amount: 6500000 },
      { name: 'Garment Factory - Accessories Order', amount: 1800000 },
    ],
  },

  logistics: {
    pipelineName: 'Contract Pipeline',
    pipelineStages: ['RFQ', 'Costing', 'Proposal', 'Negotiation', 'Signed'],
    contacts: [
      {
        firstName: 'Ganesh',
        lastName: 'Pillai',
        email: 'ganesh.pillai@ecomlogix.in',
        company: 'EcomLogix',
        phone: '+91-9876543310',
      },
      {
        firstName: 'Hema',
        lastName: 'Sundaram',
        email: 'hema.sundaram@retailco.in',
        company: 'Retail Co',
        phone: '+91-9876543311',
      },
      {
        firstName: 'Indraneel',
        lastName: 'Bose',
        email: 'indraneel.bose@pharmaexp.in',
        company: 'Pharma Express',
        phone: '+91-9876543312',
      },
      {
        firstName: 'Jayanti',
        lastName: 'Misra',
        email: 'jayanti.misra@coldchain.in',
        company: 'Cold Chain Co',
        phone: '+91-9876543313',
      },
      {
        firstName: 'Kartik',
        lastName: 'Soni',
        email: 'kartik.soni@automotive.in',
        company: 'Automotive Logistics',
        phone: '+91-9876543314',
      },
      {
        firstName: 'Leela',
        lastName: 'Choudhary',
        email: 'leela.choudhary@textiles.in',
        company: 'Textile Exports',
        phone: '+91-9876543315',
      },
      {
        firstName: 'Mukesh',
        lastName: 'Bansal',
        email: 'mukesh.bansal@electronics.in',
        company: 'Electronics Trade',
        phone: '+91-9876543316',
      },
      {
        firstName: 'Nalini',
        lastName: 'Mehta',
        email: 'nalini.mehta@fmcgco.in',
        company: 'FMCG Co',
        phone: '+91-9876543317',
      },
    ],
    deals: [
      { name: 'EcomLogix - Annual Warehousing + Last Mile', amount: 18000000 },
      { name: 'Pharma Express - Temperature Controlled', amount: 8500000 },
      { name: 'Textile Exports - Container Shipping', amount: 4200000 },
      { name: 'FMCG Co - Pan India Distribution', amount: 24000000 },
      { name: 'Cold Chain Co - Monthly Contract', amount: 6000000 },
      { name: 'Automotive Logistics - Parts Transport', amount: 3200000 },
    ],
  },

  legal: {
    pipelineName: 'Case Pipeline',
    pipelineStages: ['Inquiry', 'Consultation', 'Retainer', 'Active Case', 'Closed'],
    contacts: [
      {
        firstName: 'Omprakash',
        lastName: 'Sharma',
        email: 'omprakash@corporateclient.in',
        company: 'Corporate Client Ltd',
        phone: '+91-9876543320',
      },
      {
        firstName: 'Preeti',
        lastName: 'Arora',
        email: 'preeti.arora.legal@gmail.com',
        company: null,
        phone: '+91-9876543321',
      },
      {
        firstName: 'Qasim',
        lastName: 'Ali',
        email: 'qasim.ali@startupco.in',
        company: 'StartupCo',
        phone: '+91-9876543322',
      },
      {
        firstName: 'Rekha',
        lastName: 'Nambiar',
        email: 'rekha.nambiar.legal@gmail.com',
        company: null,
        phone: '+91-9876543323',
      },
      {
        firstName: 'Sameer',
        lastName: 'Doshi',
        email: 'sameer.doshi@realestate.in',
        company: 'RE Developers',
        phone: '+91-9876543324',
      },
      {
        firstName: 'Tara',
        lastName: 'Iyer',
        email: 'tara.iyer.legal@gmail.com',
        company: null,
        phone: '+91-9876543325',
      },
      {
        firstName: 'Uday',
        lastName: 'Kale',
        email: 'uday.kale@industry.in',
        company: 'Kale Industries',
        phone: '+91-9876543326',
      },
      {
        firstName: 'Vimala',
        lastName: 'Rao',
        email: 'vimala.rao.legal@gmail.com',
        company: null,
        phone: '+91-9876543327',
      },
    ],
    deals: [
      { name: 'Corporate Client - Annual Retainer', amount: 1800000 },
      { name: 'StartupCo - Incorporation + Compliance', amount: 250000 },
      { name: 'RE Developers - Land Acquisition', amount: 850000 },
      { name: 'Kale Industries - Labour Law Compliance', amount: 420000 },
      { name: 'Individual - Divorce Settlement', amount: 180000 },
      { name: 'Corporate - IP Registration Portfolio', amount: 320000 },
    ],
  },

  restaurant: {
    pipelineName: 'Order Pipeline',
    pipelineStages: ['Inquiry', 'Tasting', 'Quote', 'Booked', 'Delivered'],
    contacts: [
      {
        firstName: 'Aakash',
        lastName: 'Shah',
        email: 'aakash.shah.rest@gmail.com',
        company: null,
        phone: '+91-9876543330',
      },
      {
        firstName: 'Bhumi',
        lastName: 'Patel',
        email: 'bhumi.patel.rest@gmail.com',
        company: null,
        phone: '+91-9876543331',
      },
      {
        firstName: 'Chirayu',
        lastName: 'Mehta',
        email: 'chirayu.mehta@office.in',
        company: 'Tech Office',
        phone: '+91-9876543332',
      },
      {
        firstName: 'Disha',
        lastName: 'Vyas',
        email: 'disha.vyas.rest@gmail.com',
        company: null,
        phone: '+91-9876543333',
      },
      {
        firstName: 'Eesha',
        lastName: 'Trivedi',
        email: 'eesha.trivedi@events.in',
        company: 'Events Co',
        phone: '+91-9876543334',
      },
      {
        firstName: 'Falak',
        lastName: 'Kapadia',
        email: 'falak.kapadia.rest@gmail.com',
        company: null,
        phone: '+91-9876543335',
      },
      {
        firstName: 'Gaurangi',
        lastName: 'Sheth',
        email: 'gaurangi.sheth.rest@gmail.com',
        company: null,
        phone: '+91-9876543336',
      },
      {
        firstName: 'Hetvi',
        lastName: 'Raval',
        email: 'hetvi.raval@catering.in',
        company: 'Corporate Catering',
        phone: '+91-9876543337',
      },
    ],
    deals: [
      { name: 'Tech Office - Monthly Lunch Catering', amount: 85000 },
      { name: 'Corporate Catering - Annual Contract', amount: 1200000 },
      { name: 'Wedding Banquet - 500 guests', amount: 750000 },
      { name: 'Events Co - Conference Catering', amount: 180000 },
      { name: 'Festival Special Menu Orders', amount: 45000 },
      { name: 'Birthday Party Catering - 100 pax', amount: 65000 },
    ],
  },

  construction: {
    pipelineName: 'Project Pipeline',
    pipelineStages: ['Inquiry', 'Site Survey', 'Estimate', 'Contract', 'In Progress', 'Handover'],
    contacts: [
      {
        firstName: 'Ishaan',
        lastName: 'Trivedi',
        email: 'ishaan.trivedi@redev.in',
        company: 'RE Developers',
        phone: '+91-9876543340',
      },
      {
        firstName: 'Juhi',
        lastName: 'Khanna',
        email: 'juhi.khanna.const@gmail.com',
        company: null,
        phone: '+91-9876543341',
      },
      {
        firstName: 'Kamlesh',
        lastName: 'Bhatt',
        email: 'kamlesh.bhatt@commercial.in',
        company: 'Commercial Builders',
        phone: '+91-9876543342',
      },
      {
        firstName: 'Laleh',
        lastName: 'Saberi',
        email: 'laleh.saberi.const@gmail.com',
        company: null,
        phone: '+91-9876543343',
      },
      {
        firstName: 'Mahesh',
        lastName: 'Pawar',
        email: 'mahesh.pawar@infrastructure.in',
        company: 'Infra Corp',
        phone: '+91-9876543344',
      },
      {
        firstName: 'Namita',
        lastName: 'Gaikwad',
        email: 'namita.gaikwad.const@gmail.com',
        company: null,
        phone: '+91-9876543345',
      },
      {
        firstName: 'Omkar',
        lastName: 'Jadhav',
        email: 'omkar.jadhav@industrial.in',
        company: 'Industrial Build',
        phone: '+91-9876543346',
      },
      {
        firstName: 'Padmaja',
        lastName: 'Shinde',
        email: 'padmaja.shinde.const@gmail.com',
        company: null,
        phone: '+91-9876543347',
      },
    ],
    deals: [
      { name: 'RE Developers - Residential Complex 24 flats', amount: 45000000 },
      { name: 'Commercial Builders - Office Block', amount: 28000000 },
      { name: 'Infra Corp - Road Construction 5km', amount: 85000000 },
      { name: 'Home Renovation - Trivedi Bungalow', amount: 3500000 },
      { name: 'Industrial Build - Factory Extension', amount: 18000000 },
      { name: 'Interior Design - Apartment Fit-Out', amount: 2800000 },
    ],
  },

  automotive: {
    pipelineName: 'Sales Pipeline',
    pipelineStages: ['Showroom Visit', 'Test Drive', 'Negotiation', 'Finance Applied', 'Sold'],
    contacts: [
      {
        firstName: 'Qadir',
        lastName: 'Siddiqui',
        email: 'qadir.siddiqui.auto@gmail.com',
        company: null,
        phone: '+91-9876543350',
      },
      {
        firstName: 'Rashmi',
        lastName: 'Nene',
        email: 'rashmi.nene.auto@gmail.com',
        company: null,
        phone: '+91-9876543351',
      },
      {
        firstName: 'Satish',
        lastName: 'More',
        email: 'satish.more@fleet.in',
        company: 'Fleet Solutions',
        phone: '+91-9876543352',
      },
      {
        firstName: 'Tejal',
        lastName: 'Gohil',
        email: 'tejal.gohil.auto@gmail.com',
        company: null,
        phone: '+91-9876543353',
      },
      {
        firstName: 'Ullas',
        lastName: 'Kamat',
        email: 'ullas.kamat@corporate.in',
        company: 'Corporate Fleet',
        phone: '+91-9876543354',
      },
      {
        firstName: 'Varsha',
        lastName: 'Dabke',
        email: 'varsha.dabke.auto@gmail.com',
        company: null,
        phone: '+91-9876543355',
      },
      {
        firstName: 'Waman',
        lastName: 'Joshi',
        email: 'waman.joshi.auto@gmail.com',
        company: null,
        phone: '+91-9876543356',
      },
      {
        firstName: 'Yasmin',
        lastName: 'Shaikh',
        email: 'yasmin.shaikh@taxi.in',
        company: 'Taxi Co',
        phone: '+91-9876543357',
      },
    ],
    deals: [
      { name: 'Fleet Solutions - 10 SUVs', amount: 18000000 },
      { name: 'Corporate Fleet - 5 Sedans', amount: 7500000 },
      { name: 'Taxi Co - 20 Hatchbacks', amount: 22000000 },
      { name: 'Individual - Luxury SUV', amount: 4500000 },
      { name: 'Individual - Compact Sedan', amount: 1200000 },
      { name: 'Individual - Electric Vehicle', amount: 1800000 },
    ],
  },

  agriculture: {
    pipelineName: 'Sales Pipeline',
    pipelineStages: ['Lead', 'Demo', 'Negotiation', 'Order', 'Delivered'],
    contacts: [
      {
        firstName: 'Balram',
        lastName: 'Yadav',
        email: 'balram.yadav@farm.in',
        company: 'Yadav Farms',
        phone: '+91-9876543360',
      },
      {
        firstName: 'Chameli',
        lastName: 'Devi',
        email: 'chameli.devi@coop.in',
        company: 'Farmers Coop',
        phone: '+91-9876543361',
      },
      {
        firstName: 'Dhanraj',
        lastName: 'Patel',
        email: 'dhanraj.patel@agritech.in',
        company: 'AgriTech',
        phone: '+91-9876543362',
      },
      {
        firstName: 'Ekta',
        lastName: 'Thakur',
        email: 'ekta.thakur@farm.in',
        company: 'Thakur Agriculture',
        phone: '+91-9876543363',
      },
      {
        firstName: 'Fulchand',
        lastName: 'Patidar',
        email: 'fulchand.patidar@coop.in',
        company: 'Patidar Coop',
        phone: '+91-9876543364',
      },
      {
        firstName: 'Ganga',
        lastName: 'Bai',
        email: 'ganga.bai@farmvillage.in',
        company: null,
        phone: '+91-9876543365',
      },
      {
        firstName: 'Hemraj',
        lastName: 'Singh',
        email: 'hemraj.singh@agri.in',
        company: 'Singh Agribusiness',
        phone: '+91-9876543366',
      },
      {
        firstName: 'Indira',
        lastName: 'Kasbe',
        email: 'indira.kasbe@farm.in',
        company: null,
        phone: '+91-9876543367',
      },
    ],
    deals: [
      { name: 'Yadav Farms - Tractor + Attachments', amount: 1200000 },
      { name: 'Farmers Coop - Irrigation System', amount: 3500000 },
      { name: 'AgriTech - Smart Monitoring 200 acres', amount: 850000 },
      { name: 'Patidar Coop - Fertilizer Annual Supply', amount: 650000 },
      { name: 'Singh Agribusiness - Cold Storage', amount: 2200000 },
      { name: 'Farm Equipment Rental - Harvest Season', amount: 180000 },
    ],
  },

  media_entertainment: {
    pipelineName: 'Production Pipeline',
    pipelineStages: ['Pitch', 'Development', 'Pre-Production', 'Production', 'Post', 'Released'],
    contacts: [
      {
        firstName: 'Jayesh',
        lastName: 'Bakshi',
        email: 'jayesh.bakshi@studio.in',
        company: 'Bakshi Studios',
        phone: '+91-9876543370',
      },
      {
        firstName: 'Kaveri',
        lastName: 'Namboodiri',
        email: 'kaveri.namboodiri@ott.in',
        company: 'OTT Platform',
        phone: '+91-9876543371',
      },
      {
        firstName: 'Laxman',
        lastName: 'Rao',
        email: 'laxman.rao@advertising.in',
        company: 'Ad Agency',
        phone: '+91-9876543372',
      },
      {
        firstName: 'Mythili',
        lastName: 'Venkat',
        email: 'mythili.venkat@brand.in',
        company: 'Consumer Brand',
        phone: '+91-9876543373',
      },
      {
        firstName: 'Narayan',
        lastName: 'Das',
        email: 'narayan.das@youtube.in',
        company: 'Content Creator',
        phone: '+91-9876543374',
      },
      {
        firstName: 'Odisha',
        lastName: 'Patra',
        email: 'odisha.patra@festival.in',
        company: 'Film Festival',
        phone: '+91-9876543375',
      },
      {
        firstName: 'Prashant',
        lastName: 'Damle',
        email: 'prashant.damle@podcast.in',
        company: 'Podcast Network',
        phone: '+91-9876543376',
      },
      {
        firstName: 'Qudsia',
        lastName: 'Begum',
        email: 'qudsia.begum@music.in',
        company: 'Music Label',
        phone: '+91-9876543377',
      },
    ],
    deals: [
      { name: 'OTT Platform - Web Series 6 Episodes', amount: 12000000 },
      { name: 'Consumer Brand - TVC Campaign', amount: 4500000 },
      { name: 'Ad Agency - Digital Ad Package', amount: 2200000 },
      { name: 'Film Festival - Distribution Rights', amount: 850000 },
      { name: 'Music Label - Album Production', amount: 3500000 },
      { name: 'Podcast Network - Branded Content', amount: 650000 },
    ],
  },

  fitness_wellness: {
    pipelineName: 'Membership Pipeline',
    pipelineStages: ['Walk-in', 'Trial', 'Membership Offer', 'Enrolled', 'Renewal Due'],
    contacts: [
      {
        firstName: 'Rakesh',
        lastName: 'Babu',
        email: 'rakesh.babu.fit@gmail.com',
        company: null,
        phone: '+91-9876543380',
      },
      {
        firstName: 'Sheela',
        lastName: 'Krishnaswamy',
        email: 'sheela.k.fit@gmail.com',
        company: null,
        phone: '+91-9876543381',
      },
      {
        firstName: 'Tarun',
        lastName: 'Ahuja',
        email: 'tarun.ahuja.fit@gmail.com',
        company: null,
        phone: '+91-9876543382',
      },
      {
        firstName: 'Uma',
        lastName: 'Devi',
        email: 'uma.devi.fit@gmail.com',
        company: null,
        phone: '+91-9876543383',
      },
      {
        firstName: 'Vivek',
        lastName: 'Anand',
        email: 'vivek.anand.fit@gmail.com',
        company: null,
        phone: '+91-9876543384',
      },
      {
        firstName: 'Winifred',
        lastName: 'Gomes',
        email: 'winifred.gomes.fit@gmail.com',
        company: null,
        phone: '+91-9876543385',
      },
      {
        firstName: 'Xena',
        lastName: 'DSouza',
        email: 'xena.dsouza.fit@gmail.com',
        company: null,
        phone: '+91-9876543386',
      },
      {
        firstName: 'Yogita',
        lastName: 'Sawant',
        email: 'yogita.sawant.fit@gmail.com',
        company: null,
        phone: '+91-9876543387',
      },
    ],
    deals: [
      { name: 'Annual Premium Membership - Babu', amount: 24000 },
      { name: 'Personal Training 6months - Ahuja', amount: 48000 },
      { name: 'Corporate Wellness - 30 employees', amount: 450000 },
      { name: 'Yoga Batch Q2 - 15 members', amount: 75000 },
      { name: 'Nutrition Consultation Package', amount: 18000 },
      { name: 'Annual Basic Membership - Sawant', amount: 12000 },
    ],
  },

  travel_tourism: {
    pipelineName: 'Booking Pipeline',
    pipelineStages: ['Inquiry', 'Itinerary Sent', 'Confirmed', 'Departed', 'Returned'],
    contacts: [
      {
        firstName: 'Zubair',
        lastName: 'Merchant',
        email: 'zubair.merchant.travel@gmail.com',
        company: null,
        phone: '+91-9876543390',
      },
      {
        firstName: 'Aarushi',
        lastName: 'Batra',
        email: 'aarushi.batra.travel@gmail.com',
        company: null,
        phone: '+91-9876543391',
      },
      {
        firstName: 'Badal',
        lastName: 'Roy',
        email: 'badal.roy@corporate.in',
        company: 'Corporate Co',
        phone: '+91-9876543392',
      },
      {
        firstName: 'Charulata',
        lastName: 'Ghosh',
        email: 'charulata.ghosh.travel@gmail.com',
        company: null,
        phone: '+91-9876543393',
      },
      {
        firstName: 'Debashis',
        lastName: 'Mukherjee',
        email: 'debashis.m.travel@gmail.com',
        company: null,
        phone: '+91-9876543394',
      },
      {
        firstName: 'Eklavya',
        lastName: 'Srivastava',
        email: 'eklavya.s.travel@gmail.com',
        company: null,
        phone: '+91-9876543395',
      },
      {
        firstName: 'Fiona',
        lastName: 'Fernandez',
        email: 'fiona.fernandez.travel@gmail.com',
        company: null,
        phone: '+91-9876543396',
      },
      {
        firstName: 'Goutam',
        lastName: 'Halder',
        email: 'goutam.halder@events.in',
        company: 'Group Events',
        phone: '+91-9876543397',
      },
    ],
    deals: [
      { name: 'European Tour 14N - Family 4pax', amount: 750000 },
      { name: 'Maldives Honeymoon Package', amount: 320000 },
      { name: 'Corporate MICE - Bali 50pax', amount: 4500000 },
      { name: 'Kashmir Holiday 7N - Family', amount: 185000 },
      { name: 'Japan Tour 10N - Group 20pax', amount: 1800000 },
      { name: 'Rajasthan Cultural Tour - 8N', amount: 165000 },
    ],
  },

  ecommerce: {
    pipelineName: 'Sales Pipeline',
    pipelineStages: ['Lead', 'Demo', 'Trial', 'Proposal', 'Customer'],
    contacts: [
      {
        firstName: 'Himesh',
        lastName: 'Reshammiya',
        email: 'himesh.r@onlinestore.in',
        company: 'Online Store India',
        phone: '+91-9876543400',
      },
      {
        firstName: 'Isha',
        lastName: 'Talwar',
        email: 'isha.talwar@dthings.in',
        company: 'D-Things',
        phone: '+91-9876543401',
      },
      {
        firstName: 'Jugal',
        lastName: 'Kishore',
        email: 'jugal.k@marketplace.in',
        company: 'Marketplace Co',
        phone: '+91-9876543402',
      },
      {
        firstName: 'Krishna',
        lastName: 'Murali',
        email: 'krishna.m@dtoc.in',
        company: 'D2C Brand',
        phone: '+91-9876543403',
      },
      {
        firstName: 'Lavanya',
        lastName: 'Seshadri',
        email: 'lavanya.s@fashion.in',
        company: 'Fashion eShop',
        phone: '+91-9876543404',
      },
      {
        firstName: 'Madhu',
        lastName: 'Balakrishnan',
        email: 'madhu.b@groceryapp.in',
        company: 'Grocery App',
        phone: '+91-9876543405',
      },
      {
        firstName: 'Neel',
        lastName: 'Ghosh',
        email: 'neel.ghosh@electronics.in',
        company: 'Electronics Portal',
        phone: '+91-9876543406',
      },
      {
        firstName: 'Oviya',
        lastName: 'Suresh',
        email: 'oviya.suresh@beauty.in',
        company: 'Beauty Brand',
        phone: '+91-9876543407',
      },
    ],
    deals: [
      { name: 'Online Store India - Platform Setup + Marketing', amount: 185000 },
      { name: 'D2C Brand - Full Commerce Suite', amount: 95988 },
      { name: 'Marketplace Co - Enterprise Plan', amount: 155988 },
      { name: 'Fashion eShop - Annual Growth Plan', amount: 59988 },
      { name: 'Grocery App - Delivery Integration', amount: 75000 },
      { name: 'Electronics Portal - Inventory Sync', amount: 120000 },
    ],
  },

  telecom: {
    pipelineName: 'Account Pipeline',
    pipelineStages: ['RFP', 'Proposal', 'POC', 'Negotiation', 'Contract Signed'],
    contacts: [
      {
        firstName: 'Parimal',
        lastName: 'Dave',
        email: 'parimal.dave@enterprise.in',
        company: 'Enterprise Corp',
        phone: '+91-9876543410',
      },
      {
        firstName: 'Qirat',
        lastName: 'Soni',
        email: 'qirat.soni@sme.in',
        company: 'SME Business',
        phone: '+91-9876543411',
      },
      {
        firstName: 'Rajan',
        lastName: 'Puri',
        email: 'rajan.puri@hospitality.in',
        company: 'Hotel Chain',
        phone: '+91-9876543412',
      },
      {
        firstName: 'Saraswati',
        lastName: 'Pillai',
        email: 'saraswati.p@banking.in',
        company: 'Banking Corp',
        phone: '+91-9876543413',
      },
      {
        firstName: 'Tanveer',
        lastName: 'Hussain',
        email: 'tanveer.h@retail.in',
        company: 'Retail Chain',
        phone: '+91-9876543414',
      },
      {
        firstName: 'Usha',
        lastName: 'Ramachandran',
        email: 'usha.r@government.in',
        company: 'Government Dept',
        phone: '+91-9876543415',
      },
      {
        firstName: 'Vasanth',
        lastName: 'Kumar',
        email: 'vasanth.k@education.in',
        company: 'Education Institute',
        phone: '+91-9876543416',
      },
      {
        firstName: 'Wilma',
        lastName: 'Pereira',
        email: 'wilma.p@healthcare.in',
        company: 'Hospital Network',
        phone: '+91-9876543417',
      },
    ],
    deals: [
      { name: 'Enterprise Corp - 500 SIM + Broadband', amount: 4800000 },
      { name: 'Hotel Chain - Hospitality Bundle', amount: 2400000 },
      { name: 'Banking Corp - Secure Leased Lines', amount: 8500000 },
      { name: 'Retail Chain - POS Connectivity', amount: 1800000 },
      { name: 'Hospital Network - IoT Connectivity', amount: 3200000 },
      { name: 'Education Institute - Campus Wi-Fi', amount: 2800000 },
    ],
  },

  insurance: {
    pipelineName: 'Policy Pipeline',
    pipelineStages: ['Lead', 'Needs Analysis', 'Quote', 'Application', 'Policy Issued'],
    contacts: [
      {
        firstName: 'Xander',
        lastName: 'Costa',
        email: 'xander.costa.ins@gmail.com',
        company: null,
        phone: '+91-9876543420',
      },
      {
        firstName: 'Yashoda',
        lastName: 'Patil',
        email: 'yashoda.patil.ins@gmail.com',
        company: null,
        phone: '+91-9876543421',
      },
      {
        firstName: 'Zubeida',
        lastName: 'Qureshi',
        email: 'zubeida.q.ins@gmail.com',
        company: null,
        phone: '+91-9876543422',
      },
      {
        firstName: 'Aman',
        lastName: 'Ahuja',
        email: 'aman.ahuja@business.in',
        company: 'Ahuja Business',
        phone: '+91-9876543423',
      },
      {
        firstName: 'Binita',
        lastName: 'Thakkar',
        email: 'binita.thakkar.ins@gmail.com',
        company: null,
        phone: '+91-9876543424',
      },
      {
        firstName: 'Chirag',
        lastName: 'Panchal',
        email: 'chirag.panchal@mfg.in',
        company: 'Panchal Mfg',
        phone: '+91-9876543425',
      },
      {
        firstName: 'Daksha',
        lastName: 'Trivedi',
        email: 'daksha.trivedi.ins@gmail.com',
        company: null,
        phone: '+91-9876543426',
      },
      {
        firstName: 'Ekam',
        lastName: 'Sahni',
        email: 'ekam.sahni.ins@gmail.com',
        company: null,
        phone: '+91-9876543427',
      },
    ],
    deals: [
      { name: 'Ahuja Business - Group Health Policy 50 lives', amount: 1200000 },
      { name: 'Panchal Mfg - Fire and Burglary Policy', amount: 850000 },
      { name: 'Term Plan 2Cr - Costa', amount: 42000 },
      { name: 'Health Insurance Family - Patil', amount: 32000 },
      { name: 'ULIP Investment + Life Cover - Thakkar', amount: 240000 },
      { name: 'Vehicle Fleet Insurance - 20 vehicles', amount: 380000 },
    ],
  },

  pharma: {
    pipelineName: 'Distribution Pipeline',
    pipelineStages: [
      'Distributor Onboarding',
      'Product Training',
      'First Order',
      'Regular Supply',
      'Key Account',
    ],
    contacts: [
      {
        firstName: 'Fadnavis',
        lastName: 'Patil',
        email: 'fadnavis.patil@pharma.in',
        company: 'Patil Pharma Dist',
        phone: '+91-9876543430',
      },
      {
        firstName: 'Girija',
        lastName: 'Nair',
        email: 'girija.nair@hospital.in',
        company: 'City Hospital',
        phone: '+91-9876543431',
      },
      {
        firstName: 'Harsha',
        lastName: 'Bhosle',
        email: 'harsha.bhosle@clinic.in',
        company: 'Bhosle Clinic',
        phone: '+91-9876543432',
      },
      {
        firstName: 'Indumati',
        lastName: 'Deshmukh',
        email: 'indumati.d@pharmacy.in',
        company: 'Deshmukh Pharmacy',
        phone: '+91-9876543433',
      },
      {
        firstName: 'Jayram',
        lastName: 'Jagtap',
        email: 'jayram.jagtap@wholesale.in',
        company: 'Jagtap Wholesale',
        phone: '+91-9876543434',
      },
      {
        firstName: 'Kamakshi',
        lastName: 'Menon',
        email: 'kamakshi.menon@diagnostic.in',
        company: 'Diagnostic Center',
        phone: '+91-9876543435',
      },
      {
        firstName: 'Lohit',
        lastName: 'Barua',
        email: 'lohit.barua@healthcare.in',
        company: 'Healthcare Chain',
        phone: '+91-9876543436',
      },
      {
        firstName: 'Madhabi',
        lastName: 'Sarkar',
        email: 'madhabi.sarkar@medhub.in',
        company: 'Med Hub',
        phone: '+91-9876543437',
      },
    ],
    deals: [
      { name: 'Patil Pharma Dist - Annual Supply Contract', amount: 12000000 },
      { name: 'City Hospital - Critical Care Drugs', amount: 4500000 },
      { name: 'Jagtap Wholesale - Generic Medicine Supply', amount: 8000000 },
      { name: 'Healthcare Chain - Retail Pharmacy Supply', amount: 6500000 },
      { name: 'Med Hub - OTC Products', amount: 2200000 },
      { name: 'Diagnostic Center - Reagents Annual', amount: 1800000 },
    ],
  },

  ngonpo: {
    pipelineName: 'Fundraising Pipeline',
    pipelineStages: [
      'Prospect',
      'Cultivation',
      'Solicitation',
      'Pledged',
      'Received',
      'Stewardship',
    ],
    contacts: [
      {
        firstName: 'Malati',
        lastName: 'Bhatt',
        email: 'malati.bhatt@donor.in',
        company: 'Bhatt Foundation',
        phone: '+91-9876543440',
      },
      {
        firstName: 'Narendra',
        lastName: 'Vyas',
        email: 'narendra.vyas@corp.in',
        company: 'CSR Partner Corp',
        phone: '+91-9876543441',
      },
      {
        firstName: 'Ojaswi',
        lastName: 'Kulkarni',
        email: 'ojaswi.kulkarni.ngo@gmail.com',
        company: null,
        phone: '+91-9876543442',
      },
      {
        firstName: 'Prabhavati',
        lastName: 'Shrikhande',
        email: 'prabhavati.s.ngo@gmail.com',
        company: null,
        phone: '+91-9876543443',
      },
      {
        firstName: 'Ramabai',
        lastName: 'Gajre',
        email: 'ramabai.gajre@trust.in',
        company: 'Gajre Charitable Trust',
        phone: '+91-9876543444',
      },
      {
        firstName: 'Savita',
        lastName: 'Bondre',
        email: 'savita.bondre@foundation.in',
        company: 'Bondre Foundation',
        phone: '+91-9876543445',
      },
      {
        firstName: 'Tarabai',
        lastName: 'Pawar',
        email: 'tarabai.pawar.ngo@gmail.com',
        company: null,
        phone: '+91-9876543446',
      },
      {
        firstName: 'Urmila',
        lastName: 'Mokashi',
        email: 'urmila.mokashi.ngo@gmail.com',
        company: null,
        phone: '+91-9876543447',
      },
    ],
    deals: [
      { name: 'Bhatt Foundation - Annual Grant', amount: 2500000 },
      { name: 'CSR Partner Corp - Employee Giving Program', amount: 1800000 },
      { name: 'Gajre Charitable Trust - Project Funding', amount: 3500000 },
      { name: 'Government Grant - MGNREGS Project', amount: 8000000 },
      { name: 'Individual Donors Campaign - Q4', amount: 850000 },
      { name: 'Bondre Foundation - Infrastructure Grant', amount: 5000000 },
    ],
  },

  events: {
    pipelineName: 'Event Pipeline',
    pipelineStages: ['Inquiry', 'Proposal', 'Contract', 'Planning', 'Executed', 'Invoice Sent'],
    contacts: [
      {
        firstName: 'Vijayalakshmi',
        lastName: 'Srinivasan',
        email: 'vijaya.s@corporate.in',
        company: 'MNC Corp',
        phone: '+91-9876543450',
      },
      {
        firstName: 'Wipro',
        lastName: 'Partner',
        email: 'events@wipro-partner.in',
        company: 'Tech Giant',
        phone: '+91-9876543451',
      },
      {
        firstName: 'Xavier',
        lastName: 'Britto',
        email: 'xavier.britto.events@gmail.com',
        company: null,
        phone: '+91-9876543452',
      },
      {
        firstName: 'Yashwant',
        lastName: 'Rane',
        email: 'yashwant.rane@college.in',
        company: 'Engineering College',
        phone: '+91-9876543453',
      },
      {
        firstName: 'Zarina',
        lastName: 'Hussain',
        email: 'zarina.hussain.events@gmail.com',
        company: null,
        phone: '+91-9876543454',
      },
      {
        firstName: 'Aishwarya',
        lastName: 'Deshpande',
        email: 'aishwarya.d@sports.in',
        company: 'Sports Foundation',
        phone: '+91-9876543455',
      },
      {
        firstName: 'Bharat',
        lastName: 'Kumar',
        email: 'bharat.kumar@exhibition.in',
        company: 'Exhibition Co',
        phone: '+91-9876543456',
      },
      {
        firstName: 'Chinmay',
        lastName: 'Gokhale',
        email: 'chinmay.gokhale@media.in',
        company: 'Media House',
        phone: '+91-9876543457',
      },
    ],
    deals: [
      { name: 'MNC Corp - Annual Day 2000 pax', amount: 4500000 },
      { name: 'Royal Wedding - 1000 guests Goa', amount: 8500000 },
      { name: 'Tech Conference 500 delegates', amount: 2800000 },
      { name: 'Sports Foundation - Marathon Event', amount: 1800000 },
      { name: 'Trade Exhibition - 3 days', amount: 3500000 },
      { name: 'College Cultural Fest', amount: 850000 },
    ],
  },

  government: {
    pipelineName: 'Tender Pipeline',
    pipelineStages: [
      'RFP Published',
      'Bid Submitted',
      'Technical Eval',
      'Commercial Eval',
      'L1 Awarded',
      'PO Issued',
    ],
    contacts: [
      {
        firstName: 'Dilip',
        lastName: 'Trivedi',
        email: 'dilip.trivedi@pmc.gov.in',
        company: 'PMC',
        phone: '+91-9876543460',
      },
      {
        firstName: 'Ela',
        lastName: 'Gandhi',
        email: 'ela.gandhi@maharashtra.gov.in',
        company: 'State PWD',
        phone: '+91-9876543461',
      },
      {
        firstName: 'Feroze',
        lastName: 'Khan',
        email: 'feroze.khan@railways.gov.in',
        company: 'Indian Railways',
        phone: '+91-9876543462',
      },
      {
        firstName: 'Girish',
        lastName: 'Bapat',
        email: 'girish.bapat@defence.gov.in',
        company: 'MoD',
        phone: '+91-9876543463',
      },
      {
        firstName: 'Hemalatha',
        lastName: 'Nair',
        email: 'hemalatha.n@msme.gov.in',
        company: 'MSME Ministry',
        phone: '+91-9876543464',
      },
      {
        firstName: 'Irfan',
        lastName: 'Patel',
        email: 'irfan.patel@nhai.gov.in',
        company: 'NHAI',
        phone: '+91-9876543465',
      },
      {
        firstName: 'Jayendra',
        lastName: 'Thakkar',
        email: 'jayendra.t@municipal.gov.in',
        company: 'Municipal Corp',
        phone: '+91-9876543466',
      },
      {
        firstName: 'Kishori',
        lastName: 'Lal',
        email: 'kishori.lal@education.gov.in',
        company: 'Education Dept',
        phone: '+91-9876543467',
      },
    ],
    deals: [
      { name: 'PMC - Smart City Software Tender', amount: 85000000 },
      { name: 'NHAI - Highway Monitoring System', amount: 150000000 },
      { name: 'Indian Railways - Passenger Management', amount: 250000000 },
      { name: 'MoD - IT Infrastructure Upgrade', amount: 500000000 },
      { name: 'Municipal Corp - Waste Management App', amount: 45000000 },
      { name: 'Education Dept - Online Learning Platform', amount: 35000000 },
    ],
  },

  other: {
    pipelineName: 'Sales Pipeline',
    pipelineStages: ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won'],
    contacts: [
      {
        firstName: 'Lakshmi',
        lastName: 'Narayan',
        email: 'lakshmi.narayan@business.in',
        company: 'Narayan Business',
        phone: '+91-9876543500',
      },
      {
        firstName: 'Madhav',
        lastName: 'Prasad',
        email: 'madhav.prasad@company.in',
        company: 'Prasad Co',
        phone: '+91-9876543501',
      },
      {
        firstName: 'Nandita',
        lastName: 'Roy',
        email: 'nandita.roy@enterprise.in',
        company: 'Roy Enterprise',
        phone: '+91-9876543502',
      },
      {
        firstName: 'Omveer',
        lastName: 'Singh',
        email: 'omveer.singh@business.in',
        company: 'Singh Business',
        phone: '+91-9876543503',
      },
      {
        firstName: 'Padma',
        lastName: 'Shri',
        email: 'padma.shri@services.in',
        company: 'Padma Services',
        phone: '+91-9876543504',
      },
      {
        firstName: 'Quentin',
        lastName: 'DMello',
        email: 'quentin.dmello@corp.in',
        company: 'Corp Solutions',
        phone: '+91-9876543505',
      },
      {
        firstName: 'Rajrani',
        lastName: 'Devi',
        email: 'rajrani.devi@business.in',
        company: null,
        phone: '+91-9876543506',
      },
      {
        firstName: 'Suman',
        lastName: 'Lata',
        email: 'suman.lata@firm.in',
        company: 'Lata Firm',
        phone: '+91-9876543507',
      },
    ],
    deals: [
      { name: 'Narayan Business - Growth Plan', amount: 120000 },
      { name: 'Prasad Co - Service Contract', amount: 85000 },
      { name: 'Roy Enterprise - Annual Package', amount: 240000 },
      { name: 'Singh Business - Starter Plan', amount: 48000 },
      { name: 'Corp Solutions - Enterprise License', amount: 500000 },
      { name: 'Lata Firm - Consulting Retainer', amount: 180000 },
    ],
  },
};

// ---------------------------------------------------------------------------
// Stage colours — cycle through a palette
// ---------------------------------------------------------------------------
const STAGE_COLORS = [
  '#3B82F6',
  '#8B5CF6',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#6B7280',
  '#EC4899',
  '#14B8A6',
];

// ---------------------------------------------------------------------------
// seedIndustryData
// ---------------------------------------------------------------------------
/**
 * Seeds industry-specific demo data for a tenant.
 *
 * @param {string} tenantId        - The tenant to seed data for.
 * @param {string} industryId      - One of the keys in INDUSTRY_SEED_DATA (e.g. 'saas').
 * @param {object} [prismaClient]  - Optional Prisma client override (for testing).
 * @returns {Promise<object>}      - Result object describing what was seeded.
 */
export async function seedIndustryData(tenantId, industryId, prismaClient) {
  const db = prismaClient || defaultPrisma;

  // Idempotency check — do not seed if contacts already exist for this tenant
  const existingCount = await db.contact.count({ where: { tenantId } });
  if (existingCount > 0) {
    return {
      seeded: false,
      reason: 'already_seeded',
      existingCount,
    };
  }

  const seedData = INDUSTRY_SEED_DATA[industryId] || INDUSTRY_SEED_DATA['other'];

  let createdPipeline = null;
  const stages = [];

  // 1. Create or reuse pipeline (upsert to avoid unique constraint on tenantId+name+type)
  try {
    const pipelineName = seedData.pipelineName || 'Main Pipeline';
    // Try to find existing pipeline with this name, or create a new one
    const existing = await db.pipeline.findFirst({
      where: { tenantId, type: 'DEAL', name: pipelineName },
    });
    if (existing) {
      createdPipeline = existing;
    } else {
      createdPipeline = await db.pipeline.create({
        data: {
          tenantId,
          name: pipelineName,
          isDefault: false,
          type: 'DEAL',
        },
      });
    }

    // 2. Create stages (delete old ones from this pipeline first to avoid conflicts)
    await db.stage.deleteMany({ where: { tenantId, pipelineId: createdPipeline.id } });
    for (let i = 0; i < seedData.pipelineStages.length; i++) {
      const stage = await db.stage.create({
        data: {
          tenantId,
          pipelineId: createdPipeline.id,
          name: seedData.pipelineStages[i],
          order: i + 1,
          color: STAGE_COLORS[i % STAGE_COLORS.length],
        },
      });
      stages.push(stage);
    }
  } catch (e) {
    console.warn('[seed-industry] Pipeline/stage creation skipped:', e.message);
  }

  // 3. Create contacts
  const contacts = [];
  for (const contactData of seedData.contacts) {
    try {
      const contact = await db.contact.create({
        data: {
          tenantId,
          firstName: contactData.firstName,
          lastName: contactData.lastName,
          email: contactData.email,
          phone: contactData.phone || null,
          // Note: 'company' on Contact is a relation field (Company model).
          // We store the company name in a separate field if available,
          // or skip company linking to keep seeding self-contained.
        },
      });
      contacts.push(contact);
    } catch (e) {
      // Skip contacts with duplicate emails or other constraint violations
      console.warn(`[seed-industry] Skipping contact ${contactData.email}:`, e.message);
    }
  }

  // 4. Create deals (requires a valid stageId and pipelineId)
  let dealsCreated = 0;
  if (stages.length > 0 && createdPipeline) {
    for (let i = 0; i < seedData.deals.length; i++) {
      const dealData = seedData.deals[i];
      const stage = stages[i % stages.length];
      try {
        await db.deal.create({
          data: {
            tenantId,
            name: dealData.name,
            amount: dealData.amount,
            pipelineId: createdPipeline.id,
            stageId: stage.id,
            contactId: contacts[i % contacts.length]?.id || null,
            currency: 'INR',
          },
        });
        dealsCreated++;
      } catch (e) {
        console.warn(`[seed-industry] Skipping deal "${dealData.name}":`, e.message);
      }
    }
  }

  return {
    seeded: true,
    industry: industryId,
    counts: {
      contacts: contacts.length,
      stages: stages.length,
      deals: dealsCreated,
      pipeline: createdPipeline ? 1 : 0,
    },
  };
}
