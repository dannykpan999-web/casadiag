# Week 2 - Client Action Checklist

## 🎯 What You Need to Do

This is your step-by-step checklist to get Week 2 deployed and working.

---

## ☑️ Before Deployment

### 1. Stripe Account Setup (15 minutes)

**Why:** Accept payments from users

**Steps:**
1. Go to https://stripe.com
2. Click "Start now" and create account
3. Complete business verification
4. Go to **Developers → API keys**
5. Copy these two keys:
   - **Secret key** (sk_test_...) - KEEP THIS SECRET
   - **Publishable key** (pk_test_...) - Safe to use in frontend

**Test Mode vs Live Mode:**
- Start with **Test mode** to try it out
- Switch to **Live mode** when ready for real customers
- No real money is charged in Test mode

**Send to developer:**
- ✉️ Email both keys to your developer

---

### 2. Resend Account Setup (10 minutes)

**Why:** Send professional emails with report attachments

**Steps:**
1. Go to https://resend.com/signup
2. Create account (free tier works fine)
3. Go to **API Keys** → **Create API Key**
4. Copy the key (starts with `re_`)
5. Go to **Domains** → **Add Domain**
6. Enter: `micasaverde.es`
7. Follow instructions to add DNS records (you'll need access to your domain DNS)

**DNS Records to Add:**
```
Type: TXT
Name: @
Value: [shown in Resend dashboard]

Type: MX
Name: @
Value: [shown in Resend dashboard]
Priority: 10

Type: CNAME
Name: resend._domainkey
Value: [shown in Resend dashboard]
```

**Send to developer:**
- ✉️ Email the Resend API key

**Verification:**
- Wait 5-10 minutes after adding DNS records
- Resend will verify automatically
- You'll see "Verified" status

---

### 3. Create Word Template (20 minutes)

**Why:** Professional reports sent to users

**Steps:**
1. Download template from developer or use template in `casadiag-backend/templates/README.md`
2. Open Microsoft Word
3. Customize the template if desired:
   - Add your company logo
   - Adjust formatting
   - Keep the variable names like `{expedienteId}`, `{fecha}`, etc.
4. Save as: `informe-template.docx`

**Send to developer:**
- ✉️ Email the DOCX file

---

## ☑️ During Deployment (Developer does this)

You don't need to do these steps - the developer will:

- ✅ Install new NPM packages
- ✅ Create OpenAI Assistant
- ✅ Update .env with your keys
- ✅ Upload DOCX template
- ✅ Deploy code to VPS
- ✅ Test all features

**Estimated time:** 30 minutes

---

## ☑️ After Deployment - Testing

### Test 1: Send a Test Message (2 minutes)

1. Go to https://patologias.micasaverde.es
2. Click "Iniciar diagnóstico"
3. Select a profile
4. Start chat
5. Send: "Tengo humedades en el baño"

**Expected:** You should get an AI response (not a mock/fake response)

---

### Test 2: Upload a Photo (2 minutes)

1. In the same chat, upload a photo of something
2. Wait for upload to complete

**Expected:** Photo appears in evidence list with Vision analysis

---

### Test 3: Generate Diagnosis (2 minutes)

1. Upload 2-3 photos
2. Click "Generar prediagnóstico" button

**Expected:** Real diagnosis appears with:
- Hypotheses
- Probable causes
- Recommended next steps
- Risk level

---

### Test 4: Test Payment (TESTING MODE) (3 minutes)

1. Select "Informe técnico revisado" (49€)
2. Click "Autorizar pago"
3. Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date (12/34)
   - CVC: Any 3 digits (123)
   - ZIP: Any 5 digits (12345)

**Expected:**
- Payment authorized
- No real money charged (test mode)
- Case moves to "En revisión"

---

### Test 5: Admin Send Report (5 minutes)

**Note:** This requires admin access - developer will set up a simple admin interface or you can test via Swagger:

1. Go to https://patologias.micasaverde.es/api/docs
2. Find `POST /api/admin/cases/{caseId}/send-report`
3. Click "Try it out"
4. Enter the case ID from Test 4
5. Add admin notes: "Revisado y aprobado"
6. Click "Execute"

**Expected:**
- ✅ DOCX report generated
- ✅ Email sent to your test email
- ✅ Payment captured (test mode - no real charge)
- ✅ Case status: "Enviado"

**Check your email:**
- Should receive professional email
- With DOCX attachment
- Open the DOCX - should have all case details

---

## ☑️ Going Live (When Ready)

### Switch to Live Mode

1. **Stripe:**
   - Go to Stripe dashboard
   - Switch from "Test mode" to "Live mode" (toggle in top right)
   - Copy NEW keys from **Developers → API keys**
   - Send to developer to update `.env`

2. **Test with Real Card:**
   - Use your own card
   - Make a small test payment (49€)
   - Verify email delivery works
   - Verify payment appears in Stripe dashboard
   - Request refund for test

3. **Monitor:**
   - Check Stripe dashboard for payments
   - Check Resend dashboard for email deliveries
   - Monitor admin panel for cases

---

## 💰 Costs

### One-Time Setup
- Stripe: Free (they take 1.4% + 0.25€ per transaction)
- Resend: Free for up to 100 emails/day (then €10/month)
- OpenAI: Already have API key
- DOCX Template: Free (you create it)

### Ongoing Costs
- Stripe fees: 1.4% + 0.25€ per transaction
- Resend: €0 (up to 100 emails/day) or €10/month
- OpenAI API: ~€0.05 per conversation (you already have credits)
- R2 Storage: Minimal (included in current plan)

**Example:**
- 10 paid reports/day (49€ each)
- Stripe fees: ~€8/day
- Resend: Free (under 100 emails/day)
- OpenAI: ~€0.50/day
- **Total:** ~€8.50/day operational cost

---

## ✅ Final Checklist

Before marking Week 2 as complete:

- [ ] Stripe account created and verified
- [ ] Stripe test keys sent to developer
- [ ] Resend account created
- [ ] Resend API key sent to developer
- [ ] Domain DNS records added for Resend
- [ ] Domain verified in Resend (shows "Verified")
- [ ] DOCX template created
- [ ] Template sent to developer
- [ ] Developer has deployed Week 2
- [ ] Test 1: AI responses working ✓
- [ ] Test 2: Photo upload working ✓
- [ ] Test 3: Diagnosis generation working ✓
- [ ] Test 4: Test payment working ✓
- [ ] Test 5: Report email received ✓

---

## 🆘 If Something Goes Wrong

### AI Responses Not Working
→ Check with developer that OpenAI Assistant was created

### Payment Fails
→ Verify Stripe keys are correct in `.env`

### Email Not Delivered
→ Check domain is verified in Resend dashboard

### Report Not Generating
→ Verify DOCX template was uploaded to VPS

---

## 📞 Support

If you have questions:
1. Check documentation in `WEEK2_DEPLOYMENT_GUIDE.md`
2. Contact developer with specific error message
3. Check PM2 logs (developer can help with this)

---

**Status:** Ready to go live once all checklist items are complete! ✅
