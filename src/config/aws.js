/**
 * AWS Configuration
 * Centralized AWS service configuration
 */

import { S3Client } from '@aws-sdk/client-s3';
import { SESClient } from '@aws-sdk/client-ses';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { logger } from '../common/logger.js';

const region = process.env.AWS_REGION || 'ap-south-1';

// AWS Clients
export const s3Client = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const sesClient = new SESClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const secretsManagerClient = new SecretsManagerClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// S3 Configuration
export const s3Config = {
  region,
  buckets: {
    files: process.env.AWS_S3_BUCKET_FILES || 'nexora-files-prod',
    attachments: process.env.AWS_S3_BUCKET_ATTACHMENTS || 'nexora-email-attachments',
    backups: process.env.AWS_S3_BUCKET_BACKUPS || 'nexora-backups',
  },
};

// SES Configuration
export const sesConfig = {
  region,
  fromEmail: process.env.AWS_SES_FROM_EMAIL || 'noreply@nexoraos.pro',
  fromName: process.env.AWS_SES_FROM_NAME || 'Nexora CRM',
  configurationSet: process.env.AWS_SES_CONFIGURATION_SET || 'nexora-emails',
};

// Secrets Manager Configuration
export const secretsConfig = {
  secretName: process.env.AWS_SECRETS_MANAGER_SECRET_NAME || 'nexora-prod-secrets',
};

/**
 * Load secrets from AWS Secrets Manager
 * This replaces .env file in production
 */
export async function loadSecretsFromAWS() {
  try {
    const command = new GetSecretValueCommand({
      SecretId: secretsConfig.secretName,
    });

    const response = await secretsManagerClient.send(command);

    if (response.SecretString) {
      const secrets = JSON.parse(response.SecretString);

      // Merge secrets into process.env
      Object.keys(secrets).forEach((key) => {
        if (!process.env[key]) {
          process.env[key] = secrets[key];
        }
      });

      logger.info({ secretName: secretsConfig.secretName }, 'AWS Secrets loaded successfully');
      return secrets;
    }
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      logger.warn(
        { secretName: secretsConfig.secretName },
        'AWS Secret not found - using local .env'
      );
    } else {
      logger.error({ error }, 'Failed to load AWS Secrets');
    }
    // Fall back to local .env
    return null;
  }
}

/**
 * Check if AWS is properly configured
 */
export function isAWSConfigured() {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_REGION
  );
}

export default {
  s3Client,
  sesClient,
  secretsManagerClient,
  s3Config,
  sesConfig,
  secretsConfig,
  loadSecretsFromAWS,
  isAWSConfigured,
};
