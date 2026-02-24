/**
 * DynamoDB Connection Test Script
 *
 * Tests DynamoDB connection and basic operations.
 *
 * Usage:
 *   node scripts/test-dynamodb.js
 *
 * Prerequisites:
 *   - AWS credentials configured in .env.local or .env.aws
 *   - AWS_REGION set
 */

import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBService } from '../src/services/aws-dynamodb.service.js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envAwsPath = path.join(__dirname, '..', '.env.aws');
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envPath = path.join(__dirname, '..', '.env');

let envFile;
if (fs.existsSync(envAwsPath)) {
  envFile = envAwsPath;
} else if (fs.existsSync(envLocalPath)) {
  envFile = envLocalPath;
} else {
  envFile = envPath;
}

dotenv.config({ path: envFile });

console.log('🧪 DynamoDB Connection Test');
console.log('─────────────────────────────');
console.log(`Region: ${process.env.AWS_REGION || 'ap-south-1'}`);
console.log(`Environment: ${envFile}`);
console.log('');

// Check AWS configuration
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error('❌ AWS credentials not found');
  console.error('Please add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to your .env file');
  process.exit(1);
}

console.log('✅ AWS credentials configured');
console.log('');

/**
 * Test DynamoDB connection
 */
async function testDynamoDBConnection() {
  console.log('📊 Testing DynamoDB Connection...');
  console.log('');

  try {
    const client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    // 1. List tables to verify connection
    console.log('1️⃣  Listing DynamoDB tables...');
    const command = new ListTablesCommand({});
    const response = await client.send(command);

    if (response.TableNames && response.TableNames.length > 0) {
      console.log(`   ✅ Connection successful! Found ${response.TableNames.length} tables:`);
      response.TableNames.forEach((tableName) => {
        console.log(`      - ${tableName}`);
      });
    } else {
      console.log('   ⚠️  Connection successful, but no tables found');
      console.log('   Create tables in AWS Console → DynamoDB → Create table');
    }
    console.log('');

    // 2. Test session storage (if sessions table exists)
    const sessionsTable = process.env.AWS_DYNAMODB_SESSIONS_TABLE || 'nexora-sessions';

    if (response.TableNames && response.TableNames.includes(sessionsTable)) {
      console.log('2️⃣  Testing session storage...');

      // Store test session
      const testSessionId = `test-${Date.now()}`;
      await DynamoDBService.storeSession(testSessionId, {
        userId: 'test-user-123',
        tenantId: 'test-tenant-456',
        ipAddress: '127.0.0.1',
        userAgent: 'DynamoDB Test Script',
      });
      console.log(`   ✅ Session stored: ${testSessionId}`);

      // Retrieve test session
      const session = await DynamoDBService.getSession(testSessionId);
      console.log('   ✅ Session retrieved successfully');
      console.log(`      User ID: ${session.userId}`);
      console.log(`      Tenant ID: ${session.tenantId}`);

      // Delete test session
      await DynamoDBService.deleteSession(testSessionId);
      console.log('   ✅ Test session deleted');
      console.log('');

      console.log('✅ DynamoDB Service Test: PASSED');
    } else {
      console.log('2️⃣  Skipping session storage test (table not found)');
      console.log(`   Table "${sessionsTable}" does not exist`);
      console.log('');
      console.log('⚠️  DynamoDB Service Test: SKIPPED (no tables)');
    }

    console.log('');
    console.log('─────────────────────────────');
    console.log('📊 Test Summary');
    console.log('');
    console.log('DynamoDB Connection: ✅ PASSED');

    if (response.TableNames && response.TableNames.length > 0) {
      console.log('Session Operations:  ✅ PASSED (if sessions table exists)');
    } else {
      console.log('Session Operations:  ⚠️  SKIPPED (no tables)');
    }

    console.log('');
    console.log('Next steps:');
    if (!response.TableNames || response.TableNames.length === 0) {
      console.log('1. Create DynamoDB tables:');
      console.log('   - Sessions table: nexora-sessions (primary key: id)');
      console.log('   - Main table: nexora-prod (primary key: id)');
      console.log('');
      console.log('   AWS Console → DynamoDB → Create table');
      console.log('   - Table name: nexora-sessions');
      console.log('   - Partition key: id (String)');
      console.log('   - Enable TTL on "ttl" attribute (for auto-cleanup)');
    } else {
      console.log('1. DynamoDB is ready to use!');
      console.log('2. Update application code to use DynamoDBService');
      console.log('3. Consider using DynamoDB for:');
      console.log('   - User sessions (fast read/write)');
      console.log('   - Rate limiting counters');
      console.log('   - Cache data');
      console.log('   - Real-time analytics');
    }
    console.log('');
  } catch (error) {
    console.error('❌ DynamoDB Connection Test: FAILED');
    console.error(`   Error: ${error.message}`);
    console.error('');

    if (error.name === 'UnrecognizedClientException') {
      console.error('💡 Possible issues:');
      console.error('   - AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY is incorrect');
      console.error('   - IAM user does not exist');
      console.error('   - Credentials have been deactivated');
    } else if (error.name === 'AccessDeniedException') {
      console.error('💡 Possible issues:');
      console.error('   - IAM user lacks DynamoDB permissions');
      console.error('   - Add AmazonDynamoDBFullAccess policy to IAM user');
      console.error('   - Or create custom policy with dynamodb:ListTables permission');
    } else if (error.message.includes('Region')) {
      console.error('💡 Possible issues:');
      console.error('   - AWS_REGION is invalid or not set');
      console.error('   - Use: ap-south-1 (Mumbai), us-east-1 (Virginia), etc.');
    }

    console.error('');
    process.exit(1);
  }
}

// Run the test
testDynamoDBConnection();
