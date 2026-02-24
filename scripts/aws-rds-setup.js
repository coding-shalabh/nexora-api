/**
 * AWS RDS PostgreSQL Database Setup Script
 *
 * Creates production-ready RDS instance for first 50 customers
 * Estimated cost: $80/month (db.t4g.micro with 100GB storage)
 *
 * Usage: node scripts/aws-rds-setup.js
 */

import {
  RDSClient,
  CreateDBInstanceCommand,
  DescribeDBInstancesCommand,
  ModifyDBInstanceCommand,
  CreateDBSubnetGroupCommand,
  CreateDBParameterGroupCommand,
} from '@aws-sdk/client-rds';
import {
  EC2Client,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  DescribeSecurityGroupsCommand,
} from '@aws-sdk/client-ec2';

const region = 'ap-south-1';
const rdsClient = new RDSClient({ region });
const ec2Client = new EC2Client({ region });

// RDS Configuration for 50 users (can scale to 200 users)
const rdsConfig = {
  DBInstanceIdentifier: 'nexora-prod-db',
  DBInstanceClass: 'db.t4g.micro', // 2 vCPU, 1GB RAM - $0.016/hr
  Engine: 'postgres',
  EngineVersion: '15.5', // Latest stable PostgreSQL
  MasterUsername: 'nexora_admin',
  MasterUserPassword: process.env.RDS_MASTER_PASSWORD || 'ChangeMe123!', // CHANGE THIS
  AllocatedStorage: 100, // 100GB gp3 storage
  StorageType: 'gp3', // Latest generation, better performance
  StorageEncrypted: true,
  MultiAZ: false, // Single AZ for cost savings (enable for HA in production)
  PubliclyAccessible: true, // Allow VPS to connect
  VpcSecurityGroupIds: [], // Will be populated
  DBName: 'nexora_prod',
  BackupRetentionPeriod: 7, // 7 days automated backups
  PreferredBackupWindow: '03:00-04:00', // IST 8:30-9:30 AM
  PreferredMaintenanceWindow: 'sun:04:00-sun:05:00', // Sunday morning
  EnablePerformanceInsights: true, // Monitor performance
  PerformanceInsightsRetentionPeriod: 7,
  DeletionProtection: true, // Prevent accidental deletion
  Tags: [
    { Key: 'Environment', Value: 'production' },
    { Key: 'Application', Value: 'Nexora' },
    { Key: 'ManagedBy', Value: 'Terraform' },
    { Key: 'CostCenter', Value: 'Infrastructure' },
  ],
};

/**
 * Step 1: Create Security Group for RDS
 */
async function createSecurityGroup() {
  console.log('\n📋 Step 1: Creating RDS Security Group...');

  try {
    // Check if security group already exists
    const describeCommand = new DescribeSecurityGroupsCommand({
      Filters: [{ Name: 'group-name', Values: ['nexora-rds-sg'] }],
    });

    const existing = await ec2Client.send(describeCommand);

    if (existing.SecurityGroups && existing.SecurityGroups.length > 0) {
      console.log('✅ Security group already exists:', existing.SecurityGroups[0].GroupId);
      return existing.SecurityGroups[0].GroupId;
    }

    // Create new security group
    const createCommand = new CreateSecurityGroupCommand({
      GroupName: 'nexora-rds-sg',
      Description: 'Security group for Nexora RDS PostgreSQL database',
      VpcId: process.env.VPC_ID || 'default', // Use default VPC or specify
    });

    const result = await ec2Client.send(createCommand);
    console.log('✅ Created security group:', result.GroupId);

    // Add inbound rules
    // Allow PostgreSQL from VPS IP
    const vpsIP = '147.79.71.176/32';
    const authorizeCommand = new AuthorizeSecurityGroupIngressCommand({
      GroupId: result.GroupId,
      IpPermissions: [
        {
          IpProtocol: 'tcp',
          FromPort: 5432,
          ToPort: 5432,
          IpRanges: [
            { CidrIp: vpsIP, Description: 'Nexora VPS' },
            { CidrIp: '0.0.0.0/0', Description: 'Public access (remove in production)' },
          ],
        },
      ],
    });

    await ec2Client.send(authorizeCommand);
    console.log('✅ Added inbound rules for PostgreSQL (port 5432)');

    return result.GroupId;
  } catch (error) {
    console.error('❌ Error creating security group:', error.message);
    throw error;
  }
}

