/**
 * AWS DynamoDB Tables Setup Script
 *
 * Creates DynamoDB tables for sessions, cache, and real-time data
 * Estimated cost: $15/month for 50-user workload
 *
 * Usage: node scripts/aws-dynamodb-tables.js
 */

import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
  UpdateTimeToLiveCommand,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';

const region = 'ap-south-1';
const dynamoDBClient = new DynamoDBClient({ region });

// Table Configurations
const tables = [
  {
    TableName: 'nexora-sessions',
    KeySchema: [
      { AttributeName: 'sessionId', KeyType: 'HASH' }, // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: 'sessionId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'UserIdIndex',
        KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
        Projection: {
          ProjectionType: 'ALL',
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 2,
          WriteCapacityUnits: 2,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5, // 5 RCU = ~5 sessions read/sec
      WriteCapacityUnits: 5, // 5 WCU = ~5 sessions write/sec
    },
    TTL: {
      AttributeName: 'ttl',
      Enabled: true,
    },
    Tags: [
      { Key: 'Environment', Value: 'production' },
      { Key: 'Application', Value: 'Nexora' },
      { Key: 'Purpose', Value: 'User sessions' },
    ],
  },
  {
    TableName: 'nexora-cache',
    KeySchema: [
      { AttributeName: 'cacheKey', KeyType: 'HASH' }, // Partition key
      { AttributeName: 'tenantId', KeyType: 'RANGE' }, // Sort key
    ],
    AttributeDefinitions: [
      { AttributeName: 'cacheKey', AttributeType: 'S' },
      { AttributeName: 'tenantId', AttributeType: 'S' },
      { AttributeName: 'category', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'CategoryIndex',
        KeySchema: [
          { AttributeName: 'category', KeyType: 'HASH' },
          { AttributeName: 'tenantId', KeyType: 'RANGE' },
        ],
        Projection: {
          ProjectionType: 'ALL',
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 2,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 10, // 10 RCU = ~10 cache reads/sec
      WriteCapacityUnits: 5, // 5 WCU = ~5 cache writes/sec
    },
    TTL: {
      AttributeName: 'expiresAt',
      Enabled: true,
    },
    Tags: [
      { Key: 'Environment', Value: 'production' },
      { Key: 'Application', Value: 'Nexora' },
      { Key: 'Purpose', Value: 'Application cache' },
    ],
  },
  {
    TableName: 'nexora-realtime-events',
    KeySchema: [
      { AttributeName: 'eventId', KeyType: 'HASH' }, // Partition key
      { AttributeName: 'timestamp', KeyType: 'RANGE' }, // Sort key
    ],
    AttributeDefinitions: [
      { AttributeName: 'eventId', AttributeType: 'S' },
      { AttributeName: 'timestamp', AttributeType: 'N' },
      { AttributeName: 'tenantId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'TenantTimeIndex',
        KeySchema: [
          { AttributeName: 'tenantId', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' },
        ],
        Projection: {
          ProjectionType: 'ALL',
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
      {
        IndexName: 'UserTimeIndex',
        KeySchema: [
          { AttributeName: 'userId', KeyType: 'HASH' },
          { AttributeName: 'timestamp', KeyType: 'RANGE' },
        ],
        Projection: {
          ProjectionType: 'KEYS_ONLY', // Only event IDs and timestamps
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 3,
          WriteCapacityUnits: 3,
        },
      },
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 10, // Higher writes for real-time events
    },
    TTL: {
      AttributeName: 'expiresAt',
      Enabled: true,
    },
    Tags: [
      { Key: 'Environment', Value: 'production' },
      { Key: 'Application', Value: 'Nexora' },
      { Key: 'Purpose', Value: 'Real-time notifications and events' },
    ],
  },
];

/**
 * Step 1: Create DynamoDB Table
 */
async function createTable(tableConfig) {
  console.log(`\n📋 Creating table: ${tableConfig.TableName}...`);

  try {
    // Check if table already exists
    try {
      const describeCommand = new DescribeTableCommand({
        TableName: tableConfig.TableName,
      });
      const existing = await dynamoDBClient.send(describeCommand);

      console.log(`✅ Table ${tableConfig.TableName} already exists`);
      console.log(`   Status: ${existing.Table.TableStatus}`);
      console.log(`   Items: ${existing.Table.ItemCount || 0}`);
      console.log(`   Size: ${((existing.Table.TableSizeBytes || 0) / 1024).toFixed(2)} KB`);

      return existing.Table;
    } catch (error) {
      if (error.name !== 'ResourceNotFoundException') {
        throw error;
      }
    }

    // Create new table
    const createCommand = new CreateTableCommand(tableConfig);
    const result = await dynamoDBClient.send(createCommand);

    console.log(`✅ Created table: ${tableConfig.TableName}`);
    console.log(`   Status: ${result.TableDescription.TableStatus}`);
    console.log('   ⏳ Table is being created... (this takes 1-2 minutes)');

    // Wait for table to be active
    await waitForTable(tableConfig.TableName);

    // Enable TTL
    if (tableConfig.TTL) {
      await enableTTL(tableConfig.TableName, tableConfig.TTL.AttributeName);
    }

    return result.TableDescription;
  } catch (error) {
    console.error(`❌ Error creating table ${tableConfig.TableName}:`, error.message);
    throw error;
  }
}

/**
 * Step 2: Wait for table to become active
 */
async function waitForTable(tableName, maxAttempts = 30) {
  console.log(`   ⏳ Waiting for ${tableName} to become active...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const command = new DescribeTableCommand({ TableName: tableName });
      const result = await dynamoDBClient.send(command);

      if (result.Table.TableStatus === 'ACTIVE') {
        console.log(`   ✅ Table ${tableName} is now active`);
        return true;
      }

      console.log(`   ⏳ Attempt ${attempt}/${maxAttempts}: ${result.Table.TableStatus}`);
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds
    } catch (error) {
      console.error(`   ❌ Error checking table status:`, error.message);
      throw error;
    }
  }

  throw new Error(`Table ${tableName} did not become active after ${maxAttempts} attempts`);
}

/**
 * Step 3: Enable TTL
 */
async function enableTTL(tableName, attributeName) {
  console.log(`   🔧 Enabling TTL on ${tableName}...`);

  try {
    const command = new UpdateTimeToLiveCommand({
      TableName: tableName,
      TimeToLiveSpecification: {
        Enabled: true,
        AttributeName: attributeName,
      },
    });

    await dynamoDBClient.send(command);
    console.log(`   ✅ TTL enabled (${attributeName})`);
  } catch (error) {
    console.error(`   ❌ Error enabling TTL:`, error.message);
    // Don't throw - TTL is optional
  }
}

/**
 * Step 4: List all tables
 */
async function listTables() {
  console.log('\n📋 Listing all DynamoDB tables...');

  try {
    const command = new ListTablesCommand({});
    const result = await dynamoDBClient.send(command);

    console.log(`✅ Found ${result.TableNames.length} tables:`);
    result.TableNames.forEach((tableName, index) => {
      const isNexora = tableName.startsWith('nexora-');
      console.log(`   ${index + 1}. ${tableName} ${isNexora ? '(Nexora)' : ''}`);
    });
  } catch (error) {
    console.error('❌ Error listing tables:', error.message);
    throw error;
  }
}

/**
 * Step 5: Print usage examples
 */
function printUsageExamples() {
  console.log('\n📝 DynamoDB Usage Examples:');

  console.log('\n1️⃣ Store Session:');
  console.log(`
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { PutCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'ap-south-1' }));

await client.send(new PutCommand({
  TableName: 'nexora-sessions',
  Item: {
    sessionId: 'session_123',
    userId: 'user_456',
    data: { authenticated: true, role: 'admin' },
    ttl: Math.floor(Date.now() / 1000) + 86400 // Expires in 24 hours
  }
}));
  `);

  console.log('\n2️⃣ Get Session:');
  console.log(`
import { GetCommand } from '@aws-sdk/lib-dynamodb';

const result = await client.send(new GetCommand({
  TableName: 'nexora-sessions',
  Key: { sessionId: 'session_123' }
}));

console.log(result.Item);
  `);

  console.log('\n3️⃣ Cache Data:');
  console.log(`
import { PutCommand } from '@aws-sdk/lib-dynamodb';

await client.send(new PutCommand({
  TableName: 'nexora-cache',
  Item: {
    cacheKey: 'contacts_list',
    tenantId: 'tenant_789',
    category: 'contacts',
    data: [...], // Your cached data
    expiresAt: Math.floor(Date.now() / 1000) + 3600 // 1 hour cache
  }
}));
  `);

  console.log('\n4️⃣ Query by Tenant:');
  console.log(`
import { QueryCommand } from '@aws-sdk/lib-dynamodb';

const result = await client.send(new QueryCommand({
  TableName: 'nexora-realtime-events',
  IndexName: 'TenantTimeIndex',
  KeyConditionExpression: 'tenantId = :tenantId AND #timestamp > :startTime',
  ExpressionAttributeNames: {
    '#timestamp': 'timestamp'
  },
  ExpressionAttributeValues: {
    ':tenantId': 'tenant_789',
    ':startTime': Date.now() - 3600000 // Last hour
  }
}));

console.log('Recent events:', result.Items);
  `);
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 AWS DynamoDB Tables Setup for Nexora');
  console.log('========================================\n');
  console.log('Configuration:');
  console.log('  - Tables: 3 (sessions, cache, realtime-events)');
  console.log('  - Region: ap-south-1 (Mumbai)');
  console.log('  - Mode: Provisioned throughput');
  console.log('  - TTL: Enabled for auto-cleanup');

  try {
    // Create all tables
    for (const tableConfig of tables) {
      await createTable(tableConfig);
    }

    // List all tables
    await listTables();

    // Print usage examples
    printUsageExamples();

    console.log('\n✅ DynamoDB Setup Complete!');
    console.log('\n📊 Estimated Monthly Cost (50 users):');
    console.log('   - Sessions table (5 RCU, 5 WCU): $2.50');
    console.log('   - Cache table (10 RCU, 5 WCU): $4.00');
    console.log('   - Events table (5 RCU, 10 WCU): $4.50');
    console.log('   - Storage (1GB): $0.25');
    console.log('   ─────────────────────────────');
    console.log('   Total: ~$11.25/month');

    console.log('\n🔐 Environment Variables:');
    console.log('   AWS_DYNAMODB_REGION=ap-south-1');
    console.log('   AWS_DYNAMODB_SESSION_TABLE=nexora-sessions');
    console.log('   AWS_DYNAMODB_CACHE_TABLE=nexora-cache');
    console.log('   AWS_DYNAMODB_EVENTS_TABLE=nexora-realtime-events');

    console.log('\n💡 Next Steps:');
    console.log('   1. Update AWS Secrets Manager with table names');
    console.log('   2. Update DynamoDB service to use new tables');
    console.log('   3. Test session storage');
    console.log('   4. Test cache operations');
    console.log('   5. Monitor usage with CloudWatch');

    console.log('\n📈 Scaling Recommendations:');
    console.log('   - 50-200 users: Current config (5-10 RCU/WCU)');
    console.log('   - 200-500 users: Increase to 20-30 RCU/WCU');
    console.log('   - 500+ users: Consider switching to On-Demand mode');
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createTable, waitForTable, enableTTL, listTables };
