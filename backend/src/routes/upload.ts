import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";

import { smartExtract } from "../utils/extractors/smartExtractor";
import { getSupabaseAdminClient } from "../lib/supabaseClient";
import { verifyToken } from "../middleware/verifyToken";
import { MultiLLMService } from "../services/MultiLLMService";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Extend Express Request to include multer file and user
declare global {
    namespace Express {
        interface Request {
            file?: Express.Multer.File;
            user?: any;
        }
    }
}

// Async error handler
const asyncHandler = (fn: (req: Request, res: Response, next?: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

// Helper function
function generatePatientId(): string {
    return `NIR-${new Date().getFullYear()}-${Math.random()
        .toString(16)
        .substring(2, 8)
        .toUpperCase()}`;
}

/**
 * POST /api/upload-report
 * Upload a health report (PDF, PNG, or JSON) for processing
 */
router.post(
    "/upload-report",
    verifyToken,
    upload.single("file"),
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
        console.log("📥 [UPLOAD-REPORT] POST request received");
        console.log("📥 [UPLOAD-REPORT] Headers:", {
            authorization: req.headers.authorization ? "Bearer ..." : "missing",
            contentType: req.headers["content-type"],
        });

        try {
            // Get user from request (set by middleware)
            const userId = req.user?.id;

            if (!userId) {
                console.error("❌ No user ID found in request");
                res.status(401).json({ error: "Unauthorized - no user found" });
                return;
            }

            console.log("✅ User authenticated:", userId);

            // Check if file was uploaded
            if (!req.file) {
                console.error("❌ No file uploaded");
                res.status(400).json({ error: "No file uploaded" });
                return;
            }

            const file = req.file as Express.Multer.File;

            console.log("📥 [UPLOAD-REPORT] File info:", {
                fieldname: file.fieldname,
                originalname: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
            });

            // Extract text using smart extractor
            console.log("🔄 Starting OCR/text extraction...");
            let extractedText: string;
            try {
                extractedText = await smartExtract(file);
            } catch (extractErr: any) {
                console.error("❌ Text extraction failed:", extractErr.message);
                res.status(500).json({
                    error: "Text extraction failed",
                    details: extractErr.message
                });
                return;
            }
            console.log(`📄 Extracted text length: ${extractedText.length} characters`);

            // Process with MultiLLM Service (Mistral, OpenRouter, NVIDIA, Qwen)
            const multiLLM = new MultiLLMService();

            const prompt = `
You are a medical document analyzer for the healthcare platform Niraiva.
Your job is to:
1. Extract structured clinical data into the schema provided
2. Classify the report into a Timeline Event
3. Determine event type, status, UI card labels, and detail fields
4. Output EXACTLY one JSON object matching the full schema
5. Never hallucinate — if you infer or normalize, add a clear note explaining why

Be fully deterministic.

# STEP 1 — Document Type Classification

If the text contains mostly profile info (name, age, gender, height, weight, BMI, emergency contact, blood type, allergies),
set: metadata.documentType = "Patient Profile"
and leave: parameters = [], medications = [], conditions = [], appointments = []

Otherwise treat it as: metadata.documentType = "health_report"

# STEP 2 — Critical Field Extraction Rules

## Blood Type
Recognize patterns: A+, A-, B+, O-, AB+, etc.
Use the most recent if multiple appear.

## Allergies
Look for: "Allergies", "Allergic to", "Known allergies"
Return as an array of strings. Standardize spelling, remove duplicates.

## Dates
Always use ISO 8601 (YYYY-MM-DD).
If month/year only → use YYYY-MM-01 + add note.

## Units
Prefer metric (kg, cm, mmHg, mg/dL).
If converted → add note.

## Parameter Status Mapping
normal → ["normal", "within normal", "WNL"]
warning → ["elevated", "high", "borderline", "abnormal"]
critical → ["critical", "severe", "very high"]

## Severity Mapping
Default is "moderate" if missing.

# STEP 3 — EVENT CLASSIFICATION FOR TIMELINE

After completing the main schema, ADD eventInfo:

{
  "eventInfo": {
    "eventType": "test" | "diagnosis" | "treatment" | "medication" | "appointment" | "profile" | "other",
    "status": "completed" | "pending",
    "displayTitle": string,
    "displaySubtitle": string | null,
    "displayDate": string | null,
    "icon": string,
    "details": {}
  }
}

## Event Type Detection

Keywords in document → eventType:
- Lab values, vitals, HbA1c, CBC → "test"
- Diagnosis, impression, assessment → "diagnosis"
- Medication names, dosage, RX → "medication"
- Therapy, treatment plan, procedure → "treatment"
- Appointment, follow-up, visit → "appointment"
- Pure demographics → "profile"
- None matched → "other"

## Status Logic

completed if:
- lab values present
- diagnosis given
- medication started
- appointment date is in the past
- report says "completed", "done", etc.

pending if:
- appointment date in future
- lab order but no results
- prescription written but not yet started

## Display Fields (Used for Timeline Cards)

### displayTitle
- test → "Lab Test Report" or detected test name
- diagnosis → diagnosis name
- medication → "Medication Update"
- appointment → appointment.title
- treatment → treatment name
- profile → "Patient Profile Update"

### displaySubtitle
A short explanation like:
- "Blood Pressure: 145/95 mmHg"
- "Check-up with Dr. Smith"
- "New prescription: Amlodipine"

### displayDate
Choose based on event type:
- test → metadata.documentDate
- diagnosis → metadata.documentDate
- appointment → appointment.date
- medication → medication.startDate
- treatment → metadata.documentDate
- profile → metadata.documentDate

### icon
- test → "T"
- diagnosis → "D"
- medication → "M"
- appointment → "A"
- treatment → "R"
- profile → "P"
- other → "O"

## Details
Include compact summary for "Show more":
{
  "details": {
    "parameters": [...],
    "medications": [...],
    "appointments": [...],
    "conditions": [...],
    "notes": string | null
  }
}

# STEP 4 — FULL STRICT OUTPUT SCHEMA

You MUST return JSON matching this EXACT structure:

{
  "type": "health_report",
  "metadata": {
    "documentDate": string | null,
    "patientId": string | null,
    "documentType": string | null,
    "provider": string | null
  },
  "data": {
    "profile": {
      "id": string | null,
      "name": string | null,
      "age": number | null,
      "gender": string | null,
      "height": { "value": number | null, "unit": string | null } | null,
      "weight": { "value": number | null, "unit": string | null } | null,
      "bmi": number | null,
      "bloodType": string | null,
      "emergencyContact": string | null,
      "allergies": string[] | null
    },
    "parameters": [],
    "medications": [],
    "appointments": [],
    "conditions": [],
    "clinicalInfo": {
      "allergies": [],
      "immunizations": [],
      "lifestyle": {
        "diet": string[] | null,
        "exercise": string[] | null,
        "smoking": "never" | "current" | "former" | null,
        "alcohol": "none" | "occasional" | "regular" | null,
        "note": string | null
      }
    }
  },
  "eventInfo": {
    "eventType": string,
    "status": string,
    "displayTitle": string,
    "displaySubtitle": string | null,
    "displayDate": string | null,
    "icon": string,
    "details": {}
  },
  "extractedAt": string | null,
  "processingStatus": "success" | "failure"
}

# STEP 5 — Final Output Requirements

- Must return exactly ONE JSON object
- No markdown, no backticks
- First character must be "{" and last must be "}"
- Arrays must not be null (use empty arrays)
- Missing values = null
- Include note fields whenever normalization or assumptions are made

TEXT:
${extractedText}
            `;

            console.log("🤖 Calling MultiLLM Service (Mistral, OpenRouter, NVIDIA, Qwen)...");
            let aiJSON: any = null;
            let aiStatus: 'parsed' | 'failed' = 'failed';
            let usedProvider = 'unknown';

            try {
                console.log("📋 MultiLLMService is initialized, calling parseReport...");
                const result = await multiLLM.parseReport(extractedText, prompt);
                aiJSON = result.data;
                usedProvider = result.provider;
                aiStatus = 'parsed';
                console.log(`✅ Report parsed successfully with provider: ${result.provider}`);
            } catch (parseErr: any) {
                console.warn(`❌ Failed to parse with MultiLLM Service:`, parseErr);
                console.warn(`Error type:`, parseErr.constructor.name);
                console.warn(`Error message:`, parseErr.message);
                console.warn(`Error stack:`, parseErr.stack);
                aiStatus = 'failed';
                aiJSON = null;
            }

            // Fallback: Extract basic parameters from raw text if AI failed
            if (!aiJSON) {
                const basicParams: any[] = [];
                const patterns = [
                    { regex: /blood\s*pressure[:\s]+(\d+)\s*\/\s*(\d+)/gi, name: 'Blood Pressure', unit: 'mmHg' },
                    { regex: /heart\s*rate[:\s]+(\d+)/gi, name: 'Heart Rate', unit: 'bpm' },
                    { regex: /temperature[:\s]+(\d+\.?\d*)/gi, name: 'Temperature', unit: '°F' },
                    { regex: /pulse[:\s]+(\d+)/gi, name: 'Pulse', unit: 'bpm' }
                ];

                for (const pattern of patterns) {
                    let match;
                    while ((match = pattern.regex.exec(extractedText)) !== null) {
                        basicParams.push({
                            name: pattern.name,
                            value: parseInt(match[1]),
                            unit: pattern.unit,
                            status: 'normal'
                        });
                    }
                }

                aiJSON = {
                    type: "health_report",
                    error: "AI Parsing failed - using basic extraction",
                    processingStatus: "partial",
                    metadata: {
                        documentType: "Medical Report"
                    },
                    data: {
                        parameters: basicParams.length > 0 ? basicParams : [{
                            name: "Report Uploaded",
                            value: 1,
                            unit: "report",
                            status: "normal"
                        }],
                        medications: [],
                        conditions: [],
                        appointments: []
                    },
                    eventInfo: {
                        eventType: "diagnostic_report",
                        displayTitle: "Medical Report Uploaded",
                        displaySubtitle: `Report analyzed - ${basicParams.length} vital(s) found`,
                        icon: "T"
                    }
                };
            }

            // Store in Supabase
            const patientId = generatePatientId();

            console.log("💾 Storing report in Supabase...");
            const supabaseAdmin = getSupabaseAdminClient();

            let reportData: any = null;
            let dbError: any = null;

            try {
                const result = await supabaseAdmin
                    .from("health_reports")
                    .insert({
                        user_id: userId,
                        patient_id: patientId,
                        report_json: aiJSON,
                        raw_text: extractedText,
                        file_type: file.mimetype,
                        uploaded_at: new Date().toISOString(),
                    })
                    .select('id')
                    .single();

                reportData = result.data;
                dbError = result.error;
            } catch (err: any) {
                console.error("❌ Database insert exception:", err);
                dbError = err;
            }

            if (dbError) {
                console.error("🔥 Supabase insert error:", dbError);
                res.status(500).json({
                    status: "supabase-error",
                    message: "Supabase insert failed",
                    supabase_error: dbError,
                    details: dbError?.message || JSON.stringify(dbError)
                });
                return;
            }

            // Also insert into timeline_events for the new Production Timeline
            // Event 1: The Report
            await supabaseAdmin.from('timeline_events').insert({
                patient_id: userId,
                event_type: 'diagnostic_report',
                title: aiJSON.eventInfo?.displayTitle || 'Health Report Uploaded',
                description: aiJSON.eventInfo?.displaySubtitle || `A new report was added.`,
                status: 'completed',
                category: 'test',
                event_time: new Date().toISOString()
            });

            // Event 2: AI Summary (if AI succeeded)
            if (aiStatus === 'parsed' && aiJSON.type !== "Patient Profile") {
                const aiSummaryText = `Clinical Summary: ${aiJSON.data?.conditions?.map((c: any) => c.name || c).join(', ') || 'Analyzed'}. Check details for vitals and labs.`;
                await supabaseAdmin.from('timeline_events').insert({
                    patient_id: userId,
                    event_type: 'ai_summary',
                    title: 'AI Insights Summary',
                    description: aiSummaryText,
                    status: 'completed',
                    category: 'report',
                    event_time: new Date().toISOString()
                });
            }

            // Insert parsed health parameters into health_parameters table
            if (aiStatus === 'parsed' && aiJSON.data?.parameters && Array.isArray(aiJSON.data.parameters)) {
                console.log(`📊 Inserting ${aiJSON.data.parameters.length} health parameters...`);
                const parametersToInsert = aiJSON.data.parameters.map((param: any) => ({
                    user_id: userId,
                    name: param.name || param.parameter || 'Unknown',
                    value: param.value || 0,
                    unit: param.unit || '',
                    status: param.status || param.interpretation || 'normal',
                    measured_at: new Date().toISOString(),
                    source: 'uploaded_report',
                }));

                const { error: paramError } = await supabaseAdmin
                    .from('health_parameters')
                    .insert(parametersToInsert);

                if (paramError) {
                    console.error('⚠️  Warning: Failed to insert health parameters:', paramError);
                    // Don't fail the request, just log the warning
                } else {
                    console.log(`✅ Successfully inserted ${parametersToInsert.length} health parameters`);
                }
            }

            console.log("✅ Report and timeline events stored successfully");

            res.json({
                status: "success",
                ai_status: aiStatus,
                patient_id: patientId,
                report: aiJSON,
                reportId: reportData.id,
                report_id: reportData.id
            });
        } catch (err) {
            console.error("❌ UPLOAD ERROR:", err);
            res.status(500).json({
                status: "error",
                message: err instanceof Error ? err.message : "Unknown error",
                details: String(err),
            });
        }
    })
);

export { router as uploadRouter };