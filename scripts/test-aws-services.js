/**
 * AWS Services Test Script
 *
 * Tests S3 and SES integration to verify AWS setup is working correctly.
 *
 * Usage:
 *   node scripts/test-aws-services.js [s3|ses|all]
 *
 * Prerequisites:
 *   - AWS credentials configured in .env.local
 *   - S3 buckets created
 *   - SES email verified (or in sandbox mode)
 */

import { S3Service } from '../src/services/aws-s3.service.js';
import { SESService } from '../src/services/aws-ses.service.js';
import { isAWSConfigured } from '../src/config/aws.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const testService = process.argv[2] || 'all';

console.log('🧪 AWS Services Test');
console.log('─────────────────────────────');

// Check AWS configuration
if (!isAWSConfigured()) {
  console.error('❌ AWS is not configured');
  console.error('Please add AWS credentials to .env.local:');
  console.error('  AWS_REGION=ap-south-1');
  console.error('  AWS_ACCESS_KEY_ID=your-key');
  console.error('  AWS_SECRET_ACCESS_KEY=your-secret');
  process.exit(1);
}

console.log('✅ AWS credentials configured');
console.log('');

/**
 * Test S3 file upload and download
 */
async function testS3() {
  console.log('📦 Testing S3 Service...');
  console.log('');

  try {
    // 1. Upload a test file
    console.log('1️⃣  Uploading test file...');
    const testContent = Buffer.from('Hello from Nexora CRM! This is a test file.');
    const uploadResult = await S3Service.uploadFile(testContent, 'test-file.txt', 'files', {
      folder: 'tests',
      contentType: 'text/plain',
      metadata: {
        test: 'true',
        timestamp: new Date().toISOString(),
      },
    });

    console.log('   ✅ File uploaded successfully');
    console.log(`   📍 URL: ${uploadResult.url}`);
    console.log(`   🔑 Key: ${uploadResult.key}`);
    console.log('');

    // 2. Check if file exists
    console.log('2️⃣  Checking if file exists...');
    const exists = await S3Service.fileExists(uploadResult.key, 'files');
    console.log(`   ${exists ? '✅' : '❌'} File exists: ${exists}`);
    console.log('');

    // 3. Generate presigned download URL
    console.log('3️⃣  Generating presigned download URL...');
    const downloadUrl = await S3Service.getPresignedDownloadUrl(uploadResult.key, 'files', 300);
    console.log('   ✅ Download URL generated (valid for 5 minutes)');
    console.log(`   🔗 URL: ${downloadUrl.substring(0, 100)}...`);
    console.log('');

    // 4. Generate presigned upload URL
    console.log('4️⃣  Generating presigned upload URL...');
    const uploadUrlData = await S3Service.getPresignedUploadUrl('test-upload.txt', 'files', 300);
    console.log('   ✅ Upload URL generated');
    console.log(`   🔑 Key: ${uploadUrlData.key}`);
    console.log('');

    // 5. Delete test file
    console.log('5️⃣  Cleaning up - deleting test file...');
    await S3Service.deleteFile(uploadResult.key, 'files');
    console.log('   ✅ Test file deleted');
    console.log('');

    console.log('✅ S3 Service Test: PASSED');
    console.log('');
    return true;
  } catch (error) {
    console.error('❌ S3 Service Test: FAILED');
    console.error(`   Error: ${error.message}`);
    console.error('');

    if (error.message.includes('AccessDenied')) {
      console.error('💡 Possible issues:');
      console.error('   - IAM user lacks S3 permissions');
      console.error('   - Bucket does not exist or is in wrong region');
      console.error('   - Bucket policy blocks access');
    } else if (error.message.includes('NoSuchBucket')) {
      console.error('💡 Possible issues:');
      console.error('   - S3 bucket does not exist');
      console.error('   - Check AWS_S3_BUCKET_FILES in .env');
      console.error('   - Create bucket in AWS Console');
    }

    console.error('');
    return false;
  }
}

/**
 * Test SES email sending
 */
