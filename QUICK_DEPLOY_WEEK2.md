# Quick Deploy - Week 2 (30 minutes)

## ⚡ Fast Track Deployment

### Step 1: Install Dependencies (2 min)
```bash
ssh root@91.98.167.120
cd /var/www/casadiag-backend
npm install stripe resend docxtemplater pizzip
npm install --save-dev @types/pizzip
```

### Step 2: Create OpenAI Assistant (5 min)
```bash
# Locally, in casadiag-backend folder
node scripts/create-assistant.js
# Copy the Assistant ID (asst_XXXXX)
```

### Step 3: Get Stripe Keys (3 min)
1. Go to https://dashboard.stripe.com/test/apikeys
2. Copy "Secret key" (sk_test_...)
3. Copy "Publishable key" (pk_test_...)

### Step 4: Get Resend Key (3 min)
1. Go to https://resend.com/api-keys
2. Create API key
3. Copy key (re_...)

### Step 5: Update .env on VPS (2 min)
```bash
ssh root@91.98.167.120
nano /var/www/casadiag-backend/.env
```

Add:
```env
OPENAI_ASSISTANT_ID=asst_XXXXX
STRIPE_SECRET_KEY=sk_test_XXXXX
STRIPE_PUBLISHABLE_KEY=pk_test_XXXXX
RESEND_API_KEY=re_XXXXX
RESEND_FROM_EMAIL=informes@micasaverde.es
```

### Step 6: Create Template (5 min)
1. Open Word
2. Copy template from `templates/README.md`
3. Save as `informe-template.docx`
4. Upload:
```bash
scp informe-template.docx root@91.98.167.120:/var/www/casadiag-backend/templates/
```

### Step 7: Deploy (5 min)
```bash
ssh root@91.98.167.120
cd /var/www/casadiag-backend
git pull origin main
npm install
npx prisma generate
npm run build
pm2 restart casadiag-api
pm2 logs casadiag-api --lines 50
```

### Step 8: Test (5 min)
```bash
# Create case
CASE=$(curl -s -X POST https://patologias.micasaverde.es/api/cases \
  -H "Content-Type: application/json" \
  -d '{"userProfile":"particular"}' | grep -o '"id":"[^"]*' | cut -d'"' -f4)

echo "Case ID: $CASE"

# Test AI message
curl -X POST https://patologias.micasaverde.es/api/cases/$CASE/messages \
  -H "Content-Type: application/json" \
  -d '{"content":"Tengo humedades"}'

# Should see AI response!
```

---

## ✅ Done!

Week 2 deployed in ~30 minutes.

**Verify:**
- AI responses working
- Re-evaluation generates diagnosis
- Payment endpoints respond
- Admin endpoints accessible

**Full docs:** See WEEK2_DEPLOYMENT_GUIDE.md
