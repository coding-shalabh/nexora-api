/**
 * WhatsApp Voice Calling Configuration
 *
 * STATUS: DISABLED - Configuration prepared for future implementation
 *
 * This file contains configuration constants and schema definitions
 * for the WhatsApp voice calling feature.
 */

// ========================================
// FEATURE FLAGS
// ========================================

/**
 * Master switch for voice calling feature
 * Set to true to enable voice calling across the platform
 */
export const VOICE_CALLING_ENABLED = false

/**
 * Allow per-tenant voice calling toggle
 * When true, tenants can enable/disable voice calling individually
 */
export const VOICE_CALLING_PER_TENANT = false

// ========================================
// API ENDPOINTS
// ========================================

export const MSG91_VOICE_ENDPOINTS = {
  // Enable/disable voice calling for a number
  CALL_SETTINGS: 'https://control.msg91.com/api/v5/whatsapp/integrated-number/call-settings/',

  // Voice webhooks endpoint (configure in MSG91 dashboard)
  WEBHOOK_PATH: '/api/v1/webhooks/msg91/voice',
}

// ========================================
// VOICE CALL STATUS
// ========================================

export const VoiceCallStatus = {
  INITIATED: 'INITIATED',    // Call request received
  RINGING: 'RINGING',        // Call is ringing
  CONNECTED: 'CONNECTED',    // Call connected, in progress
  ENDED: 'ENDED',            // Call ended normally
  MISSED: 'MISSED',          // Call was not answered
  FAILED: 'FAILED',          // Call failed to connect
  CANCELLED: 'CANCELLED',    // Call was cancelled by caller
}

// ========================================
// VOICE CALL END REASONS
// ========================================

export const VoiceCallEndReason = {
  USER_HANGUP: 'user_hangup',       // User ended the call
  AGENT_HANGUP: 'agent_hangup',     // Agent ended the call
  TIMEOUT: 'timeout',               // Call reached 25 min limit
  NO_ANSWER: 'no_answer',           // Call not answered
  BUSY: 'busy',                     // Line was busy
  ERROR: 'error',                   // Technical error
  CANCELLED: 'cancelled',           // Caller cancelled
}

// ========================================
// LIMITS
// ========================================

export const VOICE_LIMITS = {
  // Maximum call duration in seconds (25 minutes)
  MAX_CALL_DURATION_SECONDS: 25 * 60, // 1500 seconds

  // Ring timeout in seconds before marking as missed
  RING_TIMEOUT_SECONDS: 60,

  // Session window requirement (customer must have messaged within this time)
  SESSION_WINDOW_HOURS: 24,
}

// ========================================
// PRICING (Reference only - actual pricing from MSG91)
// ========================================

export const VOICE_PRICING = {
  // Current promotional pricing
  CURRENT: {
    perMinute: 0,
    currency: 'USD',
    note: 'Free during promotional period',
  },

  // Expected future pricing
  EXPECTED: {
    perMinute: 0.01,
    currency: 'USD',
    billingIncrement: 60, // Billed per minute
    note: 'Expected pricing after promotional period',
  },
}

// ========================================
// FUTURE DATABASE SCHEMA
// ========================================

/**
 * VoiceCall Model (to be added to Prisma schema when enabling)
 *
 * model VoiceCall {
 *   id              String   @id @default(cuid())
 *   tenantId        String
 *   tenant          Tenant   @relation(fields: [tenantId], references: [id])
 *
 *   // Call identifiers
 *   callId          String   @unique // MSG91 call ID
 *   conversationId  String?
 *   conversation    ConversationThread? @relation(fields: [conversationId], references: [id])
 *
 *   // Participants
 *   from            String   // Caller phone number
 *   to              String   // Business phone number
 *   contactId       String?
 *   contact         Contact? @relation(fields: [contactId], references: [id])
 *
 *   // Channel
 *   channelAccountId String
 *   channelAccount  ChannelAccount @relation(fields: [channelAccountId], references: [id])
 *
 *   // Call details
 *   direction       String   @default("INBOUND") // Always INBOUND for WhatsApp
 *   status          String   // VoiceCallStatus enum
 *   duration        Int?     // Duration in seconds
 *   endReason       String?  // VoiceCallEndReason enum
 *
 *   // Timestamps
 *   initiatedAt     DateTime
 *   connectedAt     DateTime?
 *   endedAt         DateTime?
 *
 *   // Metadata
 *   metadata        Json?
 *
 *   createdAt       DateTime @default(now())
 *   updatedAt       DateTime @updatedAt
 *
 *   @@index([tenantId])
 *   @@index([conversationId])
 *   @@index([contactId])
 *   @@index([callId])
 *   @@index([status])
 * }
 */

