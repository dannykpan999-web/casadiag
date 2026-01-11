# CasaDiag Backend - Testing Guide

**Base URL:** https://patologias.micasaverde.es/api

## Quick Testing with cURL

### 1. Create a New Case

```bash
curl -X POST https://patologias.micasaverde.es/api/cases \
  -H "Content-Type: application/json" \
  -d '{"userProfile":"particular"}'
```

**Expected Response:**
```json
{
  "id": "case_id_here",
  "userProfile": "particular",
  "currentState": "S0_WELCOME",
  "threadId": "thread_xxx",
  ...
}
```

**→ Copy the `id` value for next steps**

---

### 2. Get Case Details

Replace `{CASE_ID}` with your case ID:

```bash
curl https://patologias.micasaverde.es/api/cases/{CASE_ID}
```

---

### 3. Update Case Information

```bash
curl -X PATCH https://patologias.micasaverde.es/api/cases/{CASE_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Juan Pérez",
    "email": "juan@example.com",
    "phone": "+34600123456",
    "propertyAddress": "Calle Mayor 123, Madrid"
  }'
```

---

### 4. Upload Evidence (Photo)

Replace `{CASE_ID}` and `path/to/image.jpg`:

```bash
curl -X POST https://patologias.micasaverde.es/api/cases/{CASE_ID}/evidence \
  -F "file=@path/to/image.jpg" \
  -F "type=photo"
```

**Expected Response:**
```json
{
  "id": "evidence_id_here",
  "caseId": "case_id",
  "filename": "image.jpg",
  "storageUrl": "https://...",
  ...
}
```

**→ Copy the evidence `id` for Vision API test**

---

### 5. Analyze Image with Vision API

Replace `{CASE_ID}` and `{EVIDENCE_ID}`:

```bash
curl -X POST https://patologias.micasaverde.es/api/cases/{CASE_ID}/evidence/{EVIDENCE_ID}/analyze-vision
```

**Expected Response:**
```json
{
  "id": "evidence_id",
  "visionAnalysis": {
    "pathologyType": "humedad_condensacion",
    "confidence": 7,
    "visualSymptoms": ["manchas_oscuras", "descamación"],
    "affectedElements": ["techo", "pared"],
    "technicalObservations": ["Se observan manchas oscuras..."]
  }
}
```

---

### 6. Send a Message

```bash
curl -X POST https://patologias.micasaverde.es/api/cases/{CASE_ID}/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Tengo humedades en el techo del baño. ¿Qué puede ser?"
  }'
```

---

### 7. List All Messages

```bash
curl https://patologias.micasaverde.es/api/cases/{CASE_ID}/messages
```

---

### 8. List All Cases (with pagination)

```bash
curl "https://patologias.micasaverde.es/api/cases?take=10&skip=0"
```

---

### 9. Get Case State

```bash
curl https://patologias.micasaverde.es/api/cases/{CASE_ID}/state
```

---

### 10. Trigger Re-evaluation

```bash
curl -X POST https://patologias.micasaverde.es/api/cases/{CASE_ID}/re-evaluate
```

---

## Testing with Swagger UI (Recommended)

**URL:** https://patologias.micasaverde.es/api/docs

### Advantages:
- ✅ Visual interface
- ✅ No command line needed
- ✅ Built-in request/response formatting
- ✅ File upload interface
- ✅ Auto-completion
- ✅ See all available endpoints

### How to Use:

1. **Open Swagger:** https://patologias.micasaverde.es/api/docs
2. **Find an endpoint** (e.g., "POST /api/cases")
3. **Click "Try it out"**
4. **Fill in parameters**
5. **Click "Execute"**
6. **See response** below

---

## Testing Workflow Example

### Complete User Journey Test:

```bash
# 1. Create case
CASE_RESPONSE=$(curl -s -X POST https://patologias.micasaverde.es/api/cases \
  -H "Content-Type: application/json" \
  -d '{"userProfile":"particular"}')

echo $CASE_RESPONSE

# Extract case ID (you'll need to copy it manually from the response)
CASE_ID="paste_case_id_here"

# 2. Update case info
curl -s -X PATCH https://patologias.micasaverde.es/api/cases/$CASE_ID \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "María González",
    "email": "maria@example.com",
    "phone": "+34612345678",
    "propertyAddress": "Av. Libertad 45, Barcelona"
  }'

# 3. Upload evidence
EVIDENCE_RESPONSE=$(curl -s -X POST https://patologias.micasaverde.es/api/cases/$CASE_ID/evidence \
  -F "file=@my_photo.jpg" \
  -F "type=photo")

echo $EVIDENCE_RESPONSE

# Extract evidence ID
EVIDENCE_ID="paste_evidence_id_here"

# 4. Analyze with Vision API
curl -s -X POST https://patologias.micasaverde.es/api/cases/$CASE_ID/evidence/$EVIDENCE_ID/analyze-vision

# 5. Send message
curl -s -X POST https://patologias.micasaverde.es/api/cases/$CASE_ID/messages \
  -H "Content-Type: application/json" \
  -d '{
    "content": "He subido una foto de las humedades. ¿Qué tipo de problema es?"
  }'

# 6. List all evidence
curl -s https://patologias.micasaverde.es/api/cases/$CASE_ID/evidence

# 7. List all messages
curl -s https://patologias.micasaverde.es/api/cases/$CASE_ID/messages

# 8. Get current state
curl -s https://patologias.micasaverde.es/api/cases/$CASE_ID/state
```

