/**
 * WhatsApp Service
 * Unified WhatsApp messaging via MSG91
 * Supports both BYOK (Bring Your Own Key) and Managed (Reseller) modes
 */

import { prisma } from '@crm360/database'
import { logger } from '../../logger.js'

const MSG91_CONTROL_URL = 'https://control.msg91.com/api/v5'

class WhatsAppService {
  constructor() {
    this.logger = logger.child({ service: 'WhatsAppService' })
  }

  /**
   * Get headers for MSG91 API
   */
  getHeaders(authKey) {
    return {
      'authkey': authKey,
      'Content-Type': 'application/json',
      'accept': 'application/json',
    }
  }

  // =====================
  // Channel Account Management
  // =====================

  /**
   * Connect WhatsApp channel (BYOK mode)
   * Company provides their own MSG91 API key
   */
  async connectBYOK({ tenantId, name, msg91AuthKey }) {
    // Validate the API key by fetching integrated numbers
    const numbers = await this.getIntegratedNumbers(msg91AuthKey)

    if (!numbers.success || !numbers.data?.length) {
      throw new Error('Invalid MSG91 API key or no WhatsApp numbers integrated')
    }

    const primaryNumber = numbers.data[0]
    // MSG91 returns integrated_number or number depending on the endpoint
    const phoneNum = primaryNumber.integrated_number || primaryNumber.number

    // Create channel account
    const channelAccount = await prisma.channelAccount.create({
      data: {
        tenantId,
        type: 'WHATSAPP',
        name: name || `WhatsApp - ${phoneNum}`,
        provider: 'MSG91',
        providerConfig: {
          mode: 'BYOK',
          msg91AuthKey,
          integratedNumber: phoneNum,
          businessName: primaryNumber.business_name || null,
          businessVerified: primaryNumber.verified || false,
        },
        phoneNumber: phoneNum,
        phoneNumberId: primaryNumber.id || phoneNum,
        status: 'ACTIVE',
        healthStatus: 'HEALTHY',
        lastHealthCheck: new Date(),
      },
    })

    this.logger.info({ tenantId, channelAccountId: channelAccount.id }, 'WhatsApp BYOK channel connected')

    return {
      success: true,
      channelAccount,
      integratedNumbers: numbers.data,
    }
  }

  /**
   * Connect WhatsApp channel (Managed/Reseller mode)
   * Company uses Nexora's MSG91 account
   */
  async connectManaged({ tenantId, name, phoneNumber }) {
    const nexoraAuthKey = process.env.MSG91_AUTH_KEY

    if (!nexoraAuthKey) {
      throw new Error('Nexora MSG91 auth key not configured')
    }

    // For managed mode, we use Nexora's MSG91 account
    // The phone number should be one of Nexora's integrated numbers
    // Or we create a sub-client via MSG91 reseller API

    const channelAccount = await prisma.channelAccount.create({
      data: {
        tenantId,
        type: 'WHATSAPP',
        name: name || `WhatsApp - ${phoneNumber}`,
        provider: 'MSG91_MANAGED',
        providerConfig: {
          mode: 'MANAGED',
          nexoraManaged: true,
          integratedNumber: phoneNumber,
          // We use Nexora's auth key, not stored in providerConfig
        },
        phoneNumber,
        phoneNumberId: phoneNumber,
        status: 'ACTIVE',
        healthStatus: 'HEALTHY',
        lastHealthCheck: new Date(),
      },
    })

    this.logger.info({ tenantId, channelAccountId: channelAccount.id }, 'WhatsApp Managed channel connected')

    return {
      success: true,
      channelAccount,
    }
  }

  /**
   * Get the auth key for a channel account
   * Checks multiple locations: direct field, providerConfig, and env fallback
   */
  async getAuthKey(channelAccountId) {
    const account = await prisma.channelAccount.findUnique({
      where: { id: channelAccountId },
    })

    if (!account) {
      throw new Error('Channel account not found')
    }

    // Priority order for auth key:
    // 1. Direct msg91AuthKey field on account (from Self-Service/configureWhatsApp)
    // 2. providerConfig.msg91AuthKey (from BYOK/connectBYOK)
    // 3. Environment variable (for Managed mode)
    const authKey = account.msg91AuthKey
      || account.providerConfig?.msg91AuthKey
      || process.env.MSG91_AUTH_KEY

    if (!authKey) {
      this.logger.error({ channelAccountId }, 'No MSG91 auth key found for channel account')
      throw new Error('MSG91 auth key not configured for this channel')
    }

    return authKey
  }

