/**
 * WhatsApp Voice Calling Service (MSG91)
 *
 * STATUS: DISABLED - Prepared for future implementation
 *
 * This service handles WhatsApp voice calling features via MSG91.
 * Voice calling is currently disabled and will be enabled in a future release.
 *
 * ========================================
 * MSG91 WHATSAPP VOICE CALLING - DOCUMENTATION
 * ========================================
 *
 * OVERVIEW:
 * ---------
 * MSG91 supports WhatsApp inbound voice calling through Meta's Cloud API.
 * This allows customers to call businesses directly through WhatsApp,
 * providing a more personal touch to customer service interactions.
 *
 * REQUIREMENTS:
 * -------------
 * 1. WhatsApp Business Account (WABA) must be connected to MSG91
 * 2. Account must be at 1000+ messages/day tier (Standard tier or above)
 * 3. Voice calling must be enabled via MSG91 API or dashboard
 * 4. Customer must have messaged the business first (within 24-hour window)
 *
 * LIMITATIONS:
 * ------------
 * 1. INBOUND ONLY: Businesses cannot initiate calls to customers
 *    - Only customers can call businesses
 *    - This is a Meta/WhatsApp platform restriction, not MSG91
 *
 * 2. CALL DURATION: Maximum 25 minutes per call
 *    - Calls automatically disconnect after 25 minutes
 *    - This is a WhatsApp platform limitation
 *
 * 3. SESSION REQUIREMENT: Customer must have messaged within 24 hours
 *    - Similar to the messaging window rule
 *    - Call button only appears if there's an active session
 *
 * 4. NO NATIVE CALL RECORDING:
 *    - Meta's WhatsApp Cloud API does NOT support native call recording
 *    - MSG91 does not provide call recording for WhatsApp calls
 *    - Call recording would require third-party solutions (see CALL_RECORDING section)
 *
 * 5. NO VIDEO CALLING:
 *    - WhatsApp Business API only supports voice calls
 *    - Video calling is not available through the API
 *
 * PRICING:
 * --------
 * - Currently: FREE (promotional period)
 * - Future pricing: Expected ~$0.01 (1 cent) per minute
 * - Pricing is per-minute billing based on call duration
 * - Pricing may vary by country/region
 *
 * API ENDPOINTS:
 * --------------
 * 1. Enable Voice Calling:
 *    POST https://control.msg91.com/api/v5/whatsapp/integrated-number/call-settings/
 *    Headers: { authkey: 'YOUR_AUTH_KEY', Content-Type: 'application/json' }
 *    Body: { integrated_number: 'PHONE_NUMBER', voice_enabled: true }
 *
 * 2. Disable Voice Calling:
 *    POST https://control.msg91.com/api/v5/whatsapp/integrated-number/call-settings/
 *    Headers: { authkey: 'YOUR_AUTH_KEY', Content-Type: 'application/json' }
 *    Body: { integrated_number: 'PHONE_NUMBER', voice_enabled: false }
 *
 * 3. Get Voice Settings:
 *    GET https://control.msg91.com/api/v5/whatsapp/integrated-number/call-settings/
 *    Headers: { authkey: 'YOUR_AUTH_KEY' }
 *    Query: integrated_number=PHONE_NUMBER
 *
 * WEBHOOK EVENTS:
 * ---------------
 * When a voice call event occurs, MSG91 sends webhooks:
 *
 * 1. Call Initiated:
 *    {
 *      "type": "voice",
 *      "event": "call_initiated",
 *      "from": "CUSTOMER_PHONE",
 *      "to": "BUSINESS_PHONE",
 *      "call_id": "UNIQUE_CALL_ID",
 *      "timestamp": 1234567890
 *    }
 *
 * 2. Call Connected:
 *    {
 *      "type": "voice",
 *      "event": "call_connected",
 *      "call_id": "UNIQUE_CALL_ID",
 *      "timestamp": 1234567890
 *    }
 *
 * 3. Call Ended:
 *    {
 *      "type": "voice",
 *      "event": "call_ended",
 *      "call_id": "UNIQUE_CALL_ID",
 *      "duration": 120, // seconds
 *      "end_reason": "user_hangup" | "timeout" | "error",
 *      "timestamp": 1234567890
 *    }
 *
 * CALL RECORDING (ALTERNATIVE SOLUTIONS):
 * ---------------------------------------
 * Since Meta's WhatsApp API doesn't support native call recording,
 * here are alternative approaches if recording is needed:
 *
 * 1. Third-Party Recording Solutions:
 *    - Use a call recording middleware/proxy
 *    - Requires custom SIP integration
 *    - Legal considerations apply (consent requirements)
 *
 * 2. Customer Consent Flow:
 *    - Always inform customers calls may be recorded
 *    - Obtain explicit consent before proceeding
 *    - Store consent records for compliance
 *
 * 3. Alternative: Switch to Regular Phone Calls:
 *    - Use TeleCMI or similar for regular phone calls with recording
 *    - More expensive but full recording support
 *    - Separate from WhatsApp conversation flow
 *
 * IMPLEMENTATION NOTES:
 * ---------------------
 * When enabling this feature:
 *
 * 1. Database Schema:
 *    - Add VoiceCall model to track call history
 *    - Add voiceEnabled field to ChannelAccount
 *    - Add call_id to Message model for call references
 *
 * 2. Webhook Handling:
 *    - Add voice call webhook handlers
 *    - Store call events in call history
 *    - Update conversation with call activity
 *
 * 3. UI Updates:
 *    - Show call button in inbox when voice is enabled
 *    - Display call history in conversation
 *    - Show call status indicators
 *
 * 4. Settings:
 *    - Add voice calling toggle in channel settings
 *    - Configure voice webhooks in MSG91 dashboard
 *
 * @see https://docs.msg91.com/whatsapp/voice-calling
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api/reference/voice
 */

