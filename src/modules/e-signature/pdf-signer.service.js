/**
 * PDF Signer Service
 * Handles PDF manipulation, signature embedding, and verification
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../../common/utils/logger.js';

export class PDFSignerService {
  /**
   * Add signature fields to PDF
   * @param {Buffer} pdfBuffer - Original PDF buffer
   * @param {Array} fields - Signature fields with positions
   * @returns {Promise<Buffer>} - Modified PDF buffer
   */
  async addSignatureFields(pdfBuffer, fields) {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

      for (const field of fields) {
        const page = pages[field.page - 1]; // Pages are 0-indexed
        if (!page) {
          logger.warn({ field }, 'Page not found for signature field');
          continue;
        }

        const { width: pageWidth, height: pageHeight } = page.getSize();

        // Draw signature box (placeholder)
        page.drawRectangle({
          x: field.x,
          y: pageHeight - field.y - field.height, // PDF coordinates are bottom-left
          width: field.width,
          height: field.height,
          borderColor: rgb(0.5, 0.5, 0.5),
          borderWidth: 1,
        });

        // Draw label
        page.drawText(field.label || 'Signature', {
          x: field.x + 5,
          y: pageHeight - field.y - field.height + 5,
          size: 10,
          font: font,
          color: rgb(0.5, 0.5, 0.5),
        });
      }

      const modifiedPdfBytes = await pdfDoc.save();
      return Buffer.from(modifiedPdfBytes);
    } catch (error) {
      logger.error({ error }, 'Failed to add signature fields to PDF');
      throw new Error('Failed to add signature fields to PDF');
    }
  }

  /**
   * Embed signatures into PDF
   * @param {Buffer} pdfBuffer - Original PDF buffer
   * @param {Array} signatures - Array of signatures with position and data
   * @returns {Promise<Buffer>} - Signed PDF buffer
   */
  async embedSignatures(pdfBuffer, signatures) {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();

      for (const signature of signatures) {
        if (!signature.signatureData || !signature.field) continue;

        const page = pages[signature.field.page - 1];
        if (!page) {
          logger.warn({ signature }, 'Page not found for signature');
          continue;
        }

        const { width: pageWidth, height: pageHeight } = page.getSize();

        // Convert base64 signature image to PNG
        const signatureImageBytes = Buffer.from(
          signature.signatureData.replace(/^data:image\/png;base64,/, ''),
          'base64'
        );
        const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

        // Calculate signature dimensions
        const signatureWidth = signature.field.width - 10; // Padding
        const signatureHeight = signature.field.height - 10;

        // Draw signature image
        page.drawImage(signatureImage, {
          x: signature.field.x + 5,
          y: pageHeight - signature.field.y - signature.field.height + 5,
          width: signatureWidth,
          height: signatureHeight,
        });

        // Add timestamp and signer name below signature
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const timestamp = new Date(signature.signedAt).toLocaleString();
        page.drawText(`Signed by: ${signature.signerName}`, {
          x: signature.field.x + 5,
          y: pageHeight - signature.field.y - signature.field.height - 15,
          size: 8,
          font: font,
          color: rgb(0.3, 0.3, 0.3),
        });
        page.drawText(`Date: ${timestamp}`, {
          x: signature.field.x + 5,
          y: pageHeight - signature.field.y - signature.field.height - 25,
          size: 8,
          font: font,
          color: rgb(0.3, 0.3, 0.3),
        });
      }

      const signedPdfBytes = await pdfDoc.save();
      return Buffer.from(signedPdfBytes);
    } catch (error) {
      logger.error({ error }, 'Failed to embed signatures into PDF');
      throw new Error('Failed to embed signatures into PDF');
    }
  }

  /**
   * Generate signature hash for verification
   * @param {string} signatureData - Base64 signature image
   * @param {string} email - Signer email
   * @param {Date} timestamp - Signing timestamp
   * @returns {string} - SHA-256 hash
   */
  generateSignatureHash(signatureData, email, timestamp) {
    const dataToHash = `${signatureData}|${email}|${timestamp.toISOString()}`;
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
  }

  /**
   * Verify signature hash
   * @param {string} signatureData - Base64 signature image
   * @param {string} email - Signer email
   * @param {Date} timestamp - Signing timestamp
   * @param {string} expectedHash - Expected hash
   * @returns {boolean} - True if hash matches
   */
  verifySignatureHash(signatureData, email, timestamp, expectedHash) {
    const actualHash = this.generateSignatureHash(signatureData, email, timestamp);
    return actualHash === expectedHash;
  }

  /**
   * Add watermark to signed document
   * @param {Buffer} pdfBuffer - Signed PDF buffer
   * @param {string} text - Watermark text (e.g., "Legally Binding")
   * @returns {Promise<Buffer>} - PDF with watermark
   */
  async addWatermark(pdfBuffer, text = 'Legally Binding Document') {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const pages = pdfDoc.getPages();
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      pages.forEach((page) => {
        const { width, height } = page.getSize();

        page.drawText(text, {
          x: width / 2 - 100,
          y: height - 30,
          size: 12,
          font: font,
          color: rgb(0, 0.6, 0),
          opacity: 0.3,
        });
      });

      const watermarkedPdfBytes = await pdfDoc.save();
      return Buffer.from(watermarkedPdfBytes);
    } catch (error) {
      logger.error({ error }, 'Failed to add watermark to PDF');
      throw new Error('Failed to add watermark to PDF');
    }
  }

  /**
   * Create PDF certificate of completion
   * @param {Object} requestData - Signature request data
   * @returns {Promise<Buffer>} - Certificate PDF buffer
   */
  async createCompletionCertificate(requestData) {
    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([600, 800]);
      const { width, height } = page.getSize();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Title
      page.drawText('Certificate of Completion', {
        x: 50,
        y: height - 100,
        size: 24,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      // Document info
      page.drawText(`Document: ${requestData.documentName}`, {
        x: 50,
        y: height - 150,
        size: 14,
        font: font,
      });

      page.drawText(`Completed: ${new Date(requestData.completedAt).toLocaleString()}`, {
        x: 50,
        y: height - 175,
        size: 12,
        font: font,
      });

      // Signers
      let yPosition = height - 220;
      page.drawText('Signers:', {
        x: 50,
        y: yPosition,
        size: 14,
        font: boldFont,
      });

      yPosition -= 25;
      requestData.signers.forEach((signer, index) => {
        page.drawText(`${index + 1}. ${signer.name} (${signer.email})`, {
          x: 70,
          y: yPosition,
          size: 12,
          font: font,
        });
        page.drawText(`   Signed: ${new Date(signer.signedAt).toLocaleString()}`, {
          x: 70,
          y: yPosition - 15,
          size: 10,
          font: font,
          color: rgb(0.4, 0.4, 0.4),
        });
        yPosition -= 40;
      });

      // Verification hash
      yPosition -= 20;
      page.drawText('Verification Hash:', {
        x: 50,
        y: yPosition,
        size: 12,
        font: boldFont,
      });
      yPosition -= 20;
      page.drawText(requestData.verificationHash || 'N/A', {
        x: 50,
        y: yPosition,
        size: 8,
        font: font,
        color: rgb(0.4, 0.4, 0.4),
      });

      const certificatePdfBytes = await pdfDoc.save();
      return Buffer.from(certificatePdfBytes);
    } catch (error) {
      logger.error({ error }, 'Failed to create completion certificate');
      throw new Error('Failed to create completion certificate');
    }
  }
}
