/**
 * AWS Production Deployment Orchestrator
 *
 * Complete end-to-end AWS setup for first 50 customers
 * Runs all setup scripts in correct order and verifies deployment
 *
 * Usage: node scripts/aws-deploy-production.js [--skip-rds] [--skip-s3] [--skip-ses] [--skip-dynamodb]
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// Deployment configuration
const deploymentConfig = {
  steps: [
    {
      id: 'secrets',
      name: 'AWS Secrets Manager',
      script: 'aws-secrets-setup.js',
      required: true,
      estimatedTime: '1 minute',
      cost: '$0.40/month',
    },
    {
      id: 'rds',
      name: 'RDS PostgreSQL Database',
      script: 'aws-rds-setup.js',
      required: true,
      estimatedTime: '10-15 minutes',
      cost: '$38.27/month',
    },
    {
      id: 's3',
      name: 'S3 File Storage',
      script: 'aws-s3-setup.js',
      required: true,
      estimatedTime: '2-3 minutes',
      cost: '$15.41/month',
    },
    {
      id: 'dynamodb',
      name: 'DynamoDB Tables',
      script: 'aws-dynamodb-tables.js',
      required: true,
      estimatedTime: '3-5 minutes',
      cost: '$11.25/month',
    },
    {
      id: 'ses',
      name: 'SES Email Service',
      script: 'aws-ses-setup.js',
      required: true,
      estimatedTime: '2-3 minutes',
      cost: '$15.00/month',
    },
  ],
  totalCost: {
    monthly: 80.33,
    yearly: 963.96,
    currency: 'USD',
  },
};

/**
 * Check prerequisites
 */
