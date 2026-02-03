/**
 * MSG91 Test Service
 * Direct API testing for MSG91 channels: SMS, WhatsApp, Voice, Email
 *
 * API Documentation: https://docs.msg91.com/
 */

const MSG91_BASE_URL = 'https://api.msg91.com/api/v5'
const MSG91_CONTROL_URL = 'https://control.msg91.com/api/v5'

class MSG91TestService {
  constructor(authKey) {
    this.authKey = authKey || process.env.MSG91_AUTH_KEY
    this.baseUrl = MSG91_BASE_URL
    this.controlUrl = MSG91_CONTROL_URL
  }

  /**
   * Get common headers for MSG91 API
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'authkey': this.authKey,
    }
  }

  // =====================
  // Authentication Test
  // =====================

  /**
   * Validate authentication by testing the API with a dummy request
   * Note: balance.json may be IP-restricted, so we use flow endpoint for validation
   * @returns {Promise<{success: boolean, balance?: number, error?: string}>}
   */
  async validateAuth() {
    try {
      // Try balance endpoint first (may be IP-restricted)
      const balanceResponse = await fetch(`${this.baseUrl}/balance.json?type=1`, {
        method: 'GET',
        headers: this.getHeaders(),
      })

      // Check if we got HTML (403 Forbidden due to IP restriction)
      const contentType = balanceResponse.headers.get('content-type') || ''
      if (contentType.includes('text/html')) {
        // IP restricted - try flow endpoint to validate auth
        const flowResponse = await fetch(`${this.baseUrl}/flow/`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ flow_id: 'test_validation', mobiles: '919999999999' }),
        })

        const flowData = await flowResponse.json()

        // If we get "invalid flow ID" error, auth is valid but flow doesn't exist
        if (flowData.message?.includes('flow ID') || flowData.message?.includes('template ID')) {
          return {
            success: true,
            message: 'Authentication successful (validated via flow API)',
            note: 'Balance API is IP-restricted. Whitelist your IP in MSG91 dashboard for full access.',
          }
        }

        // Check for auth errors
        if (flowData.message?.toLowerCase().includes('auth') || flowData.code === '101') {
          return {
            success: false,
            error: 'Invalid authentication key',
            code: flowData.code,
          }
        }

