#!/bin/bash
# ============================================================
# Switch VPS from local PostgreSQL → AWS RDS
# Run this ON your VPS: bash switch-to-rds.sh
# ============================================================

RDS_URL="postgresql://nexora_admin:NexoraDB2026!@nexora-prod-db.c1gqciwmu8tl.ap-south-1.rds.amazonaws.com:5432/nexora_prod"
APP_DIR="/var/www/nexora-api"

echo "============================================================"
echo "  Switching to AWS RDS PostgreSQL"
echo "============================================================"

# Step 1: Test RDS connection
echo "[1/5] Testing RDS connection..."
if pg_isready -h nexora-prod-db.c1gqciwmu8tl.ap-south-1.rds.amazonaws.com -p 5432 -U nexora_admin; then
  echo "✅ RDS connection OK"
else
  echo "❌ Cannot reach RDS - check security group allows port 5432"
  exit 1
fi

# Step 2: Dump local database
echo "[2/5] Dumping local PostgreSQL database..."
pg_dump -U postgres nexora > /tmp/nexora_backup_$(date +%Y%m%d_%H%M%S).sql
echo "✅ Local DB dumped to /tmp/"

# Step 3: Restore to RDS
echo "[3/5] Restoring to RDS..."
PGPASSWORD="NexoraDB2026!" psql \
  -h nexora-prod-db.c1gqciwmu8tl.ap-south-1.rds.amazonaws.com \
  -U nexora_admin \
  -d nexora_prod \
  -f /tmp/nexora_backup_*.sql
echo "✅ Data restored to RDS"

# Step 4: Update .env
echo "[4/5] Updating .env DATABASE_URL..."
cd $APP_DIR

# Backup current .env
cp .env .env.local.backup

# Update DATABASE_URL
sed -i "s|DATABASE_URL=.*|DATABASE_URL=$RDS_URL|g" .env

echo "✅ .env updated"
echo "   New DATABASE_URL: $RDS_URL"

# Step 5: Restart app
echo "[5/5] Restarting application..."
pm2 restart all
sleep 3
pm2 status

echo ""
echo "============================================================"
echo "  Migration Complete!"
echo "============================================================"
echo ""
echo "Verify with:"
echo "  pm2 logs nexora-api --lines 20"
echo "  curl http://localhost:4000/health"
echo ""