/**
 * ChannelAccount additions (when enabling voice)
 *
 * Add to ChannelAccount model:
 *   voiceEnabled    Boolean  @default(false)
 *   voiceSettings   Json?    // Voice-specific configuration
 */

// ========================================
// WEBHOOK PAYLOAD TYPES
// ========================================

/**
 * @typedef {Object} VoiceWebhookPayload
 * @property {'voice'} type - Always 'voice' for voice events
 * @property {string} event - Event type: call_initiated, call_connected, call_ended
 * @property {string} call_id - Unique call identifier
 * @property {string} [from] - Caller phone number (on call_initiated)
 * @property {string} [to] - Business phone number (on call_initiated)
 * @property {number} [duration] - Call duration in seconds (on call_ended)
 * @property {string} [end_reason] - Why call ended (on call_ended)
 * @property {number} timestamp - Unix timestamp of event
 */

/**
 * Example webhook payloads:
 *
 * Call Initiated:
 * {
 *   "type": "voice",
 *   "event": "call_initiated",
 *   "call_id": "wamid.abc123",
 *   "from": "919876543210",
 *   "to": "919123456789",
 *   "timestamp": 1699000000
 * }
 *
 * Call Connected:
 * {
 *   "type": "voice",
 *   "event": "call_connected",
 *   "call_id": "wamid.abc123",
 *   "timestamp": 1699000010
 * }
 *
 * Call Ended:
 * {
 *   "type": "voice",
 *   "event": "call_ended",
 *   "call_id": "wamid.abc123",
 *   "duration": 120,
 *   "end_reason": "user_hangup",
 *   "timestamp": 1699000130
 * }
 */

// ========================================
// UI CONFIGURATION
// ========================================

export const VOICE_UI_CONFIG = {
  // Show voice call button in inbox
  showCallButton: false,

  // Show call history in conversation
  showCallHistory: false,

  // Show voice settings in channel configuration
  showVoiceSettings: false,

  // Enable voice call notifications
  enableCallNotifications: false,
}

// ========================================
// ACTIVITY TYPES FOR VOICE CALLS
// ========================================

/**
 * Activity types to add when enabling (add to ActivityType enum):
 *
 * VOICE_CALL_RECEIVED   - Incoming call received
 * VOICE_CALL_ANSWERED   - Call was answered
 * VOICE_CALL_MISSED     - Call was missed
 * VOICE_CALL_ENDED      - Call ended with duration
 */

export const VOICE_ACTIVITY_TYPES = {
  RECEIVED: 'VOICE_CALL_RECEIVED',
  ANSWERED: 'VOICE_CALL_ANSWERED',
  MISSED: 'VOICE_CALL_MISSED',
  ENDED: 'VOICE_CALL_ENDED',
}

// ========================================
// CALL RECORDING NOTES
// ========================================

/**
 * IMPORTANT: Call Recording Limitations
 *
 * Meta's WhatsApp Cloud API does NOT support native call recording.
 * This is a platform limitation, not a MSG91 limitation.
 *
 * If call recording is required, consider:
 *
 * 1. Third-Party SIP Recording:
 *    - Route calls through a SIP gateway with recording
 *    - Adds latency and complexity
 *    - Legal consent requirements apply
 *
 * 2. Alternative Communication Channel:
 *    - Use regular phone calls (TeleCMI, Twilio, etc.)
 *    - Full recording support available
 *    - Separate from WhatsApp conversation flow
 *
 * 3. Manual Recording Disclosure:
 *    - Inform customers calls are not recorded
 *    - Provide option to switch to recorded call
 *    - Document important points during call
 *
 * Legal Requirements:
 *    - Many jurisdictions require consent for call recording
 *    - One-party vs two-party consent laws vary
 *    - Always consult legal counsel before implementing recording
 */
