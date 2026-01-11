#!/bin/bash

# Week 2 Deployment Script
# Deploys all Week 2 modules to production VPS

set -e

VPS="root@91.98.167.120"
BACKEND_PATH="/var/www/casadiag-backend"

echo "🚀 Deploying Week 2 to production..."

# Step 1: Copy Week 2 modules via SCP
echo "📦 Uploading Week 2 modules..."

ssh $VPS "mkdir -p $BACKEND_PATH/src/assistant $BACKEND_PATH/src/diagnosis $BACKEND_PATH/src/payments $BACKEND_PATH/src/reports $BACKEND_PATH/src/email $BACKEND_PATH/src/admin"

# Upload all module files
for module in assistant diagnosis payments reports email admin; do
  echo "  → Uploading $module module..."
  if [ -d "casadiag-backend/src/$module" ]; then
    scp -r casadiag-backend/src/$module/* $VPS:$BACKEND_PATH/src/$module/
  fi
done

# Step 2: Update modified files
echo "📝 Updating modified core files..."
scp casadiag-backend/src/app.module.ts $VPS:$BACKEND_PATH/src/
scp casadiag-backend/src/messages/messages.service.ts $VPS:$BACKEND_PATH/src/messages/
scp casadiag-backend/src/messages/messages.module.ts $VPS:$BACKEND_PATH/src/messages/
scp casadiag-backend/src/cases/cases.service.ts $VPS:$BACKEND_PATH/src/cases/
scp casadiag-backend/src/cases/cases.module.ts $VPS:$BACKEND_PATH/src/cases/
scp casadiag-backend/src/common/openai.service.ts $VPS:$BACKEND_PATH/src/common/

# Step 3: Upload templates and scripts
echo "📄 Uploading templates and scripts..."
scp -r casadiag-backend/templates/* $VPS:$BACKEND_PATH/templates/ 2>/dev/null || echo "  (No templates to upload yet)"
scp -r casadiag-backend/scripts/* $VPS:$BACKEND_PATH/scripts/ 2>/dev/null || echo "  (Scripts already created)"

# Step 4: Build and restart
echo "🔨 Building backend..."
ssh $VPS "cd $BACKEND_PATH && npx prisma generate && npm run build"

echo "🔄 Restarting PM2..."
ssh $VPS "pm2 delete casadiag-api || true && pm2 start $BACKEND_PATH/ecosystem.config.js && pm2 save"

echo "📊 Checking status..."
ssh $VPS "pm2 logs casadiag-api --lines 20 --nostream"

echo ""
echo "✅ Week 2 deployed successfully!"
echo ""
echo "🧪 Test with:"
echo "  curl https://patologias.micasaverde.es/api/cases"
echo ""
