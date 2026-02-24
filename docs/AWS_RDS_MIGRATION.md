# Railway → AWS RDS PostgreSQL Migration Guide

## Overview

This guide covers migrating from Railway PostgreSQL to AWS RDS PostgreSQL while maintaining zero downtime and data integrity.

---

## Why AWS RDS Instead of Railway?

**Advantages of AWS RDS:**

- ✅ Full AWS ecosystem integration (S3, SES, Secrets Manager, DynamoDB)
- ✅ Enterprise-grade security and compliance
- ✅ Automated backups with point-in-time recovery
- ✅ Better monitoring with CloudWatch
- ✅ Multi-AZ deployment for high availability
- ✅ Read replicas for scaling
- ✅ Encryption at rest and in transit

**Cost Comparison:**

- Railway: ~$5-10/month (shared hosting)
- AWS RDS db.t4g.micro: ~$15-20/month (dedicated instance)
- AWS RDS db.t3.small: ~$30-35/month (better performance)

---

## Pre-Migration Checklist

- [ ] AWS account with IAM credentials (already have: AKIAT7V3GCY2LBYTBJUE)
- [ ] Railway database credentials
- [ ] Local backup storage ready
- [ ] Downtime window scheduled (or zero-downtime approach)
- [ ] VPS access for deployment

---

## Step 1: Create AWS RDS Instance

### Using AWS Console

1. **Go to RDS Console**: https://ap-south-1.console.aws.amazon.com/rds/
2. **Create Database**:
   - Engine: PostgreSQL 16.x
   - Template: Free tier (or Production for better performance)
   - DB instance identifier: `nexora-prod`
   - Master username: `nexora`
   - Master password: `NexoraDB2026!Secure` (save this!)
   - Instance type: `db.t4g.micro` (1 vCPU, 1GB RAM) - Free tier eligible
   - Storage: 20 GB gp3 (General Purpose SSD)
   - Enable storage autoscaling: Yes, max 100 GB

3. **Connectivity**:
   - VPC: Default VPC
   - Public access: **Yes** (required for VPS connection)
   - VPC security group: Create new `nexora-rds-sg`
   - Availability Zone: `ap-south-1a`

4. **Database authentication**: Password authentication

5. **Additional configuration**:
   - Initial database name: `nexora`
   - Enable automated backups: Yes, 7 days retention
   - Enable encryption: Yes
   - Enable CloudWatch logs: PostgreSQL log, Upgrade log

6. **Create database** → Wait 5-10 minutes for provisioning

### Security Group Configuration

After RDS is created:

1. Go to EC2 → Security Groups → `nexora-rds-sg`
2. Edit Inbound Rules:
   - Type: PostgreSQL
   - Port: 5432
   - Source: Custom → VPS IP (147.79.71.176/32)
   - Description: "VPS access"
3. Add another rule:
   - Type: PostgreSQL
   - Port: 5432
   - Source: My IP (your local IP for testing)
   - Description: "Local development"

### Get RDS Endpoint

Once created, note down:

- **Endpoint**: `nexora-prod.xxxxxxxxx.ap-south-1.rds.amazonaws.com`
- **Port**: `5432`
- **Master username**: `nexora`
- **Master password**: `NexoraDB2026!Secure`

---

## Step 2: Backup Railway Database

Run this script to create a complete backup:

```bash
# Run from nexora-api directory
node scripts/railway-backup.js
```

This will:

- Export Railway DB to `backups/railway-backup-YYYY-MM-DD.sql`
- Verify backup integrity
- Store backup metadata

**Manual Backup (alternative):**

```bash
# Set Railway credentials
export PGPASSWORD="TrdnPDDXyoFJEIZvmRpxLugHxwtSMbPp"

# Create backup
pg_dump -h nozomi.proxy.rlwy.net \
  -p 34866 \
  -U postgres \
  -d railway \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -f backups/railway-backup-$(date +%Y%m%d-%H%M%S).sql

echo "Backup created successfully!"
```

---

## Step 3: Restore to AWS RDS

Once RDS is ready and you have the backup:

```bash
# Run migration script
node scripts/rds-migration.js
```

This will:

1. Test RDS connection
2. Create database schema
3. Restore data from backup
4. Run Prisma migrations
5. Verify data integrity

**Manual Restore (alternative):**

```bash
# Set RDS credentials
export PGPASSWORD="NexoraDB2026!Secure"

# Restore backup to RDS
psql -h nexora-prod.xxxxxxxxx.ap-south-1.rds.amazonaws.com \
  -p 5432 \
  -U nexora \
  -d nexora \
  -f backups/railway-backup-YYYYMMDD-HHMMSS.sql

echo "Restore complete!"
```

---

## Step 4: Update AWS Secrets Manager

The new DATABASE_URL format:

```bash
postgresql://nexora:NexoraDB2026!Secure@nexora-prod.xxxxxxxxx.ap-south-1.rds.amazonaws.com:5432/nexora?schema=public
```

Update Secrets Manager:

```bash
# Run update script
node scripts/update-rds-secret.js
```

Or manually via AWS Console:

1. Go to Secrets Manager → `nexora-prod-secrets`
2. Click "Retrieve secret value" → "Edit"
3. Find `DATABASE_URL` key
4. Replace with new RDS endpoint
5. Save

---

## Step 5: Test Connection

Before deploying to VPS, test locally:

```bash
# Test RDS connection
node scripts/test-rds-connection.js
```

