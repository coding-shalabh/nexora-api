import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find the user and tenant for arpit.sharma@helixcode.in
  const user = await prisma.user.findFirst({
    where: { email: 'arpit.sharma@helixcode.in' },
    include: { tenant: true }
  })

  if (!user) {
    console.error('User arpit.sharma@helixcode.in not found!')
    // List available users
    const users = await prisma.user.findMany({
      select: { email: true, id: true, tenantId: true }
    })
    console.log('Available users:', users)
    return
  }

  console.log(`Found user: ${user.email} (tenant: ${user.tenant.name})`)

  const tenantId = user.tenantId
  const createdById = user.id

  // Create categories
  const categories = [
    { name: 'Greetings', icon: '👋', color: 'blue', order: 1 },
    { name: 'Sales', icon: '💰', color: 'green', order: 2 },
    { name: 'Support', icon: '🛠️', color: 'orange', order: 3 },
    { name: 'Follow-up', icon: '📞', color: 'purple', order: 4 },
    { name: 'Closing', icon: '🎉', color: 'pink', order: 5 },
    { name: 'General', icon: '📝', color: 'gray', order: 6 },
  ]

  const createdCategories = {}

  for (const cat of categories) {
    const category = await prisma.cannedResponseCategory.upsert({
      where: { tenantId_name: { tenantId, name: cat.name } },
      update: { icon: cat.icon, color: cat.color, order: cat.order },
      create: { tenantId, ...cat }
    })
    createdCategories[cat.name] = category.id
    console.log(`✓ Category: ${cat.name}`)
  }

  // System templates (TEAM visibility - available to all)
  const systemTemplates = [
    // Greetings
    {
      categoryId: createdCategories['Greetings'],
      title: 'Welcome Message',
      shortcut: '/welcome',
      content: 'Hello {{name}}! 👋\n\nThank you for reaching out to us. How can I assist you today?',
      variables: [{ name: 'name', label: 'Customer Name', defaultValue: 'there' }],
      visibility: 'TEAM'
    },
    {
      categoryId: createdCategories['Greetings'],
      title: 'Good Morning',
      shortcut: '/gm',
      content: 'Good morning, {{name}}! ☀️\n\nI hope you\'re having a great day. How may I help you?',
      variables: [{ name: 'name', label: 'Customer Name', defaultValue: 'there' }],
      visibility: 'TEAM'
    },
    {
      categoryId: createdCategories['Greetings'],
      title: 'Thank You for Contacting',
      shortcut: '/thanks',
      content: 'Thank you for contacting us, {{name}}! We appreciate your interest.\n\nI\'ll be happy to help you with any questions you may have.',
      variables: [{ name: 'name', label: 'Customer Name', defaultValue: '' }],
      visibility: 'TEAM'
    },

    // Sales
    {
      categoryId: createdCategories['Sales'],
      title: 'Product Introduction',
      shortcut: '/intro',
      content: 'Hi {{name}}!\n\nI\'d love to tell you about {{product}}. It\'s designed to help you {{benefit}}.\n\nWould you like me to share more details or schedule a quick demo?',
      variables: [
        { name: 'name', label: 'Customer Name', defaultValue: 'there' },
        { name: 'product', label: 'Product Name', defaultValue: 'our solution' },
        { name: 'benefit', label: 'Key Benefit', defaultValue: 'achieve your goals' }
      ],
      visibility: 'TEAM'
    },
    {
      categoryId: createdCategories['Sales'],
      title: 'Pricing Information',
      shortcut: '/pricing',
      content: 'Great question about pricing! 💰\n\nOur {{plan}} plan starts at {{price}}/month and includes:\n• Feature 1\n• Feature 2\n• Feature 3\n\nWould you like me to set up a personalized demo?',
      variables: [
        { name: 'plan', label: 'Plan Name', defaultValue: 'Professional' },
        { name: 'price', label: 'Price', defaultValue: '$99' }
      ],
      visibility: 'TEAM'
    },
    {
      categoryId: createdCategories['Sales'],
      title: 'Schedule Demo',
      shortcut: '/demo',
      content: 'I\'d be happy to schedule a demo for you, {{name}}! 📅\n\nPlease let me know your preferred date and time, and I\'ll send you a calendar invite.\n\nAlternatively, you can book directly here: {{link}}',
      variables: [
        { name: 'name', label: 'Customer Name', defaultValue: '' },
        { name: 'link', label: 'Booking Link', defaultValue: '[booking link]' }
      ],
      visibility: 'TEAM'
    },
    {
      categoryId: createdCategories['Sales'],
      title: 'Special Offer',
      shortcut: '/offer',
      content: '🎁 Great news, {{name}}!\n\nWe\'re currently offering {{discount}}% off on {{product}} for a limited time.\n\nThis offer is valid until {{expiry}}. Would you like to take advantage of it?',
      variables: [
        { name: 'name', label: 'Customer Name', defaultValue: '' },
        { name: 'discount', label: 'Discount %', defaultValue: '20' },
        { name: 'product', label: 'Product', defaultValue: 'our premium plan' },
        { name: 'expiry', label: 'Expiry Date', defaultValue: 'end of this month' }
      ],
      visibility: 'TEAM'
    },

    // Support
    {
      categoryId: createdCategories['Support'],
      title: 'Issue Acknowledgment',
      shortcut: '/ack',
      content: 'I understand the issue you\'re facing, {{name}}. I\'m sorry for the inconvenience.\n\nLet me look into this right away. I\'ll get back to you within {{time}} with a solution.',
      variables: [
        { name: 'name', label: 'Customer Name', defaultValue: '' },
        { name: 'time', label: 'Response Time', defaultValue: '30 minutes' }
      ],
      visibility: 'TEAM'
    },
    {
      categoryId: createdCategories['Support'],
      title: 'Troubleshooting Steps',
      shortcut: '/troubleshoot',
      content: 'Let\'s try a few troubleshooting steps:\n\n1. {{step1}}\n2. {{step2}}\n3. {{step3}}\n\nPlease let me know if this resolves the issue, or if you need further assistance.',
      variables: [
        { name: 'step1', label: 'Step 1', defaultValue: 'Clear your browser cache' },
        { name: 'step2', label: 'Step 2', defaultValue: 'Try logging out and back in' },
        { name: 'step3', label: 'Step 3', defaultValue: 'Try a different browser' }
      ],
      visibility: 'TEAM'
    },
    {
      categoryId: createdCategories['Support'],
      title: 'Issue Resolved',
      shortcut: '/resolved',
      content: 'Great news, {{name}}! 🎉\n\nI\'m pleased to confirm that the issue has been resolved. Here\'s what we did:\n\n{{solution}}\n\nPlease let me know if you have any other questions!',
      variables: [
        { name: 'name', label: 'Customer Name', defaultValue: '' },
        { name: 'solution', label: 'Solution Summary', defaultValue: 'Applied the fix' }
      ],
      visibility: 'TEAM'
    },
    {
      categoryId: createdCategories['Support'],
      title: 'Escalation Notice',
      shortcut: '/escalate',
      content: 'I\'ve escalated your issue to our {{team}} team, {{name}}.\n\nThey will review it with priority and get back to you within {{time}}.\n\nTicket Reference: {{ticket}}',
      variables: [
        { name: 'name', label: 'Customer Name', defaultValue: '' },
        { name: 'team', label: 'Team Name', defaultValue: 'senior support' },
        { name: 'time', label: 'Response Time', defaultValue: '24 hours' },
        { name: 'ticket', label: 'Ticket Number', defaultValue: '#12345' }
      ],
      visibility: 'TEAM'
    },

    // Follow-up
    {
      categoryId: createdCategories['Follow-up'],
      title: 'Check-in After Demo',
      shortcut: '/followdemo',
      content: 'Hi {{name}}! 👋\n\nI wanted to follow up on the demo we had {{when}}.\n\nDo you have any questions about what we covered? I\'m happy to provide more information or help you get started.',
      variables: [
        { name: 'name', label: 'Customer Name', defaultValue: '' },
        { name: 'when', label: 'Demo Date', defaultValue: 'recently' }
      ],
      visibility: 'TEAM'
    },
    {
      categoryId: createdCategories['Follow-up'],
      title: 'Proposal Follow-up',
      shortcut: '/followproposal',
      content: 'Hi {{name}},\n\nI wanted to check in regarding the proposal I sent on {{date}}.\n\nHave you had a chance to review it? I\'d be happy to answer any questions or make adjustments based on your feedback.',
      variables: [
        { name: 'name', label: 'Customer Name', defaultValue: '' },
        { name: 'date', label: 'Proposal Date', defaultValue: '[date]' }
      ],
      visibility: 'TEAM'
    },
    {
      categoryId: createdCategories['Follow-up'],
      title: 'Gentle Reminder',
      shortcut: '/remind',
      content: 'Hi {{name}},\n\nJust a gentle reminder about {{topic}}.\n\nPlease let me know if you need any additional information or if there\'s anything I can help with.',
      variables: [
        { name: 'name', label: 'Customer Name', defaultValue: '' },
        { name: 'topic', label: 'Topic', defaultValue: 'our previous conversation' }
      ],
      visibility: 'TEAM'
    },

    // Closing
    {
      categoryId: createdCategories['Closing'],
      title: 'Deal Confirmation',
      shortcut: '/confirm',
      content: 'Wonderful, {{name}}! 🎉\n\nI\'m thrilled to confirm your order for {{product}}.\n\nHere are the next steps:\n1. {{step1}}\n2. {{step2}}\n\nWelcome aboard!',
      variables: [
        { name: 'name', label: 'Customer Name', defaultValue: '' },
        { name: 'product', label: 'Product/Plan', defaultValue: '' },
        { name: 'step1', label: 'Next Step 1', defaultValue: 'You\'ll receive a confirmation email' },
        { name: 'step2', label: 'Next Step 2', defaultValue: 'Our team will reach out for onboarding' }
      ],
      visibility: 'TEAM'
    },
    {
      categoryId: createdCategories['Closing'],
      title: 'Thank You & Goodbye',
      shortcut: '/bye',
      content: 'Thank you for chatting with us today, {{name}}! 🙏\n\nIf you have any more questions in the future, don\'t hesitate to reach out. Have a wonderful day!',
      variables: [
        { name: 'name', label: 'Customer Name', defaultValue: '' }
      ],
      visibility: 'TEAM'
    },

    // General
    {
      categoryId: createdCategories['General'],
      title: 'Out of Office',
      shortcut: '/ooo',
      content: 'Thank you for your message! 📩\n\nI\'m currently out of office and will return on {{date}}. For urgent matters, please contact {{contact}}.\n\nI\'ll respond to your message as soon as I\'m back.',
      variables: [
        { name: 'date', label: 'Return Date', defaultValue: '[date]' },
        { name: 'contact', label: 'Alternative Contact', defaultValue: 'our support team' }
      ],
      visibility: 'TEAM'
    },
    {
      categoryId: createdCategories['General'],
      title: 'Hold Please',
      shortcut: '/hold',
      content: 'Please hold on for a moment while I {{action}}. I\'ll be right back! ⏳',
      variables: [
        { name: 'action', label: 'Action', defaultValue: 'look into this' }
      ],
      visibility: 'TEAM'
    },
    {
      categoryId: createdCategories['General'],
      title: 'Need More Info',
      shortcut: '/moreinfo',
      content: 'To better assist you, could you please provide:\n\n• {{info1}}\n• {{info2}}\n\nThis will help me give you the most accurate answer.',
      variables: [
        { name: 'info1', label: 'Info 1', defaultValue: 'Your account email' },
        { name: 'info2', label: 'Info 2', defaultValue: 'A screenshot of the issue' }
      ],
      visibility: 'TEAM'
    },
  ]

  // Personal templates for the agent (arpit.sharma)
  const personalTemplates = [
    {
      categoryId: createdCategories['Greetings'],
      title: 'My Personal Welcome',
      shortcut: '/mywelcome',
      content: 'Hi {{name}}! 👋\n\nThis is Arpit from Helix Code. Thanks for reaching out!\n\nHow can I help you today?',
      variables: [{ name: 'name', label: 'Customer Name', defaultValue: 'there' }],
      visibility: 'PERSONAL'
    },
    {
      categoryId: createdCategories['Sales'],
      title: 'My Quick Pitch',
      shortcut: '/mypitch',
      content: 'Hey {{name}}!\n\nI noticed you were interested in {{topic}}. I\'d love to give you a quick 10-minute overview.\n\nWould tomorrow at {{time}} work for you?',
      variables: [
        { name: 'name', label: 'Customer Name', defaultValue: '' },
        { name: 'topic', label: 'Topic', defaultValue: 'our CRM' },
        { name: 'time', label: 'Time', defaultValue: '3 PM' }
      ],
      visibility: 'PERSONAL'
    },
    {
      categoryId: createdCategories['Follow-up'],
      title: 'My Follow-up',
      shortcut: '/myfu',
      content: 'Hi {{name}},\n\nArpit here! Just following up on our conversation from {{when}}.\n\nAny thoughts or questions I can help with?',
      variables: [
        { name: 'name', label: 'Customer Name', defaultValue: '' },
        { name: 'when', label: 'When', defaultValue: 'last week' }
      ],
      visibility: 'PERSONAL'
    },
    {
      categoryId: createdCategories['Closing'],
      title: 'My Signature Close',
      shortcut: '/myclose',
      content: 'Thanks so much, {{name}}! It was great chatting with you. 🙌\n\nFeel free to reach out anytime - I\'m always here to help!\n\nBest,\nArpit',
      variables: [
        { name: 'name', label: 'Customer Name', defaultValue: '' }
      ],
      visibility: 'PERSONAL'
    },
  ]

  const allTemplates = [...systemTemplates, ...personalTemplates]

  let created = 0
  let updated = 0

  for (const template of allTemplates) {
    try {
      await prisma.cannedResponse.upsert({
        where: { tenantId_shortcut: { tenantId, shortcut: template.shortcut } },
        update: {
          title: template.title,
          content: template.content,
          variables: template.variables,
          categoryId: template.categoryId,
          visibility: template.visibility
        },
        create: {
          tenantId,
          createdById,
          ...template
        }
      })
      console.log(`✓ Template: ${template.title} (${template.shortcut})`)
      created++
    } catch (err) {
      console.error(`✗ Error with ${template.title}:`, err.message)
    }
  }

  console.log(`\n✅ Done! Created/Updated ${created} templates in ${categories.length} categories.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
