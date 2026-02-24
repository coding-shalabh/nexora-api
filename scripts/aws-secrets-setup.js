/**
 * AWS Secrets Manager Setup Script
 *
 * This script reads environment variables from .env file and stores them in AWS Secrets Manager.
 * Run this once during initial AWS setup to migrate from .env to Secrets Manager.
 *
 * Usage:
 *   node scripts/aws-secrets-setup.js
 *
 * Prerequisites:
 *   - AWS credentials configured (.env.aws.example -> .env.local)
 *   - AWS_SECRETS_MANAGER_SECRET_NAME defined
 */

import {
  SecretsManagerClient,
  CreateSecretCommand,
  UpdateSecretCommand,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file
const envPath = path.join(__dirname, '..', '.env');
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envAwsPath = path.join(__dirname, '..', '.env.aws');

// Try .env.aws first (production), then .env.local, then .env
let envFile;
if (fs.existsSync(envAwsPath)) {
  envFile = envAwsPath;
} else if (fs.existsSync(envLocalPath)) {
  envFile = envLocalPath;
} else {
  envFile = envPath;
}

if (!fs.existsSync(envFile)) {
  console.error('❌ No .env, .env.local, or .env.aws file found');
  console.error('Please create one of these files with your environment variables');
  process.exit(1);
}

// Load environment variables
dotenv.config({ path: envFile });

// Initialize AWS Secrets Manager client
const region = process.env.AWS_REGION || 'ap-south-1';
const secretName = process.env.AWS_SECRETS_MANAGER_SECRET_NAME || 'nexora-prod-secrets';

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌ AWS credentials not found in .env file');
  console.error('Please add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to your .env file');
  process.exit(1);
}

const secretsClient = new SecretsManagerClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/**
 * Environment variables to store in Secrets Manager
 * Excludes AWS credentials themselves (use IAM roles in production)
 */
const ENV_VARS_TO_STORE = [
  // Database
  'DATABASE_URL',
  'DIRECT_URL',

  // JWT & Auth
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'REFRESH_TOKEN_SECRET',
  'REFRESH_TOKEN_EXPIRES_IN',

  // Redis
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'REDIS_URL',

  // MSG91 (WhatsApp, SMS)
  'MSG91_AUTH_KEY',
  'MSG91_SENDER_ID',
  'MSG91_TEMPLATE_ID',
  'MSG91_WHATSAPP_AUTH_KEY',

  // TeleCMI (Voice)
  'TELECMI_APP_ID',
  'TELECMI_APP_SECRET',

  // Email Providers
  'RESEND_API_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',

  // Application
  'APP_URL',
  'API_URL',
  'NODE_ENV',
  'PORT',

  // AWS Services (but NOT credentials)
  'AWS_S3_BUCKET_FILES',
  'AWS_S3_BUCKET_ATTACHMENTS',
  'AWS_S3_BUCKET_BACKUPS',
  'AWS_SES_FROM_EMAIL',
  'AWS_SES_FROM_NAME',
  'AWS_SES_CONFIGURATION_SET',

  // Encryption
  'ENCRYPTION_KEY',

  // Other services
  'WEBHOOK_SECRET',
  'API_KEY',
];

/**
 * Check if secret already exists
 */
async function secretExists() {
  try {
    await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    );
    return true;
  } catch (error) {
    if (error.name === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
}

/**
 * Create or update secret in AWS Secrets Manager
 */
async function setupSecretsManager() {
  console.log('🔐 AWS Secrets Manager Setup');
  console.log('─────────────────────────────');
  console.log(`Region: ${region}`);
  console.log(`Secret Name: ${secretName}`);
  console.log(`Environment File: ${envFile}`);
  console.log('');

  // Collect environment variables to store
  const secrets = {};
  const foundVars = [];
  const missingVars = [];

  ENV_VARS_TO_STORE.forEach((varName) => {
    if (process.env[varName]) {
      secrets[varName] = process.env[varName];
      foundVars.push(varName);
    } else {
      missingVars.push(varName);
    }
  });

  console.log(`✅ Found ${foundVars.length} environment variables:`);
  foundVars.forEach((varName) => {
    console.log(`   - ${varName}`);
  });

  if (missingVars.length > 0) {
    console.log('');
    console.log(`⚠️  Missing ${missingVars.length} optional environment variables:`);
    missingVars.forEach((varName) => {
      console.log(`   - ${varName}`);
    });
  }

  console.log('');
  console.log('📤 Uploading to AWS Secrets Manager...');

  try {
    const exists = await secretExists();

    if (exists) {
      // Update existing secret
      console.log(`📝 Secret "${secretName}" already exists, updating...`);

      await secretsClient.send(
        new UpdateSecretCommand({
          SecretId: secretName,
          SecretString: JSON.stringify(secrets, null, 2),
          Description: `Nexora CRM environment variables - Updated ${new Date().toISOString()}`,
        })
      );

      console.log('✅ Secret updated successfully!');
    } else {
      // Create new secret
      console.log(`📝 Creating new secret "${secretName}"...`);

      await secretsClient.send(
        new CreateSecretCommand({
          Name: secretName,
          SecretString: JSON.stringify(secrets, null, 2),
          Description: 'Nexora CRM environment variables',
          Tags: [
            { Key: 'Application', Value: 'Nexora' },
            { Key: 'Environment', Value: process.env.NODE_ENV || 'production' },
            { Key: 'ManagedBy', Value: 'aws-secrets-setup.js' },
          ],
        })
      );

      console.log('✅ Secret created successfully!');
    }

    console.log('');
    console.log('─────────────────────────────');
    console.log('✅ Secrets Manager setup complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Update your production server to load secrets from AWS:');
    console.log('   - Call loadSecretsFromAWS() in src/index.js on startup');
    console.log('2. Configure AWS credentials on VPS using IAM role (recommended)');
    console.log('   - Or set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
    console.log('3. Test with: node scripts/test-aws-secrets.js');
    console.log('');
  } catch (error) {
    console.error('❌ Failed to setup Secrets Manager:');
    console.error(error.message);

    if (error.name === 'InvalidSignatureException') {
      console.error('');
      console.error('💡 Possible issues:');
      console.error('   - Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are correct');
      console.error('   - Verify IAM user has SecretsManager permissions');
    }

    process.exit(1);
  }
}

// Run the setup
setupSecretsManager();
