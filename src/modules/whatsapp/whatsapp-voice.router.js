/**
 * WhatsApp Voice Calling Router
 *
 * STATUS: DISABLED - Endpoints prepared for future implementation
 *
 * These endpoints will be enabled when voice calling feature is activated.
 * All endpoints currently return 503 Service Unavailable.
 *
 * Routes:
 * GET  /api/v1/whatsapp/voice/info                    - Get voice feature info (always accessible)
 * GET  /api/v1/whatsapp/voice/settings/:id            - Get voice settings for channel
 * POST /api/v1/whatsapp/voice/enable                  - Enable voice calling
 * POST /api/v1/whatsapp/voice/disable                 - Disable voice calling
 * GET  /api/v1/whatsapp/voice/history/:conversationId - Get call history
 */

import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '@crm360/database'
import { whatsAppVoiceService } from '../../common/providers/whatsapp/whatsapp-voice.service.js'
import { VOICE_CALLING_ENABLED } from '../../common/providers/whatsapp/whatsapp-voice.config.js'

const router = Router()

// =====================
// Validation Schemas
// =====================

const channelIdSchema = z.object({
  channelAccountId: z.string().min(1),
})

const conversationIdSchema = z.object({
  conversationId: z.string().min(1),
})

// =====================
// Middleware
// =====================

/**
 * Middleware to check if voice calling is enabled
 * Skips check for /info endpoint
 */
const checkVoiceEnabled = (req, res, next) => {
  // Allow /info endpoint to pass through
  if (req.path === '/info' || req.path === '/') {
    return next()
  }

  if (!VOICE_CALLING_ENABLED) {
    return res.status(503).json({
      success: false,
      error: 'FEATURE_DISABLED',
      message: 'WhatsApp voice calling is not currently available',
      featureInfo: whatsAppVoiceService.getFeatureInfo(),
    })
  }
  next()
}

// Apply middleware to all routes
router.use(checkVoiceEnabled)

// =====================
// Feature Info (Always Accessible)
// =====================

/**
 * Get voice calling feature information
 * This endpoint is always accessible, even when feature is disabled
 */
router.get('/info', async (req, res) => {
  res.json({
    success: true,
    data: whatsAppVoiceService.getFeatureInfo(),
  })
})

// =====================
// Voice Settings
// =====================

/**
 * Get voice calling settings for a channel
 */
router.get('/settings/:channelAccountId', async (req, res, next) => {
  try {
    const { tenantId } = req
    const { channelAccountId } = req.params

    // Validate params
    channelIdSchema.parse({ channelAccountId })

    // Get channel account and verify ownership
    const channelAccount = await prisma.channelAccount.findFirst({
      where: { id: channelAccountId, tenantId, type: 'WHATSAPP' },
    })

    if (!channelAccount) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'WhatsApp channel account not found',
      })
    }

    const authKey = channelAccount.msg91AuthKey ||
      channelAccount.providerConfig?.msg91AuthKey ||
      process.env.MSG91_AUTH_KEY

    if (!authKey) {
      return res.status(400).json({
        success: false,
        error: 'NO_AUTH_KEY',
        message: 'MSG91 auth key not configured for this channel',
      })
    }

    const result = await whatsAppVoiceService.getVoiceSettings(
      authKey,
      channelAccount.phoneNumber
    )

    res.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        details: error.errors,
      })
    }
    next(error)
  }
})

/**
 * Enable voice calling for a channel
 */
router.post('/enable', async (req, res, next) => {
  try {
    const { tenantId } = req
    const data = channelIdSchema.parse(req.body)

    // Get channel account and verify ownership
    const channelAccount = await prisma.channelAccount.findFirst({
      where: { id: data.channelAccountId, tenantId, type: 'WHATSAPP' },
    })

    if (!channelAccount) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'WhatsApp channel account not found',
      })
    }

    const authKey = channelAccount.msg91AuthKey ||
      channelAccount.providerConfig?.msg91AuthKey ||
      process.env.MSG91_AUTH_KEY

    if (!authKey) {
      return res.status(400).json({
        success: false,
        error: 'NO_AUTH_KEY',
        message: 'MSG91 auth key not configured for this channel',
      })
    }

    const result = await whatsAppVoiceService.enableVoiceCalling(
      authKey,
      channelAccount.phoneNumber
    )

    if (result.success) {
      // Update channel account to reflect voice enabled
      await prisma.channelAccount.update({
        where: { id: data.channelAccountId },
        data: {
          providerConfig: {
            ...channelAccount.providerConfig,
            voiceEnabled: true,
            voiceEnabledAt: new Date().toISOString(),
          },
        },
      })
    }

    res.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        details: error.errors,
      })
    }
    next(error)
  }
})

/**
 * Disable voice calling for a channel
 */
router.post('/disable', async (req, res, next) => {
  try {
    const { tenantId } = req
    const data = channelIdSchema.parse(req.body)

    // Get channel account and verify ownership
    const channelAccount = await prisma.channelAccount.findFirst({
      where: { id: data.channelAccountId, tenantId, type: 'WHATSAPP' },
    })

    if (!channelAccount) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'WhatsApp channel account not found',
      })
    }

    const authKey = channelAccount.msg91AuthKey ||
      channelAccount.providerConfig?.msg91AuthKey ||
      process.env.MSG91_AUTH_KEY

    if (!authKey) {
      return res.status(400).json({
        success: false,
        error: 'NO_AUTH_KEY',
        message: 'MSG91 auth key not configured for this channel',
      })
    }

    const result = await whatsAppVoiceService.disableVoiceCalling(
      authKey,
      channelAccount.phoneNumber
    )

    if (result.success) {
      // Update channel account to reflect voice disabled
      await prisma.channelAccount.update({
        where: { id: data.channelAccountId },
        data: {
          providerConfig: {
            ...channelAccount.providerConfig,
            voiceEnabled: false,
            voiceDisabledAt: new Date().toISOString(),
          },
        },
      })
    }

    res.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        details: error.errors,
      })
    }
    next(error)
  }
})

// =====================
// Call History
// =====================

/**
 * Get call history for a conversation
 */
router.get('/history/:conversationId', async (req, res, next) => {
  try {
    const { tenantId } = req
    const { conversationId } = req.params

    // Validate params
    conversationIdSchema.parse({ conversationId })

    // Verify conversation belongs to tenant
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    })

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Conversation not found',
      })
    }

    const result = await whatsAppVoiceService.getCallHistory(conversationId)
    res.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        details: error.errors,
      })
    }
    next(error)
  }
})

export { router as whatsAppVoiceRouter }