async function testSES() {
  console.log('📧 Testing SES Service...');
  console.log('');

  // Get test email from environment or use default
  const testEmail = process.env.TEST_EMAIL || process.env.AWS_SES_FROM_EMAIL;

  if (!testEmail) {
    console.error('❌ No test email configured');
    console.error('Please set TEST_EMAIL in .env.local or configure AWS_SES_FROM_EMAIL');
    console.error('');
    return false;
  }

  console.log(`📮 Test recipient: ${testEmail}`);
  console.log('');

  try {
    // 1. Send simple text email
    console.log('1️⃣  Sending plain text email...');
    const textResult = await SESService.sendEmail(
      testEmail,
      'Nexora AWS SES Test - Plain Text',
      'This is a test email from Nexora CRM AWS SES integration.',
      { isHtml: false }
    );

    console.log('   ✅ Plain text email sent');
    console.log(`   📬 Message ID: ${textResult.messageId}`);
    console.log('');

    // 2. Send HTML email
    console.log('2️⃣  Sending HTML email...');
    const htmlResult = await SESService.sendEmail(
      testEmail,
      'Nexora AWS SES Test - HTML',
      `
        <html>
          <body style="font-family: Arial, sans-serif;">
            <h2 style="color: #4F46E5;">Nexora CRM AWS SES Test</h2>
            <p>This is a test <strong>HTML email</strong> from Nexora CRM.</p>
            <p>If you received this, AWS SES integration is working correctly! ✅</p>
          </body>
        </html>
      `,
      { isHtml: true }
    );

    console.log('   ✅ HTML email sent');
    console.log(`   📬 Message ID: ${htmlResult.messageId}`);
    console.log('');

    // 3. Send verification email (template test)
    console.log('3️⃣  Sending verification email template...');
    const verifyResult = await SESService.sendVerificationEmail(
      testEmail,
      'https://nexoraos.pro/verify?token=test123',
      'Test User'
    );

    console.log('   ✅ Verification email sent');
    console.log(`   📬 Message ID: ${verifyResult.messageId}`);
    console.log('');

    console.log('✅ SES Service Test: PASSED');
    console.log('');
    console.log('📥 Check your inbox for 3 test emails:');
    console.log('   1. Plain text test email');
    console.log('   2. HTML formatted test email');
    console.log('   3. Verification email template');
    console.log('');

    if (process.env.AWS_SES_FROM_EMAIL && process.env.AWS_SES_FROM_EMAIL.includes('@')) {
      const domain = process.env.AWS_SES_FROM_EMAIL.split('@')[1];
      console.log('⚠️  Note: If in SES sandbox mode:');
      console.log(`   - Only verified emails can receive messages`);
      console.log(`   - Verify ${testEmail} in AWS SES Console`);
      console.log(`   - Or move to production mode for ${domain}`);
      console.log('');
    }

    return true;
  } catch (error) {
    console.error('❌ SES Service Test: FAILED');
    console.error(`   Error: ${error.message}`);
    console.error('');

    if (error.message.includes('MessageRejected')) {
      console.error('💡 Possible issues:');
      console.error('   - Email not verified in SES (sandbox mode)');
      console.error('   - Domain not verified');
      console.error('   - From email does not match verified identity');
    } else if (error.message.includes('AccessDenied')) {
      console.error('💡 Possible issues:');
      console.error('   - IAM user lacks SES send permissions');
      console.error('   - SES service not enabled in region');
    }

    console.error('');
    return false;
  }
}

/**
 * Run tests
 */
async function runTests() {
  let s3Passed = true;
  let sesPassed = true;

  if (testService === 'all' || testService === 's3') {
    s3Passed = await testS3();
  }

  if (testService === 'all' || testService === 'ses') {
    sesPassed = await testSES();
  }

  console.log('─────────────────────────────');
  console.log('📊 Test Summary');
  console.log('');

  if (testService === 'all' || testService === 's3') {
    console.log(`S3 Service:  ${s3Passed ? '✅ PASSED' : '❌ FAILED'}`);
  }

  if (testService === 'all' || testService === 'ses') {
    console.log(`SES Service: ${sesPassed ? '✅ PASSED' : '❌ FAILED'}`);
  }

  console.log('');

  const allPassed = s3Passed && sesPassed;

  if (allPassed) {
    console.log('✅ All AWS services are configured correctly!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Set up Secrets Manager: node scripts/aws-secrets-setup.js');
    console.log('2. Update src/index.js to load secrets on startup');
    console.log('3. Deploy to VPS with AWS integration');
  } else {
    console.log('❌ Some AWS services failed tests');
    console.log('Please review the errors above and fix configuration');
    process.exit(1);
  }
}

// Run the tests
runTests().catch((error) => {
  console.error('❌ Test execution failed:');
  console.error(error);
  process.exit(1);
});
