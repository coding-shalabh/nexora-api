/**
 * MSG91 Test Router
 * API endpoints for testing MSG91 integration
 *
 * Routes:
 * POST /api/v1/test/msg91/auth              - Test authentication
 * POST /api/v1/test/msg91/sms               - Send test SMS
 * POST /api/v1/test/msg91/sms/flow          - Send SMS via Flow
 * GET  /api/v1/test/msg91/sms/report/:id    - Get SMS report
 *
 * WhatsApp:
 * POST /api/v1/test/msg91/whatsapp/template        - Send WhatsApp template message
 * POST /api/v1/test/msg91/whatsapp/message         - Send WhatsApp session message
 * GET  /api/v1/test/msg91/whatsapp/numbers         - Get integrated WhatsApp numbers
 * GET  /api/v1/test/msg91/whatsapp/templates       - Get all WhatsApp templates
 * POST /api/v1/test/msg91/whatsapp/template/create - Create new WhatsApp template
 * DELETE /api/v1/test/msg91/whatsapp/template/delete - Delete WhatsApp template
 * GET  /api/v1/test/msg91/whatsapp/template/status - Check template approval status
 *
 * Voice:
 * POST /api/v1/test/msg91/voice/sms     - Send Voice SMS
 * POST /api/v1/test/msg91/voice/flow    - Execute Voice flow
 * POST /api/v1/test/msg91/voice/c2c     - Click-to-call
 * GET  /api/v1/test/msg91/voice/logs    - Get Voice logs
 *
 * Email:
 * POST /api/v1/test/msg91/email         - Send Email
 * POST /api/v1/test/msg91/email/validate - Validate Email
 * GET  /api/v1/test/msg91/email/templates - Get Email templates
 *
 * GET  /api/v1/test/msg91/all           - Run all tests
 */

import { Router } from 'express'
import { z } from 'zod'
import { MSG91TestService } from '../../common/providers/msg91/index.js'

const router = Router()

// Schema definitions
const authTestSchema = z.object({
  authKey: z.string().optional(),
})

const smsTestSchema = z.object({
  authKey: z.string().optional(),
  mobile: z.string().min(10, 'Mobile number is required'),
  senderId: z.string().min(3).max(6),
  message: z.string().min(1),
  route: z.enum(['1', '4']).optional().default('4'),
  country: z.string().optional().default('91'),
  dltTemplateId: z.string().optional(),
})

const smsFlowTestSchema = z.object({
  authKey: z.string().optional(),
  flowId: z.string().min(1, 'Flow ID is required'),
  mobile: z.string().min(10),
  senderId: z.string().min(3).max(6),
  variables: z.record(z.string()).optional().default({}),
})

const whatsappTemplateSchema = z.object({
  authKey: z.string().optional(),
  integratedNumber: z.string().min(10),
  recipient: z.string().min(10),
  templateName: z.string().min(1),
  languageCode: z.string().optional().default('en'),
  components: z.record(z.any()).optional().default({}),
})

const whatsappMessageSchema = z.object({
  authKey: z.string().optional(),
  integratedNumber: z.string().min(10),
  recipient: z.string().min(10),
  message: z.string().min(1),
})

const voiceSmsSchema = z.object({
  authKey: z.string().optional(),
  mobile: z.string().min(10),
  message: z.string().min(1),
  voice: z.enum(['male', 'female']).optional().default('female'),
  language: z.string().optional().default('en'),
})

const voiceFlowSchema = z.object({
  authKey: z.string().optional(),
  flowId: z.string().min(1),
  mobile: z.string().min(10),
  variables: z.record(z.string()).optional().default({}),
})

const clickToCallSchema = z.object({
  authKey: z.string().optional(),
  from: z.string().min(10),
  to: z.string().min(10),
  callerId: z.string().optional(),
})

const emailSchema = z.object({
  authKey: z.string().optional(),
  to: z.string().email(),
  from: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  fromName: z.string().optional(),
  templateId: z.string().optional(),
  variables: z.record(z.string()).optional().default({}),
})

const emailValidateSchema = z.object({
  authKey: z.string().optional(),
  email: z.string().email(),
})

// WhatsApp template creation schema
const createTemplateSchema = z.object({
  authKey: z.string().optional(),
  integratedNumber: z.string().min(10),
  templateName: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Template name must be lowercase with underscores only'),
  language: z.string().optional().default('en'),
  category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']).optional().default('MARKETING'),
  components: z.array(z.object({
    type: z.enum(['HEADER', 'BODY', 'FOOTER', 'BUTTONS']),
    format: z.string().optional(),
    text: z.string().optional(),
    buttons: z.array(z.any()).optional(),
    example: z.any().optional(),
  })).optional().default([]),
})