import { prisma } from '@crm360/database'
import { logger } from '../../logger.js'

const MSG91_CONTROL_URL = 'https://control.msg91.com/api/v5'

// Feature flag - Set to true to enable voice calling
const VOICE_CALLING_ENABLED = false

class WhatsAppVoiceService {
  constructor() {
    this.logger = logger.child({ service: 'WhatsAppVoiceService' })
    this.enabled = VOICE_CALLING_ENABLED
  }

  /**
   * Check if voice calling feature is enabled
   */
  isEnabled() {
    return this.enabled
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

  /**
   * Enable voice calling for a WhatsApp number
   *
   * @param {string} authKey - MSG91 API key
   * @param {string} integratedNumber - WhatsApp phone number
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async enableVoiceCalling(authKey, integratedNumber) {
    if (!this.enabled) {
      return {
        success: false,
        error: 'Voice calling feature is currently disabled',
        reason: 'FEATURE_DISABLED'
      }
    }

    try {
      const response = await fetch(`${MSG91_CONTROL_URL}/whatsapp/integrated-number/call-settings/`, {
        method: 'POST',
        headers: this.getHeaders(authKey),
        body: JSON.stringify({
          integrated_number: integratedNumber,
          voice_enabled: true,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        this.logger.error({ response: data }, 'Failed to enable voice calling')
        return { success: false, error: data.message || 'Failed to enable voice calling' }
      }

      this.logger.info({ integratedNumber }, 'Voice calling enabled')
      return { success: true, data }
    } catch (error) {
      this.logger.error({ error }, 'Error enabling voice calling')
      return { success: false, error: error.message }
    }
  }

  /**
   * Disable voice calling for a WhatsApp number
   *
   * @param {string} authKey - MSG91 API key
   * @param {string} integratedNumber - WhatsApp phone number
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async disableVoiceCalling(authKey, integratedNumber) {
    if (!this.enabled) {
      return {
        success: false,
        error: 'Voice calling feature is currently disabled',
        reason: 'FEATURE_DISABLED'
      }
    }

    try {
      const response = await fetch(`${MSG91_CONTROL_URL}/whatsapp/integrated-number/call-settings/`, {
        method: 'POST',
        headers: this.getHeaders(authKey),
        body: JSON.stringify({
          integrated_number: integratedNumber,
          voice_enabled: false,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        this.logger.error({ response: data }, 'Failed to disable voice calling')
        return { success: false, error: data.message || 'Failed to disable voice calling' }
      }

      this.logger.info({ integratedNumber }, 'Voice calling disabled')
      return { success: true, data }
    } catch (error) {
      this.logger.error({ error }, 'Error disabling voice calling')
      return { success: false, error: error.message }
    }
  }

  /**
   * Get voice calling settings for a WhatsApp number
   *
   * @param {string} authKey - MSG91 API key
   * @param {string} integratedNumber - WhatsApp phone number
   * @returns {Promise<{success: boolean, voiceEnabled?: boolean, error?: string}>}
   */
  async getVoiceSettings(authKey, integratedNumber) {
    if (!this.enabled) {
      return {
        success: false,
        error: 'Voice calling feature is currently disabled',
        reason: 'FEATURE_DISABLED'
      }
    }

    try {
      const url = new URL(`${MSG91_CONTROL_URL}/whatsapp/integrated-number/call-settings/`)
      url.searchParams.set('integrated_number', integratedNumber)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: this.getHeaders(authKey),
      })

      const data = await response.json()

      if (!response.ok) {
        this.logger.error({ response: data }, 'Failed to get voice settings')
        return { success: false, error: data.message || 'Failed to get voice settings' }
      }

      return {
        success: true,
        voiceEnabled: data.voice_enabled || false,
        data
      }
    } catch (error) {
      this.logger.error({ error }, 'Error getting voice settings')
      return { success: false, error: error.message }
    }
  }

  /**
   * Process voice call webhook event
   *
   * @param {object} payload - Webhook payload from MSG91
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async processVoiceWebhook(channelAccountId, payload) {
    if (!this.enabled) {
      this.logger.warn({ payload }, 'Received voice webhook but feature is disabled')
      return { success: false, reason: 'FEATURE_DISABLED' }
    }

    const { type, event, call_id, from, to, duration, end_reason, timestamp } = payload

    if (type !== 'voice') {
      return { success: false, error: 'Not a voice event' }
    }

    try {
      switch (event) {
        case 'call_initiated':
          await this.handleCallInitiated(channelAccountId, { call_id, from, to, timestamp })
          break

        case 'call_connected':
          await this.handleCallConnected(channelAccountId, { call_id, timestamp })
          break

        case 'call_ended':
          await this.handleCallEnded(channelAccountId, { call_id, duration, end_reason, timestamp })
          break

        default:
          this.logger.warn({ event, payload }, 'Unknown voice call event')
          return { success: false, error: `Unknown event: ${event}` }
      }

      return { success: true }
    } catch (error) {
      this.logger.error({ error, payload }, 'Error processing voice webhook')
      return { success: false, error: error.message }
    }
  }

  /**
   * Handle call initiated event
   * @private
   */
  async handleCallInitiated(channelAccountId, { call_id, from, to, timestamp }) {
    this.logger.info({ channelAccountId, call_id, from, to }, 'Voice call initiated')

    // TODO: When enabling, implement:
    // 1. Create VoiceCall record
    // 2. Find/create conversation
    // 3. Add call initiated message to conversation
    // 4. Send real-time notification via WebSocket
  }

  /**
   * Handle call connected event
   * @private
   */
  async handleCallConnected(channelAccountId, { call_id, timestamp }) {
    this.logger.info({ channelAccountId, call_id }, 'Voice call connected')

    // TODO: When enabling, implement:
    // 1. Update VoiceCall record status to 'connected'
    // 2. Update call start time
    // 3. Send real-time notification via WebSocket
  }

  /**
   * Handle call ended event
   * @private
   */
  async handleCallEnded(channelAccountId, { call_id, duration, end_reason, timestamp }) {
    this.logger.info({ channelAccountId, call_id, duration, end_reason }, 'Voice call ended')

    // TODO: When enabling, implement:
    // 1. Update VoiceCall record status to 'ended'
    // 2. Store call duration and end reason
    // 3. Add call summary message to conversation
    // 4. Create activity record
    // 5. Send real-time notification via WebSocket
  }

  /**
   * Get call history for a conversation
   *
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<{success: boolean, calls?: array, error?: string}>}
   */
  async getCallHistory(conversationId) {
    if (!this.enabled) {
      return { success: true, calls: [], message: 'Voice calling is not enabled' }
    }

    // TODO: When enabling, implement:
    // 1. Query VoiceCall records for this conversation
    // 2. Return call history with duration, status, timestamps

    return { success: true, calls: [] }
  }

  /**
   * Get voice calling feature info and requirements
   * Useful for displaying in settings UI
   */
  getFeatureInfo() {
    return {
      enabled: this.enabled,
      name: 'WhatsApp Voice Calling',
      provider: 'MSG91',
      requirements: [
        'WhatsApp Business Account (WABA) connected to MSG91',
        'Standard tier (1000+ messages/day) or above',
        'Voice calling enabled via MSG91 dashboard or API',
      ],
      limitations: [
        'Inbound calls only - customers initiate calls to business',
        'Maximum call duration: 25 minutes',
        'Customer must have messaged within 24 hours',
        'No native call recording support',
        'Voice only - no video calling support',
      ],
      pricing: {
        current: 'Free (promotional period)',
        expected: '$0.01/minute (per-minute billing)',
        note: 'Pricing may vary by country/region',
      },
      callRecording: {
        supported: false,
        reason: 'Meta WhatsApp Cloud API does not support native call recording',
        alternatives: [
          'Third-party SIP-based recording solutions',
          'Switch to regular phone calls (TeleCMI) for recording support',
        ],
      },
      webhookEvents: ['call_initiated', 'call_connected', 'call_ended'],
      documentation: 'https://docs.msg91.com/whatsapp/voice-calling',
    }
  }
}

// Export singleton instance
export const whatsAppVoiceService = new WhatsAppVoiceService()

// Export class for testing
export { WhatsAppVoiceService }
