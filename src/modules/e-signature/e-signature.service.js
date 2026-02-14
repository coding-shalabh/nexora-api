/**
 * E-Signature Service
 * Business logic for document signature requests
 */

import { prisma } from '@crm360/database';
import { logger } from '../../common/utils/logger.js';
import { PDFSignerService } from './pdf-signer.service.js';
import crypto from 'crypto';
import { sendEmail } from '../../common/utils/email.js';

export class ESignatureService {
  constructor() {
    this.pdfSigner = new PDFSignerService();
  }

  /**
   * Create a new signature request
   * @param {Object} params - Request parameters
   * @returns {Promise<Object>} - Created signature request
   */
  async createSignatureRequest({
    tenantId,
    userId,
    documentType,
    documentId,
    documentName,
    documentUrl,
    signers,
    fields,
    message,
    expiresAt,
  }) {
    try {
      // Create signature request
      const request = await prisma.documentSignatureRequest.create({
        data: {
          tenantId,
          documentType,
          documentId,
          documentName,
          documentUrl,
          requestedById: userId,
          message,
          expiresAt,
          status: 'PENDING',
          signers: {
            create: signers.map((signer, index) => ({
              signerType: signer.userId ? 'INTERNAL' : 'EXTERNAL',
              userId: signer.userId,
              contactId: signer.contactId,
              email: signer.email,
              name: signer.name,
              role: signer.role,
              order: index + 1,
              status: 'PENDING',
              authToken: crypto.randomBytes(32).toString('hex'),
              tokenExpiresAt: expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            })),
          },
          fields: {
            create: fields.map((field) => ({
              fieldType: field.type || 'SIGNATURE',
              signerId: field.signerId,
              label: field.label,
              required: field.required !== false,
              page: field.page || 1,
              x: field.x,
              y: field.y,
              width: field.width || 200,
              height: field.height || 80,
            })),
          },
        },
        include: {
          signers: true,
          fields: true,
        },
      });

      // Log audit event
      await this.logAudit({
        requestId: request.id,
        action: 'CREATED',
        actorType: 'USER',
        actorId: userId,
      });

      // Send signature request emails to all signers
      await this.sendSignatureEmails(request);

      logger.info({ requestId: request.id }, 'Signature request created');
      return request;
    } catch (error) {
      logger.error({ error }, 'Failed to create signature request');
      throw error;
    }
  }

  /**
   * Send signature request emails to signers
   * @param {Object} request - Signature request
   */
  async sendSignatureEmails(request) {
    try {
      for (const signer of request.signers) {
        const signingUrl = `${process.env.APP_URL}/sign/${request.id}/${signer.authToken}`;

        await sendEmail({
          to: signer.email,
          subject: `${request.documentName} - Signature Required`,
          html: `
            <h2>Signature Request</h2>
            <p>Hello ${signer.name},</p>
            <p>You have been requested to sign the document: <strong>${request.documentName}</strong></p>
            ${request.message ? `<p><em>${request.message}</em></p>` : ''}
            <p><a href="${signingUrl}" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Sign Document</a></p>
            <p>This link expires on ${new Date(signer.tokenExpiresAt).toLocaleDateString()}</p>
            <p>If you did not expect this request, please ignore this email.</p>
            <p>Best regards,<br>Nexora Team</p>
          `,
        });

        // Log audit
        await this.logAudit({
          requestId: request.id,
          action: 'SENT',
          actorType: 'SYSTEM',
          actorEmail: signer.email,
          metadata: { signerId: signer.id },
        });
      }
    } catch (error) {
      logger.error({ error, requestId: request.id }, 'Failed to send signature emails');
    }
  }