async function checkPrerequisites() {
  console.log('\n🔍 Checking Prerequisites...\n');

  const checks = [
    {
      name: 'AWS Credentials',
      check: async () => {
        const hasKey = process.env.AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
        const hasSecret = process.env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
        return hasKey && hasSecret;
      },
      error: 'AWS credentials not found in environment variables',
    },
    {
      name: 'AWS Region',
      check: async () => {
        return (
          process.env.AWS_REGION === 'ap-south-1' || process.env.AWS_DEFAULT_REGION === 'ap-south-1'
        );
      },
      error: 'AWS_REGION should be set to ap-south-1',
    },
    {
      name: 'RDS Master Password',
      check: async () => {
        return (
          process.env.RDS_MASTER_PASSWORD && process.env.RDS_MASTER_PASSWORD !== 'ChangeMe123!'
        );
      },
      error: 'RDS_MASTER_PASSWORD not set or using default password',
    },
    {
      name: 'Node.js Version',
      check: async () => {
        const version = process.version.match(/^v(\d+)/)[1];
        return parseInt(version) >= 18;
      },
      error: 'Node.js 18+ required',
    },
    {
      name: 'Internet Connection',
      check: async () => {
        try {
          await execAsync('ping -c 1 aws.amazon.com');
          return true;
        } catch {
          return false;
        }
      },
      error: 'No internet connection or cannot reach AWS',
    },
  ];

  let allPassed = true;

  for (const check of checks) {
    try {
      const passed = await check.check();
      console.log(`${passed ? '✅' : '❌'} ${check.name}`);

      if (!passed) {
        console.log(`   ⚠️  ${check.error}`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ ${check.name}`);
      console.log(`   ⚠️  ${check.error}`);
      allPassed = false;
    }
  }

  if (!allPassed) {
    console.log('\n❌ Prerequisites check failed. Please fix the issues above and try again.');
    process.exit(1);
  }

  console.log('\n✅ All prerequisites met!\n');
}

/**
 * Run deployment step
 */
async function runDeploymentStep(step, skipFlags) {
  if (skipFlags[step.id]) {
    console.log(`⏭️  Skipped: ${step.name}`);
    return { success: true, skipped: true };
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 Step: ${step.name}`);
  console.log(`   Script: ${step.script}`);
  console.log(`   Time: ${step.estimatedTime}`);
  console.log(`   Cost: ${step.cost}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    const scriptPath = path.join(process.cwd(), 'scripts', step.script);

    // Check if script exists
    try {
      await fs.access(scriptPath);
    } catch {
      throw new Error(`Script not found: ${scriptPath}`);
    }

    // Run script
    const { stdout, stderr } = await execAsync(`node ${scriptPath}`, {
      env: { ...process.env },
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });

    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);

    console.log(`\n✅ Completed: ${step.name}\n`);
    return { success: true, skipped: false };
  } catch (error) {
    console.error(`\n❌ Failed: ${step.name}`);
    console.error(`   Error: ${error.message}`);

    if (step.required) {
      console.error('\n⚠️  This is a required step. Deployment cannot continue.');
      throw error;
    }

    return { success: false, skipped: false, error: error.message };
  }
}

/**
 * Generate deployment report
 */
function generateDeploymentReport(results) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 DEPLOYMENT SUMMARY');
  console.log('='.repeat(80) + '\n');

  const completed = results.filter((r) => r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`✅ Completed: ${completed}/${deploymentConfig.steps.length}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Failed: ${failed}\n`);

  console.log('📋 Steps:');
  deploymentConfig.steps.forEach((step, index) => {
    const result = results[index];
    const icon = result.skipped ? '⏭️ ' : result.success ? '✅' : '❌';
    console.log(`   ${icon} ${step.name} - ${step.cost}`);
  });

  console.log(`\n💰 Total Monthly Cost: $${deploymentConfig.totalCost.monthly}/month`);
  console.log(`💵 Total Yearly Cost: $${deploymentConfig.totalCost.yearly}/year`);

  console.log('\n' + '='.repeat(80) + '\n');
}

/**
 * Generate next steps checklist
 */
function generateNextSteps() {
  console.log('📝 NEXT STEPS CHECKLIST\n');
  console.log('═'.repeat(80) + '\n');

  const steps = [
    {
      category: '1️⃣  Database Migration',
      tasks: [
        'Wait for RDS instance to become "available" (10-15 min)',
        'Export Railway database: pg_dump $RAILWAY_DATABASE_URL > railway_backup.sql',
        'Import to RDS: psql $RDS_DATABASE_URL < railway_backup.sql',
        'Run Prisma migrations: npx prisma migrate deploy',
        'Verify data integrity: Check row counts match',
      ],
    },
    {
      category: '2️⃣  DNS Configuration',
      tasks: [
        'Add SES DKIM records to nexoraos.pro DNS',
        'Add SPF record: v=spf1 include:amazonses.com ~all',
        'Add DMARC record: v=DMARC1; p=quarantine; rua=mailto:postmaster@nexoraos.pro',
        'Wait 24-48 hours for DNS propagation',
        'Verify domain in SES console',
      ],
    },
    {
      category: '3️⃣  VPS Configuration',
      tasks: [
        'SSH into VPS: ssh -i ~/.ssh/nexora_vps_key root@147.79.71.176',
        'Update .env with new DATABASE_URL from RDS',
        'Update AWS_S3_BUCKET_NAME=nexora-prod-files',
        'Update AWS_SES_FROM_EMAIL=noreply@nexoraos.pro',
        'Restart API: pm2 restart nexora-api',
        'Test connection: curl https://api.nexoraos.pro/api/v1/health',
      ],
    },
    {
      category: '4️⃣  Service Updates',
      tasks: [
        'Update email service to use SES (src/services/email.service.js)',
        'Update S3 service for file uploads (src/services/aws-s3.service.js)',
        'Update session storage to use DynamoDB (src/common/middleware/authenticate.js)',
        'Add cache layer with DynamoDB (src/services/cache.service.js)',
        'Test all integrations end-to-end',
      ],
    },
    {
      category: '5️⃣  Performance Optimization',
      tasks: [
        'Add database indexes: CREATE INDEX idx_tenant_id ON contacts(tenant_id)',
        'Configure Prisma connection pool: pool_size=20, timeout=20',
        'Set up ElastiCache Redis for caching (optional, $20/month)',
        'Configure CloudFront CDN for S3 (optional, improves latency)',
        'Enable CloudWatch monitoring and alerts',
      ],
    },
    {
      category: '6️⃣  Testing & Validation',
      tasks: [
        'Test user signup with SES email',
        'Test file upload to S3',
        'Test file download from S3',
        'Test session persistence with DynamoDB',
        'Load test with 50 concurrent users',
        'Monitor CloudWatch metrics for 24 hours',
      ],
    },
    {
      category: '7️⃣  SES Production Access',
      tasks: [
        'Open AWS Console → SES → Account dashboard',
        'Click "Request production access"',
        'Fill form: Transactional emails for CRM platform',
        'Wait 24-48 hours for approval',
        'Test sending to non-verified email addresses',
      ],
    },
    {
      category: '8️⃣  Backup & Disaster Recovery',
      tasks: [
        'Verify RDS automated backups (7 days retention)',
        'Test RDS point-in-time recovery',
        'Enable S3 versioning (already done)',
        'Set up cross-region replication (optional)',
        'Document recovery procedures',
      ],
    },
    {
      category: '9️⃣  Monitoring & Alerts',
      tasks: [
        'Set up CloudWatch dashboard for all services',
        'Create alarm for RDS CPU > 80%',
        'Create alarm for S3 storage > 200GB',
        'Create alarm for SES bounce rate > 5%',
        'Create alarm for API errors > 100/hour',
        'Set up SNS notifications to email/Slack',
      ],
    },
    {
      category: '🔟 Security Hardening',
      tasks: [
        'Rotate AWS access keys (every 90 days)',
        'Enable AWS CloudTrail for audit logs',
        'Configure VPC security groups (restrict RDS access)',
        'Enable AWS GuardDuty for threat detection',
        'Review IAM permissions (principle of least privilege)',
        'Set up AWS WAF for API protection (optional)',
      ],
    },
  ];

  steps.forEach((section) => {
    console.log(`${section.category}`);
    console.log('─'.repeat(80));
    section.tasks.forEach((task, index) => {
      console.log(`   [ ] ${index + 1}. ${task}`);
    });
    console.log('');
  });

  console.log('═'.repeat(80) + '\n');
}

/**
 * Generate cost breakdown
 */
function generateCostBreakdown() {
  console.log('💰 DETAILED COST BREAKDOWN (50 users)\n');
  console.log('═'.repeat(80) + '\n');

  const costs = [
    { service: 'RDS PostgreSQL (db.t4g.micro)', monthly: 38.27, yearly: 459.24 },
    { service: 'S3 Storage (250GB + requests)', monthly: 15.41, yearly: 184.92 },
    { service: 'DynamoDB (provisioned)', monthly: 11.25, yearly: 135.0 },
    { service: 'SES Email (150K emails)', monthly: 15.0, yearly: 180.0 },
    { service: 'Secrets Manager', monthly: 0.4, yearly: 4.8 },
    { service: 'VPS (existing)', monthly: 8.0, yearly: 96.0 },
    { service: '─'.repeat(40), monthly: '─'.repeat(8), yearly: '─'.repeat(8) },
    { service: 'TOTAL', monthly: 88.33, yearly: 1059.96 },
  ];

  console.log('Service'.padEnd(45) + 'Monthly'.padEnd(12) + 'Yearly');
  console.log('─'.repeat(80));

  costs.forEach((cost) => {
    const monthlyStr =
      typeof cost.monthly === 'number' ? `$${cost.monthly.toFixed(2)}` : cost.monthly;
    const yearlyStr = typeof cost.yearly === 'number' ? `$${cost.yearly.toFixed(2)}` : cost.yearly;
    console.log(cost.service.padEnd(45) + monthlyStr.padEnd(12) + yearlyStr);
  });

  console.log('\n💡 Optimization Opportunities:\n');
  console.log('   - Use Reserved Instances for RDS: Save 30% ($13/month)');
  console.log('   - Switch to On-Demand DynamoDB: Pay only for usage');
  console.log('   - Use CloudFront CDN: Reduce S3 data transfer costs');
  console.log('   - Implement caching: Reduce database load and costs');
  console.log('   - Monitor and right-size: Adjust resources based on actual usage\n');

  console.log('📊 Cost Per Customer:\n');
  console.log('   - 1 tenant (50 users): $88.33/month');
  console.log('   - Revenue per tenant: ₹60,000/month (~$720)');
  console.log('   - Infrastructure cost: $88.33/month (~₹7,360)');
  console.log('   - Profit margin: 87.7% (₹52,640/month per tenant)\n');

  console.log('═'.repeat(80) + '\n');
}

/**
 * Main execution
 */
async function main() {
  console.log('\n' + '█'.repeat(80));
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█' + ' AWS PRODUCTION DEPLOYMENT - NEXORA CRM '.center(78) + '█');
  console.log('█' + ' First 50 Customers - End-to-End Setup '.center(78) + '█');
  console.log('█' + ' '.repeat(78) + '█');
  console.log('█'.repeat(80) + '\n');

  // Parse command line arguments
  const args = process.argv.slice(2);
  const skipFlags = {
    rds: args.includes('--skip-rds'),
    s3: args.includes('--skip-s3'),
    ses: args.includes('--skip-ses'),
    dynamodb: args.includes('--skip-dynamodb'),
  };

  console.log('📋 Deployment Configuration:');
  console.log(`   Steps: ${deploymentConfig.steps.length}`);
  console.log(`   Region: ap-south-1 (Mumbai)`);
  console.log(`   Capacity: 50-200 users`);
  console.log(`   Estimated Time: 20-30 minutes`);
  console.log(`   Monthly Cost: $${deploymentConfig.totalCost.monthly}`);

  if (Object.values(skipFlags).some((v) => v)) {
    console.log('\n⚠️  Skipping:');
    Object.entries(skipFlags).forEach(([key, value]) => {
      if (value) console.log(`   - ${key.toUpperCase()}`);
    });
  }

  // Check prerequisites
  await checkPrerequisites();

  // Confirm deployment
  console.log('\n⚠️  WARNING: This will create AWS resources that incur costs.');
  console.log('   Press Ctrl+C to cancel, or wait 10 seconds to continue...\n');
  await new Promise((resolve) => setTimeout(resolve, 10000));

  console.log('🚀 Starting deployment...\n');

  // Run deployment steps
  const results = [];
  const startTime = Date.now();

  for (const step of deploymentConfig.steps) {
    const result = await runDeploymentStep(step, skipFlags);
    results.push(result);

    if (!result.success && step.required) {
      console.log('\n❌ Deployment failed at required step. Stopping.');
      break;
    }
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000 / 60).toFixed(1);

  // Generate reports
  generateDeploymentReport(results);
  console.log(`⏱️  Total deployment time: ${duration} minutes\n`);

  generateCostBreakdown();
  generateNextSteps();

  console.log('✅ Deployment script complete!\n');
  console.log('📚 Documentation:');
  console.log('   - Infrastructure: .claude/skills/nexora-features/infrastructure/README.md');
  console.log('   - Cost Analysis: docs/ENTERPRISE_50_USER_ANALYSIS.md');
  console.log('   - Per-Tenant Usage: docs/PER_TENANT_USAGE_BREAKDOWN.md\n');

  console.log('💡 Quick Test Commands:');
  console.log('   # Check RDS status');
  console.log('   aws rds describe-db-instances --db-instance-identifier nexora-prod-db');
  console.log('   # List S3 buckets');
  console.log('   aws s3 ls');
  console.log('   # Check SES verification');
  console.log('   aws sesv2 get-email-identity --email-identity nexoraos.pro');
  console.log('   # List DynamoDB tables');
  console.log('   aws dynamodb list-tables\n');

  console.log('█'.repeat(80) + '\n');
}

// Helper for String.prototype.center
String.prototype.center = function (width) {
  const padding = Math.max(0, width - this.length);
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return ' '.repeat(left) + this + ' '.repeat(right);
};

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });
}

export { checkPrerequisites, runDeploymentStep, generateDeploymentReport };
