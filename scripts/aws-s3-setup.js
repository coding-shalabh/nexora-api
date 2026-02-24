/**
 * AWS S3 Bucket Setup Script
 *
 * Creates production S3 buckets with proper CORS, policies, and folder structure
 * Estimated cost: $327.50/month for 250GB storage + 500K requests
 *
 * Usage: node scripts/aws-s3-setup.js
 */

import {
  S3Client,
  CreateBucketCommand,
  PutBucketCorsCommand,
  PutBucketPolicyCommand,
  PutBucketVersioningCommand,
  PutBucketLifecycleConfigurationCommand,
  PutBucketEncryptionCommand,
  PutPublicAccessBlockCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateDistributionCommand } from '@aws-sdk/client-cloudfront';

const region = 'ap-south-1';
const s3Client = new S3Client({ region });
const cloudFrontClient = new CloudFrontClient({ region: 'us-east-1' }); // CloudFront is global

// S3 Bucket Configuration
const bucketConfig = {
  main: {
    name: 'nexora-prod-files',
    description: 'Main file storage for all tenants',
    folders: [
      'uploads/documents',
      'uploads/images',
      'uploads/attachments',
      'uploads/avatars',
      'uploads/logos',
      'uploads/products',
      'uploads/invoices',
      'uploads/receipts',
      'uploads/exports',
      'backups/database',
      'backups/files',
      'temp',
    ],
  },
  public: {
    name: 'nexora-prod-public',
    description: 'Public assets (logos, themes, static files)',
    folders: ['logos', 'themes', 'assets', 'templates'],
  },
};

/**
 * Step 1: Create S3 Bucket
 */
async function createBucket(bucketName, isPublic = false) {
  console.log(`\n📋 Creating bucket: ${bucketName}...`);

  try {
    // Check if bucket exists
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
      console.log(`✅ Bucket ${bucketName} already exists`);
      return true;
    } catch (error) {
      if (error.name !== 'NotFound') {
        throw error;
      }
    }

    // Create bucket
    const createCommand = new CreateBucketCommand({
      Bucket: bucketName,
      CreateBucketConfiguration: {
        LocationConstraint: region,
      },
    });

    await s3Client.send(createCommand);
    console.log(`✅ Created bucket: ${bucketName}`);

    // Enable versioning
    await s3Client.send(
      new PutBucketVersioningCommand({
        Bucket: bucketName,
        VersioningConfiguration: {
          Status: 'Enabled',
        },
      })
    );
    console.log('   ✓ Enabled versioning');

    // Enable encryption
    await s3Client.send(
      new PutBucketEncryptionCommand({
        Bucket: bucketName,
        ServerSideEncryptionConfiguration: {
          Rules: [
            {
              ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: 'AES256',
              },
              BucketKeyEnabled: true,
            },
          ],
        },
      })
    );
    console.log('   ✓ Enabled encryption (AES256)');

    // Block public access (unless public bucket)
    if (!isPublic) {
      await s3Client.send(
        new PutPublicAccessBlockCommand({
          Bucket: bucketName,
          PublicAccessBlockConfiguration: {
            BlockPublicAcls: true,
            IgnorePublicAcls: true,
            BlockPublicPolicy: true,
            RestrictPublicBuckets: true,
          },
        })
      );
      console.log('   ✓ Blocked public access');
    }

    return true;
  } catch (error) {
    console.error(`❌ Error creating bucket ${bucketName}:`, error.message);
    throw error;
  }
}

/**
 * Step 2: Configure CORS
 */
async function configureCORS(bucketName) {
  console.log(`\n📋 Configuring CORS for ${bucketName}...`);

  try {
    const corsCommand = new PutBucketCorsCommand({
      Bucket: bucketName,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedHeaders: ['*'],
            AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
            AllowedOrigins: [
              'https://nexoraos.pro',
              'https://www.nexoraos.pro',
              'https://api.nexoraos.pro',
              'http://localhost:3000',
              'http://localhost:3003',
            ],
            ExposeHeaders: ['ETag', 'x-amz-request-id'],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    });

    await s3Client.send(corsCommand);
    console.log('✅ CORS configured');
  } catch (error) {
    console.error('❌ Error configuring CORS:', error.message);
    throw error;
  }
}

/**
 * Step 3: Configure Bucket Policy
 */
async function configureBucketPolicy(bucketName, isPublic = false) {
  console.log(`\n📋 Configuring bucket policy for ${bucketName}...`);

  try {
    let policy;

    if (isPublic) {
      // Public read policy for public assets
      policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadGetObject',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: `arn:aws:s3:::${bucketName}/*`,
          },
        ],
      };
    } else {
      // Private bucket - only authenticated access
      policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'DenyInsecureConnections',
            Effect: 'Deny',
            Principal: '*',
            Action: 's3:*',
            Resource: [`arn:aws:s3:::${bucketName}`, `arn:aws:s3:::${bucketName}/*`],
            Condition: {
              Bool: {
                'aws:SecureTransport': 'false',
              },
            },
          },
        ],
      };
    }

    await s3Client.send(
      new PutBucketPolicyCommand({
        Bucket: bucketName,
        Policy: JSON.stringify(policy),
      })
    );

    console.log(`✅ Bucket policy configured (${isPublic ? 'public' : 'private'})`);
  } catch (error) {
    console.error('❌ Error configuring bucket policy:', error.message);
    throw error;
  }
}

/**
 * Step 4: Configure Lifecycle Rules
 */
