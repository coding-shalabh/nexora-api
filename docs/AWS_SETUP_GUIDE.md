# AWS Setup Guide for Nexora CRM

This guide walks you through setting up AWS services (S3, SES, Secrets Manager) for Nexora CRM while keeping the application hosted on your VPS.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      VPS (OVH)                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Nexora API (Node.js + Hono.js)                        │ │
│  │  - Hosted on VPS                                       │ │
│  │  - Uses AWS services for scalability                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                          ↓                                   │
│                  ┌──────────────┐                           │
│                  │  PostgreSQL  │                           │
│                  │  (Railway)   │                           │
│                  └──────────────┘                           │
└─────────────────────────────────────────────────────────────┘
                            ↓ ↑
              ┌─────────────────────────────────┐
              │         AWS Services            │
              │  ┌──────────┐  ┌──────────┐    │
              │  │ S3 Files │  │ SES Email│    │
              │  └──────────┘  └──────────┘    │
              │  ┌──────────────────────────┐  │
              │  │   Secrets Manager        │  │
              │  │   (Environment vars)     │  │
              │  └──────────────────────────┘  │
              └─────────────────────────────────┘
```

## Benefits of This Hybrid Approach

- ✅ **Cost-effective**: Only pay for AWS storage and email sends, not EC2 hosting
- ✅ **Scalable**: S3 and SES scale automatically with usage
- ✅ **Secure**: Environment variables in AWS Secrets Manager
- ✅ **Reliable**: AWS handles file storage and email delivery
- ✅ **Simple**: Keep VPS for hosting, AWS for specific services

## Prerequisites

1. **AWS Account**: Sign up at [aws.amazon.com](https://aws.amazon.com)
2. **IAM User**: Create IAM user with programmatic access
3. **VPS Access**: SSH access to your VPS server

## Step 1: Create IAM User

1. Go to **AWS Console** → **IAM** → **Users** → **Add users**
2. Set **User name**: `nexora-api-user`
3. Select **Access key - Programmatic access**
4. Click **Next: Permissions**
5. Choose **Attach existing policies directly**
6. Add these managed policies:
   - `AmazonS3FullAccess` (or create custom policy with specific bucket access)
   - `AmazonSESFullAccess` (or custom policy for sending only)
   - `SecretsManagerReadWrite`
7. Click **Next** → **Create user**
8. **Save the credentials**:
   - Access key ID: `AKIAIOSFODNN7EXAMPLE`
   - Secret access key: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`

> ⚠️ **IMPORTANT**: Save these credentials securely. You won't be able to see the secret key again!

## Step 2: Create S3 Buckets

### Option A: AWS Console (Recommended for beginners)

1. Go to **AWS Console** → **S3** → **Create bucket**
2. Create 3 buckets with these names:
   - `nexora-files-prod` (General file uploads)
   - `nexora-email-attachments` (Email attachments)
   - `nexora-backups` (Database/system backups)