---

## Testing Frontend Integration

When you integrate the frontend, use these endpoints:

### JavaScript/TypeScript Example:

```javascript
// 1. Create case
const createCase = async () => {
  const response = await fetch('https://patologias.micasaverde.es/api/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userProfile: 'particular' })
  });
  const data = await response.json();
  return data.id; // Case ID
};

// 2. Upload evidence
const uploadEvidence = async (caseId, file) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('type', 'photo');

  const response = await fetch(
    `https://patologias.micasaverde.es/api/cases/${caseId}/evidence`,
    { method: 'POST', body: formData }
  );
  return await response.json();
};

// 3. Analyze with Vision API
const analyzeEvidence = async (caseId, evidenceId) => {
  const response = await fetch(
    `https://patologias.micasaverde.es/api/cases/${caseId}/evidence/${evidenceId}/analyze-vision`,
    { method: 'POST' }
  );
  return await response.json();
};

// 4. Send message
const sendMessage = async (caseId, content) => {
  const response = await fetch(
    `https://patologias.micasaverde.es/api/cases/${caseId}/messages`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    }
  );
  return await response.json();
};

// Example usage
const testWorkflow = async () => {
  // Create case
  const caseId = await createCase();
  console.log('Case created:', caseId);

  // Upload photo
  const fileInput = document.querySelector('input[type="file"]');
  const file = fileInput.files[0];
  const evidence = await uploadEvidence(caseId, file);
  console.log('Evidence uploaded:', evidence);

  // Analyze image
  const analysis = await analyzeEvidence(caseId, evidence.id);
  console.log('Vision analysis:', analysis.visionAnalysis);

  // Send message
  const message = await sendMessage(caseId, 'Hola, necesito ayuda con humedades');
  console.log('Message sent:', message);
};
```

---

## Expected Test Results

### ✅ Successful Case Creation:
- HTTP 201 Created
- Returns case ID
- Returns OpenAI thread ID
- Current state is "S0_WELCOME"

### ✅ Successful Evidence Upload:
- HTTP 201 Created
- File uploaded to R2
- Returns storage URL
- File size recorded

### ✅ Successful Vision Analysis:
- HTTP 200 OK
- Returns pathology detection
- Spanish technical observations
- Confidence score (0-10)

### ✅ Successful Message Sending:
- HTTP 201 Created
- Message added to OpenAI thread
- Returns OpenAI message ID
- Stored in database

---

## Troubleshooting

### Issue: 404 Not Found
- Check the URL is correct
- Ensure case ID exists
- Verify endpoint path

### Issue: 500 Internal Server Error
- Check PM2 logs: `ssh root@91.98.167.120 "pm2 logs casadiag-api"`
- Verify R2 credentials are valid
- Check database connection

### Issue: File Upload Fails
- Ensure file is less than 50MB
- Check file format (JPG, PNG, MP4, etc.)
- Verify R2 credentials are working

### Issue: Vision API Slow
- Normal - OpenAI Vision takes 2-5 seconds
- Wait for response
- Check PM2 logs if timeout

---

## Test Data Examples

### Valid User Profiles:
- `"particular"` - Homeowner
- `"abogado"` - Lawyer
- `"administrador"` - Administrator

### Valid Evidence Types:
- `"photo"` - Photo of pathology
- `"video"` - Video recording
- `"document"` - Document/report

### Sample Property Addresses:
- "Calle Mayor 123, Madrid 28013"
- "Av. Diagonal 456, Barcelona 08029"
- "Plaza España 78, Sevilla 41004"

### Sample Messages (Spanish):
- "Tengo humedades en el techo del baño"
- "He encontrado grietas en la pared del salón"
- "Hay filtraciones de agua en el sótano"
- "Las ventanas tienen condensación"

---

## API Response Formats

All endpoints return JSON with proper HTTP status codes:

- **200 OK** - Successful GET/PATCH
- **201 Created** - Successful POST
- **400 Bad Request** - Invalid input
- **404 Not Found** - Resource not found
- **500 Internal Server Error** - Server error

---

## Next Steps (Week 2)

Features to test after Week 2 implementation:

1. GPT Assistant responses (messages will get AI replies)
2. Automatic re-evaluation loop
3. Stripe payment integration
4. Admin panel endpoints
5. DOCX report generation
6. Email delivery

---

**Documentation:** https://patologias.micasaverde.es/api/docs
**API Base:** https://patologias.micasaverde.es/api
**Support:** Check PM2 logs or contact developer
