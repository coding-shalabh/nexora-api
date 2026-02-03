import { Router } from 'express';
import { z } from 'zod';
import { sesDomainService } from '../../services/ses-domain.service.js';

const router = Router();

// Validation helper
const validate = (schema) => (req, res, next) => {
  try {
    req.validatedBody = schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: error.errors?.[0]?.message || 'Invalid request data',
    });
  }
};

// ============================================
// DOMAIN MANAGEMENT ENDPOINTS
// ============================================

/**
 * GET /email-domains
 * List all domains for the tenant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const domains = await sesDomainService.getTenantDomains(tenantId);

    return res.json({
      success: true,
      data: domains,
    });
  } catch (error) {
    console.error('Get domains error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch domains',
    });
  }
});

/**
 * GET /email-domains/sending
 * Get the current sending domain configuration
 */
router.get('/sending', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const sendingConfig = await sesDomainService.getSendingDomain(tenantId);

    return res.json({
      success: true,
      data: sendingConfig,
    });
  } catch (error) {
    console.error('Get sending domain error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch sending domain',
    });
  }
});

/**
 * GET /email-domains/:id
 * Get domain details with DNS records
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const domainId = req.params.id;

    const domain = await sesDomainService.getDomainDetails(tenantId, domainId);

    return res.json({
      success: true,
      data: domain,
    });
  } catch (error) {
    console.error('Get domain details error:', error);
    return res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message || 'Failed to fetch domain details',
    });
  }
});

// Add domain schema
const addDomainSchema = z.object({
  domain: z
    .string()
    .min(3)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/, 'Invalid domain format'),
  fromEmail: z.string().email().optional(),
  fromName: z.string().max(100).optional(),
});

/**
 * POST /email-domains
 * Add a new domain for verification
 */
router.post('/', validate(addDomainSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const { domain, fromEmail, fromName } = req.validatedBody;

    // Check if user has admin permissions
    if (req.roleLevel < 9) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only admins can add custom domains',
      });
    }

    const result = await sesDomainService.addDomain(tenantId, domain, {
      fromEmail,
      fromName,
    });

    return res.status(201).json({
      success: true,
      data: result,
      message: 'Domain added. Please add the DNS records to verify ownership.',
    });
  } catch (error) {
    console.error('Add domain error:', error);
    return res.status(500).json({
      success: false,
      error: 'ADD_FAILED',
      message: error.message || 'Failed to add domain',
    });
  }
});

/**
 * POST /email-domains/:id/verify
 * Check/refresh domain verification status
 */
router.post('/:id/verify', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const domainId = req.params.id;

    const result = await sesDomainService.checkDomainStatus(tenantId, domainId);

    return res.json({
      success: true,
      data: result,
      message:
        result.status === 'VERIFIED'
          ? 'Domain verified successfully!'
          : 'Verification in progress. Please ensure DNS records are added.',
    });
  } catch (error) {
    console.error('Verify domain error:', error);
    return res.status(500).json({
      success: false,
      error: 'VERIFY_FAILED',
      message: error.message || 'Failed to verify domain',
    });
  }
});

/**
 * POST /email-domains/:id/set-default
 * Set a domain as the default sending domain
 */
router.post('/:id/set-default', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const domainId = req.params.id;

    // Check if user has admin permissions
    if (req.roleLevel < 9) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only admins can change default domain',
      });
    }

    const result = await sesDomainService.setDefaultDomain(tenantId, domainId);

    return res.json({
      success: true,
      data: result,
      message: 'Default domain updated',
    });
  } catch (error) {
    console.error('Set default domain error:', error);
    return res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: error.message || 'Failed to set default domain',
    });
  }
});

// Update domain schema
const updateDomainSchema = z.object({
  fromEmail: z.string().email().optional(),
  fromName: z.string().max(100).optional().nullable(),
});

/**
 * PATCH /email-domains/:id
 * Update domain settings
 */
router.patch('/:id', validate(updateDomainSchema), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const domainId = req.params.id;
    const data = req.validatedBody;

    // Check if user has admin permissions
    if (req.roleLevel < 9) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only admins can update domain settings',
      });
    }

    const result = await sesDomainService.updateDomain(tenantId, domainId, data);

    return res.json({
      success: true,
      data: result,
      message: 'Domain settings updated',
    });
  } catch (error) {
    console.error('Update domain error:', error);
    return res.status(500).json({
      success: false,
      error: 'UPDATE_FAILED',
      message: error.message || 'Failed to update domain',
    });
  }
});

/**
 * DELETE /email-domains/:id
 * Delete a domain
 */
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const domainId = req.params.id;

    // Check if user has admin permissions
    if (req.roleLevel < 9) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: 'Only admins can delete domains',
      });
    }

    await sesDomainService.deleteDomain(tenantId, domainId);

    return res.json({
      success: true,
      message: 'Domain deleted successfully',
    });
  } catch (error) {
    console.error('Delete domain error:', error);
    return res.status(500).json({
      success: false,
      error: 'DELETE_FAILED',
      message: error.message || 'Failed to delete domain',
    });
  }
});

export default router;
