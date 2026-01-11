# Week 2 - Deployment Guide

## 📋 Pre-Deployment Checklist

### 1. Install Dependencies on VPS

```bash
ssh root@91.98.167.120
cd /var/www/casadiag-backend

# Install new packages
npm install stripe resend docxtemplater pizzip
npm install --save-dev @types/pizzip
```

### 2. Create OpenAI Assistant (One-Time Setup)

Create this script locally:

```javascript
// create-assistant.js
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: 'YOUR_OPENAI_API_KEY',  // Your existing key
});

async function createAssistant() {
  const assistant = await openai.beta.assistants.create({
    name: 'CasaDiag Technical Assistant',
    model: 'gpt-4o',
    description: 'Asistente técnico en español para diagnóstico de patologías en viviendas',
    instructions: `Eres un asistente técnico especializado en diagnóstico de patologías en viviendas en España. Tu rol es:

1. RECOPILAR INFORMACIÓN de forma estructurada y empática
2. GUIAR AL USUARIO por estados (S0 → S8)
3. EXTRAER DATOS ESTRUCTURADOS usando function calling
4. REGLAS IMPORTANTES:
   - Siempre en español de España
   - No diagnostiques definitivamente (solo orientaciones preliminares)
   - Recuerda que la revisión humana es obligatoria para informes pagados`,
    tools: [
      {
        type: 'function',
        function: {
          name: 'update_resumen',
          description: 'Actualiza un campo del resumen del caso con información detectada',
          parameters: {
            type: 'object',
            properties: {
              field: {
                type: 'string',
                enum: ['tipoPatologia', 'ubicacion', 'antiguedad', 'descripcionUsuario'],
                description: 'Campo a actualizar',
              },
              value: {
                type: 'string',
                description: 'Valor a guardar',
              },
            },
            required: ['field', 'value'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'advance_to_evidencias',
          description: 'Avanzar al estado S2_EVIDENCIAS cuando se tiene contexto suficiente',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'suggest_advance_to_prediagnostico',
          description: 'Sugerir avanzar a prediagnóstico cuando hay evidencias suficientes (3+ fotos)',
          parameters: { type: 'object', properties: {} },
        },
      },
    ],
  });

  console.log('\n✅ Assistant created successfully!');
  console.log('\n📋 Add this to your .env file:');
  console.log(`OPENAI_ASSISTANT_ID=${assistant.id}`);
}

createAssistant().catch(console.error);
```

Run it:
```bash
node create-assistant.js
```

Copy the Assistant ID that is printed.

### 3. Set Up Stripe Account

1. Go to https://dashboard.stripe.com/register
2. Create account / Sign in
3. Go to **Developers → API keys**
4. For testing: Use **Test mode** keys
5. For production: Use **Live mode** keys

Copy:
- **Secret key** (starts with `sk_test_` or `sk_live_`)
- **Publishable key** (starts with `pk_test_` or `pk_live_`)

### 4. Set Up Resend Account

1. Go to https://resend.com/signup
2. Create account
3. Go to **API Keys** → **Create API Key**
4. Copy the API key (starts with `re_`)

5. **Verify sending domain:**
   - Go to **Domains**
   - Add domain: `micasaverde.es`
   - Add DNS records as instructed (TXT, MX, CNAME)
   - Wait for verification (can take a few minutes)

### 5. Update Environment Variables on VPS

```bash
ssh root@91.98.167.120
cd /var/www/casadiag-backend
nano .env
```

Add these new variables:

```env
# Week 2 - OpenAI Assistant
OPENAI_ASSISTANT_ID=asst_XXXXX  # From step 2

# Week 2 - Stripe
STRIPE_SECRET_KEY=sk_test_XXXXX  # From step 3
STRIPE_PUBLISHABLE_KEY=pk_test_XXXXX

# Week 2 - Resend
RESEND_API_KEY=re_XXXXX  # From step 4
RESEND_FROM_EMAIL=informes@micasaverde.es
```

Save and exit (Ctrl+X, Y, Enter).

### 6. Create DOCX Template

On your local machine:

1. Open Microsoft Word
2. Create a new document
3. Copy/paste this template:

```
INFORME TÉCNICO DE DIAGNÓSTICO DE PATOLOGÍAS

═══════════════════════════════════════════

DATOS DEL EXPEDIENTE
────────────────────
Expediente Nº: {expedienteId}
Fecha de emisión: {fecha}
Perfil del solicitante: {perfil}

DATOS DEL SOLICITANTE
──────────────────────
Nombre completo: {nombreCompleto}
Correo electrónico: {email}
Teléfono: {telefono}
Dirección de la propiedad: {direccionPropiedad}

1. DESCRIPCIÓN DEL PROBLEMA
════════════════════════════

Ubicación: {ubicacion}
Antigüedad del problema: {antiguedad}

Descripción proporcionada por el usuario:
{descripcion}

2. ANÁLISIS TÉCNICO
═══════════════════

Tipo de patología detectada: {tipoPatologia}
Nivel de severidad: {nivelSeveridad}/10
Nivel de riesgo: {nivelRiesgo}
Puntuación de confianza del análisis: {puntuacionConfianza}/10

3. HIPÓTESIS DIAGNÓSTICAS
══════════════════════════

{#hipotesis}
• {.}
{/hipotesis}

4. POSIBLES CAUSAS
══════════════════

{#posiblesCausas}
• {.}
{/posiblesCausas}

5. RECOMENDACIONES Y PRÓXIMOS PASOS
════════════════════════════════════

{#proximosPasos}
• {.}
{/proximosPasos}

6. EVIDENCIA ADICIONAL SUGERIDA
════════════════════════════════

{evidenciaAdicional}

7. EVIDENCIAS ANALIZADAS
═════════════════════════

{#evidencias}
• {nombre} - Tipo: {tipo}, Tamaño: {tamano}, Fecha: {fecha}
{/evidencias}

8. CONCLUSIONES
═══════════════

{conclusiones}

═══════════════════════════════════════════

VALIDACIÓN TÉCNICA
──────────────────
Revisado por: {revisorNombre}
Fecha de revisión: {fechaRevision}

Notas del revisor:
{notasRevisor}

═══════════════════════════════════════════

AVISO LEGAL
───────────
Este informe constituye una orientación técnica preliminar basada en el análisis de la información y evidencias proporcionadas. No sustituye una inspección presencial completa cuando sea necesaria para determinar intervenciones estructurales o para cuestiones con implicaciones legales.

Para procedimientos judiciales o intervenciones que afecten a la seguridad estructural del inmueble, se recomienda la contratación de un perito colegiado que realice una inspección in situ.

═══════════════════════════════════════════
CasaDiag - Diagnóstico técnico de patologías
https://patologias.micasaverde.es
```