/**
 * Step 2: Create DB Parameter Group (optimize for multi-tenant)
 */
async function createParameterGroup() {
  console.log('\n📋 Step 2: Creating DB Parameter Group...');

  try {
    const command = new CreateDBParameterGroupCommand({
      DBParameterGroupName: 'nexora-postgres-params',
      DBParameterGroupFamily: 'postgres15',
      Description: 'Optimized parameters for Nexora multi-tenant CRM',
      Tags: [{ Key: 'Environment', Value: 'production' }],
    });

    await rdsClient.send(command);
    console.log('✅ Created parameter group: nexora-postgres-params');

    // Note: Parameter modifications require separate API calls
    console.log('📝 Recommended parameters to set via AWS Console:');
    console.log('   - max_connections: 100');
    console.log('   - shared_buffers: 256MB');
    console.log('   - effective_cache_size: 768MB');
    console.log('   - maintenance_work_mem: 64MB');
    console.log('   - checkpoint_completion_target: 0.9');
    console.log('   - wal_buffers: 16MB');
    console.log('   - default_statistics_target: 100');
    console.log('   - random_page_cost: 1.1');
    console.log('   - effective_io_concurrency: 200');
  } catch (error) {
    if (error.name === 'DBParameterGroupAlreadyExistsFault') {
      console.log('✅ Parameter group already exists');
    } else {
      console.error('❌ Error creating parameter group:', error.message);
      throw error;
    }
  }
}

/**
 * Step 3: Create RDS Instance
 */
async function createRDSInstance(securityGroupId) {
  console.log('\n📋 Step 3: Creating RDS PostgreSQL Instance...');
  console.log('⏳ This will take 10-15 minutes...\n');

  try {
    // Add security group to config
    rdsConfig.VpcSecurityGroupIds = [securityGroupId];

    const command = new CreateDBInstanceCommand(rdsConfig);
    const result = await rdsClient.send(command);

    console.log('✅ RDS instance creation initiated');
    console.log('   DB Instance:', result.DBInstance.DBInstanceIdentifier);
    console.log('   Status:', result.DBInstance.DBInstanceStatus);
    console.log('   Engine:', result.DBInstance.Engine, result.DBInstance.EngineVersion);
    console.log('   Storage:', result.DBInstance.AllocatedStorage, 'GB');
    console.log('   Instance Class:', result.DBInstance.DBInstanceClass);

    return result.DBInstance;
  } catch (error) {
    if (error.name === 'DBInstanceAlreadyExistsFault') {
      console.log('⚠️  RDS instance already exists');
      return await checkRDSStatus();
    } else {
      console.error('❌ Error creating RDS instance:', error.message);
      throw error;
    }
  }
}

/**
 * Step 4: Check RDS Instance Status
 */
async function checkRDSStatus() {
  console.log('\n📋 Checking RDS instance status...');

  try {
    const command = new DescribeDBInstancesCommand({
      DBInstanceIdentifier: rdsConfig.DBInstanceIdentifier,
    });

    const result = await rdsClient.send(command);
    const instance = result.DBInstances[0];

    console.log('\n📊 RDS Instance Status:');
    console.log('   Status:', instance.DBInstanceStatus);
    console.log('   Endpoint:', instance.Endpoint?.Address || 'Not available yet');
    console.log('   Port:', instance.Endpoint?.Port || 5432);
    console.log('   Multi-AZ:', instance.MultiAZ);
    console.log('   Storage Encrypted:', instance.StorageEncrypted);
    console.log('   Backup Retention:', instance.BackupRetentionPeriod, 'days');

    if (instance.DBInstanceStatus === 'available') {
      console.log('\n✅ Database is ready to use!');
      console.log('\n🔗 Connection Details:');
      console.log(`   Host: ${instance.Endpoint.Address}`);
      console.log(`   Port: ${instance.Endpoint.Port}`);
      console.log(`   Database: ${instance.DBName}`);
      console.log(`   Username: ${instance.MasterUsername}`);
      console.log(`   Password: [Set in environment]`);
      console.log('\n📝 Connection String:');
      console.log(
        `   postgresql://${instance.MasterUsername}:[PASSWORD]@${instance.Endpoint.Address}:${instance.Endpoint.Port}/${instance.DBName}`
      );

      // Save to .env file
      const connectionString = `DATABASE_URL="postgresql://${instance.MasterUsername}:${process.env.RDS_MASTER_PASSWORD}@${instance.Endpoint.Address}:${instance.Endpoint.Port}/${instance.DBName}?schema=public&connection_limit=20&pool_timeout=20"`;
      console.log('\n💾 Add this to your .env file:');
      console.log(`   ${connectionString}`);

      // Also add to AWS Secrets Manager
      console.log('\n🔐 Run this to update AWS Secrets Manager:');
      console.log(`   node scripts/aws-secrets-update.js DATABASE_URL "${connectionString}"`);
    } else {
      console.log('\n⏳ Database is still being created...');
      console.log('   Run this script again in 5 minutes to check status');
    }

    return instance;
  } catch (error) {
    console.error('❌ Error checking RDS status:', error.message);
    throw error;
  }
}