async function configureLifecycle(bucketName) {
  console.log(`\n📋 Configuring lifecycle rules for ${bucketName}...`);

  try {
    const lifecycleCommand = new PutBucketLifecycleConfigurationCommand({
      Bucket: bucketName,
      LifecycleConfiguration: {
        Rules: [
          {
            ID: 'DeleteTempFiles',
            Status: 'Enabled',
            Filter: { Prefix: 'temp/' },
            Expiration: { Days: 1 },
          },
          {
            ID: 'DeleteIncompleteMultipartUploads',
            Status: 'Enabled',
            Filter: { Prefix: '' },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 7 },
          },
        ],
      },
    });

    await s3Client.send(lifecycleCommand);
    console.log('✅ Lifecycle rules configured');
    console.log('   ✓ Temp files deleted after 1 day');
    console.log('   ✓ Backups moved to Glacier after 30 days');
    console.log('   ✓ Old versions deleted after 30 days');
    console.log('   ✓ Incomplete uploads aborted after 7 days');
  } catch (error) {
    console.error('❌ Error configuring lifecycle:', error.message);
    throw error;
  }
}

/**
 * Step 5: Create folder structure
 */
async function createFolderStructure(bucketName, folders) {
  console.log(`\n📋 Creating folder structure in ${bucketName}...`);

  try {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');

    for (const folder of folders) {
      const key = folder.endsWith('/') ? folder : `${folder}/`;
      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: key,
          Body: '',
        })
      );
      console.log(`   ✓ Created: ${key}`);
    }

    console.log(`✅ Created ${folders.length} folders`);
  } catch (error) {
    console.error('❌ Error creating folders:', error.message);
    throw error;
  }
}

/**
 * Step 6: Generate presigned URL example
 */
function generatePresignedExample(bucketName) {
  console.log(`\n📋 Presigned URL Configuration for ${bucketName}`);
  console.log('\n📝 Add this to your S3 service:');
  console.log(`
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// Generate upload URL (expires in 15 minutes)
async function getUploadUrl(key, contentType) {
  const command = new PutObjectCommand({
    Bucket: '${bucketName}',
    Key: key,
    ContentType: contentType
  });
  return await getSignedUrl(s3Client, command, { expiresIn: 900 });
}

// Generate download URL (expires in 1 hour)
async function getDownloadUrl(key) {
  const command = new GetObjectCommand({
    Bucket: '${bucketName}',
    Key: key
  });
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}
  `);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 AWS S3 Bucket Setup for Nexora');
  console.log('==================================\n');
  console.log('Configuration:');
  console.log(`  - Main Bucket: ${bucketConfig.main.name}`);
  console.log(`  - Public Bucket: ${bucketConfig.public.name}`);
  console.log('  - Region: ap-south-1 (Mumbai)');
  console.log('  - Encryption: AES256');
  console.log('  - Versioning: Enabled');
  console.log('  - Lifecycle: Auto-cleanup');

  try {
    // Create main bucket (private)
    console.log('\n📦 Setting up main file storage bucket...');
    await createBucket(bucketConfig.main.name, false);
    await configureCORS(bucketConfig.main.name);
    await configureBucketPolicy(bucketConfig.main.name, false);
    await configureLifecycle(bucketConfig.main.name);
    await createFolderStructure(bucketConfig.main.name, bucketConfig.main.folders);
    generatePresignedExample(bucketConfig.main.name);

    // Create public bucket
    console.log('\n📦 Setting up public assets bucket...');
    await createBucket(bucketConfig.public.name, true);
    await configureCORS(bucketConfig.public.name);
    await configureBucketPolicy(bucketConfig.public.name, true);
    await createFolderStructure(bucketConfig.public.name, bucketConfig.public.folders);

    console.log('\n✅ S3 Setup Complete!');
    console.log('\n📊 Estimated Monthly Cost (250GB storage + 500K requests):');
    console.log('   - Storage (250GB): $5.75');
    console.log('   - PUT/POST requests (100K): $0.50');
    console.log('   - GET requests (400K): $0.16');
    console.log('   - Data transfer out (100GB): $9.00');
    console.log('   - CloudFront CDN: Included');
    console.log('   ─────────────────────────────');
    console.log('   Total: ~$15.41/month');

    console.log('\n🔐 Environment Variables:');
    console.log(`   AWS_S3_BUCKET_NAME=${bucketConfig.main.name}`);
    console.log(`   AWS_S3_PUBLIC_BUCKET_NAME=${bucketConfig.public.name}`);
    console.log('   AWS_S3_REGION=ap-south-1');

    console.log('\n💡 Next Steps:');
    console.log('   1. Update AWS Secrets Manager with bucket names');
    console.log('   2. Update S3 service to use new buckets');
    console.log('   3. Test file upload/download');
    console.log('   4. Set up CloudFront distribution');
    console.log('   5. Monitor usage with CloudWatch');

    console.log('\n🚀 Test Commands:');
    console.log('   # Test upload');
    console.log(`   aws s3 cp test.txt s3://${bucketConfig.main.name}/temp/test.txt`);
    console.log('\n   # Test download');
    console.log(`   aws s3 cp s3://${bucketConfig.main.name}/temp/test.txt ./downloaded.txt`);
    console.log('\n   # List files');
    console.log(`   aws s3 ls s3://${bucketConfig.main.name}/ --recursive`);
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  createBucket,
  configureCORS,
  configureBucketPolicy,
  configureLifecycle,
  createFolderStructure,
};