        return {
          success: true,
          message: 'Authentication validated',
          data: flowData,
        }
      }

      const data = await balanceResponse.json()

      if (balanceResponse.ok && data.balance !== undefined) {
        return {
          success: true,
          balance: data.balance,
          message: 'Authentication successful',
        }
      } else {
        return {
          success: false,
          error: data.message || 'Authentication failed',
          code: data.code,
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  // =====================
  // SMS API
  // =====================

  /**
   * Send SMS via MSG91
   * @param {Object} params - SMS parameters
   * @param {string} params.mobile - Recipient mobile number with country code
   * @param {string} params.senderId - Sender ID (6 characters for India)
   * @param {string} params.message - SMS content
   * @param {string} [params.route] - Route type: 4 (transactional), 1 (promotional)
   * @param {string} [params.country] - Country code (default: 91)
   * @param {string} [params.dltTemplateId] - DLT Template ID (required for India)
   * @returns {Promise<Object>}
   */
  async sendSMS({ mobile, senderId, message, route = '4', country = '91', dltTemplateId }) {
    try {
      const payload = {
        sender: senderId,
        route,
        country,
        sms: [{
          message,
          to: [mobile],
        }],
      }

      // Add DLT Template ID if provided (required for India)
      if (dltTemplateId) {
        payload.DLT_TE_ID = dltTemplateId
      }

      const response = await fetch(`${this.baseUrl}/flow/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      return {
        success: response.ok && data.type === 'success',
        requestId: data.request_id,
        message: data.message,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Send SMS using Flow (Template)
   * @param {Object} params - Flow parameters
   * @param {string} params.flowId - Flow ID from MSG91
   * @param {string} params.mobile - Recipient mobile number
   * @param {string} params.senderId - Sender ID
   * @param {Object} params.variables - Template variables
   * @returns {Promise<Object>}
   */
  async sendSMSFlow({ flowId, mobile, senderId, variables = {} }) {
    try {
      const payload = {
        flow_id: flowId,
        sender: senderId,
        mobiles: mobile,
        ...variables,
      }

      const response = await fetch(`${this.baseUrl}/flow/`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      return {
        success: response.ok && data.type === 'success',
        requestId: data.request_id,
        message: data.message,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get SMS delivery report
   * @param {string} requestId - Request ID from send response
   * @returns {Promise<Object>}
   */
  async getSMSReport(requestId) {
    try {
      const response = await fetch(`${this.baseUrl}/report.json?request_id=${requestId}`, {
        method: 'GET',
        headers: this.getHeaders(),
      })

      const data = await response.json()

      return {
        success: response.ok,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  // =====================
  // WhatsApp API
  // =====================

  /**
   * Send WhatsApp template message
   * Uses control.msg91.com for WhatsApp API
   * @param {Object} params - WhatsApp parameters
   * @param {string} params.integratedNumber - Your WhatsApp Business number
   * @param {string} params.recipient - Recipient phone number with country code
   * @param {string} params.templateName - Template name
   * @param {string} params.languageCode - Language code (e.g., 'en')
   * @param {Array} [params.components] - Template variable components
   * @returns {Promise<Object>}
   */
  async sendWhatsAppTemplate({ integratedNumber, recipient, templateName, languageCode = 'en', components = {} }) {
    try {
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
              to: [recipient],
              components,
            }],
          },
          messaging_product: 'whatsapp',
        },
      }

      const response = await fetch(`${this.controlUrl}/whatsapp/whatsapp-outbound-message/bulk/`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'accept': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      return {
        success: response.ok && (data.type === 'success' || data.message_id),
        messageId: data.message_id || data.messageId,
        message: data.message,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Send WhatsApp text message (only works within 24-hour session window)
   * @param {Object} params - WhatsApp parameters
   * @param {string} params.integratedNumber - Your WhatsApp Business number
   * @param {string} params.recipient - Recipient phone number
   * @param {string} params.message - Text message content
   * @returns {Promise<Object>}
   */
  async sendWhatsAppMessage({ integratedNumber, recipient, message }) {
    try {
      const payload = {
        integrated_number: integratedNumber,
        content_type: 'text',
        recipient,
        text: {
          body: message,
        },
      }

      const response = await fetch(`${this.baseUrl}/whatsapp/sendMessage`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      return {
        success: response.ok && data.type === 'success',
        messageId: data.messageId,
        message: data.message,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get WhatsApp phone numbers associated with account
   * Uses control.msg91.com endpoint
   * @returns {Promise<Object>}
   */
  async getWhatsAppNumbers() {
    try {
      const response = await fetch(`${this.controlUrl}/whatsapp/whatsapp-activation/`, {
        method: 'GET',
        headers: {
          ...this.getHeaders(),
          'accept': 'application/json',
        },
      })

      const data = await response.json()

      return {
        success: data.status === 'success',
        numbers: data.data || [],
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get WhatsApp templates
   * Uses control.msg91.com endpoint
   * @param {string} phoneNumber - WhatsApp Business phone number
   * @returns {Promise<Object>}
   */
  async getWhatsAppTemplates(phoneNumber) {
    try {
      const response = await fetch(`${this.controlUrl}/whatsapp/get-template-client/${phoneNumber}`, {
        method: 'GET',
        headers: {
          ...this.getHeaders(),
          'accept': 'application/json',
        },
      })

      const data = await response.json()

      return {
        success: response.ok,
        templates: data.data || data.templates || [],
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Create WhatsApp template
   * Templates need approval from WhatsApp before they can be used
   * @param {Object} params - Template parameters
   * @param {string} params.integratedNumber - Your WhatsApp Business number
   * @param {string} params.templateName - Unique template name (lowercase, underscores)
   * @param {string} params.language - Language code (e.g., 'en', 'en_US')
   * @param {string} params.category - MARKETING, UTILITY, or AUTHENTICATION
   * @param {Array} params.components - Template components (HEADER, BODY, FOOTER, BUTTONS)
   * @returns {Promise<Object>}
   */
  async createWhatsAppTemplate({ integratedNumber, templateName, language = 'en', category = 'MARKETING', components = [] }) {
    try {
      const payload = {
        integrated_number: integratedNumber,
        template_name: templateName,
        language,
        category,
        components,
      }

      const response = await fetch(`${this.controlUrl}/whatsapp/client-panel-template/`, {
        method: 'POST',
        headers: {
          ...this.getHeaders(),
          'accept': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      return {
        success: data.status === 'success',
        templateId: data.data?.template_id,
        message: data.data?.message || data.message,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Delete WhatsApp template
   * @param {Object} params - Delete parameters
   * @param {string} params.integratedNumber - Your WhatsApp Business number
   * @param {string} params.templateName - Template name to delete
   * @returns {Promise<Object>}
   */
  async deleteWhatsAppTemplate({ integratedNumber, templateName }) {
    try {
      const response = await fetch(`${this.controlUrl}/whatsapp/delete-template/`, {
        method: 'DELETE',
        headers: {
          ...this.getHeaders(),
          'accept': 'application/json',
        },
        body: JSON.stringify({
          integrated_number: integratedNumber,
          template_name: templateName,
        }),
      })

      const data = await response.json()

      return {
        success: data.status === 'success',
        message: data.message,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  // =====================
  // Voice API
  // =====================

  /**
   * Send Voice SMS (Text-to-Speech call)
   * @param {Object} params - Voice parameters
   * @param {string} params.mobile - Recipient mobile number
   * @param {string} params.message - Message to be spoken
   * @param {string} [params.voice] - Voice type: male/female
   * @param {string} [params.language] - Language code (e.g., 'en')
   * @returns {Promise<Object>}
   */
  async sendVoiceSMS({ mobile, message, voice = 'female', language = 'en' }) {
    try {
      const payload = {
        mobile,
        message,
        voice,
        language,
      }

      const response = await fetch(`${this.baseUrl}/voice/sendVoice`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      return {
        success: response.ok && data.type === 'success',
        requestId: data.request_id,
        message: data.message,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Execute Voice IVR/Flow
   * @param {Object} params - Voice flow parameters
   * @param {string} params.flowId - Voice flow ID
   * @param {string} params.mobile - Recipient mobile number
   * @param {Object} [params.variables] - Flow variables
   * @returns {Promise<Object>}
   */
  async executeVoiceFlow({ flowId, mobile, variables = {} }) {
    try {
      const payload = {
        flow_id: flowId,
        mobile,
        ...variables,
      }

      const response = await fetch(`${this.baseUrl}/voice/flow`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      return {
        success: response.ok && data.type === 'success',
        requestId: data.request_id,
        message: data.message,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Initiate Click-to-Call
   * @param {Object} params - Click-to-call parameters
   * @param {string} params.from - Caller number
   * @param {string} params.to - Recipient number
   * @param {string} [params.callerId] - Caller ID to display
   * @returns {Promise<Object>}
   */
  async clickToCall({ from, to, callerId }) {
    try {
      const payload = {
        from,
        to,
        caller_id: callerId,
      }

      const response = await fetch(`${this.baseUrl}/voice/c2c`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      return {
        success: response.ok && data.type === 'success',
        callId: data.call_id,
        message: data.message,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get Voice logs
   * @param {Object} [params] - Filter parameters
   * @param {string} [params.from] - Start date (YYYY-MM-DD)
   * @param {string} [params.to] - End date (YYYY-MM-DD)
   * @returns {Promise<Object>}
   */
  async getVoiceLogs({ from, to } = {}) {
    try {
      let url = `${this.baseUrl}/voice/logs?`
      if (from) url += `from=${from}&`
      if (to) url += `to=${to}&`

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      })

      const data = await response.json()

      return {
        success: response.ok,
        logs: data.data || data.logs,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  // =====================
  // Email API
  // =====================

  /**
   * Send Email via MSG91
   * @param {Object} params - Email parameters
   * @param {string} params.to - Recipient email address
   * @param {string} params.from - Sender email address (must be verified domain)
   * @param {string} params.subject - Email subject
   * @param {string} params.body - Email body (HTML or text)
   * @param {string} [params.fromName] - Sender display name
   * @param {string} [params.templateId] - Template ID to use
   * @param {Object} [params.variables] - Template variables
   * @returns {Promise<Object>}
   */
  async sendEmail({ to, from, subject, body, fromName, templateId, variables = {} }) {
    try {
      const payload = {
        to: [{ email: to }],
        from: { email: from, name: fromName || from },
        subject,
        body,
        ...(templateId && { template_id: templateId }),
        ...(Object.keys(variables).length > 0 && { variables }),
      }

      const response = await fetch(`${this.baseUrl}/email/send`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      return {
        success: response.ok && data.type === 'success',
        messageId: data.message_id || data.messageId,
        message: data.message,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Validate email address
   * @param {string} email - Email address to validate
   * @returns {Promise<Object>}
   */
  async validateEmail(email) {
    try {
      const response = await fetch(`${this.baseUrl}/email/validate?email=${encodeURIComponent(email)}`, {
        method: 'GET',
        headers: this.getHeaders(),
      })

      const data = await response.json()

      return {
        success: response.ok,
        valid: data.valid,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  /**
   * Get email templates
   * @returns {Promise<Object>}
   */
  async getEmailTemplates() {
    try {
      const response = await fetch(`${this.baseUrl}/email/templates`, {
        method: 'GET',
        headers: this.getHeaders(),
      })

      const data = await response.json()

      return {
        success: response.ok,
        templates: data.templates || data.data,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      }
    }
  }

  // =====================
  // Utility Methods
  // =====================

  /**
   * Run all channel tests
   * @param {Object} testConfig - Test configuration
   * @returns {Promise<Object>}
   */
  async runAllTests(testConfig = {}) {
    const results = {
      timestamp: new Date().toISOString(),
      authKey: this.authKey ? '***' + this.authKey.slice(-4) : 'NOT SET',
      tests: {},
    }

    // Test Authentication
    console.log('\n🔐 Testing Authentication...')
    results.tests.auth = await this.validateAuth()
    console.log(results.tests.auth.success ? '✅ Auth OK' : '❌ Auth Failed')

    // Test WhatsApp Numbers
    if (testConfig.whatsapp?.enabled !== false) {
      console.log('\n📱 Testing WhatsApp API...')
      results.tests.whatsappNumbers = await this.getWhatsAppNumbers()
      console.log(results.tests.whatsappNumbers.success ? '✅ WhatsApp Numbers OK' : '❌ WhatsApp Numbers Failed')

      if (testConfig.whatsapp?.integratedNumber) {
        results.tests.whatsappTemplates = await this.getWhatsAppTemplates(testConfig.whatsapp.integratedNumber)
        console.log(results.tests.whatsappTemplates.success ? '✅ WhatsApp Templates OK' : '❌ WhatsApp Templates Failed')
      }
    }

    // Test Voice Logs
    if (testConfig.voice?.enabled !== false) {
      console.log('\n📞 Testing Voice API...')
      results.tests.voiceLogs = await this.getVoiceLogs()
      console.log(results.tests.voiceLogs.success ? '✅ Voice Logs OK' : '❌ Voice Logs Failed')
    }

    // Test Email Templates
    if (testConfig.email?.enabled !== false) {
      console.log('\n📧 Testing Email API...')
      results.tests.emailTemplates = await this.getEmailTemplates()
      console.log(results.tests.emailTemplates.success ? '✅ Email Templates OK' : '❌ Email Templates Failed')
    }

    return results
  }
}

// Export singleton and class
export const msg91TestService = new MSG91TestService()
export { MSG91TestService }
