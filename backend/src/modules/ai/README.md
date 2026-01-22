# AI Service - System-Only Ingestion

## Critical Rules

### 🔴 AI Runs ONLY on Clinical Uploads
- AI parsing is triggered ONLY from `medical-records.service`
- **NEVER** from `personal-records.service`
- Patient uploads bypass AI completely

### 🔴 Output Destination
- AI output → `medical_records.data` (JSONB)
- Authority always = `'clinical'`
- Locked by default

### 🔴 AI Never Overwrites
- AI suggests structure
- Doctor confirms/edits
- Final data is doctor-verified

## Current Implementation

### Mock Parsing
The current implementation uses mock data for testing:
- Lab results (CBC example)
- Imaging results (X-Ray example)
- Prescription data (medication list)

### Integration Points
To integrate with real AI service (Gemini, OpenAI, etc.):

1. Update `parseDocument()` in [`ai.service.ts`](file:///c:/niraiva-pathway-ragav-main/backend/src/modules/ai/ai.service.ts)
2. Add API credentials to `.env`
3. Implement document OCR if needed
4. Parse structured data from AI response

### Example Integration (Gemini)
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async parseDocument(filePath: string, recordType: string) {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
  
  // Read file
  const fileBuffer = await fs.readFile(filePath);
  const base64 = fileBuffer.toString('base64');
  
  // Prompt based on record type
  const prompt = this.getPromptForType(recordType);
  
  const result = await model.generateContent([
    prompt,
    { inlineData: { data: base64, mimeType: 'image/jpeg' } }
  ]);
  
  return JSON.parse(result.response.text());
}
```

## Validation

### Upload Source Check
```typescript
// In medical-records.service.ts
if (!aiService.validateUploadSource(uploadedBy, userRole)) {
  // Skip AI parsing
}
```

### Patient Upload Block
```typescript
// In personal-records.service.ts
// NO AI parsing - intentionally omitted
```

## Data Flow

```
Doctor uploads PDF
    ↓
medical-records.service
    ↓
aiService.parseDocument()
    ↓
Structured JSON
    ↓
medical_records.data
    ↓
timeline_events (auto-created)
```

vs.

```
Patient uploads photo
    ↓
personal-records.service
    ↓
NO AI parsing
    ↓
personal_records.data
    ↓
timeline_events (auto-created, authority='personal')
```

## Security

- AI service has NO access to `personal_records` table
- AI parsing is logged in `audit_log`
- Failed parsing does NOT block record creation
- AI output is always reviewable by doctor
