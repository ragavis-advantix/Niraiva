import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import type { File } from "multer";
import { smartExtract } from "../utils/extractors/smartExtractor";
import { getSupabaseAdminClient } from "../lib/supabaseClient";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Extend Express Request to include multer file and user
declare global {
    namespace Express {
        interface Request {
            file?: File;
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

            const file = req.file;

            console.log("📥 [UPLOAD-REPORT] File info:", {
                fieldname: file.fieldname,
                originalname: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
            });

            // Extract text using smart extractor
            const extractedText = await smartExtract(file);
            console.log(`📄 Extracted text length: ${extractedText.length} characters`);

            // Process with Gemini API
            const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
            const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

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

            console.log("🤖 Calling Gemini API...");
            let aiJSON: any = null;
            let aiStatus: 'parsed' | 'failed' = 'failed';

            try {
                const aiRes = await fetch(GEMINI_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [{ text: prompt }],
                            },
                        ],
                    }),
                });

                if (!aiRes.ok) {
                    const errText = await aiRes.text();
                    console.error("❌ Gemini API error:", aiRes.status, errText);
                    throw new Error(`Gemini API Error ${aiRes.status}`);
                }

                const aiData = await aiRes.json() as any;
                const aiText =
                    aiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
                    JSON.stringify(aiData);

                try {
                    aiJSON = JSON.parse(aiText);
                } catch (err) {
                    const match = aiText.match(/\{[\s\S]*\}/);
                    aiJSON = match ? JSON.parse(match[0]) : { raw: aiText };
                }
                aiStatus = "parsed";
                console.log("✅ Gemini response parsed successfully");
            } catch (err: any) {
                console.warn("⚠️ Gemini AI Parsing failed (Continuing upload):", err.message);
                aiStatus = "failed";
                aiJSON = {
                    type: "health_report",
                    error: "AI Parsing failed or quota exceeded",
                    processingStatus: "failure",
                    eventInfo: {
                        displayTitle: "Manual Report Upload",
                        displaySubtitle: "Upload succeeded, AI analysis failed",
                        icon: "O"
                    },
                    data: { parameters: [], medications: [], conditions: [] }
                };
            }

            // Store in Supabase
            const patientId = generatePatientId();

            console.log("💾 Storing report in Supabase...");
            const supabaseAdmin = getSupabaseAdminClient();
            const { data: reportData, error: dbError } = await supabaseAdmin
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

            if (dbError) {
                console.error("🔥 Supabase insert error:", dbError);
                res.status(500).json({
                    status: "supabase-error",
                    message: "Supabase insert failed",
                    supabase_error: dbError,
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

            console.log("✅ Report and timeline events stored successfully");

            res.json({
                status: "success",
                ai_status: aiStatus,
                patient_id: patientId,
                report: aiJSON,
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