  /**
   * Get signature request by ID
   * @param {string} requestId - Request ID
   * @param {string} tenantId - Tenant ID
   * @returns {Promise<Object|null>} - Signature request
   */
  async getSignatureRequest(requestId, tenantId) {
    try {
      const request = await prisma.documentSignatureRequest.findFirst({
        where: { id: requestId, tenantId },
        include: {
          signers: true,
          fields: true,
          requestedBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      return request;
    } catch (error) {
      logger.error({ error, requestId }, 'Failed to get signature request');
      throw error;
    }
  }

  /**
   * Get signature request by auth token (for signing page)
   * @param {string} requestId - Request ID
   * @param {string} authToken - Signer auth token
   * @returns {Promise<Object|null>} - Signature request and signer
   */
  async getSignatureRequestByToken(requestId, authToken) {
    try {
      const signer = await prisma.documentSigner.findFirst({
        where: {
          requestId,
          authToken,
          tokenExpiresAt: { gte: new Date() },
        },
        include: {
          request: {
            include: {
              signers: true,
              fields: true,
            },
          },
        },
      });

      if (!signer) {
        return null;
      }

      // Log view
      await this.logAudit({
        requestId,
        action: 'VIEWED',
        actorType: 'SIGNER',
        actorEmail: signer.email,
        metadata: { signerId: signer.id },
      });

      // Update signer status if still pending
      if (signer.status === 'PENDING') {
        await prisma.documentSigner.update({
          where: { id: signer.id },
          data: { status: 'VIEWED' },
        });
      }

      return { request: signer.request, signer };
    } catch (error) {
      logger.error({ error, requestId }, 'Failed to get signature request by token');
      throw error;
    }
  }

  /**
   * Sign document
   * @param {Object} params - Signing parameters
   * @returns {Promise<Object>} - Updated signer record
   */
  async signDocument({ requestId, authToken, signatureData, ipAddress, userAgent }) {
    try {
      // Find signer
      const signer = await prisma.documentSigner.findFirst({
        where: {
          requestId,
          authToken,
          tokenExpiresAt: { gte: new Date() },
        },
        include: {
          request: {
            include: {
              signers: true,
              fields: { where: { signerId: null } }, // Get signer's fields
            },
          },
        },
      });

      if (!signer) {
        throw new Error('Invalid or expired signature token');
      }

      if (signer.status === 'SIGNED') {
        throw new Error('Document already signed by this signer');
      }

      // Generate signature hash
      const signedAt = new Date();
      const signatureHash = this.pdfSigner.generateSignatureHash(
        signatureData,
        signer.email,
        signedAt
      );

      // Update signer
      const updatedSigner = await prisma.documentSigner.update({
        where: { id: signer.id },
        data: {
          status: 'SIGNED',
          signedAt,
          signatureData,
          signatureHash,
          ipAddress,
          userAgent,
        },
      });

      // Log audit
      await this.logAudit({
        requestId,
        action: 'SIGNED',
        actorType: 'SIGNER',
        actorEmail: signer.email,
        ipAddress,
        userAgent,
        metadata: { signerId: signer.id },
      });

      // Check if all signers have signed
      const allSigners = await prisma.documentSigner.findMany({
        where: { requestId },
      });

      const allSigned = allSigners.every((s) => s.status === 'SIGNED');

      if (allSigned) {
        await this.completeSignatureRequest(requestId);
      } else {
        // Update request status to IN_PROGRESS
        await prisma.documentSignatureRequest.update({
          where: { id: requestId },
          data: { status: 'IN_PROGRESS' },
        });
      }

      logger.info({ requestId, signerId: signer.id }, 'Document signed');
      return updatedSigner;
    } catch (error) {
      logger.error({ error, requestId }, 'Failed to sign document');
      throw error;
    }
  }

  /**
   * Complete signature request (all signers have signed)
   * @param {string} requestId - Request ID
   */
  async completeSignatureRequest(requestId) {
    try {
      const request = await prisma.documentSignatureRequest.findUnique({
        where: { id: requestId },
        include: {
          signers: true,
          fields: true,
        },
      });

      if (!request) {
        throw new Error('Signature request not found');
      }

      // Generate signed PDF with all signatures
      // TODO: Implement actual PDF signing (download original, embed signatures, upload signed)

      // Update request status
      await prisma.documentSignatureRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      // Log audit
      await this.logAudit({
        requestId,
        action: 'COMPLETED',
        actorType: 'SYSTEM',
      });

      // Send completion email to requester
      await this.sendCompletionEmail(request);

      logger.info({ requestId }, 'Signature request completed');
    } catch (error) {
      logger.error({ error, requestId }, 'Failed to complete signature request');
      throw error;
    }
  }

  /**
   * Send completion email to requester
   * @param {Object} request - Signature request
   */
  async sendCompletionEmail(request) {
    try {
      const requester = await prisma.user.findUnique({
        where: { id: request.requestedById },
      });

      if (!requester) return;

      await sendEmail({
        to: requester.email,
        subject: `${request.documentName} - All Signatures Completed`,
        html: `
          <h2>Signature Request Completed</h2>
          <p>Hello ${requester.firstName},</p>
          <p>All signers have completed signing the document: <strong>${request.documentName}</strong></p>
          <p>You can download the signed document from your Nexora dashboard.</p>
          <p>Best regards,<br>Nexora Team</p>
        `,
      });
    } catch (error) {
      logger.error({ error, requestId: request.id }, 'Failed to send completion email');
    }
  }

  /**
   * Cancel signature request
   * @param {string} requestId - Request ID
   * @param {string} tenantId - Tenant ID
   * @param {string} userId - User ID
   */
  async cancelSignatureRequest(requestId, tenantId, userId) {
    try {
      const request = await prisma.documentSignatureRequest.findFirst({
        where: { id: requestId, tenantId },
      });

      if (!request) {
        throw new Error('Signature request not found');
      }

      if (request.status === 'COMPLETED') {
        throw new Error('Cannot cancel completed signature request');
      }

      await prisma.documentSignatureRequest.update({
        where: { id: requestId },
        data: { status: 'CANCELLED' },
      });

      // Log audit
      await this.logAudit({
        requestId,
        action: 'CANCELLED',
        actorType: 'USER',
        actorId: userId,
      });

      logger.info({ requestId }, 'Signature request cancelled');
    } catch (error) {
      logger.error({ error, requestId }, 'Failed to cancel signature request');
      throw error;
    }
  }

  /**
   * Log audit event
   * @param {Object} params - Audit params
   */
  async logAudit({
    requestId,
    action,
    actorType,
    actorId,
    actorEmail,
    metadata,
    ipAddress,
    userAgent,
  }) {
    try {
      await prisma.signatureAuditLog.create({
        data: {
          requestId,
          action,
          actorType,
          actorId,
          actorEmail,
          metadata,
          ipAddress,
          userAgent,
        },
      });
    } catch (error) {
      logger.error({ error }, 'Failed to log audit event');
    }
  }

  /**
   * List signature requests for tenant
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} - Paginated signature requests
   */
  async listSignatureRequests({ tenantId, page = 1, limit = 20, status }) {
    try {
      const where = { tenantId };
      if (status) {
        where.status = status;
      }

      const [requests, total] = await Promise.all([
        prisma.documentSignatureRequest.findMany({
          where,
          include: {
            signers: true,
            requestedBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.documentSignatureRequest.count({ where }),
      ]);

      return {
        requests,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      logger.error({ error }, 'Failed to list signature requests');
      throw error;
    }
  }
}