3. For each bucket:
   - **Region**: `ap-south-1` (Mumbai) - Change if needed
   - **Block all public access**: Keep enabled (we'll use presigned URLs)
   - **Bucket Versioning**: Optional (recommended for backups bucket)
   - **Encryption**: Enable with SSE-S3
   - Click **Create bucket**

### Option B: AWS CLI (Automated)

```bash
# Install AWS CLI first: https://aws.amazon.com/cli/

# Configure credentials
aws configure

# Create buckets
aws s3 mb s3://nexora-files-prod --region ap-south-1
aws s3 mb s3://nexora-email-attachments --region ap-south-1
aws s3 mb s3://nexora-backups --region ap-south-1

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket nexora-files-prod \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
```

## Step 3: Set Up Amazon SES

### Configure Email Domain

1. Go to **AWS Console** → **SES** → **Verified identities**
2. Click **Create identity**
3. Choose **Domain** and enter: `nexoraos.pro`
4. Follow instructions to add DNS records (DKIM, SPF, DMARC)
5. Wait for verification (can take up to 72 hours)

### Sandbox Mode (For Testing)

While in sandbox mode, you can only send to verified email addresses:

1. Go to **SES** → **Verified identities** → **Create identity**
2. Choose **Email address**
3. Enter your test email: `admin@helixcode.in`
4. Check email and click verification link
5. Repeat for other test emails

### Request Production Access

To send to any email address:

1. Go to **SES** → **Account dashboard**
2. Click **Request production access**
3. Fill out the form:
   - **Use case**: Transactional emails (CRM system)
   - **Expected volume**: Start with 1000 emails/day
   - **Compliance**: Yes, we follow best practices
4. Submit request (approval takes 1-2 business days)

### Configuration Set (Optional but Recommended)

1. Go to **SES** → **Configuration sets** → **Create set**
2. Set name: `nexora-emails`
3. Add event destinations:
   - **Bounces**: CloudWatch or SNS
   - **Complaints**: CloudWatch or SNS
   - **Deliveries**: CloudWatch (for analytics)

## Step 4: Configure AWS Secrets Manager

1. Create `.env.local` on your local machine:

```bash
cd nexora-api
cp .env.aws.example .env.local
```

2. Edit `.env.local` with your AWS credentials:

```bash
# AWS Configuration
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# AWS Services
AWS_SECRETS_MANAGER_SECRET_NAME=nexora-prod-secrets
AWS_S3_BUCKET_FILES=nexora-files-prod
AWS_S3_BUCKET_ATTACHMENTS=nexora-email-attachments
AWS_S3_BUCKET_BACKUPS=nexora-backups
AWS_SES_FROM_EMAIL=noreply@nexoraos.pro
AWS_SES_FROM_NAME=Nexora CRM
AWS_SES_CONFIGURATION_SET=nexora-emails

# Test email for SES verification
TEST_EMAIL=admin@helixcode.in
```

3. Add all other environment variables from your existing `.env`:

```bash
# Database
DATABASE_URL=postgresql://...
JWT_SECRET=your-jwt-secret
# ... etc
```

4. Push environment variables to AWS Secrets Manager:

```bash
node scripts/aws-secrets-setup.js
```

Expected output:

```
🔐 AWS Secrets Manager Setup
─────────────────────────────
Region: ap-south-1
Secret Name: nexora-prod-secrets

✅ Found 25 environment variables:
   - DATABASE_URL
   - JWT_SECRET
   - MSG91_AUTH_KEY
   ... etc

📤 Uploading to AWS Secrets Manager...
📝 Creating new secret "nexora-prod-secrets"...
✅ Secret created successfully!

Next steps:
1. Update your production server to load secrets from AWS
2. Configure AWS credentials on VPS
3. Test with: node scripts/test-aws-services.js
```

## Step 5: Test AWS Services Locally

Run the comprehensive test suite:

```bash
# Test all services
node scripts/test-aws-services.js

# Test S3 only
node scripts/test-aws-services.js s3

# Test SES only
node scripts/test-aws-services.js ses
```

Expected output for successful test:

```
🧪 AWS Services Test
─────────────────────────────
✅ AWS credentials configured

📦 Testing S3 Service...

1️⃣  Uploading test file...
   ✅ File uploaded successfully
   📍 URL: https://nexora-files-prod.s3.ap-south-1.amazonaws.com/tests/abc123.txt
   🔑 Key: tests/abc123.txt

2️⃣  Checking if file exists...
   ✅ File exists: true

3️⃣  Generating presigned download URL...
   ✅ Download URL generated (valid for 5 minutes)

4️⃣  Generating presigned upload URL...
   ✅ Upload URL generated

5️⃣  Cleaning up - deleting test file...
   ✅ Test file deleted

✅ S3 Service Test: PASSED

📧 Testing SES Service...
📮 Test recipient: admin@helixcode.in

1️⃣  Sending plain text email...
   ✅ Plain text email sent
   📬 Message ID: 0100018d1234abcd...

2️⃣  Sending HTML email...
   ✅ HTML email sent
   📬 Message ID: 0100018d5678efgh...

3️⃣  Sending verification email template...
   ✅ Verification email sent
   📬 Message ID: 0100018d9012ijkl...

✅ SES Service Test: PASSED

📥 Check your inbox for 3 test emails

─────────────────────────────
📊 Test Summary

S3 Service:  ✅ PASSED
SES Service: ✅ PASSED

✅ All AWS services are configured correctly!
```

## Step 6: Deploy to VPS

### Option A: Manual Deployment (Recommended)

1. **Copy AWS credentials to VPS**:

```bash
# Create .env.local on VPS
ssh -i "C:\Users\shala\.ssh\nexora_vps_key" root@147.79.71.176

cd /var/www/nexora-api

# Create .env.local with AWS credentials
nano .env.local
```

Add:

```bash
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_SECRETS_MANAGER_SECRET_NAME=nexora-prod-secrets
```

2. **Copy updated files to VPS**:

```bash
# From local machine
scp -i "C:\Users\shala\.ssh\nexora_vps_key" -r src/config/aws.js root@147.79.71.176:/var/www/nexora-api/src/config/
scp -i "C:\Users\shala\.ssh\nexora_vps_key" -r src/services/aws-s3.service.js root@147.79.71.176:/var/www/nexora-api/src/services/
scp -i "C:\Users\shala\.ssh\nexora_vps_key" -r src/services/aws-ses.service.js root@147.79.71.176:/var/www/nexora-api/src/services/
scp -i "C:\Users\shala\.ssh\nexora_vps_key" -r src/index.js root@147.79.71.176:/var/www/nexora-api/src/
```

3. **Restart API on VPS**:

```bash
ssh -i "C:\Users\shala\.ssh\nexora_vps_key" root@147.79.71.176 "cd /var/www/nexora-api && pm2 restart nexora-api"
```

4. **Check logs**:

```bash
ssh -i "C:\Users\shala\.ssh\nexora_vps_key" root@147.79.71.176 "pm2 logs nexora-api --lines 50"
```

Look for:

```
AWS configured, loading secrets from Secrets Manager...
AWS Secrets loaded (or using local .env as fallback)
```

### Option B: IAM Role (More Secure - for Production)

Instead of storing credentials on VPS, assign an IAM role to your VPS instance:

1. Create IAM role with same permissions as user
2. Attach role to VPS EC2 instance (if using AWS for VPS)
3. Remove `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` from `.env.local`
4. AWS SDK will automatically use IAM role credentials

## Step 7: Update Application Code

The integration is already complete! Here's what was added:

### S3 File Upload Example

```javascript
import { S3Service } from './services/aws-s3.service.js';

// Upload file
const result = await S3Service.uploadFile(fileBuffer, 'document.pdf', 'files', {
  folder: 'tenant-123/documents',
  contentType: 'application/pdf',
});

console.log(result.url); // Public URL
console.log(result.key); // S3 object key
```

### SES Email Sending Example

```javascript
import { SESService } from './services/aws-ses.service.js';

// Send verification email
await SESService.sendVerificationEmail(
  'user@example.com',
  'https://nexoraos.pro/verify?token=abc123',
  'John Doe'
);

// Send custom email
await SESService.sendEmail(
  'customer@company.com',
  'Welcome to Nexora CRM',
  '<h1>Welcome!</h1><p>Your account is ready.</p>',
  { isHtml: true }
);
```

## Cost Estimates

### S3 Storage

- **Standard Storage**: $0.023 per GB/month
- **Requests**:
  - PUT: $0.005 per 1,000 requests
  - GET: $0.0004 per 1,000 requests
- **Example**: 10 GB storage + 100k requests/month = ~$0.50/month

### SES Email

- **First 62,000 emails/month**: FREE (when sent from EC2/Lambda)
- **After 62,000**: $0.10 per 1,000 emails
- **Example**: 100,000 emails/month = $3.80/month

### Secrets Manager

- **Secret storage**: $0.40 per secret/month
- **API calls**: $0.05 per 10,000 calls
- **Example**: 1 secret + 100k calls/month = $0.90/month

### Total Estimated Cost

For a small-medium business with:

- 50 GB S3 storage
- 500k file requests
- 200k emails
- 1 secret

**Monthly Cost**: ~$18-20/month

Compare to:

- Managed file storage: $50-100/month
- Email service (SendGrid): $80-200/month
- **Savings**: $112-280/month (84-93% cheaper!)

## Monitoring and Maintenance

### CloudWatch Metrics

Monitor your AWS usage:

1. Go to **CloudWatch** → **Dashboards**
2. Create dashboard with:
   - S3: StorageBytes, NumberOfObjects
   - SES: Send, Bounce, Complaint
   - Secrets Manager: API call count

### Cost Alerts

Set up billing alerts:

1. Go to **Billing** → **Budgets** → **Create budget**
2. Set monthly budget: $25
3. Get email alerts at 80% and 100%

### Regular Tasks

- **Weekly**: Check SES bounce/complaint rates (keep < 5%)
- **Monthly**: Review S3 storage growth, clean old files
- **Quarterly**: Review IAM permissions, rotate access keys

## Troubleshooting

### S3 Issues

**Error**: `AccessDenied`

- Check IAM user has S3 permissions
- Verify bucket exists in correct region
- Check bucket policy doesn't block access

**Error**: `NoSuchBucket`

- Verify bucket name in .env matches AWS
- Ensure bucket created in correct region

### SES Issues

**Error**: `MessageRejected`

- Verify email/domain in SES (if in sandbox)
- Check SPF/DKIM DNS records
- Ensure from email matches verified identity

**Error**: `AccountSendingPausedException`

- SES account suspended (check bounce/complaint rates)
- Contact AWS support to resolve

### Secrets Manager Issues

**Error**: `ResourceNotFoundException`

- Secret not created yet, run setup script
- Check secret name in .env matches AWS

**Error**: `AccessDeniedException`

- IAM user lacks Secrets Manager permissions
- Add `SecretsManagerReadWrite` policy

## Security Best Practices

1. **Credentials**:
   - Never commit AWS credentials to git
   - Use IAM roles instead of keys on VPS (when possible)
   - Rotate access keys every 90 days

2. **S3 Buckets**:
   - Keep buckets private, use presigned URLs
   - Enable versioning for backups bucket
   - Enable encryption at rest

3. **SES**:
   - Implement DMARC policy
   - Monitor bounce/complaint rates
   - Use SES configuration set for tracking

4. **Secrets Manager**:
   - Limit access to production secrets
   - Enable secret rotation where possible
   - Audit secret access logs

## Next Steps

1. ✅ Complete AWS setup (S3, SES, Secrets Manager)
2. ✅ Test services locally
3. ✅ Deploy to VPS
4. 📝 Monitor for 1 week, check costs
5. 📝 Request SES production access
6. 📝 Set up CloudWatch alarms
7. 📝 Create backup automation using S3

## Support

For AWS-specific issues:

- AWS Support: https://console.aws.amazon.com/support
- AWS Documentation: https://docs.aws.amazon.com

For Nexora integration issues:

- Check logs: `pm2 logs nexora-api`
- Run test script: `node scripts/test-aws-services.js`
- Contact support: support@nexoraos.pro

---

**Document Version**: 1.0
**Last Updated**: 2026-02-15
**Maintained By**: Helix Code
