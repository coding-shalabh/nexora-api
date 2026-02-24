/**
 * Seed rich demo data for the main admin tenant (Nexora CRM Platform)
 * Tenant ID: cml6wep6v0000td0ndxo78efn
 * Run: node packages/database/prisma/seed-admin-tenant.js
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TENANT_ID = 'cml6wep6v0000td0ndxo78efn';
const WORKSPACE_ID = 'cml6wepe20004td0nr2gav9fg';
const ADMIN_USER_ID = 'cml6wepdw0002td0nimb62l6x';

const SALES_PIPELINE_ID = 'cmlqntobb0000dllvl1fusxy3';
const SUPPORT_PIPELINE_ID = 'cmlqmomh80000u18qy7r07f3f';
const SUPPORT_STAGE_NEW = 'cmlqmomh80001u18qsh60y5j0';
const SUPPORT_STAGE_OPEN = 'cmlqmomh80002u18qhshnak7h';
const SUPPORT_STAGE_RESOLVED = 'cmlqmomh80004u18qzthyidv5';
const SUPPORT_STAGE_CLOSED = 'cmlqmomh80005u18quzd8xyv1';
const STAGE_QUALIFICATION = 'cmlqntobb0001dllvgz5u5nyk';
const STAGE_DISCOVERY = 'cmlqntobb0002dllvzb1wr98i';
const STAGE_PROPOSAL = 'cmlqntobb0003dllvq5g5gngi';
const STAGE_NEGOTIATION = 'cmlqntobb0004dllvr1358yh6';
const STAGE_CLOSED_WON = 'cmlqntobb0005dllvldz40wfj';

const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const daysFromNow = (n) => new Date(Date.now() + n * 86400000);

async function main() {
  console.log('🌱 Seeding admin tenant data...\n');

  // Create extra users / team members
  const PASSWORD = await bcrypt.hash('Demo@2025', 10);
  const newUsers = [];

  const teamMembers = [
    { email: 'sales.rep@nexora.demo', firstName: 'Arjun', lastName: 'Sharma', role: 'Sales Rep' },
    {
      email: 'marketing@nexora.demo',
      firstName: 'Priya',
      lastName: 'Mehta',
      role: 'Marketing Manager',
    },
    { email: 'support@nexora.demo', firstName: 'Rahul', lastName: 'Verma', role: 'Support Agent' },
    { email: 'hr@nexora.demo', firstName: 'Sneha', lastName: 'Patel', role: 'HR Manager' },
    { email: 'sales2@nexora.demo', firstName: 'Vikram', lastName: 'Gupta', role: 'Sales Rep' },
  ];

  for (const m of teamMembers) {
    let user = await prisma.user.findFirst({ where: { tenantId: TENANT_ID, email: m.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          tenantId: TENANT_ID,
          email: m.email,
          firstName: m.firstName,
          lastName: m.lastName,
          passwordHash: PASSWORD,
          status: 'ACTIVE',
          emailVerified: true,
        },
      });
      await prisma.userWorkspace
        .create({
          data: { userId: user.id, workspaceId: WORKSPACE_ID, role: 'MEMBER' },
        })
        .catch(() => {});
    }
    newUsers.push(user);
  }
  console.log(`✅ Team members: ${newUsers.length} created`);

  // Companies
  const companyData = [
    {
      name: 'TechBridge Solutions',
      industry: 'Technology',
      domain: 'techbridge.in',
      employeeCount: 120,
      lifecycleStage: 'CUSTOMER',
    },
    {
      name: 'Fusion Retail Group',
      industry: 'Retail',
      domain: 'fusionretail.com',
      employeeCount: 450,
      lifecycleStage: 'CUSTOMER',
    },
    {
      name: 'MedX Healthcare',
      industry: 'Healthcare',
      domain: 'medxhealth.in',
      employeeCount: 80,
      lifecycleStage: 'QUALIFIED',
    },
    {
      name: 'BuildSmart Corp',
      industry: 'Construction',
      domain: 'buildsmart.co.in',
      employeeCount: 200,
      lifecycleStage: 'OPPORTUNITY',
    },
    {
      name: 'EduLearn Systems',
      industry: 'Education',
      domain: 'edulearn.org',
      employeeCount: 60,
      lifecycleStage: 'LEAD',
    },
    {
      name: 'Finova Capital',
      industry: 'Finance',
      domain: 'finovacap.com',
      employeeCount: 35,
      lifecycleStage: 'CUSTOMER',
    },
    {
      name: 'AutoVista Motors',
      industry: 'Automotive',
      domain: 'autovista.in',
      employeeCount: 300,
      lifecycleStage: 'QUALIFIED',
    },
    {
      name: 'GreenPath Logistics',
      industry: 'Logistics',
      domain: 'greenpath.co',
      employeeCount: 150,
      lifecycleStage: 'OPPORTUNITY',
    },
  ];

  const companies = [];
  for (const c of companyData) {
    let company = await prisma.company.findFirst({ where: { tenantId: TENANT_ID, name: c.name } });
    if (!company) {
      company = await prisma.company.create({
        data: {
          tenantId: TENANT_ID,
          name: c.name,
          industry: c.industry,
          domain: c.domain,
          employeeCount: String(c.employeeCount),
          lifecycleStage: c.lifecycleStage,
          ownerId: ADMIN_USER_ID,
        },
      });
    }
    companies.push(company);
  }
  console.log(`✅ Companies: ${companies.length} created/found`);

  // Contacts - rich data across lifecycle stages
  const contactData = [
    {
      firstName: 'Aditya',
      lastName: 'Kumar',
      email: 'aditya.kumar@techbridge.in',
      phone: '+91 98765 43210',
      lifecycleStage: 'CUSTOMER',
      leadScore: 85,
      rating: 'HOT',
      jobTitle: 'CTO',
    },
    {
      firstName: 'Meera',
      lastName: 'Singh',
      email: 'meera.singh@fusionretail.com',
      phone: '+91 87654 32109',
      lifecycleStage: 'CUSTOMER',
      leadScore: 72,
      rating: 'WARM',
      jobTitle: 'Head of Operations',
    },
    {
      firstName: 'Rohan',
      lastName: 'Joshi',
      email: 'rohan@medxhealth.in',
      phone: '+91 76543 21098',
      lifecycleStage: 'SQL',
      leadScore: 65,
      rating: 'HOT',
      jobTitle: 'Director',
    },
    {
      firstName: 'Ananya',
      lastName: 'Reddy',
      email: 'ananya@buildsmart.co.in',
      phone: '+91 65432 10987',
      lifecycleStage: 'OPPORTUNITY',
      leadScore: 58,
      rating: 'WARM',
      jobTitle: 'Procurement Manager',
    },
    {
      firstName: 'Karan',
      lastName: 'Malhotra',
      email: 'karan.m@edulearn.org',
      phone: '+91 54321 09876',
      lifecycleStage: 'LEAD',
      leadScore: 42,
      rating: 'COLD',
      jobTitle: 'COO',
    },
    {
      firstName: 'Divya',
      lastName: 'Iyer',
      email: 'divya@finovacap.com',
      phone: '+91 94321 56789',
      lifecycleStage: 'CUSTOMER',
      leadScore: 91,
      rating: 'HOT',
      jobTitle: 'CFO',
    },
    {
      firstName: 'Sanjay',
      lastName: 'Nair',
      email: 'sanjay@autovista.in',
      phone: '+91 83210 65432',
      lifecycleStage: 'MQL',
      leadScore: 55,
      rating: 'WARM',
      jobTitle: 'VP Sales',
    },
    {
      firstName: 'Priti',
      lastName: 'Desai',
      email: 'priti@greenpath.co',
      phone: '+91 72109 54321',
      lifecycleStage: 'OPPORTUNITY',
      leadScore: 48,
      rating: 'WARM',
      jobTitle: 'Operations Head',
    },
    {
      firstName: 'Amit',
      lastName: 'Chauhan',
      email: 'amit.chauhan@startup.io',
      phone: '+91 91234 56780',
      lifecycleStage: 'LEAD',
      leadScore: 30,
      rating: 'COLD',
      jobTitle: 'Founder',
    },
    {
      firstName: 'Nisha',
      lastName: 'Kapoor',
      email: 'nisha.k@enterprise.com',
      phone: '+91 80123 45678',
      lifecycleStage: 'SUBSCRIBER',
      leadScore: 20,
      rating: 'COLD',
      jobTitle: 'Manager',
    },
    {
      firstName: 'Rajesh',
      lastName: 'Pillai',
      email: 'rajesh.p@techcorp.com',
      phone: '+91 79012 34567',
      lifecycleStage: 'SQL',
      leadScore: 70,
      rating: 'HOT',
      jobTitle: 'IT Manager',
    },
    {
      firstName: 'Kavitha',
      lastName: 'Balan',
      email: 'kavitha@healthcare.org',
      phone: '+91 68901 23456',
      lifecycleStage: 'OPPORTUNITY',
      leadScore: 60,
      rating: 'WARM',
      jobTitle: 'Director Operations',
    },
  ];

  const contacts = [];
  for (let i = 0; i < contactData.length; i++) {
    const cd = contactData[i];
    let contact = await prisma.contact.findFirst({
      where: { tenantId: TENANT_ID, email: cd.email },
    });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId: TENANT_ID,
          firstName: cd.firstName,
          lastName: cd.lastName,
          email: cd.email,
          phone: cd.phone,
          companyId: companies[i % companies.length]?.id,
          ownerId: ADMIN_USER_ID,
          lifecycleStage: cd.lifecycleStage,
          leadScore: cd.leadScore,
          rating: cd.rating,
          jobTitle: cd.jobTitle,
        },
      });
    }
    contacts.push(contact);
  }
  console.log(`✅ Contacts: ${contacts.length} created/found`);

  // Deals
  const dealData = [
    {
      name: 'TechBridge - Annual SaaS License',
      amount: 480000,
      stageId: STAGE_CLOSED_WON,
      contactIdx: 0,
      companyIdx: 0,
      probability: 100,
    },
    {
      name: 'MedX - CRM Implementation',
      amount: 180000,
      stageId: STAGE_PROPOSAL,
      contactIdx: 2,
      companyIdx: 2,
      probability: 60,
    },
    {
      name: 'BuildSmart - Field Sales Module',
      amount: 95000,
      stageId: STAGE_NEGOTIATION,
      contactIdx: 3,
      companyIdx: 3,
      probability: 75,
    },
    {
      name: 'EduLearn - Starter Plan',
      amount: 36000,
      stageId: STAGE_QUALIFICATION,
      contactIdx: 4,
      companyIdx: 4,
      probability: 25,
    },
    {
      name: 'Finova Capital - Growth Plan Renewal',
      amount: 240000,
      stageId: STAGE_CLOSED_WON,
      contactIdx: 5,
      companyIdx: 5,
      probability: 100,
    },
    {
      name: 'AutoVista - Multi-Branch Deployment',
      amount: 320000,
      stageId: STAGE_DISCOVERY,
      contactIdx: 6,
      companyIdx: 6,
      probability: 40,
    },
    {
      name: 'GreenPath - Logistics CRM',
      amount: 72000,
      stageId: STAGE_PROPOSAL,
      contactIdx: 7,
      companyIdx: 7,
      probability: 55,
    },
    {
      name: 'Fusion Retail - Analytics Add-on',
      amount: 60000,
      stageId: STAGE_NEGOTIATION,
      contactIdx: 1,
      companyIdx: 1,
      probability: 80,
    },
    {
      name: 'Rajesh Corp - IT Suite',
      amount: 45000,
      stageId: STAGE_QUALIFICATION,
      contactIdx: 10,
      companyIdx: 0,
      probability: 20,
    },
    {
      name: 'Enterprise Deal - Healthcare',
      amount: 150000,
      stageId: STAGE_DISCOVERY,
      contactIdx: 11,
      companyIdx: 2,
      probability: 45,
    },
  ];

  const deals = [];
  for (const d of dealData) {
    let deal = await prisma.deal.findFirst({ where: { tenantId: TENANT_ID, name: d.name } });
    if (!deal) {
      deal = await prisma.deal.create({
        data: {
          tenantId: TENANT_ID,
          name: d.name,
          amount: d.amount,
          currency: 'INR',
          pipelineId: SALES_PIPELINE_ID,
          stageId: d.stageId,
          contactId: contacts[d.contactIdx]?.id,
          companyId: companies[d.companyIdx]?.id,
          ownerId: ADMIN_USER_ID,
          expectedCloseDate: daysFromNow(30),
          ...(d.probability === 100
            ? { closedAt: daysAgo(15), wonReason: 'Best value proposition' }
            : {}),
        },
      });
    }
    deals.push(deal);
  }
  console.log(`✅ Deals: ${deals.length} created/found`);

  // Calendar Events
  const eventData = [
    {
      title: 'Q1 Sales Review Meeting',
      type: 'MEETING',
      startDate: daysFromNow(2),
      endDate: daysFromNow(2),
    },
    {
      title: 'TechBridge Demo Call',
      type: 'CALL',
      startDate: daysFromNow(3),
      endDate: daysFromNow(3),
    },
    {
      title: 'Team Sprint Planning',
      type: 'MEETING',
      startDate: daysFromNow(1),
      endDate: daysFromNow(1),
    },
    {
      title: 'AutoVista Discovery Session',
      type: 'MEETING',
      startDate: daysFromNow(5),
      endDate: daysFromNow(5),
    },
    {
      title: 'Marketing Campaign Review',
      type: 'MEETING',
      startDate: daysFromNow(7),
      endDate: daysFromNow(7),
    },
    {
      title: 'MedX Proposal Presentation',
      type: 'MEETING',
      startDate: daysFromNow(10),
      endDate: daysFromNow(10),
    },
    { title: 'HR All Hands', type: 'MEETING', startDate: daysFromNow(4), endDate: daysFromNow(4) },
    {
      title: 'GreenPath Contract Review',
      type: 'CALL',
      startDate: daysAgo(2),
      endDate: daysAgo(2),
    },
    {
      title: 'Product Roadmap Session',
      type: 'MEETING',
      startDate: daysAgo(5),
      endDate: daysAgo(5),
    },
    {
      title: 'Monthly Analytics Review',
      type: 'MEETING',
      startDate: daysFromNow(14),
      endDate: daysFromNow(14),
    },
  ];

  let calEventsCreated = 0;
  for (const e of eventData) {
    const start = new Date(e.startDate);
    start.setHours(10, 0, 0, 0);
    const end = new Date(e.endDate);
    end.setHours(11, 0, 0, 0);
    try {
      await prisma.calendarEvent.create({
        data: {
          tenantId: TENANT_ID,
          title: e.title,
          type: e.type,
          startTime: start,
          endTime: end,
          organizerId: ADMIN_USER_ID,
          status: 'SCHEDULED',
        },
      });
      calEventsCreated++;
    } catch (err) {
      console.log('  Calendar event error:', err.message.split('\n')[0]);
    }
  }
  console.log(`✅ Calendar Events: ${calEventsCreated} created`);

  // Projects + Tasks
  const projectData = [
    {
      name: 'CRM Platform v2 Launch',
      status: 'IN_PROGRESS',
      budget: 500000,
      tasks: [
        { title: 'Design new dashboard UI', status: 'COMPLETED', priority: 'HIGH' },
        { title: 'Implement API v2 endpoints', status: 'IN_PROGRESS', priority: 'HIGH' },
        { title: 'Write migration scripts', status: 'IN_PROGRESS', priority: 'MEDIUM' },
        { title: 'Conduct beta testing', status: 'TODO', priority: 'HIGH' },
        { title: 'Deploy to production', status: 'TODO', priority: 'HIGH' },
        { title: 'Update documentation', status: 'TODO', priority: 'LOW' },
      ],
    },
    {
      name: 'Q1 Marketing Campaign',
      status: 'IN_PROGRESS',
      budget: 120000,
      tasks: [
        { title: 'Create campaign brief', status: 'COMPLETED', priority: 'HIGH' },
        { title: 'Design creative assets', status: 'COMPLETED', priority: 'MEDIUM' },
        { title: 'Setup email sequences', status: 'IN_PROGRESS', priority: 'HIGH' },
        { title: 'Launch social media ads', status: 'TODO', priority: 'MEDIUM' },
        { title: 'Track & report KPIs', status: 'TODO', priority: 'LOW' },
      ],
    },
    {
      name: 'Customer Onboarding Improvement',
      status: 'PLANNING',
      budget: 80000,
      tasks: [
        { title: 'Audit current onboarding flow', status: 'IN_PROGRESS', priority: 'HIGH' },
        { title: 'Design onboarding checklist', status: 'TODO', priority: 'MEDIUM' },
        { title: 'Build welcome email series', status: 'TODO', priority: 'MEDIUM' },
        { title: 'Create video tutorials', status: 'TODO', priority: 'LOW' },
      ],
    },
    {
      name: 'Data Migration & Cleanup',
      status: 'IN_PROGRESS',
      budget: 60000,
      tasks: [
        { title: 'Export legacy data', status: 'COMPLETED', priority: 'HIGH' },
        { title: 'Clean duplicate contacts', status: 'IN_PROGRESS', priority: 'HIGH' },
        { title: 'Validate migrated records', status: 'TODO', priority: 'MEDIUM' },
        { title: 'Archive old records', status: 'TODO', priority: 'LOW' },
      ],
    },
  ];

  let tasksCreated = 0;
  for (const p of projectData) {
    let project = await prisma.project.findFirst({ where: { tenantId: TENANT_ID, name: p.name } });
    if (!project) {
      project = await prisma.project.create({
        data: {
          tenantId: TENANT_ID,
          name: p.name,
          status: p.status,
          budget: p.budget,
          startDate: daysAgo(30),
          endDate: daysFromNow(60),
          ownerId: ADMIN_USER_ID,
        },
      });
    }

    for (const t of p.tasks) {
      const existing = await prisma.task.findFirst({
        where: { tenantId: TENANT_ID, title: t.title, projectId: project.id },
      });
      if (!existing) {
        await prisma.task.create({
          data: {
            tenantId: TENANT_ID,
            title: t.title,
            status: t.status,
            priority: t.priority,
            projectId: project.id,
            assigneeId: ADMIN_USER_ID,
            createdById: ADMIN_USER_ID,
            dueDate: daysFromNow(Math.floor(Math.random() * 30) + 1),
          },
        });
        tasksCreated++;
      }
    }
  }
  console.log(`✅ Projects: ${projectData.length} ensured | Tasks: ${tasksCreated} created`);

  // Activities (calls, emails, meetings on contacts/deals)
  const activityTypes = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK'];
  let activitiesCreated = 0;
  for (let i = 0; i < 20; i++) {
    const contact = contacts[i % contacts.length];
    const type = activityTypes[i % activityTypes.length];
    try {
      await prisma.activity.create({
        data: {
          tenantId: TENANT_ID,
          type,
          title: `${type} with ${contact.firstName} ${contact.lastName}`,
          description: `Follow-up ${type.toLowerCase()} regarding product demo and pricing discussion`,
          contactId: contact.id,
          ownerId: ADMIN_USER_ID,
          scheduledAt: daysAgo(i % 10),
          completedAt: i % 3 !== 0 ? daysAgo(i % 10) : null,
          status: i % 3 !== 0 ? 'COMPLETED' : 'PLANNED',
        },
      });
      activitiesCreated++;
    } catch {}
  }
  console.log(`✅ Activities: ${activitiesCreated} created`);

  // HR Employees
  const employeeData = [
    {
      firstName: 'Arjun',
      lastName: 'Sharma',
      email: 'arjun.sharma@nexora.in',
      department: 'Sales',
      role: 'Senior Sales Executive',
      salary: 75000,
      managerId: null,
    },
    {
      firstName: 'Priya',
      lastName: 'Mehta',
      email: 'priya.mehta@nexora.in',
      department: 'Marketing',
      role: 'Marketing Manager',
      salary: 85000,
      managerId: null,
    },
    {
      firstName: 'Rahul',
      lastName: 'Verma',
      email: 'rahul.verma@nexora.in',
      department: 'Support',
      role: 'Support Lead',
      salary: 60000,
      managerId: null,
    },
    {
      firstName: 'Sneha',
      lastName: 'Patel',
      email: 'sneha.patel@nexora.in',
      department: 'HR',
      role: 'HR Manager',
      salary: 70000,
      managerId: null,
    },
    {
      firstName: 'Vikram',
      lastName: 'Gupta',
      email: 'vikram.gupta@nexora.in',
      department: 'Sales',
      role: 'Sales Executive',
      salary: 55000,
      managerId: null,
    },
    {
      firstName: 'Ritu',
      lastName: 'Bose',
      email: 'ritu.bose@nexora.in',
      department: 'Engineering',
      role: 'Backend Developer',
      salary: 90000,
      managerId: null,
    },
    {
      firstName: 'Nikhil',
      lastName: 'Jain',
      email: 'nikhil.jain@nexora.in',
      department: 'Engineering',
      role: 'Frontend Developer',
      salary: 85000,
      managerId: null,
    },
    {
      firstName: 'Pooja',
      lastName: 'Rao',
      email: 'pooja.rao@nexora.in',
      department: 'Finance',
      role: 'Finance Analyst',
      salary: 65000,
      managerId: null,
    },
  ];

  let employeesCreated = 0;
  for (let i = 0; i < employeeData.length; i++) {
    const e = employeeData[i];
    const existing = await prisma.employee.findFirst({
      where: { tenantId: TENANT_ID, email: e.email },
    });
    if (!existing) {
      const emp = await prisma.employee.create({
        data: {
          tenantId: TENANT_ID,
          employeeId: `EMP${String(i + 2).padStart(3, '0')}`,
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
          department: e.department,
          role: e.role,
          salary: e.salary,
          status: 'ACTIVE',
          joinDate: daysAgo(90 + i * 30),
        },
      });

      // Leave balance
      const currentYear = new Date().getFullYear();
      await prisma.leaveBalance
        .create({
          data: {
            tenantId: TENANT_ID,
            employeeId: emp.id,
            year: currentYear,
            annual: 20,
            sick: 10,
            personal: 5,
            usedAnnual: Math.floor(Math.random() * 8),
            usedSick: Math.floor(Math.random() * 3),
            usedPersonal: Math.floor(Math.random() * 2),
          },
        })
        .catch(() => {});

      employeesCreated++;
    }
  }
  console.log(`✅ Employees: ${employeesCreated} created`);

  // Tickets
  const ticketData = [
    { subject: 'Unable to import CSV contacts', priority: 'HIGH', status: 'OPEN' },
    { subject: 'Dashboard analytics not loading', priority: 'MEDIUM', status: 'IN_PROGRESS' },
    { subject: 'Email integration setup issue', priority: 'HIGH', status: 'OPEN' },
    { subject: 'WhatsApp messages not syncing', priority: 'MEDIUM', status: 'RESOLVED' },
    { subject: 'Pipeline stages reorder bug', priority: 'LOW', status: 'CLOSED' },
    { subject: 'Bulk email sending failure', priority: 'HIGH', status: 'IN_PROGRESS' },
    { subject: 'Calendar events not showing', priority: 'MEDIUM', status: 'OPEN' },
    { subject: 'Invoice PDF generation error', priority: 'MEDIUM', status: 'RESOLVED' },
  ];

  let ticketsCreated = 0;
  for (const t of ticketData) {
    const existing = await prisma.ticket.findFirst({
      where: { tenantId: TENANT_ID, subject: t.subject },
    });
    if (!existing) {
      try {
        await prisma.ticket.create({
          data: {
            tenantId: TENANT_ID,
            subject: t.subject,
            priority: t.priority,
            status: t.status,
            contactId: contacts[ticketsCreated % contacts.length]?.id,
            assigneeId: ADMIN_USER_ID,
            createdById: ADMIN_USER_ID,
            source: 'EMAIL',
            pipelines: { connect: { id: SUPPORT_PIPELINE_ID } },
          },
        });
      } catch {
        await prisma.ticket
          .create({
            data: {
              tenantId: TENANT_ID,
              subject: t.subject,
              priority: t.priority,
              status: t.status,
              contactId: contacts[ticketsCreated % contacts.length]?.id,
              assigneeId: ADMIN_USER_ID,
              createdById: ADMIN_USER_ID,
              source: 'EMAIL',
            },
          })
          .catch(() => {});
      }
      ticketsCreated++;
    }
  }
  console.log(`✅ Tickets: ${ticketsCreated} created`);

  // Notes on contacts
  const noteTexts = [
    'Very interested in enterprise plan. Follow up next week with pricing.',
    'Had a great demo call. They want to start a pilot.',
    'Decision maker is the CTO. CFO approval needed for >5L.',
    'Competitor is Salesforce but they find it too expensive.',
    'Requested custom integration with their ERP system.',
    'Wants to migrate 50k+ contacts from their old system.',
  ];

  let notesCreated = 0;
  for (let i = 0; i < Math.min(noteTexts.length, contacts.length); i++) {
    try {
      await prisma.note.create({
        data: {
          tenantId: TENANT_ID,
          content: noteTexts[i],
          contactId: contacts[i].id,
          createdById: ADMIN_USER_ID,
        },
      });
      notesCreated++;
    } catch {}
  }
  console.log(`✅ Notes: ${notesCreated} created`);

  console.log('\n✨ Admin tenant seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