const deleteTemplateSchema = z.object({
  authKey: z.string().optional(),
  integratedNumber: z.string().min(10),
  templateName: z.string().min(1),
})

// Helper to get MSG91 service instance
function getService(authKey) {
  return new MSG91TestService(authKey || process.env.MSG91_AUTH_KEY)
}

// =====================
// Authentication Test
// =====================

router.post('/auth', async (req, res, next) => {
  try {
    const { authKey } = authTestSchema.parse(req.body)
    const service = getService(authKey)
    const result = await service.validateAuth()

    res.json({
      success: result.success,
      data: result,
      message: result.success ? 'MSG91 authentication successful' : 'Authentication failed',
    })
  } catch (error) {
    next(error)
  }
})

// =====================
// SMS Tests
// =====================

router.post('/sms', async (req, res, next) => {
  try {
    const { authKey, ...params } = smsTestSchema.parse(req.body)
    const service = getService(authKey)
    const result = await service.sendSMS(params)

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
      message: result.success ? 'SMS sent successfully' : 'Failed to send SMS',
    })
  } catch (error) {
    next(error)
  }
})

router.post('/sms/flow', async (req, res, next) => {
  try {
    const { authKey, ...params } = smsFlowTestSchema.parse(req.body)
    const service = getService(authKey)
    const result = await service.sendSMSFlow(params)

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
      message: result.success ? 'SMS Flow executed successfully' : 'Failed to execute SMS flow',
    })
  } catch (error) {
    next(error)
  }
})

router.get('/sms/report/:requestId', async (req, res, next) => {
  try {
    const requestId = req.params.requestId
    const authKey = req.query.authKey
    const service = getService(authKey)
    const result = await service.getSMSReport(requestId)

    res.json({
      success: result.success,
      data: result,
    })
  } catch (error) {
    next(error)
  }
})

// =====================
// WhatsApp Tests
// =====================

router.post('/whatsapp/template', async (req, res, next) => {
  try {
    const { authKey, ...params } = whatsappTemplateSchema.parse(req.body)
    const service = getService(authKey)
    const result = await service.sendWhatsAppTemplate(params)

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
      message: result.success ? 'WhatsApp template sent successfully' : 'Failed to send WhatsApp template',
    })
  } catch (error) {
    next(error)
  }
})

router.post('/whatsapp/message', async (req, res, next) => {
  try {
    const { authKey, ...params } = whatsappMessageSchema.parse(req.body)
    const service = getService(authKey)
    const result = await service.sendWhatsAppMessage(params)

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
      message: result.success ? 'WhatsApp message sent successfully' : 'Failed to send WhatsApp message',
    })
  } catch (error) {
    next(error)
  }
})

router.get('/whatsapp/numbers', async (req, res, next) => {
  try {
    const authKey = req.query.authKey
    const service = getService(authKey)
    const result = await service.getWhatsAppNumbers()

    res.json({
      success: result.success,
      data: result,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/whatsapp/templates', async (req, res, next) => {
  try {
    const authKey = req.query.authKey
    const phoneNumber = req.query.phoneNumber

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber query parameter is required',
      })
    }

    const service = getService(authKey)
    const result = await service.getWhatsAppTemplates(phoneNumber)

    res.json({
      success: result.success,
      data: result,
    })
  } catch (error) {
    next(error)
  }
})

// Create WhatsApp template
router.post('/whatsapp/template/create', async (req, res, next) => {
  try {
    const { authKey, ...params } = createTemplateSchema.parse(req.body)
    const service = getService(authKey)
    const result = await service.createWhatsAppTemplate(params)

    res.status(result.success ? 201 : 400).json({
      success: result.success,
      data: result,
      message: result.success
        ? `Template "${params.templateName}" created successfully. Status: PENDING (awaiting WhatsApp approval)`
        : 'Failed to create template',
    })
  } catch (error) {
    next(error)
  }
})

// Delete WhatsApp template
router.delete('/whatsapp/template/delete', async (req, res, next) => {
  try {
    const { authKey, ...params } = deleteTemplateSchema.parse(req.body)
    const service = getService(authKey)
    const result = await service.deleteWhatsAppTemplate(params)

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
      message: result.success
        ? `Template "${params.templateName}" deleted successfully`
        : 'Failed to delete template',
    })
  } catch (error) {
    next(error)
  }
})