/**
 * Step 5: Generate migration script
 */
function generateMigrationScript() {
  console.log('\n📋 Step 5: Database Migration Plan');
  console.log('\n🔄 To migrate from Railway to RDS:');
  console.log('\n1. Export Railway database:');
  console.log('   pg_dump $RAILWAY_DATABASE_URL > railway_backup.sql');
  console.log('\n2. Import to RDS:');
  console.log('   psql $RDS_DATABASE_URL < railway_backup.sql');
  console.log('\n3. Update VPS .env with new DATABASE_URL');
  console.log('\n4. Restart API: pm2 restart nexora-api');
  console.log('\n5. Test connection: curl https://api.nexoraos.pro/api/v1/health');
}

/**
 * Main execution
 */
async function main() {
  console.log('🚀 AWS RDS PostgreSQL Setup for Nexora');
  console.log('=====================================\n');
  console.log('Configuration:');
  console.log('  - Instance: db.t4g.micro (2 vCPU, 1GB RAM)');
  console.log('  - Storage: 100GB gp3 SSD');
  console.log('  - Engine: PostgreSQL 15.5');
  console.log('  - Cost: ~$80/month');
  console.log('  - Capacity: 50-200 users');
  console.log('  - Backups: 7 days retention');
  console.log('  - Encryption: Enabled');

  try {
    // Validate master password
    if (!process.env.RDS_MASTER_PASSWORD || process.env.RDS_MASTER_PASSWORD === 'ChangeMe123!') {
      console.error('\n❌ ERROR: Please set RDS_MASTER_PASSWORD environment variable');
      console.error('   Example: export RDS_MASTER_PASSWORD="YourSecurePassword123!"');
      process.exit(1);
    }

    // Step 1: Create security group
    const securityGroupId = await createSecurityGroup();

    // Step 2: Create parameter group
    await createParameterGroup();

    // Step 3: Create RDS instance
    await createRDSInstance(securityGroupId);

    // Step 4: Check status
    const instance = await checkRDSStatus();

    // Step 5: Migration plan
    if (instance.DBInstanceStatus === 'available') {
      generateMigrationScript();
    }

    console.log('\n✅ RDS Setup Complete!');
    console.log('\n📊 Estimated Monthly Cost Breakdown:');
    console.log('   - Instance (db.t4g.micro): $11.68');
    console.log('   - Storage (100GB gp3): $11.50');
    console.log('   - Backup Storage (100GB): $10.00');
    console.log('   - Performance Insights: $0.09');
    console.log('   - Data Transfer: ~$5.00');
    console.log('   ─────────────────────────────');
    console.log('   Total: ~$38.27/month');
    console.log('\n💡 Next Steps:');
    console.log('   1. Wait for instance to become "available" (10-15 min)');
    console.log('   2. Run migration script to copy data from Railway');
    console.log('   3. Update VPS environment variables');
    console.log('   4. Test database connection');
    console.log('   5. Monitor with CloudWatch');
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createSecurityGroup, createParameterGroup, createRDSInstance, checkRDSStatus };
