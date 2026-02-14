/**
 * E-Signature Router
 * API endpoints for document signature management
 */

import { Hono } from 'hono';
import { ESignatureService } from './e-signature.service.js';
import { logger } from '../../common/utils/logger.js';

const router = new Hono();
const eSignatureService = new ESignatureService();

/**
 * POST /e-signature/requests
 * Create a new signature request
 */
router.post('/requests', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();

    const {
      documentType,
      documentId,
      documentName,
      documentUrl,
      signers,
      fields,
      message,
      expiresAt,
    } = body;

    // Validation
    if (!documentType || !documentId || !documentName) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    if (!signers || !Array.isArray(signers) || signers.length === 0) {
      return c.json({ success: false, error: 'At least one signer is required' }, 400);
    }

    // Create signature request
    const request = await eSignatureService.createSignatureRequest({
      tenantId: user.tenantId,
      userId: user.id,
      documentType,
      documentId,
      documentName,
      documentUrl,
      signers,
      fields: fields || [],
      message,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    return c.json({
      success: true,
      data: request,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to create signature request');
    return c.json(
      {
        success: false,
        error: 'Failed to create signature request',
        message: error.message,
      },
      500
    );
  }
});

/**
 * GET /e-signature/requests
 * List all signature requests for tenant
 */
router.get('/requests', async (c) => {
  try {
    const user = c.get('user');
    const { page = '1', limit = '20', status } = c.req.query();

    const result = await eSignatureService.listSignatureRequests({
      tenantId: user.tenantId,
      page: parseInt(page),
      limit: parseInt(limit),
      status,
    });

    return c.json({
      success: true,
      data: result.requests,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to list signature requests');
    return c.json(
      {
        success: false,
        error: 'Failed to list signature requests',
        message: error.message,
      },
      500
    );
  }
});

/**
 * GET /e-signature/requests/:id
 * Get signature request details
 */
router.get('/requests/:id', async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    const request = await eSignatureService.getSignatureRequest(id, user.tenantId);

    if (!request) {
      return c.json({ success: false, error: 'Signature request not found' }, 404);
    }

    return c.json({
      success: true,
      data: request,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get signature request');
    return c.json(
      {
        success: false,
        error: 'Failed to get signature request',
        message: error.message,
      },
      500
    );
  }
});

/**
 * POST /e-signature/requests/:id/cancel
 * Cancel a signature request
 */
router.post('/requests/:id/cancel', async (c) => {
  try {
    const user = c.get('user');
    const { id } = c.req.param();

    await eSignatureService.cancelSignatureRequest(id, user.tenantId, user.id);

    return c.json({
      success: true,
      message: 'Signature request cancelled successfully',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to cancel signature request');
    return c.json(
      {
        success: false,
        error: 'Failed to cancel signature request',
        message: error.message,
      },
      500
    );
  }
});

/**
 * GET /e-signature/sign/:requestId/:token
 * Get signature request for signing (public endpoint)
 */
router.get('/sign/:requestId/:token', async (c) => {
  try {
    const { requestId, token } = c.req.param();

    const result = await eSignatureService.getSignatureRequestByToken(requestId, token);

    if (!result) {
      return c.json({ success: false, error: 'Invalid or expired signature link' }, 404);
    }

    return c.json({
      success: true,
      data: {
        request: result.request,
        signer: {
          id: result.signer.id,
          name: result.signer.name,
          email: result.signer.email,
          role: result.signer.role,
          status: result.signer.status,
        },
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get signature request for signing');
    return c.json(
      {
        success: false,
        error: 'Failed to get signature request',
        message: error.message,
      },
      500
    );
  }
});

/**
 * POST /e-signature/sign/:requestId/:token
 * Submit signature (public endpoint)
 */
router.post('/sign/:requestId/:token', async (c) => {
  try {
    const { requestId, token } = c.req.param();
    const body = await c.req.json();
    const { signatureData } = body;

    if (!signatureData) {
      return c.json({ success: false, error: 'Signature data is required' }, 400);
    }

    // Get IP address and user agent
    const ipAddress =
      c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userAgent = c.req.header('user-agent') || 'unknown';

    const signer = await eSignatureService.signDocument({
      requestId,
      authToken: token,
      signatureData,
      ipAddress,
      userAgent,
    });

    return c.json({
      success: true,
      message: 'Document signed successfully',
      data: {
        signerId: signer.id,
        signedAt: signer.signedAt,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to sign document');
    return c.json(
      {
        success: false,
        error: 'Failed to sign document',
        message: error.message,
      },
      500
    );
  }
});

/**
 * POST /e-signature/sign/:requestId/:token/decline
 * Decline to sign (public endpoint)
 */
router.post('/sign/:requestId/:token/decline', async (c) => {
  try {
    const { requestId, token } = c.req.param();
    const body = await c.req.json();
    const { reason } = body;

    // TODO: Implement decline functionality
    // For now, just return success
    return c.json({
      success: true,
      message: 'Signature declined',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to decline signature');
    return c.json(
      {
        success: false,
        error: 'Failed to decline signature',
        message: error.message,
      },
      500
    );
  }
});

export default router;