// Get template status by name
router.get('/whatsapp/template/status', async (req, res, next) => {
  try {
    const authKey = req.query.authKey
    const phoneNumber = req.query.phoneNumber
    const templateName = req.query.templateName

    if (!phoneNumber || !templateName) {
      return res.status(400).json({
        success: false,
        error: 'phoneNumber and templateName query parameters are required',
      })
    }

    const service = getService(authKey)
    const result = await service.getWhatsAppTemplates(phoneNumber)

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to fetch templates',
        data: result,
      })
    }

    // Find the specific template by name
    const templates = result.templates || result.data?.data || []
    const template = templates.find(t => t.name === templateName || t.template_name === templateName)

    if (!template) {
      return res.json({
        success: true,
        found: false,
        message: `Template "${templateName}" not found`,
        availableTemplates: templates.map(t => {
          const lang = t.languages?.[0]
          return {
            name: t.name || t.template_name,
            status: lang?.status || t.status,
          }
        }),
      })
    }

    // Status is nested inside languages array
    const languageData = template.languages?.[0]
    const status = languageData?.status || template.status || 'UNKNOWN'
    const rejectionReason = languageData?.rejection_reason

    res.json({
      success: true,
      found: true,
      template: {
        name: template.name || template.template_name,
        status,
        category: template.category,
        language: languageData?.language || template.language,
        components: languageData?.code || template.components,
        id: languageData?.id || template.id || template.template_id,
        rejectionReason: rejectionReason !== 'NONE' ? rejectionReason : null,
        variables: languageData?.variables || [],
      },
      isApproved: status === 'APPROVED',
      isPending: status === 'PENDING',
      isRejected: status === 'REJECTED',
      message: status === 'APPROVED'
        ? 'Template is approved and ready to use'
        : status === 'PENDING'
          ? 'Template is pending WhatsApp approval (usually takes 24-48 hours)'
          : status === 'REJECTED'
            ? `Template was rejected: ${rejectionReason}`
            : `Template status: ${status}`,
    })
  } catch (error) {
    next(error)
  }
})

// =====================
// Voice Tests
// =====================

router.post('/voice/sms', async (req, res, next) => {
  try {
    const { authKey, ...params } = voiceSmsSchema.parse(req.body)
    const service = getService(authKey)
    const result = await service.sendVoiceSMS(params)

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
      message: result.success ? 'Voice SMS sent successfully' : 'Failed to send Voice SMS',
    })
  } catch (error) {
    next(error)
  }
})

router.post('/voice/flow', async (req, res, next) => {
  try {
    const { authKey, ...params } = voiceFlowSchema.parse(req.body)
    const service = getService(authKey)
    const result = await service.executeVoiceFlow(params)

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
      message: result.success ? 'Voice flow executed successfully' : 'Failed to execute voice flow',
    })
  } catch (error) {
    next(error)
  }
})

router.post('/voice/c2c', async (req, res, next) => {
  try {
    const { authKey, ...params } = clickToCallSchema.parse(req.body)
    const service = getService(authKey)
    const result = await service.clickToCall(params)

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
      message: result.success ? 'Click-to-call initiated successfully' : 'Failed to initiate call',
    })
  } catch (error) {
    next(error)
  }
})

router.get('/voice/logs', async (req, res, next) => {
  try {
    const authKey = req.query.authKey
    const from = req.query.from
    const to = req.query.to
    const service = getService(authKey)
    const result = await service.getVoiceLogs({ from, to })

    res.json({
      success: result.success,
      data: result,
    })
  } catch (error) {
    next(error)
  }
})

// =====================
// Email Tests
// =====================

router.post('/email', async (req, res, next) => {
  try {
    const { authKey, ...params } = emailSchema.parse(req.body)
    const service = getService(authKey)
    const result = await service.sendEmail(params)

    res.status(result.success ? 200 : 400).json({
      success: result.success,
      data: result,
      message: result.success ? 'Email sent successfully' : 'Failed to send email',
    })
  } catch (error) {
    next(error)
  }
})

router.post('/email/validate', async (req, res, next) => {
  try {
    const { authKey, email } = emailValidateSchema.parse(req.body)
    const service = getService(authKey)
    const result = await service.validateEmail(email)

    res.json({
      success: result.success,
      data: result,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/email/templates', async (req, res, next) => {
  try {
    const authKey = req.query.authKey
    const service = getService(authKey)
    const result = await service.getEmailTemplates()

    res.json({
      success: result.success,
      data: result,
    })
  } catch (error) {
    next(error)
  }
})

// =====================
// Run All Tests
// =====================

router.get('/all', async (req, res, next) => {
  try {
    const authKey = req.query.authKey
    const whatsappNumber = req.query.whatsappNumber

    const service = getService(authKey)
    const results = await service.runAllTests({
      whatsapp: {
        enabled: true,
        integratedNumber: whatsappNumber,
      },
      voice: { enabled: true },
      email: { enabled: true },
    })

    res.json({
      success: true,
      data: results,
    })
  } catch (error) {
    next(error)
  }
})

export { router as msg91TestRouter }
