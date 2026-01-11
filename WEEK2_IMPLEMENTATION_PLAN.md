# Week 2 - Backend Implementation Plan
**Based on existing UI/UX analysis**

---

## 📋 Table of Contents

1. [Current Frontend Analysis](#current-frontend-analysis)
2. [Week 2 Backend Tasks](#week-2-backend-tasks)
3. [Integration Strategy](#integration-strategy)
4. [Implementation Timeline](#implementation-timeline)
5. [Testing Strategy](#testing-strategy)

---

## 🎨 Current Frontend Analysis

### Existing UI/UX Structure

The frontend is **already fully implemented** with:

#### **User Journey Pages:**
- `/asistente` - Profile selection + checklist
- `/asistente/expediente/:id` - Main chat interface with dual panel
- `/asistente/confirmacion` - Confirmation page after payment

#### **State Machine (Frontend):**
```typescript
S0_PERFIL → S1_CONTEXTO → S2_EVIDENCIAS → S3_PREDIAGNOSTICO
→ S4_PACKS → S5_PAGO_AUTORIZACION → S6_REVISION_HUMANA
→ S7_ENVIADO → S8_CERRADO
```

#### **Key Frontend Components:**
1. **ChatPanel** ([ChatPanel.tsx](src/components/asistente/ChatPanel.tsx))
   - Displays messages from `expediente.messages[]`
   - Calls `onSendMessage(content)` when user types
   - Currently shows **mock assistant responses**

2. **EvidenceUploader** ([EvidenceUploader.tsx](src/components/asistente/EvidenceUploader.tsx))
   - Handles file upload UI
   - Calls `onUpload(file)` which currently stores in **localStorage**
   - Validates file types and sizes (max 10 photos, 2 videos, 200MB)

3. **PaymentModal** ([PaymentModal.tsx](src/components/asistente/PaymentModal.tsx))
   - Shows payment authorization dialog
   - Currently **mocks payment** - no real Stripe integration

4. **ExpedientePanel** - Shows pack selection, prediagnostico, resumen

#### **Current Data Flow (localStorage-based):**
```
useExpediente hook (src/hooks/useExpediente.ts)
  ↓
expediente-storage.ts (localStorage CRUD)
  ↓
localStorage (key: "diagnostico_expedientes")
```

**Frontend is ready and waiting for backend API integration!**

---

## 🎯 Week 2 Backend Tasks

Based on the existing UI/UX, Week 2 backend needs to:

### **Task 1: OpenAI Assistant with Function Calling** ⭐ HIGH PRIORITY

**Current State:**
- Frontend sends user messages via `sendMessage(content)`
- `useExpediente.ts` generates **mock responses** in `generateAssistantResponse()` (lines 58-150)
- No real AI integration

**What to Build:**

1. **Create OpenAI Assistant (one-time setup):**
   ```bash
   # Use OpenAI Assistants API
   POST https://api.openai.com/v1/assistants
   ```

   **Assistant Configuration:**
   - Model: `gpt-4o` (supports vision + function calling)
   - Name: `CasaDiag Technical Assistant`
   - Instructions: Spanish technical pathology analysis
   - Tools: `function calling` for state management

   **Functions to define:**
   - `advance_to_evidencias()` - Move to S2_EVIDENCIAS
   - `advance_to_prediagnostico()` - Move to S3_PREDIAGNOSTICO
   - `suggest_pack(pack_id)` - Recommend a pack
   - `update_resumen(field, value)` - Update case summary

2. **Implement Run Management:**

   **Backend endpoint: `POST /api/cases/:caseId/messages` (already exists, needs enhancement)**

   Current flow:
   ```typescript
   // Frontend calls
   sendMessage("Tengo humedades en el baño")

   // Backend should:
   1. Add user message to thread (✅ already implemented)
   2. Create a Run with the Assistant
   3. Poll Run status until completion
   4. Handle function calls if required
   5. Return final assistant message
   ```

   **New logic needed in Messages service:**
   ```typescript
   // casadiag-backend/src/messages/messages.service.ts

   async sendMessage(caseId: string, content: string) {
     // 1. Add message to thread (existing)
     await openai.beta.threads.messages.create(threadId, { ... });

     // 2. Create Run
     const run = await openai.beta.threads.runs.create(threadId, {
       assistant_id: process.env.OPENAI_ASSISTANT_ID,
     });

     // 3. Poll Run status
     while (run.status === 'queued' || run.status === 'in_progress') {
       await sleep(1000);
       run = await openai.beta.threads.runs.retrieve(threadId, run.id);

       // 4. Handle function calls
       if (run.status === 'requires_action') {
         const tool_outputs = await this.handleFunctionCalls(
           caseId,
           run.required_action.submit_tool_outputs.tool_calls
         );
         await openai.beta.threads.runs.submitToolOutputs(threadId, run.id, {
           tool_outputs,
         });
       }
     }

     // 5. Get assistant's final message
     const messages = await openai.beta.threads.messages.list(threadId);
     const lastMessage = messages.data[0];

     return lastMessage;
   }
   ```

3. **Function Call Handlers:**

   Create new service: `casadiag-backend/src/assistant/assistant-functions.service.ts`

   ```typescript
   async handleFunctionCall(functionName: string, args: any, caseId: string) {
     switch (functionName) {
       case 'advance_to_evidencias':
         await this.casesService.updateState(caseId, 'S2_EVIDENCIAS');
         return { success: true, state: 'S2_EVIDENCIAS' };

       case 'update_resumen':
         await this.casesService.updateResumen(caseId, {
           [args.field]: args.value
         });
         return { success: true };

       case 'suggest_pack':
         // Log suggestion, don't auto-select
         return { success: true, suggested: args.pack_id };

       default:
         return { error: 'Unknown function' };
     }
   }
   ```

**Integration with Frontend:**
- Frontend calls `POST /api/cases/:caseId/messages` with `{ content: "..." }`
- Backend returns assistant's response after Run completes
- Frontend adds response to chat UI
- **Remove mock response generation from `useExpediente.ts`**

**Files to modify:**
- ✅ `casadiag-backend/src/messages/messages.service.ts` - Add Run logic
- ✅ `casadiag-backend/src/messages/messages.controller.ts` - Update response format
- ⭐ Create `casadiag-backend/src/assistant/assistant.module.ts`
- ⭐ Create `casadiag-backend/src/assistant/assistant.service.ts`
- ⭐ Update `.env` with real Assistant ID after creation

---

### **Task 2: Re-evaluation Loop** ⭐ HIGH PRIORITY

**Current State:**
- Endpoint exists: `POST /api/cases/:caseId/re-evaluate` (returns "queued")
- Frontend calls `generatePrediagnostico()` which generates **mock prediagnostico** locally

**What to Build:**

1. **Trigger Re-evaluation:**

   **When to trigger:**
   - User uploads new evidence
   - User explicitly requests prediagnostico
   - Assistant determines sufficient context exists

   **Backend flow:**
   ```typescript
   async triggerReEvaluation(caseId: string) {
     // 1. Get case + all evidence
     const case = await this.prisma.case.findUnique({
       where: { id: caseId },
       include: { evidence: true, messages: true }
     });

     // 2. Analyze all photos with Vision API
     const visionAnalyses = [];
     for (const evidence of case.evidence.filter(e => e.type === 'photo')) {
       if (!evidence.visionAnalysis) {
         const analysis = await this.analyzeWithVision(evidence);
         visionAnalyses.push(analysis);
       } else {
         visionAnalyses.push(evidence.visionAnalysis);
       }
     }

     // 3. Send context to Assistant for diagnosis
     const prompt = this.buildDiagnosisPrompt(case, visionAnalyses);
     const diagnosis = await this.getAssistantDiagnosis(case.threadId, prompt);

     // 4. Parse structured diagnosis JSON
     const structured = this.parseStructuredDiagnosis(diagnosis);

     // 5. Save to DiagnosisHistory
     await this.prisma.diagnosisHistory.create({
       data: {
         caseId,
         diagnosisData: structured,
         visionAnalysisUsed: visionAnalyses,
         ...
       }
     });

     // 6. Update case state
     await this.prisma.case.update({
       where: { id: caseId },
       data: { currentState: 'S3_PREDIAGNOSTICO' }
     });

     return structured;
   }
   ```

2. **Structured Diagnosis Format:**

   **Assistant should return JSON:**
   ```json
   {
     "pathologyType": "humedad_condensacion",
     "severity": 6,
     "hypotheses": [
       "Condensación por falta de ventilación",
       "Posible puente térmico en esquina"
     ],
     "probableCauses": [
       "Insuficiente renovación de aire",
       "Aislamiento térmico deficiente"
     ],
     "nextSteps": [
       "Ventilar diariamente 10-15 minutos",
       "Revisar sistema de ventilación",
       "Valorar mejora de aislamiento"
     ],
     "riskLevel": "medio",
     "additionalEvidenceSuggested": [
       "Foto de zonas colindantes",
       "Detalle de manchas"
     ],
     "confidenceScore": 7
   }
   ```

3. **Integration with Frontend:**

   **Frontend change needed:**
   ```typescript
   // In useExpediente.ts
   const generatePrediagnostico = async () => {
     // Remove mock generation
     // Call backend instead:
     const response = await fetch(
       `${API_URL}/cases/${expedienteId}/re-evaluate`,
       { method: 'POST' }
     );
     const diagnosis = await response.json();

     // Update local state with real diagnosis
     expediente.prediagnostico = diagnosis;
     expediente.estado = ExpedienteState.S3_PREDIAGNOSTICO;
     saveExpediente(expediente);
   };
   ```

**Files to modify:**
- ✅ `casadiag-backend/src/cases/cases.service.ts` - Implement re-evaluation logic
- ⭐ Create `casadiag-backend/src/diagnosis/diagnosis.service.ts` - Diagnosis parsing
- ✅ Update `casadiag-backend/prisma/schema.prisma` - Add diagnosisData JSON field if needed
- 🎨 Update `src/hooks/useExpediente.ts` - Call backend API instead of mock

---

### **Task 3: Stripe Payment Integration** 💳 MEDIUM PRIORITY

**Current State:**
- Frontend shows PaymentModal but **mocks authorization**
- No real payment processing

**What to Build:**

1. **Stripe Setup:**
   ```bash
   npm install stripe --workspace=casadiag-backend
   ```

   Add to `.env`:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

2. **Payment Flow:**

   **Step 1: Frontend requests PaymentIntent**
   ```typescript
   // Frontend: when user clicks "Autorizar pago"
   POST /api/cases/:caseId/payments/create-intent

   // Body:
   {
     "packId": "informe", // or "prioridad"
     "amount": 4900 // 49€ in cents
   }

   // Response:
   {
     "clientSecret": "pi_xxx_secret_xxx",
     "paymentIntentId": "pi_xxx"
   }
   ```

   **Step 2: Frontend uses Stripe Elements to collect card**
   ```typescript
   // In PaymentModal.tsx - add Stripe Elements
   import { loadStripe } from '@stripe/stripe-js';
   import { Elements, CardElement, useStripe } from '@stripe/react-stripe-js';

   const stripe = await loadStripe(STRIPE_PUBLISHABLE_KEY);

   const handlePayment = async () => {
     const { error, paymentIntent } = await stripe.confirmCardPayment(
       clientSecret,
       { payment_method: { card: cardElement } }
     );

     if (paymentIntent.status === 'requires_capture') {
       // Payment authorized! Update backend
       await fetch(`/api/cases/${caseId}/payments/authorize`, {
         method: 'POST',
         body: JSON.stringify({ paymentIntentId })
       });
     }
   };
   ```

   **Step 3: Backend captures payment when report is delivered**
   ```typescript
   async capturePayment(caseId: string) {
     const payment = await this.prisma.payment.findFirst({
       where: { caseId, status: 'authorized' }
     });

     const captured = await this.stripe.paymentIntents.capture(
       payment.stripePaymentIntentId
     );

     await this.prisma.payment.update({
       where: { id: payment.id },
       data: { status: 'captured', capturedAt: new Date() }
     });
   }
   ```

3. **Payment Model Updates:**
   ```prisma
   model Payment {
     id                    String   @id @default(cuid())
     caseId                String
     case                  Case     @relation(...)
     stripePaymentIntentId String   @unique
     amount                Int      // Amount in cents
     currency              String   @default("eur")
     status                PaymentStatus
     authorizedAt          DateTime?
     capturedAt            DateTime?
     cancelledAt           DateTime?
     ...
   }

   enum PaymentStatus {
     pending
     authorized
     captured
     cancelled
     failed
   }
   ```

**Files to create:**
- ⭐ `casadiag-backend/src/payments/payments.module.ts`
- ⭐ `casadiag-backend/src/payments/payments.service.ts`
- ⭐ `casadiag-backend/src/payments/payments.controller.ts`
- ⭐ `casadiag-backend/src/payments/stripe.service.ts`
- 🎨 Update `src/components/asistente/PaymentModal.tsx` - Add Stripe Elements
- 🎨 Create `src/lib/stripe.ts` - Frontend Stripe utilities

---

### **Task 4: DOCX Report Generation** 📄 MEDIUM PRIORITY

**Current State:**
- No report generation exists
- Frontend expects report to be emailed after human review

**What to Build:**

1. **Install Dependencies:**
   ```bash
   npm install docxtemplater pizzip --workspace=casadiag-backend
   npm install @types/docxtemplater --save-dev --workspace=casadiag-backend
   ```

2. **Create DOCX Template:**

   Create `casadiag-backend/templates/informe-template.docx` in Word:
   ```
   INFORME TÉCNICO DE DIAGNÓSTICO

   Expediente: {expedienteId}
   Fecha: {fecha}

   1. DATOS DEL CASO
   - Perfil: {perfil}
   - Ubicación: {ubicacion}
   - Antigüedad: {antiguedad}

   2. DESCRIPCIÓN DEL PROBLEMA
   {descripcion}

   3. ANÁLISIS TÉCNICO
   {#hipotesis}
   - {.}
   {/hipotesis}

   4. POSIBLES CAUSAS
   {#posiblesCausas}
   - {.}
   {/posiblesCausas}

   5. RECOMENDACIONES
   {#proximosPasos}
   - {.}
   {/proximosPasos}

   6. EVIDENCIAS ANALIZADAS
   {#evidencias}
   - {nombre} ({tipo})
   {/evidencias}

   7. CONCLUSIONES
   {conclusiones}

   ___________________________
   Técnico revisor: {revisorNombre}
   Fecha de revisión: {fechaRevision}
   ```

3. **Report Generation Service:**

   ```typescript
   // casadiag-backend/src/reports/reports.service.ts

   import Docxtemplater from 'docxtemplater';
   import PizZip from 'pizzip';
   import * as fs from 'fs';

   async generateReport(caseId: string): Promise<Buffer> {
     // 1. Get case data with all relations
     const caseData = await this.prisma.case.findUnique({
       where: { id: caseId },
       include: {
         evidence: true,
         diagnosisHistory: { orderBy: { createdAt: 'desc' }, take: 1 },
         payment: true
       }
     });

     // 2. Load template
     const templatePath = path.join(__dirname, '../../templates/informe-template.docx');
     const content = fs.readFileSync(templatePath, 'binary');
     const zip = new PizZip(content);
     const doc = new Docxtemplater(zip);

     // 3. Prepare data for template
     const diagnosis = caseData.diagnosisHistory[0]?.diagnosisData;
     const templateData = {
       expedienteId: caseData.id,
       fecha: new Date().toLocaleDateString('es-ES'),
       perfil: caseData.userProfile,
       ubicacion: caseData.propertyAddress || 'No especificada',
       antiguedad: caseData.diagnosisHistory[0]?.diagnosisData?.antiguedad || 'No especificada',
       descripcion: caseData.fullName || 'Sin descripción',
       hipotesis: diagnosis?.hypotheses || [],
       posiblesCausas: diagnosis?.probableCauses || [],
       proximosPasos: diagnosis?.nextSteps || [],
       evidencias: caseData.evidence.map(e => ({
         nombre: e.filename,
         tipo: e.type
       })),
       conclusiones: diagnosis?.summary || 'Pendiente de revisión humana',
       revisorNombre: 'Pendiente',
       fechaRevision: new Date().toLocaleDateString('es-ES')
     };

     // 4. Render document
     doc.setData(templateData);
     doc.render();

     // 5. Generate buffer
     const buffer = doc.getZip().generate({ type: 'nodebuffer' });

     return buffer;
   }
   ```

4. **Integration:**
   ```typescript
   // Admin endpoint to generate and send report
   POST /api/admin/cases/:caseId/send-report

   async sendReport(caseId: string, adminNotes?: string) {
     // 1. Generate DOCX
     const reportBuffer = await this.reportsService.generateReport(caseId);

     // 2. Upload to R2 for archival
     const reportKey = `reports/${caseId}/informe-${Date.now()}.docx`;
     await this.r2Service.uploadFile(reportKey, reportBuffer, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

     // 3. Send via email
     await this.emailService.sendReportEmail(caseId, reportBuffer);

     // 4. Capture payment
     await this.paymentsService.capturePayment(caseId);

     // 5. Update case state
     await this.casesService.updateState(caseId, 'S7_ENVIADO');
   }
   ```

**Files to create:**
- ⭐ `casadiag-backend/src/reports/reports.module.ts`
- ⭐ `casadiag-backend/src/reports/reports.service.ts`
- ⭐ `casadiag-backend/templates/informe-template.docx` (Word document)

---

### **Task 5: Email Delivery (Resend)** 📧 LOW PRIORITY

**Current State:**
- No email integration

**What to Build:**

1. **Setup Resend:**
   ```bash
   npm install resend --workspace=casadiag-backend
   ```

   Add to `.env`:
   ```env
   RESEND_API_KEY=re_...
   RESEND_FROM_EMAIL=informes@micasaverde.es
   ```

2. **Email Service:**
   ```typescript
   // casadiag-backend/src/email/email.service.ts

   import { Resend } from 'resend';

   async sendReportEmail(caseId: string, reportBuffer: Buffer) {
     const caseData = await this.prisma.case.findUnique({
       where: { id: caseId }
     });

     const resend = new Resend(this.configService.get('RESEND_API_KEY'));

     await resend.emails.send({
       from: 'CasaDiag <informes@micasaverde.es>',
       to: caseData.email,
       subject: `Informe técnico - Expediente ${caseId}`,
       html: `
         <h2>Tu informe técnico está listo</h2>
         <p>Estimado/a ${caseData.fullName},</p>
         <p>Adjuntamos el informe técnico de diagnóstico solicitado.</p>
         <p>Expediente: ${caseId}</p>
         <p>Si tienes alguna duda, responde a este email.</p>
         <br/>
         <p>Saludos,<br/>Equipo CasaDiag</p>
       `,
       attachments: [
         {
           filename: `informe-${caseId}.docx`,
           content: reportBuffer
         }
       ]
     });
   }
   ```

**Files to create:**
- ⭐ `casadiag-backend/src/email/email.module.ts`
- ⭐ `casadiag-backend/src/email/email.service.ts`

---

### **Task 6: Admin Panel Endpoints** 🔧 LOW PRIORITY

**Current State:**
- No admin functionality exists

**What to Build:**

**Admin endpoints needed:**

```typescript
// List all cases pending review
GET /api/admin/cases?status=S6_REVISION_HUMANA

// Get case details for review
GET /api/admin/cases/:caseId/review

// Update diagnosis with human review notes
PATCH /api/admin/cases/:caseId/diagnosis
{
  "reviewerNotes": "...",
  "updatedDiagnosis": { ... }
}

// Send report (triggers DOCX generation + email + payment capture)
POST /api/admin/cases/:caseId/send-report

// Cancel case (refund payment if authorized)
POST /api/admin/cases/:caseId/cancel
```

**Admin authentication (simple JWT):**
```typescript
// casadiag-backend/src/auth/auth.module.ts
POST /api/auth/admin/login
{
  "username": "admin",
  "password": "..."
}

// Returns JWT token for admin endpoints
```

**Files to create:**
- ⭐ `casadiag-backend/src/admin/admin.module.ts`
- ⭐ `casadiag-backend/src/admin/admin.controller.ts`
- ⭐ `casadiag-backend/src/admin/admin.service.ts`
- ⭐ `casadiag-backend/src/auth/auth.module.ts` (for admin JWT)

---

## 🔗 Integration Strategy

### Phase 1: Replace Mock Data with API Calls

**Frontend files to update:**

1. **`src/hooks/useExpediente.ts`** - Main integration point

   Replace localStorage calls with API calls:
   ```typescript
   // Before (mock):
   const sendMessage = (content: string) => {
     addMessage(expedienteId, { role: 'user', content });
     // Mock assistant response
     const response = generateAssistantResponse(...);
   };

   // After (real API):
   const sendMessage = async (content: string) => {
     const response = await fetch(`${API_URL}/cases/${expedienteId}/messages`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ content })
     });
     const message = await response.json();

     // Update local state
     expediente.messages.push(message);
   };
   ```

2. **`src/hooks/useExpediente.ts` - Upload Evidence**
   ```typescript
   // Before (mock with blob URLs):
   const uploadEvidence = async (file: File) => {
     const url = URL.createObjectURL(file);
     addEvidence(expedienteId, { ... });
   };

   // After (real R2 upload):
   const uploadEvidence = async (file: File) => {
     const formData = new FormData();
     formData.append('file', file);
     formData.append('type', file.type.startsWith('image/') ? 'photo' : 'video');

     const response = await fetch(`${API_URL}/cases/${expedienteId}/evidence`, {
       method: 'POST',
       body: formData
     });

     const evidence = await response.json();

     // Optionally analyze with Vision API
     if (file.type.startsWith('image/')) {
       await fetch(`${API_URL}/cases/${expedienteId}/evidence/${evidence.id}/analyze-vision`, {
         method: 'POST'
       });
     }
   };
   ```

3. **`src/components/asistente/PaymentModal.tsx` - Real Stripe**
   ```typescript
   // Install Stripe in frontend
   npm install @stripe/stripe-js @stripe/react-stripe-js

   // Wrap PaymentModal with Stripe Elements
   const PaymentModalWithStripe = ({ packId, onAuthorize, ... }) => {
     const [clientSecret, setClientSecret] = useState('');

     useEffect(() => {
       // Get PaymentIntent client secret
       fetch(`${API_URL}/cases/${caseId}/payments/create-intent`, {
         method: 'POST',
         body: JSON.stringify({ packId, amount: getAmount(packId) })
       })
       .then(res => res.json())
       .then(data => setClientSecret(data.clientSecret));
     }, []);

     return (
       <Elements stripe={stripePromise} options={{ clientSecret }}>
         <PaymentForm onSuccess={onAuthorize} />
       </Elements>
     );
   };
   ```

### Phase 2: API Configuration

Create `src/config/api.ts`:
```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://patologias.micasaverde.es/api';

export const apiClient = {
  async post(endpoint: string, data?: any) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: data instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      body: data instanceof FormData ? data : JSON.stringify(data)
    });
    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    return response.json();
  },

  async get(endpoint: string) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`);
    if (!response.ok) throw new Error(`API error: ${response.statusText}`);
    return response.json();
  },

  // ... patch, delete, etc.
};
```

Add to `.env.local`:
```env
VITE_API_URL=https://patologias.micasaverde.es/api
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 📅 Implementation Timeline

### **Week 2 - Day by Day Plan**

#### **Day 1-2: OpenAI Assistant + Run Management**
- [ ] Create OpenAI Assistant via API
- [ ] Implement Run creation and polling in Messages service
- [ ] Add function call handlers (advance_to_evidencias, update_resumen, etc.)
- [ ] Test assistant responses with real conversations
- [ ] Update frontend to call API instead of generating mock responses

**Deliverable:** Chat with real AI responses

---

#### **Day 3: Re-evaluation Loop + Vision API**
- [ ] Implement re-evaluation trigger logic
- [ ] Enhance Vision API analysis to save to Evidence model
- [ ] Build diagnosis prompt with context + vision analyses
- [ ] Parse structured diagnosis JSON from assistant
- [ ] Save to DiagnosisHistory model
- [ ] Update frontend to fetch diagnosis from API

**Deliverable:** Real prediagnostico generation

---

#### **Day 4: Stripe Payment Integration**
- [ ] Set up Stripe in backend
- [ ] Create PaymentIntent endpoint
- [ ] Add Stripe Elements to frontend PaymentModal
- [ ] Implement payment authorization flow
- [ ] Test payment capture on report delivery

**Deliverable:** Working payment flow (authorize now, capture later)

---

#### **Day 5: DOCX Report Generation**
- [ ] Create Word template
- [ ] Implement DOCX generation service
- [ ] Test template rendering with real case data
- [ ] Upload generated reports to R2

**Deliverable:** DOCX reports generated from cases

---

#### **Day 6: Email + Admin Panel**
- [ ] Set up Resend email service
- [ ] Implement email sending with attachments
- [ ] Create basic admin endpoints
- [ ] Add admin authentication (JWT)
- [ ] Test full flow: admin sends report → email sent → payment captured

**Deliverable:** Complete end-to-end flow working

---

#### **Day 7: Testing + Deployment**
- [ ] Update TESTING_GUIDE.md with Week 2 features
- [ ] Test all new endpoints with Swagger
- [ ] Update deployment scripts if needed
- [ ] Deploy to production VPS
- [ ] Final integration testing with frontend

**Deliverable:** Week 2 deployed and tested

---

## 🧪 Testing Strategy

### Backend Testing (Swagger UI)

**Test Sequence:**

1. **Test Assistant Messaging:**
   ```bash
   # Create case
   POST /api/cases { "userProfile": "particular" }

   # Send message
   POST /api/cases/{caseId}/messages
   { "content": "Tengo humedades en el baño desde hace 2 meses" }

   # Should return assistant's response with function calls processed
   ```

2. **Test Evidence + Vision:**
   ```bash
   # Upload photo
   POST /api/cases/{caseId}/evidence
   (multipart form with image file)

   # Analyze with Vision
   POST /api/cases/{caseId}/evidence/{evidenceId}/analyze-vision

   # Check visionAnalysis field populated
   GET /api/cases/{caseId}/evidence/{evidenceId}
   ```

3. **Test Re-evaluation:**
   ```bash
   # Trigger prediagnostico generation
   POST /api/cases/{caseId}/re-evaluate

   # Check diagnosis created
   GET /api/cases/{caseId}
   # Should have currentState: 'S3_PREDIAGNOSTICO'
   ```

4. **Test Payment:**
   ```bash
   # Create PaymentIntent
   POST /api/cases/{caseId}/payments/create-intent
   { "packId": "informe", "amount": 4900 }

   # Returns clientSecret for Stripe

   # After frontend confirms: authorize payment
   POST /api/cases/{caseId}/payments/authorize
   { "paymentIntentId": "pi_xxx" }
   ```

5. **Test Report Generation (Admin):**
   ```bash
   # Generate DOCX
   POST /api/admin/cases/{caseId}/send-report

   # Check:
   # - DOCX uploaded to R2
   # - Email sent
   # - Payment captured
   # - Case state = 'S7_ENVIADO'
   ```

### Frontend Testing

1. **Create new case** from `/asistente`
2. **Chat with assistant** - verify real AI responses
3. **Upload photos** - verify R2 upload + Vision analysis
4. **Generate prediagnostico** - verify real diagnosis displayed
5. **Select pack** - verify payment modal with Stripe Elements
6. **Authorize payment** - verify success and state change

---

## 📝 Environment Variables Summary

Add to `casadiag-backend/.env`:

```env
# Week 1 (existing)
OPENAI_API_KEY=sk-proj-...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...

# Week 2 (new)
OPENAI_ASSISTANT_ID=asst_xxx  # ⚠️ Create assistant first
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...  # Also needed in frontend
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=informes@micasaverde.es
ADMIN_JWT_SECRET=random_secure_string_here
```

Add to frontend `.env.local`:
```env
VITE_API_URL=https://patologias.micasaverde.es/api
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

---

## 🎯 Success Criteria

Week 2 is **complete** when:

- ✅ User sends message → GPT Assistant responds (not mock)
- ✅ User uploads photo → Stored in R2 + Vision analysis saved
- ✅ User requests prediagnostico → Real diagnosis generated
- ✅ User selects paid pack → Stripe payment authorized (not captured)
- ✅ Admin sends report → DOCX generated + emailed + payment captured
- ✅ All endpoints tested and documented
- ✅ Frontend fully integrated with backend (no localStorage)

---

## 📚 Reference Documentation

- **OpenAI Assistants API:** https://platform.openai.com/docs/assistants/overview
- **OpenAI Vision API:** https://platform.openai.com/docs/guides/vision
- **Stripe PaymentIntents:** https://stripe.com/docs/payments/payment-intents
- **Resend Node SDK:** https://resend.com/docs/send-with-nodejs
- **Docxtemplater:** https://docxtemplater.com/docs/get-started-node/

---

**Next Steps:** Let me know when you're ready to start implementing! We can begin with Task 1 (OpenAI Assistant) as it's the highest priority and unblocks the chat experience.
