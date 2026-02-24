/**
 * Conversation Seeder for Postman Mock Provider
 * Creates 30 conversations + 250+ messages in PostgreSQL using real Prisma models
 *
 * Usage: node nexora-api/packages/database/prisma/seed-conversations.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ==========================================
// Helpers
// ==========================================

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

function minutesAgo(m) {
  return new Date(Date.now() - m * 60 * 1000);
}

function daysAgo(d) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000);
}

let msgCounter = 0;
function nextMsgId() {
  return `mock-msg-${String(++msgCounter).padStart(4, '0')}`;
}

// ==========================================
// Contact Data (Indian SMB personas)
// ==========================================

const contacts = [
  {
    firstName: 'Priya',
    lastName: 'Sharma',
    phone: '+919876543201',
    email: 'priya.sharma@techcorp.in',
  },
  {
    firstName: 'Rajesh',
    lastName: 'Kumar',
    phone: '+919876543202',
    email: 'rajesh.kumar@startup.co',
  },
  {
    firstName: 'Anita',
    lastName: 'Desai',
    phone: '+919876543203',
    email: 'anita.desai@retailchain.com',
  },
  {
    firstName: 'Vikram',
    lastName: 'Singh',
    phone: '+919876543204',
    email: 'vikram.singh@manufacturing.in',
  },
  {
    firstName: 'Meera',
    lastName: 'Patel',
    phone: '+919876543205',
    email: 'meera.patel@agency.co.in',
  },
  {
    firstName: 'Arjun',
    lastName: 'Reddy',
    phone: '+919876543206',
    email: 'arjun.reddy@healthtech.in',
  },
  { firstName: 'Neha', lastName: 'Gupta', phone: '+919876543207', email: 'neha.gupta@edtech.co' },
  {
    firstName: 'Suresh',
    lastName: 'Iyer',
    phone: '+919876543208',
    email: 'suresh.iyer@finserv.com',
  },
  {
    firstName: 'Kavitha',
    lastName: 'Nair',
    phone: '+919876543209',
    email: 'kavitha.nair@logistics.in',
  },
  {
    firstName: 'Deepak',
    lastName: 'Joshi',
    phone: '+919876543210',
    email: 'deepak.joshi@realestate.co.in',
  },
  {
    firstName: 'Pooja',
    lastName: 'Agarwal',
    phone: '+919876543211',
    email: 'pooja.agarwal@fashion.in',
  },
  { firstName: 'Amit', lastName: 'Verma', phone: '+919876543212', email: 'amit.verma@auto.co.in' },
  { firstName: 'Rohit', lastName: 'Mehta', phone: '+919876543213', email: 'rohit.mehta@media.in' },
  {
    firstName: 'Sanjay',
    lastName: 'Shah',
    phone: '+919876543214',
    email: 'sanjay.shah@pharma.co.in',
  },
  {
    firstName: 'Divya',
    lastName: 'Pillai',
    phone: '+919876543215',
    email: 'divya.pillai@hotel.in',
  },
  { firstName: 'Kiran', lastName: 'Bhat', phone: '+919876543216', email: 'kiran.bhat@food.co.in' },
  {
    firstName: 'Lakshmi',
    lastName: 'Rao',
    phone: '+919876543217',
    email: 'lakshmi.rao@jewelry.in',
  },
  {
    firstName: 'Manoj',
    lastName: 'Tiwari',
    phone: '+919876543218',
    email: 'manoj.tiwari@travel.co.in',
  },
  { firstName: 'Rekha', lastName: 'Das', phone: '+919876543219', email: 'rekha.das@beauty.in' },
  {
    firstName: 'Anil',
    lastName: 'Kapoor',
    phone: '+919876543220',
    email: 'anil.kapoor@sports.co.in',
  },
  {
    firstName: 'Rahul',
    lastName: 'Malhotra',
    phone: '+919876543221',
    email: 'rahul.m@techcorp.in',
  },
  { firstName: 'Sneha', lastName: 'Banerjee', phone: '+919876543222', email: 'priya.s@startup.co' },
  {
    firstName: 'Vivek',
    lastName: 'Choudhury',
    phone: '+919876543223',
    email: 'cfo@manufacturing.in',
  },
  { firstName: 'Ritu', lastName: 'Saxena', phone: '+919876543224', email: 'hr@retailchain.com' },
  {
    firstName: 'Gaurav',
    lastName: 'Mishra',
    phone: '+919876543225',
    email: 'support@clientfirm.in',
  },
  { firstName: 'Shruti', lastName: 'Pandey', phone: '+919876543226', email: 'admin@hospital.org' },
];

// ==========================================
// WhatsApp Conversations (12)
// ==========================================

const whatsappConversations = [
  {
    contactIdx: 0,
    status: 'RESOLVED',
    purpose: 'SALES',
    priority: 'HIGH',
    messages: [
      {
        dir: 'INBOUND',
        text: 'Hi, I saw your ad for CRM software. Can you tell me more?',
        ago: 168,
      },
      {
        dir: 'OUTBOUND',
        text: 'Hello Priya! Welcome to Nexora. We offer a complete CRM with WhatsApp integration, pipeline management, and analytics. What industry are you in?',
        ago: 167,
      },
      {
        dir: 'INBOUND',
        text: 'I run a tech consulting firm with 25 employees. We need something to manage client relationships better.',
        ago: 166,
      },
      {
        dir: 'OUTBOUND',
        text: 'Perfect! Our Pro plan at ₹999/user/month would be ideal. It includes unlimited contacts, WhatsApp automation, and custom reports.',
        ago: 165,
      },
      {
        dir: 'INBOUND',
        text: 'That sounds good. What about GST invoicing? We need proper tax compliance.',
        ago: 140,
      },
      {
        dir: 'OUTBOUND',
        text: 'Yes! We have full GST integration — GSTIN validation, e-invoicing, and automatic HSN code mapping. Very popular with Indian businesses.',
        ago: 139,
      },
      { dir: 'INBOUND', text: 'Great. Can we do a demo?', ago: 138 },
      {
        dir: 'OUTBOUND',
        text: "Absolutely! I've scheduled a demo for Thursday 2 PM IST. You'll get a calendar invite shortly. 📅",
        ago: 137,
      },
      {
        dir: 'INBOUND',
        text: 'Received the invite. One more thing — do you support Tally integration?',
        ago: 120,
      },
      {
        dir: 'OUTBOUND',
        text: 'Yes, we have native Tally ERP 9 and TallyPrime integration. Contacts, invoices, and payment data sync automatically.',
        ago: 119,
      },
      {
        dir: 'INBOUND',
        text: "That's exactly what we need. Can you share the pricing doc?",
        ago: 96,
      },
      {
        dir: 'OUTBOUND',
        text: 'Sending now! For 25 users on Pro, we can offer 10% volume discount — ₹899/user/month.',
        ago: 95,
      },
      { dir: 'INBOUND', text: 'Ok thanks 👍 Will review and get back after the demo', ago: 94 },
      {
        dir: 'OUTBOUND',
        text: 'Sounds great, Priya! Looking forward to the demo. Feel free to WhatsApp anytime if you have questions.',
        ago: 93,
      },
    ],
  },
  {
    contactIdx: 1,
    status: 'OPEN',
    purpose: 'SUPPORT',
    priority: 'URGENT',
    messages: [
      {
        dir: 'INBOUND',
        text: "I've been charged twice for my subscription! ₹9,990 debited two times from my account.",
        ago: 48,
      },
      {
        dir: 'OUTBOUND',
        text: "I'm really sorry about that, Rajesh. Let me check your billing immediately.",
        ago: 47,
      },
      {
        dir: 'OUTBOUND',
        text: "I can see the duplicate charge. I've initiated a refund of ₹9,990 to your account. It should reflect in 3-5 business days.",
        ago: 46,
      },
      {
        dir: 'INBOUND',
        text: 'This is the second time this has happened. Very frustrating.',
        ago: 45,
      },
      {
        dir: 'OUTBOUND',
        text: "I completely understand your frustration. I've flagged this with our billing team to prevent it from happening again. As compensation, I'm adding 1 month free to your subscription.",
        ago: 44,
      },
      { dir: 'INBOUND', text: "Ok. Please make sure this doesn't happen again.", ago: 43 },
      {
        dir: 'OUTBOUND',
        text: "Absolutely. I've personally set up monitoring on your account. You'll receive a confirmation email with the refund details and the free month credit.",
        ago: 42,
      },
      { dir: 'INBOUND', text: 'Fine. Thanks for handling it quickly at least.', ago: 41 },
    ],
  },
  {
    contactIdx: 2,
    status: 'RESOLVED',
    purpose: 'SERVICE',
    priority: 'MEDIUM',
    messages: [
      {
        dir: 'OUTBOUND',
        text: 'Hi Anita! Following up on your interest in our retail CRM package. Would you like to schedule a demo?',
        ago: 192,
      },
      {
        dir: 'INBOUND',
        text: 'Yes please! We have 4 stores and need something to manage inventory + customer data.',
        ago: 190,
      },
      {
        dir: 'OUTBOUND',
        text: 'Our Commerce hub is perfect for multi-store retail. Includes inventory tracking, customer segments, and WhatsApp order updates.',
        ago: 189,
      },
      { dir: 'INBOUND', text: 'How about POS integration?', ago: 180 },
      {
        dir: 'OUTBOUND',
        text: 'We integrate with most Indian POS systems. For retail, Pine Labs and Mswipe are fully supported.',
        ago: 179,
      },
      { dir: 'INBOUND', text: "We use Pine Labs. That's great!", ago: 178 },
      {
        dir: 'OUTBOUND',
        text: "Demo scheduled for Monday 11 AM. I'll show you the full retail workflow including loyalty points.",
        ago: 170,
      },
      {
        dir: 'INBOUND',
        text: 'Perfect, Monday works. Will my store managers also be able to join?',
        ago: 169,
      },
      {
        dir: 'OUTBOUND',
        text: "Of course! I've sent the invite with a guest link. Up to 5 people can join.",
        ago: 168,
      },
      { dir: 'INBOUND', text: 'Received. Looking forward to it!', ago: 167 },
      { dir: 'OUTBOUND', text: 'Great! See you Monday, Anita. 😊', ago: 166 },
    ],
  },
  {
    contactIdx: 3,
    status: 'OPEN',
    purpose: 'SUPPORT',
    priority: 'MEDIUM',
    messages: [
      {
        dir: 'INBOUND',
        text: 'Where is my order? I placed it 5 days ago. Order #ORD-2024-7890',
        ago: 72,
      },
      { dir: 'OUTBOUND', text: 'Let me check that for you, Vikram.', ago: 71 },
      {
        dir: 'OUTBOUND',
        text: 'Your order is currently with the courier (Delhivery). Tracking: DL2024789012. Expected delivery: Tomorrow by 6 PM.',
        ago: 70,
      },
      { dir: 'INBOUND', text: 'Its already delayed by 2 days. Can you expedite?', ago: 69 },
      {
        dir: 'OUTBOUND',
        text: "I've contacted the courier for priority delivery. You'll receive an SMS update once it's out for delivery. Apologies for the delay!",
        ago: 68,
      },
      { dir: 'INBOUND', text: 'Ok please update me', ago: 67 },
    ],
  },
  {
    contactIdx: 4,
    status: 'PENDING',
    purpose: 'SUPPORT',
    priority: 'LOW',
    messages: [
      {
        dir: 'INBOUND',
        text: 'Hi, I need help getting my WhatsApp template approved. It keeps getting rejected.',
        ago: 96,
      },
      {
        dir: 'OUTBOUND',
        text: 'Hi Meera! What template are you trying to get approved? Can you share the content?',
        ago: 95,
      },
      {
        dir: 'INBOUND',
        text: 'It\'s a promotional message: "Get 50% OFF on all services! Limited time offer. Click to buy now!"',
        ago: 94,
      },
      {
        dir: 'OUTBOUND',
        text: 'I see the issue — Meta rejects templates with ALL CAPS in promotional content and "Click to buy" is flagged. Let me help you rewrite it.',
        ago: 93,
      },
      {
        dir: 'OUTBOUND',
        text: 'Try this: "Hi {{1}}, we have a special offer for you — 50% off on all services this week. Reply YES to learn more or visit our website."',
        ago: 92,
      },
      {
        dir: 'INBOUND',
        text: 'That makes sense. Will try this. Do I need to re-register with DLT too?',
        ago: 91,
      },
      {
        dir: 'OUTBOUND',
        text: 'No, DLT registration is only for SMS. WhatsApp templates are approved directly by Meta. Just submit the new version through our template builder.',
        ago: 90,
      },
      { dir: 'INBOUND', text: 'Got it. Submitting now.', ago: 72 },
      { dir: 'INBOUND', text: 'Its still showing pending. How long does approval take?', ago: 24 },
    ],
  },
  {
    contactIdx: 5,
    status: 'RESOLVED',
    purpose: 'SUPPORT',
    priority: 'HIGH',
    messages: [
      {
        dir: 'INBOUND',
        text: 'The dashboard is not loading. Just showing a blank white screen.',
        ago: 36,
      },
      {
        dir: 'OUTBOUND',
        text: "I'm sorry about that, Arjun. Can you try clearing your browser cache and refreshing? (Ctrl+Shift+R)",
        ago: 35,
      },
      { dir: 'INBOUND', text: 'Tried. Still blank.', ago: 34 },
      { dir: 'OUTBOUND', text: 'What browser and version are you using?', ago: 33 },
      { dir: 'INBOUND', text: 'Firefox 102. My company mandates this version.', ago: 32 },
      {
        dir: 'OUTBOUND',
        text: "That's the issue — we require Firefox 110+ for our latest dashboard. The older version has a CSS Grid compatibility issue.",
        ago: 31,
      },
      { dir: 'INBOUND', text: 'I cant upgrade. Is there a workaround?', ago: 30 },
      {
        dir: 'OUTBOUND',
        text: "I've enabled our legacy rendering mode for your account. Can you try again now?",
        ago: 29,
      },
      { dir: 'INBOUND', text: "Yes! It's loading now. Thank you!", ago: 28 },
      {
        dir: 'OUTBOUND',
        text: 'Great! The legacy mode will stay active for your account. If you need anything else, just message us.',
        ago: 27,
      },
      { dir: 'INBOUND', text: 'Will do. Thanks for the quick resolution.', ago: 26 },
      { dir: 'OUTBOUND', text: 'Happy to help, Arjun! Have a great day. 🙏', ago: 25 },
      {
        dir: 'INBOUND',
        text: 'One more thing — can you also check why the analytics page loads slowly?',
        ago: 12,
      },
      {
        dir: 'OUTBOUND',
        text: "I've optimized the analytics queries for your account. Should be much faster now. Try refreshing the page.",
        ago: 11,
      },
      { dir: 'INBOUND', text: 'Much better. Thanks!', ago: 10 },
    ],
  },
  {
    contactIdx: 6,
    status: 'OPEN',
    purpose: 'SALES',
    priority: 'MEDIUM',
    messages: [
      {
        dir: 'INBOUND',
        text: 'Interested in your CRM for our EdTech startup. We have 100+ tutors to manage.',
        ago: 8,
      },
      {
        dir: 'OUTBOUND',
        text: 'Hi Neha! Great to hear from you. Our platform handles team management beautifully. Are you looking for student CRM or tutor management?',
        ago: 7,
      },
      {
        dir: 'INBOUND',
        text: 'Both actually. Student enrollment + tutor scheduling + parent communication via WhatsApp.',
        ago: 6,
      },
      {
        dir: 'OUTBOUND',
        text: 'Perfect use case! We can set up custom pipelines for student enrollment and use our calendar + WhatsApp integration for scheduling and parent updates.',
        ago: 5,
      },
      { dir: 'INBOUND', text: "Sounds interesting. What's the pricing for 100 users?", ago: 4 },
    ],
  },
  {
    contactIdx: 7,
    status: 'OPEN',
    purpose: 'SALES',
    priority: 'HIGH',
    messages: [
      {
        dir: 'INBOUND',
        text: 'Hi, our annual subscription is up for renewal next month. Can we discuss pricing?',
        ago: 72,
      },
      {
        dir: 'OUTBOUND',
        text: 'Hi Suresh! Thanks for being a loyal customer. Let me pull up your account details.',
        ago: 71,
      },
      {
        dir: 'OUTBOUND',
        text: "You're on the Pro plan (50 users) at ₹999/user/month. With annual payment, we can offer ₹849/user/month — that's 15% savings.",
        ago: 70,
      },
      {
        dir: 'INBOUND',
        text: "We were hoping for 20% off. We've been with you for 2 years now.",
        ago: 65,
      },
      {
        dir: 'OUTBOUND',
        text: 'I appreciate your loyalty! Let me check what I can do. For a 2-year commitment, I can offer 15% off plus 2 months free — effectively about 18% savings.',
        ago: 64,
      },
      { dir: 'INBOUND', text: 'Can you also include the Enterprise analytics add-on?', ago: 60 },
      {
        dir: 'OUTBOUND',
        text: "I'll include Enterprise Analytics at no extra cost for the first year. After that, it would be ₹5,000/month. How does that sound?",
        ago: 59,
      },
      { dir: 'INBOUND', text: 'Let me discuss with my CFO. Will get back by Friday.', ago: 48 },
      {
        dir: 'OUTBOUND',
        text: "Of course! I'll send a formal proposal to your email. Looking forward to continuing our partnership.",
        ago: 47,
      },
      { dir: 'INBOUND', text: 'Priya from accounts might reach out for the GST details.', ago: 46 },
      {
        dir: 'OUTBOUND',
        text: "No problem! I'll make sure our team is ready to assist Priya with any billing or GST queries.",
        ago: 45,
      },
      { dir: 'INBOUND', text: 'Thanks 👍', ago: 44 },
    ],
  },
  {
    contactIdx: 8,
    status: 'RESOLVED',
    purpose: 'GENERAL',
    priority: 'LOW',
    messages: [
      {
        dir: 'INBOUND',
        text: 'Feature request: Can you add a Kanban view for the inbox? Like Trello boards.',
        ago: 240,
      },
      {
        dir: 'OUTBOUND',
        text: "Hi Kavitha! That's a great suggestion. We actually have this on our Q2 roadmap.",
        ago: 239,
      },
      { dir: 'INBOUND', text: 'Oh nice! Any timeline?', ago: 238 },
      {
        dir: 'OUTBOUND',
        text: "We're targeting March 2026 for the Kanban inbox view. I've added your vote to the feature request.",
        ago: 237,
      },
      {
        dir: 'INBOUND',
        text: 'Also would love drag-and-drop for conversation assignment.',
        ago: 200,
      },
      {
        dir: 'OUTBOUND',
        text: 'Noted! That will actually be part of the Kanban release. Drag conversations between columns to reassign.',
        ago: 199,
      },
      { dir: 'INBOUND', text: 'Perfect. Will there be a beta?', ago: 198 },
    ],
  },
  {
    contactIdx: 9,
    status: 'RESOLVED',
    purpose: 'SERVICE',
    priority: 'MEDIUM',
    messages: [
      {
        dir: 'OUTBOUND',
        text: "Welcome to Nexora, Deepak! Let's get your account set up. First, how many team members will be using the CRM?",
        ago: 120,
      },
      { dir: 'INBOUND', text: '5 people — me, 2 sales reps, 1 operations, 1 admin.', ago: 119 },
      {
        dir: 'OUTBOUND',
        text: "Perfect. I've created 5 user accounts. Invites sent to their emails. Next, let's import your existing contacts.",
        ago: 118,
      },
      {
        dir: 'INBOUND',
        text: 'We have about 500 contacts in an Excel file. Can I upload directly?',
        ago: 117,
      },
      {
        dir: 'OUTBOUND',
        text: "Yes! Go to CRM → Import → Upload your Excel/CSV file. Our mapper will auto-detect columns. I'll guide you.",
        ago: 116,
      },
      {
        dir: 'INBOUND',
        text: 'Done. Uploaded successfully — 487 contacts imported. 13 duplicates skipped.',
        ago: 100,
      },
      {
        dir: 'OUTBOUND',
        text: "Excellent! Now let's set up your WhatsApp Business channel. Do you have an MSG91 account?",
        ago: 99,
      },
      { dir: 'INBOUND', text: "Yes, here's my API key: msg91_xxx... (redacted)", ago: 98 },
      {
        dir: 'OUTBOUND',
        text: 'WhatsApp connected successfully! ✅ Your number +91-98765-43210 is now integrated. You can start sending messages from the Inbox.',
        ago: 97,
      },
      {
        dir: 'INBOUND',
        text: 'This is amazing. Setup was so smooth. Appreciate the help!',
        ago: 96,
      },
    ],
  },
  {
    contactIdx: 10,
    status: 'PENDING',
    purpose: 'MARKETING',
    priority: 'LOW',
    messages: [
      {
        dir: 'OUTBOUND',
        text: "Hi Pooja! We noticed you signed up for our free trial but haven't logged in yet. Need any help getting started?",
        ago: 72,
      },
      { dir: 'INBOUND', text: 'Oh hi! Yes I got busy. Will check it out this weekend.', ago: 48 },
      {
        dir: 'OUTBOUND',
        text: "No worries! Here's a quick start guide: https://docs.nexoraos.pro/quickstart. And feel free to WhatsApp us anytime for help.",
        ago: 47,
      },
    ],
  },
  {
    contactIdx: 11,
    status: 'RESOLVED',
    purpose: 'SUPPORT',
    priority: 'MEDIUM',
    messages: [
      {
        dir: 'INBOUND',
        text: "I need a GST invoice for last month's payment. Invoice #INV-2024-456.",
        ago: 48,
      },
      { dir: 'OUTBOUND', text: 'Hi Amit! Let me pull that up. What GSTIN should we use?', ago: 47 },
      {
        dir: 'INBOUND',
        text: 'GSTIN: 27AABCU9603R1ZM. Company: AutoParts India Pvt Ltd.',
        ago: 46,
      },
      {
        dir: 'OUTBOUND',
        text: 'Updated! Your GST invoice for ₹29,970 (inclusive of 18% GST) has been generated. Sending to your email now.',
        ago: 45,
      },
      { dir: 'INBOUND', text: 'Received. Can you also share a PDF copy here?', ago: 44 },
      { dir: 'OUTBOUND', text: "📄 Here's the PDF.", ago: 43, contentType: 'DOCUMENT' },
      {
        dir: 'INBOUND',
        text: 'Got it. Everything looks correct. Thanks for the quick turnaround!',
        ago: 42,
      },
      {
        dir: 'OUTBOUND',
        text: 'Happy to help! Going forward, all invoices will auto-include your GSTIN. 🙏',
        ago: 41,
      },
    ],
  },
];

// ==========================================
// SMS Conversations (8)
// ==========================================

const smsConversations = [
  {
    contactIdx: 12,
    status: 'RESOLVED',
    purpose: 'GENERAL',
    priority: 'LOW',
    messages: [
      {
        dir: 'OUTBOUND',
        text: 'Your Nexora verification OTP is 847291. Valid for 5 minutes.',
        ago: 24,
      },
      { dir: 'INBOUND', text: '847291', ago: 23 },
      {
        dir: 'OUTBOUND',
        text: 'Phone number verified successfully! Welcome to Nexora, Rohit.',
        ago: 22,
      },
      { dir: 'INBOUND', text: 'Thanks', ago: 21 },
    ],
  },
  {
    contactIdx: 13,
    status: 'RESOLVED',
    purpose: 'SERVICE',
    priority: 'MEDIUM',
    messages: [
      {
        dir: 'OUTBOUND',
        text: 'Reminder: Your appointment with Dr. Kapoor is tomorrow at 3:00 PM. Reply YES to confirm or RESCHED to reschedule.',
        ago: 48,
      },
      { dir: 'INBOUND', text: 'RESCHED', ago: 47 },
      {
        dir: 'OUTBOUND',
        text: 'No problem! Available slots: Mon 10AM, Tue 2PM, Wed 4PM. Reply with day.',
        ago: 46,
      },
      { dir: 'INBOUND', text: 'Tue 2PM', ago: 45 },
      {
        dir: 'OUTBOUND',
        text: 'Confirmed! Your appointment is rescheduled to Tuesday at 2:00 PM with Dr. Kapoor. Calendar updated.',
        ago: 44,
      },
      { dir: 'INBOUND', text: 'Thanks', ago: 43 },
    ],
  },
  {
    contactIdx: 14,
    status: 'RESOLVED',
    purpose: 'SUPPORT',
    priority: 'HIGH',
    messages: [
      {
        dir: 'OUTBOUND',
        text: 'Payment reminder: ₹15,500 due for Invoice INV-2024-789. Pay via: https://pay.nexora.io/inv789',
        ago: 72,
      },
      { dir: 'INBOUND', text: 'Paid just now via UPI', ago: 36 },
      {
        dir: 'OUTBOUND',
        text: 'Payment of ₹15,500 received! Thank you, Divya. Receipt sent to your email.',
        ago: 35,
      },
    ],
  },
  {
    contactIdx: 15,
    status: 'RESOLVED',
    purpose: 'SERVICE',
    priority: 'LOW',
    messages: [
      {
        dir: 'OUTBOUND',
        text: 'Your order #ORD-5678 has been dispatched! Track: https://track.delhivery.com/dl5678',
        ago: 48,
      },
      { dir: 'INBOUND', text: 'Received. When will it arrive?', ago: 47 },
      {
        dir: 'OUTBOUND',
        text: "Expected delivery: Feb 22, 2026 by 6 PM. You'll get an update when it's out for delivery.",
        ago: 46,
      },
      { dir: 'INBOUND', text: 'Package delivered. Everything looks good!', ago: 12 },
      { dir: 'OUTBOUND', text: 'Glad to hear! Rate your experience (1-5): ', ago: 11 },
    ],
  },
  {
    contactIdx: 16,
    status: 'OPEN',
    purpose: 'MARKETING',
    priority: 'LOW',
    messages: [
      {
        dir: 'OUTBOUND',
        text: "✨ Exclusive for Lakshmi! 30% off on all gold jewelry this Valentine's week. Visit store or reply SHOP.",
        ago: 24,
      },
      { dir: 'INBOUND', text: 'SHOP', ago: 23 },
      {
        dir: 'OUTBOUND',
        text: 'Great choice! Browse our collection: https://store.nexora.io/valentines. Use code LOVE30 at checkout.',
        ago: 22,
      },
      { dir: 'INBOUND', text: 'Do you have EMI options?', ago: 20 },
    ],
  },
  {
    contactIdx: 17,
    status: 'RESOLVED',
    purpose: 'SERVICE',
    priority: 'LOW',
    messages: [
      {
        dir: 'OUTBOUND',
        text: 'Order confirmed! #ORD-9012 — Goa Package (3N/4D) for 2 adults. Total: ₹45,000. Check email for details.',
        ago: 96,
      },
      { dir: 'INBOUND', text: 'Got the email. When do I get the flight tickets?', ago: 95 },
      {
        dir: 'OUTBOUND',
        text: 'E-tickets will be sent 48 hours before departure. Your trip starts Feb 28!',
        ago: 94,
      },
    ],
  },
  {
    contactIdx: 18,
    status: 'RESOLVED',
    purpose: 'MARKETING',
    priority: 'LOW',
    messages: [
      {
        dir: 'OUTBOUND',
        text: 'Hi Rekha! How was your facial treatment yesterday? Rate 1-5.',
        ago: 24,
      },
      { dir: 'INBOUND', text: '4', ago: 23 },
      {
        dir: 'OUTBOUND',
        text: 'Thank you for the feedback! 🙏 As a thank you, enjoy 15% off your next visit. Code: GLOW15',
        ago: 22,
      },
      { dir: 'INBOUND', text: 'Nice! Will book next week', ago: 21 },
      {
        dir: 'OUTBOUND',
        text: 'Looking forward to seeing you! Book anytime: https://book.nexora.io/rekha',
        ago: 20,
      },
    ],
  },
  {
    contactIdx: 19,
    status: 'RESOLVED',
    purpose: 'SUPPORT',
    priority: 'URGENT',
    messages: [
      {
        dir: 'OUTBOUND',
        text: "⚠️ Security Alert: A new login detected from Mumbai (Chrome, Windows). If this wasn't you, reply BLOCK.",
        ago: 6,
      },
      { dir: 'INBOUND', text: 'That was me. Thanks for the alert.', ago: 5 },
      {
        dir: 'OUTBOUND',
        text: "Great, you're all set! Enable 2FA for extra security: Settings → Security → Two-Factor.",
        ago: 4,
      },
      { dir: 'INBOUND', text: 'Will do', ago: 3 },
    ],
  },
];

// ==========================================
// Email Conversations (6)
// ==========================================

const emailConversations = [
  {
    contactIdx: 20,
    status: 'OPEN',
    purpose: 'SALES',
    priority: 'HIGH',
    subject: 'Enterprise CRM Inquiry — TechCorp India',
    messages: [
      {
        dir: 'INBOUND',
        text: 'Dear Nexora Team,\n\nWe are evaluating CRM solutions for our organization of 200+ employees across 5 offices in India. We need:\n- Multi-location support\n- WhatsApp Business API integration\n- Custom reporting dashboard\n- GST-compliant invoicing\n- API access for custom integrations\n\nCould you share an enterprise proposal?\n\nBest regards,\nRahul Malhotra\nCTO, TechCorp India',
        ago: 168,
      },
      {
        dir: 'OUTBOUND',
        text: "Dear Rahul,\n\nThank you for your interest in Nexora CRM! We'd be happy to prepare a custom enterprise proposal.\n\nAll the features you mentioned are available in our Enterprise plan. I'd like to schedule a discovery call to understand your specific workflows.\n\nAvailable times:\n- Tuesday 2 PM IST\n- Wednesday 11 AM IST\n- Thursday 3 PM IST\n\nBest,\nNexora Enterprise Team",
        ago: 167,
      },
      {
        dir: 'INBOUND',
        text: 'Tuesday 2 PM works. Please send a calendar invite to rahul.m@techcorp.in and our VP Sales: anand.k@techcorp.in',
        ago: 160,
      },
      {
        dir: 'OUTBOUND',
        text: "Calendar invite sent for Tuesday 2 PM IST. I've included both email addresses.\n\nIn the meantime, here's our Enterprise feature deck for your review.\n\nLooking forward to the call!",
        ago: 159,
      },
      {
        dir: 'INBOUND',
        text: "Received. One question — do you support SSO with Azure AD? That's a hard requirement for us.",
        ago: 140,
      },
      {
        dir: 'OUTBOUND',
        text: "Yes, we support SAML 2.0 SSO with Azure AD, Google Workspace, and Okta. It's included in the Enterprise plan at no extra cost.\n\nI'll include the SSO setup documentation in the proposal.",
        ago: 139,
      },
      { dir: 'INBOUND', text: 'Excellent. See you Tuesday.', ago: 138 },
      { dir: 'OUTBOUND', text: 'Looking forward to it, Rahul!', ago: 137 },
    ],
  },
  {
    contactIdx: 21,
    status: 'RESOLVED',
    purpose: 'SUPPORT',
    priority: 'HIGH',
    subject: 'Bug Report: Contact import failing with CSV > 10MB',
    messages: [
      {
        dir: 'INBOUND',
        text: 'Hi Support,\n\nI\'m trying to import a CSV file with 50,000 contacts but it fails with "File too large" error. The file is 12MB. Your docs say 50MB limit.\n\nBrowser: Chrome 120\nPlan: Pro\n\n— Sneha',
        ago: 96,
      },
      {
        dir: 'OUTBOUND',
        text: "Hi Sneha,\n\nThank you for reporting this. I can reproduce the issue — there's a frontend validation bug that caps at 10MB instead of 50MB.\n\nWorkaround: Use our API endpoint directly:\nPOST /api/v1/crm/contacts/import\n\nI'll update you when the fix is deployed.",
        ago: 95,
      },
      {
        dir: 'INBOUND',
        text: 'The API workaround worked! Imported all 50K contacts. Thanks.\n\nWhen will the UI fix be live?',
        ago: 72,
      },
      {
        dir: 'OUTBOUND',
        text: 'Fix deployed! The CSV import now correctly accepts files up to 50MB. Please verify on your end.\n\nThanks for your patience, Sneha!',
        ago: 48,
      },
      { dir: 'INBOUND', text: 'Confirmed working. Great turnaround time! 👏', ago: 47 },
    ],
  },
  {
    contactIdx: 22,
    status: 'OPEN',
    purpose: 'SUPPORT',
    priority: 'HIGH',
    subject: 'Invoice Dispute — Double Charge for November',
    messages: [
      {
        dir: 'INBOUND',
        text: 'To whom it may concern,\n\nWe have been charged twice for November 2025. Invoice INV-2025-1102 and INV-2025-1103 are for the same amount (₹1,49,700).\n\nPlease issue a credit note for the duplicate charge immediately.\n\nRegards,\nVivek Choudhury\nCFO, Manufacturing Solutions Pvt Ltd',
        ago: 120,
      },
      {
        dir: 'OUTBOUND',
        text: "Dear Vivek,\n\nI sincerely apologize for this billing error. I've verified both invoices and confirmed the duplicate.\n\nAction taken:\n1. Credit Note CN-2025-1103 issued for ₹1,49,700\n2. Amount will be adjusted against your December invoice\n3. Root cause identified and fixed in our billing system\n\nPlease find the credit note attached.",
        ago: 119,
      },
      {
        dir: 'INBOUND',
        text: 'Received the credit note. Please ensure this is reflected in our December statement.\n\nAlso, we need the GST adjustment — original was 18% GST on the duplicate amount.',
        ago: 96,
      },
      {
        dir: 'OUTBOUND',
        text: 'Absolutely. The GST credit of ₹22,950 (18% of ₹1,27,375 base) has been included in the credit note. This will show on your next GSTR-2B as a credit.\n\nYour December statement will reflect the net payable after adjustment.',
        ago: 95,
      },
      {
        dir: 'INBOUND',
        text: 'Thank you. Our accounts team will verify against GSTR-2B.',
        ago: 72,
      },
      {
        dir: 'OUTBOUND',
        text: 'Of course. If your accounts team needs any documentation for the GST reconciliation, please have them contact us at billing@nexoraos.pro.\n\nOnce again, we apologize for the inconvenience.',
        ago: 71,
      },
    ],
  },
  {
    contactIdx: 23,
    status: 'RESOLVED',
    purpose: 'SALES',
    priority: 'MEDIUM',
    subject: 'Re: Partnership Opportunity — Retail Chain',
    messages: [
      {
        dir: 'INBOUND',
        text: 'Hi Nexora,\n\nOur HR department is evaluating CRM + HR tools for our 12-store retail chain. We currently use Zoho but want something more India-focused.\n\nCan we discuss a partnership where you provide CRM for our stores?\n\n— Ritu Saxena, HR Head',
        ago: 168,
      },
      {
        dir: 'OUTBOUND',
        text: "Hi Ritu,\n\nThank you for reaching out! We'd love to discuss a partnership. Our retail CRM includes:\n- Store-level dashboards\n- Employee rostering (HR module)\n- Customer loyalty program\n- WhatsApp catalog integration\n\nWould you be available for a meeting next week?",
        ago: 167,
      },
      { dir: 'INBOUND', text: 'Wednesday 3 PM works. Please share a Zoom/Meet link.', ago: 144 },
      {
        dir: 'OUTBOUND',
        text: "Meeting set for Wednesday 3 PM. Google Meet link: meet.google.com/xxx-yyyy-zzz\n\nI'll prepare a retail-specific demo showcasing the multi-store dashboard.",
        ago: 143,
      },
    ],
  },
  {
    contactIdx: 24,
    status: 'OPEN',
    purpose: 'SUPPORT',
    priority: 'MEDIUM',
    subject: 'Data Migration Guide — Moving from Salesforce',
    messages: [
      {
        dir: 'INBOUND',
        text: "Hi,\n\nWe're migrating from Salesforce to Nexora. We have:\n- 25,000 contacts\n- 3,000 deals with history\n- 500 email templates\n- Custom objects for project tracking\n\nDo you have a migration guide or tool?\n\n— Gaurav Mishra",
        ago: 96,
      },
      {
        dir: 'OUTBOUND',
        text: "Hi Gaurav,\n\nGreat timing! We've recently launched our Salesforce migration tool. Here's the process:\n\n1. Export your Salesforce data using Data Loader\n2. Use our migration wizard: Settings → Import → Salesforce Migration\n3. Map custom objects to our fields\n4. Preview and validate\n5. Execute migration\n\nFor 25K contacts + 3K deals, expect ~30 minutes.\n\nI'll also assign a dedicated migration specialist to assist you.",
        ago: 95,
      },
      {
        dir: 'INBOUND',
        text: 'That sounds straightforward. What about our Salesforce automations (Flows)?',
        ago: 72,
      },
      {
        dir: 'OUTBOUND',
        text: "Salesforce Flows don't directly migrate, but our Automation hub can replicate most workflows. I'll prepare a mapping document:\n\n- Record-triggered flows → Nexora Triggers\n- Screen flows → Nexora Forms\n- Scheduled flows → Nexora Scheduled Automations\n\nOur team will help rebuild the top 10 most-used flows.",
        ago: 71,
      },
      {
        dir: 'INBOUND',
        text: "Perfect. Let's schedule a call to walk through our top flows.",
        ago: 48,
      },
      {
        dir: 'OUTBOUND',
        text: "Call scheduled for Friday 11 AM. I'll have our automation specialist join.\n\nPlease share your top 10 flow names/descriptions beforehand so we can prepare the mapping.",
        ago: 47,
      },
      { dir: 'INBOUND', text: 'Will send the list by Thursday evening.', ago: 46 },
    ],
  },
  {
    contactIdx: 25,
    status: 'RESOLVED',
    purpose: 'SUPPORT',
    priority: 'MEDIUM',
    subject: 'Compliance Documentation for HIPAA/Healthcare',
    messages: [
      {
        dir: 'INBOUND',
        text: "Hello,\n\nWe're a multi-specialty hospital evaluating Nexora for patient CRM. We need documentation on:\n- Data encryption (at rest and in transit)\n- Access control and audit logs\n- Data retention policies\n- HIPAA-equivalent compliance for India\n\n— Shruti Pandey, Admin, City Hospital",
        ago: 120,
      },
      {
        dir: 'OUTBOUND',
        text: "Dear Shruti,\n\nThank you for your inquiry. Here's our compliance overview:\n\n1. Encryption: AES-256 at rest, TLS 1.3 in transit\n2. Access Control: Role-based (RBAC) with granular permissions + full audit logs\n3. Data Retention: Configurable per tenant (30 days to unlimited)\n4. Compliance: SOC 2 Type II certified, DPDP Act 2023 compliant\n\nI'm attaching our Security Whitepaper and Data Processing Agreement (DPA).\n\nFor healthcare-specific requirements, we offer a HIPAA-aligned configuration.",
        ago: 119,
      },
      {
        dir: 'INBOUND',
        text: 'The whitepaper is comprehensive. Two more questions:\n1. Where are servers located?\n2. Can we get a dedicated database?',
        ago: 96,
      },
      {
        dir: 'OUTBOUND',
        text: 'Great questions!\n\n1. Primary servers: AWS Mumbai (ap-south-1). Backup: AWS Hyderabad.\n2. Yes! Our Enterprise Healthcare plan includes a dedicated PostgreSQL instance for patient data isolation.\n\nWould you like to proceed with a healthcare-specific demo?',
        ago: 95,
      },
      {
        dir: 'INBOUND',
        text: 'Yes please. Schedule for next week. Include our IT head: vinod.r@hospital.org',
        ago: 72,
      },
    ],
  },
];

// ==========================================
// Main Seeder
// ==========================================

async function main() {
  console.log('🌱 Seeding conversations for Postman Mock Provider...\n');

  // Find the platform tenant
  const tenant = await prisma.tenant.findFirst({
    where: { slug: 'nexora-platform' },
  });

  if (!tenant) {
    console.error('❌ Tenant "nexora-platform" not found. Run the main seed first.');
    process.exit(1);
  }

  const tenantId = tenant.id;
  console.log(`📦 Tenant: ${tenant.name} (${tenantId})\n`);

  // ---- Clean up old data ----
  console.log('🧹 Cleaning up old conversations and messages...');

  // Delete all message_events for this tenant
  const deletedMessages = await prisma.message_events.deleteMany({
    where: { tenantId },
  });
  console.log(`  Deleted ${deletedMessages.count} old message_events`);

  // Delete all conversation threads for this tenant
  const deletedThreads = await prisma.conversationThread.deleteMany({
    where: { tenantId },
  });
  console.log(`  Deleted ${deletedThreads.count} old conversation threads`);

  // Delete all old Conversation records for this tenant
  const deletedConvos = await prisma.conversation.deleteMany({
    where: { tenantId },
  });
  console.log(`  Deleted ${deletedConvos.count} old conversations`);

  // Delete old mock channels (Channel model, for Conversation FK)
  await prisma.channel.deleteMany({
    where: {
      id: { in: ['mock-channel-whatsapp', 'mock-channel-sms', 'mock-channel-email'] },
    },
  });

  // Delete old mock channel accounts (ChannelAccount model, for message_events FK)
  await prisma.channelAccount.deleteMany({
    where: {
      id: { in: ['mock-ch-whatsapp', 'mock-ch-sms', 'mock-ch-email'] },
    },
  });
  console.log('  ✅ Old data cleaned\n');

  // ---- Create Channel records (old model — needed for Conversation.channelId FK) ----
  console.log('📡 Creating channels...');

  const waChannelOld = await prisma.channel.upsert({
    where: { id: 'mock-channel-whatsapp' },
    update: {},
    create: {
      id: 'mock-channel-whatsapp',
      tenantId,
      type: 'WHATSAPP',
      name: 'Postman Mock — WhatsApp',
      provider: 'APIDOG',
      providerConfig: {
        baseUrl: 'https://mock.apidog.com/m1/1204909-1200223-default',
        apiToken: '4BwI4HdkyYbT3O2YbbJaE',
        mode: 'MOCK',
      },
      phoneNumber: '+919876500001',
      phoneNumberId: '919876500001',
      status: 'ACTIVE',
    },
  });

  const smsChannelOld = await prisma.channel.upsert({
    where: { id: 'mock-channel-sms' },
    update: {},
    create: {
      id: 'mock-channel-sms',
      tenantId,
      type: 'SMS',
      name: 'Postman Mock — SMS',
      provider: 'APIDOG',
      providerConfig: {
        baseUrl: 'https://mock.apidog.com/m1/1204909-1200223-default',
        apiToken: '4BwI4HdkyYbT3O2YbbJaE',
        mode: 'MOCK',
      },
      status: 'ACTIVE',
    },
  });

  const emailChannelOld = await prisma.channel.upsert({
    where: { id: 'mock-channel-email' },
    update: {},
    create: {
      id: 'mock-channel-email',
      tenantId,
      type: 'EMAIL',
      name: 'Postman Mock — Email',
      provider: 'APIDOG',
      providerConfig: {
        baseUrl: 'https://mock.apidog.com/m1/1204909-1200223-default',
        apiToken: '4BwI4HdkyYbT3O2YbbJaE',
        mode: 'MOCK',
      },
      status: 'ACTIVE',
    },
  });

  // ---- Create ChannelAccount records (new model — needed for message_events FK) ----

  const waChannel = await prisma.channelAccount.upsert({
    where: { id: 'mock-ch-whatsapp' },
    update: {},
    create: {
      id: 'mock-ch-whatsapp',
      tenantId,
      type: 'WHATSAPP',
      name: 'Postman Mock — WhatsApp',
      provider: 'APIDOG',
      providerConfig: {
        baseUrl: 'https://mock.apidog.com/m1/1204909-1200223-default',
        apiToken: '4BwI4HdkyYbT3O2YbbJaE',
        mode: 'MOCK',
      },
      phoneNumber: '+919876500001',
      phoneNumberId: '919876500001',
      status: 'ACTIVE',
      healthStatus: 'HEALTHY',
      lastHealthCheck: new Date(),
    },
  });

  const smsChannel = await prisma.channelAccount.upsert({
    where: { id: 'mock-ch-sms' },
    update: {},
    create: {
      id: 'mock-ch-sms',
      tenantId,
      type: 'SMS',
      name: 'Postman Mock — SMS',
      provider: 'APIDOG',
      providerConfig: {
        baseUrl: 'https://mock.apidog.com/m1/1204909-1200223-default',
        apiToken: '4BwI4HdkyYbT3O2YbbJaE',
        mode: 'MOCK',
      },
      senderId: 'NEXORA',
      status: 'ACTIVE',
      healthStatus: 'HEALTHY',
      lastHealthCheck: new Date(),
    },
  });

  const emailChannel = await prisma.channelAccount.upsert({
    where: { id: 'mock-ch-email' },
    update: {},
    create: {
      id: 'mock-ch-email',
      tenantId,
      type: 'EMAIL_SMTP',
      name: 'Postman Mock — Email',
      provider: 'APIDOG',
      providerConfig: {
        baseUrl: 'https://mock.apidog.com/m1/1204909-1200223-default',
        apiToken: '4BwI4HdkyYbT3O2YbbJaE',
        mode: 'MOCK',
      },
      emailAddress: 'noreply@nexoraos.pro',
      status: 'ACTIVE',
      healthStatus: 'HEALTHY',
      lastHealthCheck: new Date(),
    },
  });

  console.log('  ✅ Channel + ChannelAccount records created\n');

  // ---- Ensure contacts exist ----
  console.log('👤 Creating contacts...');
  const contactRecords = [];
  for (const c of contacts) {
    // Check if contact already exists by email or phone
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        OR: [{ email: c.email }, { phone: c.phone }],
      },
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId,
          firstName: c.firstName,
          lastName: c.lastName,
          displayName: `${c.firstName} ${c.lastName}`,
          email: c.email,
          phone: c.phone,
          source: 'IMPORT',
          status: 'ACTIVE',
        },
      });
    }
    contactRecords.push(contact);
  }
  console.log(`  ✅ ${contactRecords.length} contacts ready\n`);

  // ---- Seed conversations ----
  let totalThreads = 0;
  let totalMessages = 0;

  // channelTypeOld = ChannelType enum (WHATSAPP, SMS, EMAIL)
  // channelTypeNew = ChannelAccountType enum (WHATSAPP, SMS, EMAIL_SMTP, etc.)
  async function seedConversationSet(
    convos,
    channelTypeOld,
    channelTypeNew,
    channelOld,
    channelAccount
  ) {
    for (const conv of convos) {
      const contact = contactRecords[conv.contactIdx];
      const msgs = conv.messages;
      const lastMsg = msgs[msgs.length - 1];
      const firstMsg = msgs[0];
      const unreadCount = conv.status === 'OPEN' ? Math.floor(Math.random() * 3) + 1 : 0;
      const lastCustomerMsg = msgs.filter((m) => m.dir === 'INBOUND').pop();
      const firstAgentMsg = msgs.find((m) => m.dir === 'OUTBOUND');

      // Map ConversationThreadStatus → ConversationStatus (old model only has OPEN/PENDING/RESOLVED/CLOSED)
      const statusMap = {
        OPEN: 'OPEN',
        PENDING: 'PENDING',
        RESOLVED: 'RESOLVED',
        CLOSED: 'CLOSED',
      };
      const oldStatus = statusMap[conv.status] || 'OPEN';

      // 1. Create Conversation (old model — the Inbox list queries this)
      const conversation = await prisma.conversation.create({
        data: {
          tenantId,
          channelId: channelOld.id,
          channelType: channelTypeOld,
          contactId: contact.id,
          contactPhone: contact.phone,
          contactName: `${contact.firstName} ${contact.lastName}`,
          status: oldStatus,
          lastCustomerMessageAt: hoursAgo(lastCustomerMsg?.ago || lastMsg.ago),
          firstResponseAt: firstAgentMsg ? hoursAgo(firstAgentMsg.ago) : null,
          lastMessagePreview: lastMsg.text.substring(0, 100),
          unreadCount,
          createdAt: hoursAgo(firstMsg.ago),
        },
      });

      // 2. Create ConversationThread (new model — message_events FK needs this, same ID)
      await prisma.conversationThread.create({
        data: {
          id: conversation.id, // Same ID so message_events.threadId links to both
          tenantId,
          contactId: contact.id,
          contactPhone: contact.phone,
          contactEmail: contact.email,
          status: conv.status,
          priority: conv.priority,
          purpose: conv.purpose,
          lastMessageAt: hoursAgo(lastMsg.ago),
          lastCustomerMessageAt: hoursAgo(lastCustomerMsg?.ago || lastMsg.ago),
          lastAgentMessageAt: hoursAgo(
            msgs.filter((m) => m.dir === 'OUTBOUND').pop()?.ago || lastMsg.ago
          ),
          firstResponseAt: firstAgentMsg ? hoursAgo(firstAgentMsg.ago) : null,
          unreadCount,
          messageCount: msgs.length,
          lastMessagePreview: lastMsg.text.substring(0, 100),
          lastMessageChannel: channelTypeNew,
          createdAt: hoursAgo(firstMsg.ago),
        },
      });
      totalThreads++;

      // 3. Create message_events (messages — threadId points to ConversationThread)
      for (const msg of msgs) {
        await prisma.message_events.create({
          data: {
            tenantId,
            threadId: conversation.id,
            channelAccountId: channelAccount.id,
            channel: channelTypeNew,
            direction: msg.dir,
            providerMessageId: nextMsgId(),
            providerStatus: msg.dir === 'OUTBOUND' ? 'DELIVERED' : null,
            contentType: msg.contentType || 'TEXT',
            textContent: msg.text,
            subject: conv.subject || null,
            status: msg.dir === 'OUTBOUND' ? 'DELIVERED' : 'DELIVERED',
            sentAt: hoursAgo(msg.ago),
            deliveredAt: hoursAgo(msg.ago - 0.01),
            readAt: msg.dir === 'OUTBOUND' ? hoursAgo(msg.ago - 0.1) : null,
            metadata: {
              seeded: true,
              provider: 'postman-mock',
            },
            createdAt: hoursAgo(msg.ago),
          },
        });
        totalMessages++;
      }
    }
  }

  console.log('💬 Seeding WhatsApp conversations...');
  await seedConversationSet(whatsappConversations, 'WHATSAPP', 'WHATSAPP', waChannelOld, waChannel);
  console.log(`  ✅ ${whatsappConversations.length} WhatsApp threads\n`);

  console.log('📱 Seeding SMS conversations...');
  await seedConversationSet(smsConversations, 'SMS', 'SMS', smsChannelOld, smsChannel);
  console.log(`  ✅ ${smsConversations.length} SMS threads\n`);

  console.log('📧 Seeding Email conversations...');
  await seedConversationSet(
    emailConversations,
    'EMAIL',
    'EMAIL_SMTP',
    emailChannelOld,
    emailChannel
  );
  console.log(`  ✅ ${emailConversations.length} Email threads\n`);

  console.log('═══════════════════════════════════════');
  console.log(`✅ Seeding complete!`);
  console.log(`   Threads: ${totalThreads}`);
  console.log(`   Messages: ${totalMessages}`);
  console.log(`   Channels: 3 (WhatsApp, SMS, Email)`);
  console.log(`   Contacts: ${contactRecords.length}`);
  console.log('═══════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