  /**
   * Get the integrated number for a channel account
   */
  async getIntegratedNumber(channelAccountId) {
    const account = await prisma.channelAccount.findUnique({
      where: { id: channelAccountId },
    })

    if (!account) {
      throw new Error('Channel account not found')
    }

    return account.providerConfig?.integratedNumber || account.phoneNumber
  }

  // =====================
  // MSG91 API Methods
  // =====================

  /**
   * Get integrated WhatsApp numbers from MSG91
   */
  async getIntegratedNumbers(authKey) {
    try {
      const response = await fetch(`${MSG91_CONTROL_URL}/whatsapp/whatsapp-activation/`, {
        method: 'GET',
        headers: this.getHeaders(authKey),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.message || 'Failed to fetch numbers' }
      }

      return {
        success: true,
        data: data.data || data,
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to get integrated numbers')
      return { success: false, error: error.message }
    }
  }

  /**
   * Get MSG91 wallet balance
   */
  async getBalance(authKey) {
    try {
      const response = await fetch(`${MSG91_CONTROL_URL}/user/balance/`, {
        method: 'GET',
        headers: this.getHeaders(authKey),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.message || 'Failed to fetch balance' }
      }

      // MSG91 returns balance in the response
      return {
        success: true,
        balance: data.balance || data.data?.balance || 0,
        currency: data.currency || 'INR',
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to get MSG91 balance')
      return { success: false, error: error.message }
    }
  }

  /**
   * Get WhatsApp templates for a number
   */
  async getTemplates(authKey, phoneNumber) {
    try {
      const response = await fetch(`${MSG91_CONTROL_URL}/whatsapp/get-template-client/${phoneNumber}`, {
        method: 'GET',
        headers: this.getHeaders(authKey),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.message || 'Failed to fetch templates' }
      }

      // Filter to only approved templates
      const templates = (data.data || data || []).map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        status: t.languages?.[0]?.status || t.status,
        language: t.languages?.[0]?.language || 'en',
        components: t.languages?.[0]?.code || t.components,
        variables: t.languages?.[0]?.variables || [],
      }))

      return {
        success: true,
        templates,
        approvedTemplates: templates.filter(t => t.status === 'APPROVED'),
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to get templates')
      return { success: false, error: error.message }
    }
  }