This verifies:

- ✅ Connection successful
- ✅ Prisma client working
- ✅ All tables exist
- ✅ Data integrity (row counts match)
- ✅ Multi-tenant isolation working

---

## Step 6: Deploy to VPS

```bash
# 1. SSH to VPS and pull latest .env from Secrets Manager
ssh -i "C:\Users\shala\.ssh\nexora_vps_key" root@147.79.71.176 << 'EOF'
  cd /var/www/nexora-api

  # Load secrets from AWS (this will get new DATABASE_URL)
  node -e "
    const { loadSecretsFromAWS } = require('./src/config/aws.js');
    loadSecretsFromAWS().then(() => console.log('Secrets loaded'));
  "

  # Restart API server
  pm2 restart nexora-api

  # Check logs
  pm2 logs nexora-api --lines 20
EOF

# 2. Verify API health
curl https://api.nexoraos.pro/api/v1/health

# 3. Test database query
curl https://api.nexoraos.pro/api/v1/tenants \
  -H "Authorization: Bearer <token>"
```

---

## Step 7: Verification Checklist

- [ ] VPS API server started successfully
- [ ] Health endpoint returns 200 OK
- [ ] Login works with existing credentials
- [ ] Contact list loads
- [ ] Create new contact works
- [ ] Multi-tenant isolation verified
- [ ] No errors in pm2 logs

---

## Rollback Plan

If migration fails, rollback to Railway:

1. **Restore old DATABASE_URL in Secrets Manager:**

   ```bash
   postgresql://postgres:TrdnPDDXyoFJEIZvmRpxLugHxwtSMbPp@nozomi.proxy.rlwy.net:34866/railway
   ```

2. **Restart VPS server:**

   ```bash
   ssh -i "C:\Users\shala\.ssh\nexora_vps_key" root@147.79.71.176 "pm2 restart nexora-api"
   ```

3. **Verify health:**
   ```bash
   curl https://api.nexoraos.pro/api/v1/health
   ```

---

## Cost Estimates

### AWS RDS Costs

**db.t4g.micro (Free Tier - 12 months):**

- Instance: $0/month (first 12 months)
- Storage: 20 GB gp3 = ~$2.30/month
- Backup: 20 GB = ~$0.95/month
- **Total: ~$3-5/month** (free tier)

**After Free Tier / db.t3.small (Production):**

- Instance: ~$30/month
- Storage: 20 GB gp3 = ~$2.30/month
- Backup: 20 GB = ~$0.95/month
- Data transfer: ~$5-10/month
- **Total: ~$38-45/month**

### Railway Costs

- Shared PostgreSQL: ~$5-10/month
- No dedicated resources
- Limited backups

---

## Performance Optimization

### Enable Connection Pooling

Update DATABASE_URL with connection pool:

```bash
postgresql://nexora:password@endpoint:5432/nexora?schema=public&connection_limit=20&pool_timeout=10
```

### Enable Query Logging (temporary)

For debugging, enable slow query logging:

1. Go to RDS → Parameter Groups → Create new `nexora-pg-params`
2. Edit parameters:
   - `log_min_duration_statement` = 1000 (log queries > 1 second)
   - `log_statement` = `mod` (log all DDL/DML)
3. Apply to `nexora-prod` instance → Reboot

### Create Read Replica (optional)

For read-heavy workloads:

1. RDS Console → `nexora-prod` → Actions → Create read replica
2. Identifier: `nexora-prod-read-replica`
3. Region: Same (ap-south-1)
4. Use for read-only queries in application

---

## Monitoring

### CloudWatch Alarms

Create alarms for:

- CPU Utilization > 80%
- Free Storage Space < 2 GB
- Database Connections > 80
- Read/Write IOPS > 1000

### Enable Enhanced Monitoring

1. RDS Console → `nexora-prod` → Modify
2. Enable Enhanced Monitoring: Yes
3. Granularity: 60 seconds
4. Monitoring Role: Create new `rds-monitoring-role`

---

## Security Best Practices

1. **Rotate password every 90 days**
2. **Enable SSL/TLS connections:**
   ```bash
   DATABASE_URL="postgresql://nexora:password@endpoint:5432/nexora?sslmode=require"
   ```
3. **Restrict security group to VPS IP only**
4. **Enable AWS CloudTrail for audit logs**
5. **Use IAM database authentication (advanced)**

---

## Troubleshooting

### Connection Timeout

```
Error: connect ETIMEDOUT
```

**Fix:**

- Check security group allows VPS IP (147.79.71.176/32)
- Verify RDS is publicly accessible
- Check VPS firewall rules

### Authentication Failed

```
Error: password authentication failed for user "nexora"
```

**Fix:**

- Verify master password is correct
- Check username is exactly `nexora` (case-sensitive)
- Reset password via RDS Console if needed

### Prisma Migration Failed

```
Error: P1001: Can't reach database server
```

**Fix:**

- Verify DATABASE_URL format is correct
- Check RDS endpoint is reachable: `telnet endpoint 5432`
- Run `npx prisma db push` to sync schema

---

## Next Steps After Migration

1. **Delete Railway database** (after 30-day safety window)
2. **Enable automated backups** (already enabled in RDS)
3. **Set up CloudWatch alarms**
4. **Document RDS credentials** in password manager
5. **Update infrastructure documentation**

---

## References

- [AWS RDS PostgreSQL Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [Prisma with AWS RDS](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-aws-lambda)
- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