4. Save as: `informe-template.docx`
5. Upload to VPS:

```bash
# On your local machine
scp informe-template.docx root@91.98.167.120:/var/www/casadiag-backend/templates/
```

### 7. Deploy Code to VPS

```bash
# Pull latest code
ssh root@91.98.167.120
cd /var/www/casadiag-backend
git pull origin main

# Install dependencies (if not done yet)
npm install

# Generate Prisma Client
npx prisma generate

# Build the project
npm run build

# Restart PM2
pm2 restart casadiag-api

# Check logs
pm2 logs casadiag-api --lines 50
```

### 8. Verify Deployment

Test each new feature:

#### Test 1: Assistant Messages

```bash
# Create a case
curl -X POST https://patologias.micasaverde.es/api/cases \
  -H "Content-Type: application/json" \
  -d '{"userProfile":"particular"}'

# Copy the case ID from response
CASE_ID="paste_here"

# Send a message (should get real AI response)
curl -X POST https://patologias.micasaverde.es/api/cases/$CASE_ID/messages \
  -H "Content-Type: application/json" \
  -d '{"content":"Tengo humedades en el baño desde hace 3 meses"}'

# Check response - should have assistantMessage with AI-generated content
```

#### Test 2: Re-evaluation (Diagnosis Generation)

```bash
# Upload evidence first
curl -X POST https://patologias.micasaverde.es/api/cases/$CASE_ID/evidence \
  -F "file=@test-image.jpg" \
  -F "type=photo"

# Trigger re-evaluation
curl -X POST https://patologias.micasaverde.es/api/cases/$CASE_ID/re-evaluate

# Should return structured diagnosis JSON
```

#### Test 3: Payment (Test Mode)

```bash
# Create PaymentIntent
curl -X POST https://patologias.micasaverde.es/api/cases/$CASE_ID/payments/create-intent \
  -H "Content-Type: application/json" \
  -d '{"packId":"informe"}'

# Returns clientSecret - use in frontend with Stripe Elements
```

#### Test 4: Admin Panel

```bash
# Get pending cases
curl https://patologias.micasaverde.es/api/admin/cases/pending

# Send report (will generate DOCX + send email + capture payment)
curl -X POST https://patologias.micasaverde.es/api/admin/cases/$CASE_ID/send-report \
  -H "Content-Type: application/json" \
  -d '{"adminNotes":"Diagnóstico revisado y aprobado por técnico."}'
```

---

## 🔧 Troubleshooting

### Issue: "Assistant ID not configured"

Check `.env`:
```bash
cat /var/www/casadiag-backend/.env | grep OPENAI_ASSISTANT_ID
```

If missing, create assistant (step 2) and add ID to `.env`.

### Issue: "Stripe is not configured"

Check `.env`:
```bash
cat /var/www/casadiag-backend/.env | grep STRIPE_SECRET_KEY
```

Add Stripe keys from step 3.

### Issue: "Template file not found"

Check template exists:
```bash
ls -la /var/www/casadiag-backend/templates/
```

Should see `informe-template.docx`. If missing, upload from step 6.

### Issue: Email not sending

1. Check Resend API key:
```bash
cat /var/www/casadiag-backend/.env | grep RESEND_API_KEY
```

2. Verify domain in Resend dashboard
3. Check PM2 logs for email errors:
```bash
pm2 logs casadiag-api --err
```

### Issue: Dependencies missing

Re-install:
```bash
cd /var/www/casadiag-backend
rm -rf node_modules package-lock.json
npm install
npm run build
pm2 restart casadiag-api
```

---

## 📊 Monitoring Week 2 Features

### Check Assistant is Working

```bash
# Check logs for "Run created" messages
pm2 logs casadiag-api | grep "Run created"
```

### Check Payments

```bash
# View payment records in database
ssh root@91.98.167.120
psql -U casadiag_user -d casadiag -c "SELECT id, \"caseId\", status, amount FROM \"Payment\";"
```

### Check Reports Generated

```bash
# List reports in R2 (via Cloudflare dashboard)
# Or check database for reportUrl
psql -U casadiag_user -d casadiag -c "SELECT id, \"reportUrl\", \"currentState\" FROM \"Case\" WHERE \"reportUrl\" IS NOT NULL;"
```

---

## ✅ Week 2 Complete!

All features implemented:
- ✅ OpenAI Assistant with function calling
- ✅ Re-evaluation loop with Vision API
- ✅ Stripe payment (authorize + capture)
- ✅ DOCX report generation
- ✅ Resend email delivery
- ✅ Admin panel endpoints

**Next:** Test end-to-end workflow and integrate frontend!