  /**
   * Send WhatsApp template message
   */
  async sendTemplate({ channelAccountId, recipient, templateName, languageCode = 'en', components = {} }) {
    const authKey = await this.getAuthKey(channelAccountId)
    const integratedNumber = await this.getIntegratedNumber(channelAccountId)
    const recipientNumber = recipient.startsWith('+') ? recipient.slice(1) : recipient

    // Build components object for to_and_components (MSG91 format)
    const templateComponents = {}
    if (components.header) {
      templateComponents.header = Array.isArray(components.header)
        ? components.header.map(v => ({ type: 'text', text: v }))
        : [{ type: 'text', text: components.header }]
    }
    if (components.body) {
      templateComponents.body = Array.isArray(components.body)
        ? components.body.map(v => ({ type: 'text', text: v }))
        : [{ type: 'text', text: components.body }]
    }

    const payload = {
      integrated_number: integratedNumber,
      content_type: 'template',
      payload: {
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode,
            policy: 'deterministic',
          },
          to_and_components: [{
            to: [recipientNumber],
            components: templateComponents,
          }],
        },
        messaging_product: 'whatsapp',
      },
    }

    try {
      const response = await fetch(`${MSG91_CONTROL_URL}/whatsapp/whatsapp-outbound-message/bulk/`, {
        method: 'POST',
        headers: this.getHeaders(authKey),
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        this.logger.error({ payload, response: data }, 'Failed to send template')
        return { success: false, error: data.message || 'Failed to send message' }
      }

      this.logger.info({ recipient, templateName, messageId: data.data?.id }, 'WhatsApp template sent')

      return {
        success: true,
        messageId: data.data?.id || data.id,
        data,
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to send template message')
      return { success: false, error: error.message }
    }
  }

  /**
   * Send WhatsApp text message (within 24-hour session window)
   * Uses the single message endpoint for session replies
   */
  async sendText({ channelAccountId, recipient, text }) {
    const authKey = await this.getAuthKey(channelAccountId)
    const integratedNumber = await this.getIntegratedNumber(channelAccountId)
    // Remove + prefix if present for MSG91
    const recipientNumber = recipient.startsWith('+') ? recipient.slice(1) : recipient
    // Also remove + from integrated number
    const senderNumber = integratedNumber.startsWith('+') ? integratedNumber.slice(1) : integratedNumber

    this.logger.info({
      channelAccountId,
      integratedNumber: senderNumber,
      recipient: recipientNumber,
      hasAuthKey: !!authKey,
    }, 'Preparing to send WhatsApp text')

    // Use the single message endpoint for session messages (not bulk)
    // MSG91 endpoint: POST /api/v5/whatsapp/whatsapp-outbound-message/
    // MSG91 expects 'text' at top level for session-based messages
    // See: https://docs.msg91.com/whatsapp/send-message-in-text
    const payload = {
      integrated_number: senderNumber,
      content_type: 'text',
      recipient_number: recipientNumber,
      text: text,
    }

    try {
      // Use the single message endpoint (without /bulk/)
      const url = `${MSG91_CONTROL_URL}/whatsapp/whatsapp-outbound-message/`
      this.logger.info({ url, payload }, 'Sending to MSG91 (single message)')

      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(authKey),
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      this.logger.info({
        status: response.status,
        ok: response.ok,
        response: data,
      }, 'MSG91 response received')

      // Check for errors
      if (!response.ok || data.type === 'error' || data.status === 'error' || data.status === 'fail' || data.hasError) {
        this.logger.error({ response: data, status: response.status }, 'MSG91 API error')
        return { success: false, error: data.message || data.errors || data.error || 'Failed to send message' }
      }

      // MSG91 returns message_uuid in data.data for successful messages
      // This ID will match the requestId in webhook delivery reports
      const messageId = data.request_id || data.data?.message_uuid || data.data?.id || data.id || data.messages?.[0]?.id
      this.logger.info({ recipient, messageId, rawResponse: data }, 'WhatsApp text sent successfully')

      return {
        success: true,
        messageId,
        data,
      }
    } catch (error) {
      this.logger.error({ error: error.message, stack: error.stack }, 'Failed to send text message')
      return { success: false, error: error.message }
    }
  }

  /**
   * Send WhatsApp media message
   */
  async sendMedia({ channelAccountId, recipient, mediaType, mediaUrl, caption }) {
    const authKey = await this.getAuthKey(channelAccountId)
    const integratedNumber = await this.getIntegratedNumber(channelAccountId)
    const recipientNumber = recipient.startsWith('+') ? recipient.slice(1) : recipient

    const payload = {
      integrated_number: integratedNumber,
      content_type: mediaType, // image, video, document, audio
      payload: {
        to: recipientNumber,
        type: mediaType,
        [mediaType]: {
          link: mediaUrl,
          ...(caption && { caption }),
        },
      },
    }

    try {
      const response = await fetch(`${MSG91_CONTROL_URL}/whatsapp/whatsapp-outbound-message/bulk/`, {
        method: 'POST',
        headers: this.getHeaders(authKey),
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.message || 'Failed to send media' }
      }

      this.logger.info({ recipient, mediaType, messageId: data.data?.id }, 'WhatsApp media sent')

      return {
        success: true,
        messageId: data.data?.id || data.id,
        data,
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to send media message')
      return { success: false, error: error.message }
    }
  }

  // =====================
  // Template Management
  // =====================

  /**
   * Create WhatsApp template
   */
  async createTemplate({ channelAccountId, templateName, category, language, components }) {
    const authKey = await this.getAuthKey(channelAccountId)
    const integratedNumber = await this.getIntegratedNumber(channelAccountId)

    const payload = {
      integrated_number: integratedNumber,
      template_name: templateName,
      language: language || 'en',
      category: category || 'MARKETING',
      components: components || [],
    }

    try {
      const response = await fetch(`${MSG91_CONTROL_URL}/whatsapp/client-panel-template/`, {
        method: 'POST',
        headers: this.getHeaders(authKey),
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.message || 'Failed to create template' }
      }

      this.logger.info({ templateName, templateId: data.template_id }, 'WhatsApp template created')

      return {
        success: true,
        templateId: data.template_id,
        message: 'Template created, pending WhatsApp approval',
        data,
      }
    } catch (error) {
      this.logger.error({ error }, 'Failed to create template')
      return { success: false, error: error.message }
    }
  }

  /**
   * Delete WhatsApp template
   */
  async deleteTemplate({ channelAccountId, templateName }) {
    const authKey = await this.getAuthKey(channelAccountId)
    const integratedNumber = await this.getIntegratedNumber(channelAccountId)

    const payload = {
      integrated_number: integratedNumber,
      template_name: templateName,
    }

    try {
      const response = await fetch(`${MSG91_CONTROL_URL}/whatsapp/client-panel-template/`, {
        method: 'DELETE',
        headers: this.getHeaders(authKey),
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.message || 'Failed to delete template' }
      }

      this.logger.info({ templateName }, 'WhatsApp template deleted')

      return { success: true, data }
    } catch (error) {
      this.logger.error({ error }, 'Failed to delete template')
      return { success: false, error: error.message }
    }
  }

  // =====================
  // Webhook Handling
  // =====================

  /**
   * Process incoming webhook from MSG91
   */
  async processWebhook(channelAccountId, payload) {
    const account = await prisma.channelAccount.findUnique({
      where: { id: channelAccountId },
    })

    if (!account) {
      throw new Error('Channel account not found')
    }

    // Parse the webhook based on type
    const messageType = payload.type || payload.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.type

    if (payload.status || payload.statuses) {
      // Status update (sent, delivered, read, failed)
      return this.processStatusWebhook(account, payload)
    } else if (payload.messages || payload.entry) {
      // Incoming message
      return this.processIncomingMessage(account, payload)
    }

    this.logger.warn({ payload }, 'Unknown webhook type')
    return { success: false, error: 'Unknown webhook type' }
  }

  /**
   * Process status webhook (delivery reports)
   */
  async processStatusWebhook(account, payload) {
    const statuses = payload.statuses || payload.entry?.[0]?.changes?.[0]?.value?.statuses || []

    for (const status of statuses) {
      const messageId = status.id
      const newStatus = status.status?.toUpperCase() // sent, delivered, read, failed

      // Update message status in database
      await prisma.message.updateMany({
        where: { externalId: messageId },
        data: {
          status: newStatus,
          ...(newStatus === 'DELIVERED' && { deliveredAt: new Date() }),
          ...(newStatus === 'READ' && { readAt: new Date() }),
          ...(newStatus === 'FAILED' && {
            errorCode: status.errors?.[0]?.code,
            errorMessage: status.errors?.[0]?.title,
          }),
        },
      })

      this.logger.info({ messageId, status: newStatus }, 'WhatsApp status updated')
    }

    return { success: true, processed: statuses.length }
  }

  /**
   * Process incoming message
   */
  async processIncomingMessage(account, payload) {
    const messages = payload.messages || payload.entry?.[0]?.changes?.[0]?.value?.messages || []
    const contacts = payload.contacts || payload.entry?.[0]?.changes?.[0]?.value?.contacts || []

    for (const msg of messages) {
      const from = msg.from
      const contact = contacts.find(c => c.wa_id === from)

      const messageData = {
        tenantId: account.tenantId,
        channelAccountId: account.id,
        externalId: msg.id,
        direction: 'INBOUND',
        channel: 'WHATSAPP',
        from,
        to: account.phoneNumber,
        content: this.extractMessageContent(msg),
        contentType: msg.type?.toUpperCase() || 'TEXT',
        mediaUrl: this.extractMediaUrl(msg),
        mediaType: this.extractMediaType(msg),
        status: 'RECEIVED',
        receivedAt: new Date(parseInt(msg.timestamp) * 1000),
        metadata: {
          contactName: contact?.profile?.name,
          messageType: msg.type,
          raw: msg,
        },
      }

      // Create message record
      const message = await prisma.message.create({
        data: messageData,
      })

      // Find or create contact
      await this.upsertContact(account.tenantId, from, contact?.profile?.name)

      this.logger.info({ messageId: message.id, from }, 'WhatsApp message received')
    }

    return { success: true, processed: messages.length }
  }

  /**
   * Extract content from message based on type
   */
  extractMessageContent(msg) {
    switch (msg.type) {
      case 'text':
        return msg.text?.body || ''
      case 'image':
        return msg.image?.caption || '[Image]'
      case 'video':
        return msg.video?.caption || '[Video]'
      case 'audio':
        return '[Audio]'
      case 'document':
        return msg.document?.filename || '[Document]'
      case 'location':
        return `[Location: ${msg.location?.latitude}, ${msg.location?.longitude}]`
      case 'contacts':
        return '[Contact shared]'
      case 'interactive':
        return msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '[Interactive]'
      default:
        return `[${msg.type || 'Unknown'}]`
    }
  }

  /**
   * Extract media URL from message based on type
   */
  extractMediaUrl(msg) {
    switch (msg.type) {
      case 'image':
        return msg.image?.link || msg.image?.url || msg.image?.id || null
      case 'video':
        return msg.video?.link || msg.video?.url || msg.video?.id || null
      case 'audio':
        return msg.audio?.link || msg.audio?.url || msg.audio?.id || null
      case 'document':
        return msg.document?.link || msg.document?.url || msg.document?.id || null
      case 'sticker':
        return msg.sticker?.link || msg.sticker?.url || msg.sticker?.id || null
      default:
        return null
    }
  }

  /**
   * Extract media type from message
   */
  extractMediaType(msg) {
    const type = msg.type?.toLowerCase()
    if (['image', 'video', 'audio', 'document', 'sticker'].includes(type)) {
      return type
    }
    return null
  }

  /**
   * Find or create contact from WhatsApp message
   */
  async upsertContact(tenantId, phoneNumber, name) {
    // Normalize phone number
    const normalizedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`

    // Try to find existing contact
    let contact = await prisma.contact.findFirst({
      where: {
        tenantId,
        phone: normalizedPhone,
      },
    })

    if (!contact && name) {
      // Create new contact
      contact = await prisma.contact.create({
        data: {
          tenantId,
          phone: normalizedPhone,
          firstName: name.split(' ')[0] || '',
          lastName: name.split(' ').slice(1).join(' ') || '',
          source: 'WHATSAPP',
          status: 'ACTIVE',
        },
      })

      this.logger.info({ contactId: contact.id, phone: normalizedPhone }, 'Contact created from WhatsApp')
    }

    return contact
  }

  // =====================
  // Health Check
  // =====================

  /**
   * Check channel health
   */
  async checkHealth(channelAccountId) {
    try {
      const authKey = await this.getAuthKey(channelAccountId)
      const numbers = await this.getIntegratedNumbers(authKey)

      const isHealthy = numbers.success && numbers.data?.length > 0

      await prisma.channelAccount.update({
        where: { id: channelAccountId },
        data: {
          healthStatus: isHealthy ? 'HEALTHY' : 'UNHEALTHY',
          lastHealthCheck: new Date(),
        },
      })

      return {
        success: true,
        healthy: isHealthy,
        numbers: numbers.data?.length || 0,
      }
    } catch (error) {
      await prisma.channelAccount.update({
        where: { id: channelAccountId },
        data: {
          healthStatus: 'ERROR',
          lastHealthCheck: new Date(),
        },
      })

      return {
        success: false,
        healthy: false,
        error: error.message,
      }
    }
  }
}

export const whatsAppService = new WhatsAppService()
