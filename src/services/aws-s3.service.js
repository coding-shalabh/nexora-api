/**
 * AWS S3 File Upload Service
 * Handles file uploads to S3 buckets
 */

import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, s3Config } from '../config/aws.js';
import { logger } from '../common/logger.js';
import { nanoid } from 'nanoid';
import path from 'path';

export class S3Service {
  /**
   * Upload file to S3
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} originalFilename - Original filename
   * @param {string} bucketType - Bucket type ('files', 'attachments', 'backups')
   * @param {Object} options - Additional options
   */
  static async uploadFile(fileBuffer, originalFilename, bucketType = 'files', options = {}) {
    try {
      const bucket = s3Config.buckets[bucketType];
      if (!bucket) {
        throw new Error(`Invalid bucket type: ${bucketType}`);
      }

      // Generate unique filename
      const ext = path.extname(originalFilename);
      const filename = `${options.folder || 'uploads'}/${nanoid(16)}${ext}`;

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: filename,
        Body: fileBuffer,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: {
          originalName: originalFilename,
          uploadedAt: new Date().toISOString(),
          ...options.metadata,
        },
      });

      await s3Client.send(command);

      const fileUrl = `https://${bucket}.s3.${s3Config.region}.amazonaws.com/${filename}`;

      logger.info({ filename, bucket }, 'File uploaded to S3');

      return {
        url: fileUrl,
        key: filename,
        bucket,
        originalFilename,
      };
    } catch (error) {
      logger.error({ error, originalFilename }, 'S3 upload failed');
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Get presigned URL for direct upload from browser
   * @param {string} filename - Filename
   * @param {string} bucketType - Bucket type
   * @param {number} expiresIn - URL expiry in seconds (default: 1 hour)
   */
  static async getPresignedUploadUrl(filename, bucketType = 'files', expiresIn = 3600) {
    try {
      const bucket = s3Config.buckets[bucketType];
      const key = `uploads/${nanoid(16)}-${filename}`;

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn });

      return {
        uploadUrl: url,
        key,
        bucket,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to generate presigned URL');
      throw new Error('Failed to generate upload URL');
    }
  }

  /**
   * Get presigned URL for downloading file
   * @param {string} key - S3 object key
   * @param {string} bucketType - Bucket type
   * @param {number} expiresIn - URL expiry in seconds (default: 1 hour)
   */
  static async getPresignedDownloadUrl(key, bucketType = 'files', expiresIn = 3600) {
    try {
      const bucket = s3Config.buckets[bucketType];

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const url = await getSignedUrl(s3Client, command, { expiresIn });

      return url;
    } catch (error) {
      logger.error({ error, key }, 'Failed to generate download URL');
      throw new Error('Failed to generate download URL');
    }
  }

  /**
   * Delete file from S3
   * @param {string} key - S3 object key
   * @param {string} bucketType - Bucket type
   */
  static async deleteFile(key, bucketType = 'files') {
    try {
      const bucket = s3Config.buckets[bucketType];

      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await s3Client.send(command);

      logger.info({ key, bucket }, 'File deleted from S3');
    } catch (error) {
      logger.error({ error, key }, 'Failed to delete file from S3');
      throw new Error('Failed to delete file');
    }
  }

  /**
   * Check if file exists in S3
   * @param {string} key - S3 object key
   * @param {string} bucketType - Bucket type
   */
  static async fileExists(key, bucketType = 'files') {
    try {
      const bucket = s3Config.buckets[bucketType];

      const command = new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await s3Client.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}

export default S3Service;
