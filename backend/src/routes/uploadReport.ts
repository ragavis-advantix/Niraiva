import { Router, type Request, type Response } from "express";
import multer from "multer";
import Tesseract from "tesseract.js";
import { getSupabaseAdminClient, getSupabaseClient } from "../lib/supabaseClient";
import { MultiLLMService } from "../services/MultiLLMService";
import { extractClinicalDates, resolvePrimaryClinicialDate, logDateExtraction } from "../lib/clinicalDateExtraction";
import fs from "fs";
import path from "path";

const DEBUG_LOG = path.join(process.cwd(), "upload_debug.log");
function debugLog(msg: string) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(DEBUG_LOG, `[${timestamp}] ${msg}\n`);
}

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });
let lastAIError: string | null = null;
const multiLLMService = new MultiLLMService();

// Extend Express Request to include multer file and user
declare global {
    namespace Express {
        interface Request {
            file?: Express.Multer.File;
            user?: any;
        }
    }
}

function cleanText(text: string) {
    return String(text || "")
        .replace(/\s+/g, " ")
        .replace(/[^a-zA-Z0-9.,:/\-+()\s]/g, "")
        .trim();
}

function generatePatientId() {
    return `NIR-${new Date().getFullYear()}-${Math.random()
        .toString(16)
        .substring(2, 8)
        .toUpperCase()}`;
}

router.post(
    "/upload-report",
    upload.single("file"),
    async (req: Request, res: Response) => {
        try {
            debugLog(`📥 [UPLOAD-REPORT] START - file: ${req.file?.originalname}, size: ${req.file?.size}`);
            console.log("📥 [UPLOAD-REPORT] POST request received");
            console.log("📥 [UPLOAD-REPORT] Headers:", {
                authorization: req.headers.authorization ? "Bearer ..." : "missing",
                contentType: req.headers["content-type"],
            });

            // AUTHENTICATION
            let user: any = null;
            const bypass =
                process.env.NODE_ENV === "development" &&
                String(req.headers["x-bypass-auth"]) === "true";

            if (bypass) {
                console.log("⚠️ Dev bypass auth enabled");
                user = { id: "00000000-0000-0000-0000-000000000000" };
            } else {
                const token = (req.headers.authorization || "").replace("Bearer ", "").trim();
                if (!token || token === 'null' || token === 'undefined') {
                    return res.status(401).json({ error: "Missing or invalid token" });
                }

                const supabaseAdmin = getSupabaseAdminClient();
                const { data: { user: foundUser }, error } = await supabaseAdmin.auth.getUser(token as string);

                if (error || !foundUser) {
                    console.error("🛡️ [AUTH] Supabase verification failed:", error?.message || "User not found");
                    return res.status(401).json({ error: "Invalid token", details: error?.message });
                }

                user = foundUser;
            }
            req.user = user;

            // FILE VALIDATION
            if (!req.file) return res.status(400).json({ error: "No file uploaded" });

            const file = req.file as Express.Multer.File;
            const mime = file.mimetype || "application/octet-stream";

            // ========== REJECT PDFs ==========
            if (mime === "application/pdf" || file.originalname?.toLowerCase().endsWith('.pdf')) {
                // Log for analytics
                console.warn(`[UPLOAD-REPORT] PDF upload blocked: user=${user?.id} file=${file.originalname}`);

                // Return 415 Unsupported Media Type
                return res.status(415).json({
                    status: "unsupported_media_type",
                    message: "PDF uploads are not supported. Please upload a screenshot (PNG/JPG) of the PDF, or a JSON export.",
                    hint: "Take a screenshot of your PDF and upload the image instead."
                });
            }

            // ========== VALIDATE ALLOWED TYPES ==========
            const allowedMimeTypes = ['image/png', 'image/jpeg', 'application/json'];
            if (!allowedMimeTypes.includes(mime)) {
                console.warn(`[UPLOAD-REPORT] Unsupported file type: ${mime}`);
                return res.status(415).json({
                    status: "unsupported_media_type",
                    message: "Unsupported file type. Please upload PNG, JPG, or JSON files only."
                });
            }

            let extractedText = "";

            // ========== IMAGE PROCESSING ==========
            if (mime.startsWith("image/")) {
                console.log("🖼️ Processing image file with OCR...");
                try {
                    const ocr = await Tesseract.recognize(file.buffer, "eng");
                    extractedText = ocr?.data?.text || "";
                    console.log("✅ Image OCR completed");
                } catch (err) {
                    console.error("❌ OCR ERROR:", err);
                    return res.status(500).json({ status: "error", message: "Failed to extract image text", details: String(err) });
                }
            }
            // ========== JSON PROCESSING ==========
            else if (mime === "application/json") {
                console.log("📄 Processing JSON file...");
                try {
                    const jsonContent = JSON.parse(file.buffer.toString("utf8"));
                    extractedText = JSON.stringify(jsonContent, null, 2);
                    console.log("✅ JSON parsed successfully");
                } catch (err) {
                    console.error("❌ JSON PARSE ERROR:", err);
                    return res.status(400).json({ status: "error", message: "Invalid JSON file", details: String(err) });
                }
            }

            const cleanedText = cleanText(extractedText);
            debugLog(`📝 Cleaned text length: ${cleanedText.length}`);
            console.log(`📝 Extracted text length: ${cleanedText.length} characters`);

            if (cleanedText.length < 10) {
                return res.status(400).json({
                    status: "error",
                    message: "Extracted text is too short. Please ensure the file contains readable text."
                });
            }

            // MULTI-LLM ANALYSIS
            const prompt = `
You are a medical document analyzer. Convert this text into EXACTLY one JSON following this schema:

{
  "type": "health_report",
  "metadata": {
    "documentDate": string | null,
    "patientId": string | null,
    "documentType": string | null,
    "provider": string | null
  },
  "eventInfo": {
    "eventType": "test" | "diagnosis" | "medication" | "treatment" | "appointment" | "vitals",
    "eventTitle": string,
    "eventDescription": string,
    "status": "completed"
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
    "parameters": [
      {
        "name": string | null,
        "value": number | string | null,
        "unit": string | null,
        "status": "normal" | "warning" | "critical" | "improved" | "stable" | "worsened" | null,
        "referenceRange": string | null,
        "lastUpdated": string | null,
        "trend": "improved" | "stable" | "worsened" | null
      }
    ],
    "medications": [],
    "appointments": [],
    "conditions": [
      {
        "id": string | null,
        "name": string | null,
        "diagnosedDate": string | null,
        "severity": "mild" | "moderate" | "severe" | null,
        "currentStatus": "controlled" | "improving" | "worsening" | null,
        "relatedParameters": [string]
      }
    ],
    "clinicalInfo": {
      "allergies": [],
      "immunizations": [],
      "lifestyle": null
    }
  },
  "extractedAt": string | null,
  "processingStatus": "success"
}

RULES FOR parameters in data:
- ONLY include parameters that have actual values found in the document.
- DO NOT include parameters where the value is "N/A", "unknown", or not mentioned.
- EXPLICITLY extract all Vital Signs: Blood Pressure (Systolic and Diastolic), Heart Rate (Pulse), SpO2 (Oxygen Saturation), and Body Temperature.
- Blood Pressure can be "120/80" or separate "Systolic BP" and "Diastolic BP".
- ALWAYS extract diabetic markers if present: HbA1c, Fasting Blood Sugar, Post-Prandial Blood Sugar.
- Capture Lipid profile: Total Cholesterol, LDL, HDL, Triglycerides.
- If a value is mentioned but not explicitly labeled as normal/high, use your medical knowledge to determine the status (normal/warning/critical).

RULES FOR eventInfo:
- If the report is a blood test → eventType = "test", eventTitle = "Blood Test"
- If the report is a prescription → eventType = "medication", eventTitle = "Medication Updated"
- If the report is a vital stats screenshot → eventType = "vitals", eventTitle = "Vitals Recorded"
- If the report contains diagnosis → eventType = "diagnosis", eventTitle = "Diagnosis"
- If the report contains recommendations for follow-up or visits → eventType = "appointment", eventTitle = "Appointment"
- eventTitle must be clear and human-readable
- eventDescription must summarize key extracted information (e.g., "CBC, HbA1c levels", "BP 142/93, Pulse 95")


TEXT:
${cleanedText}
        `;

            const medsSchemaNote = `\n\nNOTE: Always return a "medications" array where each item has the fields: name (string), dosage (string), frequency (string), startDate (string).`;
            const fullPrompt = prompt + medsSchemaNote;

            console.log("🤖 Starting multi-provider AI analysis...");
            let aiJSON: any = null;
            let aiStatus: 'parsed' | 'failed' = 'failed';

            try {
                debugLog("🤖 Starting AI Analysis...");
                const { data } = await multiLLMService.parseReport(cleanedText, fullPrompt);
                aiJSON = data;
                aiStatus = "parsed";
                debugLog(`✅ AI Success using: ${aiJSON.provider || 'unknown'}`);
                console.log("✅ Analysis complete using MultiLLMService");
            } catch (err: any) {
                const errorDetail = `AI Error: ${err.message} | OCR Length: ${cleanedText.length} | Text Snippet: ${cleanedText.substring(0, 100)}...`;
                debugLog(`❌ AI FAILURE: ${errorDetail}`);
                console.warn("⚠️ All AI Providers failed:", errorDetail);
                lastAIError = errorDetail;
                aiStatus = "failed";
                aiJSON = {
                    type: "health_report",
                    error: err.message,
                    processingStatus: "failure",
                    eventInfo: {
                        eventTitle: "Manual Report Upload",
                        eventDescription: "Upload succeeded, AI analysis temporarily unavailable",
                        eventType: "test",
                        status: "completed"
                    },
                    data: { parameters: [], medications: [], conditions: [] }
                };
            }

            // SUPABASE INSERT
            const patientId = generatePatientId();
            const supabaseAdmin = getSupabaseAdminClient();

            // Fetch or create user_profile ID (REQUIRED for health_reports)
            debugLog(`🔍 Fetching profile for user: ${user.id}`);
            let { data: profileRow } = await supabaseAdmin
                .from('user_profiles')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (!profileRow) {
                debugLog(`✏️ Creating missing user_profile for user: ${user.id}`);
                const { data: newProfile, error: profileErr } = await supabaseAdmin
                    .from('user_profiles')
                    .insert({
                        user_id: user.id,
                        email: user.email,
                        created_at: new Date().toISOString()
                    })
                    .select('id')
                    .single();

                if (profileErr || !newProfile) {
                    console.error("🔥 Failed to bootstrap profile:", profileErr);
                    return res.status(500).json({ status: "error", message: "Failed to create user profile" });
                }
                profileRow = newProfile;
            }

            const patientProfileId = profileRow.id;
            debugLog(`✅ Using patient_profile_id: ${patientProfileId}`);

            const { data: reportData, error: dbError } = await supabaseAdmin
                .from("health_reports")
                .insert({
                    user_id: user.id,
                    patient_id: patientId,
                    patient_profile_id: patientProfileId, // ✅ ADDED REQUIRED COLUMN
                    report_json: aiJSON,
                    raw_text: cleanedText,
                    file_type: mime,
                    uploaded_at: new Date().toISOString(),
                } as any)
                .select('id')
                .single();

            if (dbError) {
                console.error("🔥 Supabase insert error:", dbError);
                debugLog(`❌ Supabase Insert Error: ${JSON.stringify(dbError)}`);
                return res.status(500).json({ status: "supabase-error", message: "Supabase insert failed", supabase_error: dbError });
            }

            if (!reportData) {
                console.error("🔥 Supabase returned success but no data for select('id').single()");
                debugLog("❌ Supabase Insert Error: No data returned");
                return res.status(500).json({ status: "error", message: "Database returned no data" });
            }

            // ALSO: update user's profile health_metrics and add a timeline event so frontend can read it
            try {
                const profile = aiJSON?.data?.profile || {};
                const health_metrics: any = {};

                // Extract values
                const age = profile.age || null;
                const heightValue = profile.height?.value;
                const weightValue = profile.weight?.value;
                let bmi = profile.bmi;

                // Calculate BMI server-side if we have height and weight
                if (heightValue && weightValue && !bmi) {
                    const heightInMeters = heightValue / 100; // Convert cm to meters
                    bmi = Number((weightValue / (heightInMeters * heightInMeters)).toFixed(1));
                    console.log(`📊 Calculated BMI: ${bmi} (Height: ${heightValue}cm, Weight: ${weightValue}kg)`);
                }

                // Build health_metrics object
                if (profile.bloodType) health_metrics.blood_type = profile.bloodType;
                if (heightValue) health_metrics.height = heightValue;
                if (weightValue) health_metrics.weight = weightValue;
                if (bmi) health_metrics.bmi = bmi;

                const chronicConditions = aiJSON?.data?.conditions?.map((c: any) => c.name).filter(Boolean) || [];

                // 📊 HEALTH SNAPSHOT UPDATE (Delta-based merge)
                if (aiStatus === 'parsed') {
                    try {
                        console.log('🔄 Syncing health snapshot for user:', user.id);
                        const { data: existing } = await supabaseAdmin
                            .from('patient_health_snapshot')
                            .select('*')
                            .eq('patient_id', user.id)
                            .maybeSingle();

                        const data = aiJSON?.data || aiJSON || {};
                        const parsedParams = data.parameters || data.tests || [];

                        // Robust condition extractor (Canonical Mapping)
                        const extractChronicConditions = (parsed: any): string[] | null => {
                            const conditionsList = new Set<string>();

                            // Check 'conditions' field (current implementation)
                            if (Array.isArray(parsed.conditions)) {
                                parsed.conditions.forEach((c: any) => {
                                    const name = typeof c === 'string' ? c : (c.name || c.condition);
                                    if (name) conditionsList.add(name);
                                });
                            }

                            // Check 'diagnosis' field (common LLM output)
                            if (Array.isArray(parsed.diagnosis)) {
                                parsed.diagnosis.forEach((d: any) => {
                                    if (typeof d === 'string') conditionsList.add(d);
                                    else if (d.name) conditionsList.add(d.name);
                                });
                            }

                            // Check 'chronic_conditions' field
                            if (Array.isArray(parsed.chronic_conditions)) {
                                parsed.chronic_conditions.forEach((c: any) => {
                                    if (typeof c === 'string') conditionsList.add(c);
                                    else if (c.name) conditionsList.add(c.name);
                                });
                            }

                            // Heuristic extraction from summary
                            const summary = (parsed.summary || "").toLowerCase();
                            if (summary.includes("neuropathy")) conditionsList.add("Peripheral Neuropathy");
                            if (summary.includes("prediabetic") || summary.includes("pre-diabetic")) conditionsList.add("Pre-diabetes");
                            if (summary.includes("hypertension") || summary.includes("high blood pressure")) conditionsList.add("Hypertension");

                            return conditionsList.size > 0 ? Array.from(conditionsList) : null;
                        };

                        const parsedConditions = extractChronicConditions(data);

                        const findParam = (names: string[]) => {
                            const p = parsedParams.find((p: any) => {
                                const pName = (p.name || p.parameter || "").toLowerCase();
                                return names.some(n => pName.includes(n));
                            });
                            if (!p || p.value === null || p.value === undefined) return null;
                            const val = typeof p.value === 'number' ? p.value : parseFloat(String(p.value));
                            return isNaN(val) ? null : val;
                        };

                        const systolic = findParam(['systolic blood pressure', 'systolic bp']);
                        const diastolic = findParam(['diastolic blood pressure', 'diastolic bp']);
                        const heart_rate = findParam(['heart rate', 'pulse']);
                        const spo2 = findParam(['oxygen saturation', 'spo2']);
                        const temperature = findParam(['temperature', 'body temperature']);
                        const hba1c = findParam(['hba1c', 'hb a1c']);
                        const ldl = findParam(['ldl cholesterol', 'ldl']);
                        const b12 = findParam(['vitamin b12', 'b12']);

                        // Merge logic
                        const updatedSnapshot: any = {
                            patient_id: user.id,
                            systolic_bp: systolic ?? existing?.systolic_bp,
                            diastolic_bp: diastolic ?? existing?.diastolic_bp,
                            heart_rate: heart_rate ?? existing?.heart_rate,
                            spo2: spo2 ?? existing?.spo2,
                            temperature: temperature ?? existing?.temperature,
                            hba1c: hba1c ?? existing?.hba1c,
                            ldl: ldl ?? existing?.ldl,
                            vitamin_b12: b12 ?? existing?.vitamin_b12,

                            // FIX: Only overwrite if we have NEW conditions, otherwise keep existing
                            chronic_conditions: parsedConditions !== null
                                ? parsedConditions
                                : (existing?.chronic_conditions || []),

                            source_report_id: reportData.id,
                            last_updated: new Date().toISOString()
                        };

                        // Only upsert if there's at least one data field provided
                        const hasNewData = [systolic, diastolic, heart_rate, spo2, temperature, hba1c, ldl, b12].some(v => v !== null) || parsedConditions !== null;

                        if (hasNewData) {
                            const { error: snapshotErr } = await supabaseAdmin
                                .from('patient_health_snapshot')
                                .upsert(updatedSnapshot);

                            if (snapshotErr) {
                                console.warn('⚠️ Failed to upsert health snapshot:', snapshotErr);
                            } else {
                                console.log('✅ Health snapshot updated successfully');
                            }
                        } else {
                            console.log('ℹ️ No new structured health fields found, skipping snapshot update');
                        }
                    } catch (snapErr) {
                        console.warn('❌ Health snapshot sync error:', snapErr);
                    }
                }

                // Upsert into user_profiles (if AI succeeded)
                if (aiStatus === 'parsed' && (Object.keys(health_metrics).length > 0 || age || profile.name || profile.gender || chronicConditions.length > 0 || profile.allergies || aiJSON?.data?.medications)) {
                    const upsertPayload: any = {
                        user_id: user.id,
                    };

                    // Medical profile fields
                    if (profile.name) upsertPayload.name = profile.name;  // ✅ Changed full_name → name
                    if (profile.emergencyContact) upsertPayload.phone = profile.emergencyContact;
                    if (profile.gender) upsertPayload.gender = profile.gender;
                    if (age) upsertPayload.age = age;
                    if (heightValue) upsertPayload.height = heightValue;
                    if (weightValue) upsertPayload.weight = weightValue;
                    if (profile.bloodType) upsertPayload.blood_group = profile.bloodType;
                    if (bmi) upsertPayload.bmi = bmi;
                    if (chronicConditions.length > 0) upsertPayload.chronic_conditions = chronicConditions;

                    // Legacy fields for backward compatibility
                    if (Object.keys(health_metrics).length > 0) upsertPayload.health_metrics = health_metrics;
                    if (profile.allergies) upsertPayload.allergies = profile.allergies;
                    if (aiJSON?.data?.medications) upsertPayload.medications = aiJSON.data.medications;

                    // metadata
                    upsertPayload.last_updated_at = new Date().toISOString();
                    upsertPayload.full_name = upsertPayload.name || upsertPayload.full_name; // Sync name fields

                    console.log('💾 Upserting user profile with:', {
                        full_name: upsertPayload.full_name,
                        age,
                        gender: upsertPayload.gender,
                        height: upsertPayload.height,
                        weight: upsertPayload.weight,
                        bmi,
                        blood_group: upsertPayload.blood_group,
                        chronic_conditions: chronicConditions
                    });

                    // Use upsert with onConflict user_id so we don't create duplicate rows
                    const { error: upsertError } = await supabaseAdmin
                        .from('user_profiles')
                        .upsert([upsertPayload], { onConflict: 'user_id' });

                    if (upsertError) {
                        console.warn('Failed to upsert user_profiles:', upsertError);
                    } else {
                        console.log('✅ User profile updated successfully');
                    }
                }

                // Event 2: AI Summary (if AI succeeded)
                if (aiStatus === 'parsed') {
                    try {
                        debugLog(`📅 Starting timeline/parameters processing for report: ${reportData?.id}`);
                        const eventInfo = aiJSON?.eventInfo || {};

                        // Fallback title/description if missing
                        const title = eventInfo.eventTitle || `Report uploaded: ${file.originalname}`;
                        const description = eventInfo.eventDescription || `Extracted data — Blood: ${aiJSON?.data?.profile?.bloodType || 'N/A'}, Meds: ${aiJSON?.data?.medications?.length || 0}`;
                        // 🔑 CRITICAL: Use clinical date as the primary event time for sorting/grouping
                        // If we found a clinical date, that SHOULD be the event time.
                        const eventStatus = eventInfo.status || 'completed';
                        const uploadTime = new Date().toISOString();

                        // 🔑 CRITICAL: Extract clinical event dates from parsed report
                        const parsedText = String(aiJSON?.text || '');
                        const extractedDates = extractClinicalDates(parsedText, aiJSON);
                        const clinicalEventDate = resolvePrimaryClinicialDate(extractedDates);
                        const reportDate = extractedDates.reportDate || extractedDates.labDate;
                        const eventType = eventInfo.eventType || 'test';

                        // 🔑 CRITICAL: Use clinical date as the primary event time for sorting/grouping
                        const eventTime = clinicalEventDate
                            ? new Date(clinicalEventDate).toISOString()
                            : (reportDate ? new Date(reportDate).toISOString() : uploadTime);

                        // Log for debugging
                        logDateExtraction(reportData.id, extractedDates, clinicalEventDate, !clinicalEventDate);
                        debugLog(`📅 Creating timeline event: "${title}" (${eventType})`);
                        debugLog(`📅 Dates - Clinical: ${clinicalEventDate}, Report: ${reportDate}, Upload: ${uploadTime}`);

                        const { error: timelineError } = await supabaseAdmin.from('timeline_events').insert([{
                            patient_id: user.id,
                            title,
                            description,
                            event_type: eventType,
                            status: eventStatus,
                            event_time: eventTime,
                            source_report_id: reportData.id,
                            clinical_event_date: clinicalEventDate,
                            report_date: reportDate,
                            upload_date: new Date(uploadTime),
                            metadata: { report_json: aiJSON }
                        }]);

                        if (timelineError) {
                            console.warn('❌ Failed to insert timeline event:', timelineError);
                            debugLog(`❌ Timeline Insert Error: ${timelineError.message}`);
                        } else {
                            console.log('✅ Timeline event created successfully');
                            debugLog('✅ Timeline event created successfully');
                        }

                        // 📊 NEW: Also insert into health_parameters for the "Show Details" modal
                        if (aiJSON.data?.parameters && Array.isArray(aiJSON.data.parameters)) {
                            console.log(`📊 Inserting ${aiJSON.data.parameters.length} health parameters...`);
                            debugLog(`📊 Processing ${aiJSON.data.parameters.length} health parameters...`);

                            // Use clinicalEventDate if available, otherwise reportDate, otherwise eventTime
                            const measuredAt = clinicalEventDate
                                ? new Date(clinicalEventDate).toISOString()
                                : (reportDate ? new Date(reportDate).toISOString() : eventTime);

                            const parametersToInsert = aiJSON.data.parameters.map((param: any) => ({
                                user_id: user.id,
                                name: param.name || param.parameter || 'Unknown',
                                value: typeof param.value === 'number' ? param.value : parseFloat(String(param.value || 0)),
                                unit: param.unit || '',
                                status: param.status || param.interpretation || 'normal',
                                measured_at: measuredAt,
                                source: 'uploaded_report',
                            })).filter((p: any) => !isNaN(p.value));

                            if (parametersToInsert.length > 0) {
                                const { error: paramError } = await supabaseAdmin
                                    .from('health_parameters')
                                    .insert(parametersToInsert);

                                if (paramError) {
                                    console.warn('⚠️ Warning: Failed to insert health parameters:', paramError);
                                    debugLog(`⚠️ Health Parameters Insert Error: ${paramError.message}`);
                                } else {
                                    console.log(`✅ Successfully inserted ${parametersToInsert.length} health parameters`);
                                    debugLog(`✅ Successfully inserted ${parametersToInsert.length} health parameters`);
                                }
                            }
                        }
                    } catch (e: any) {
                        console.warn('Timeline/Parameters insert error:', e);
                        debugLog(`❌ Timeline/Parameters Critical Error: ${e.message}`);
                    }
                } else {
                    debugLog('⚠️ Skipping timeline event because AI parsing failed');
                }

                // 🔗 NEW: Extract clinical events for diagnostic pathway
                if (aiStatus === 'parsed' && reportData?.id) {
                    try {
                        console.log(`🔗 [DiagnosticPathway] Extracting events from report ${reportData.id}`);
                        debugLog(`🔗 [DiagnosticPathway] Starting event extraction for report ${reportData.id}`);

                        const { eventExtractionService } = await import('../modules/diagnostic-pathway/EventExtractionService');
                        const { edgeConstructionService } = await import('../modules/diagnostic-pathway/EdgeConstructionService');

                        // Extract events from parsed report
                        const eventIds = await eventExtractionService.processReportEvents(
                            user.id,
                            reportData.id,
                            aiJSON
                        );

                        // Build causal edges
                        const edgeIds = await edgeConstructionService.constructEdges(user.id);

                        console.log(`✅ [DiagnosticPathway] Extracted ${eventIds.length} events, created ${edgeIds.length} edges`);
                        debugLog(`✅ [DiagnosticPathway] Extracted ${eventIds.length} events, created ${edgeIds.length} edges`);
                    } catch (e: any) {
                        console.warn('⚠️ [DiagnosticPathway] Event extraction error (non-critical):', e.message);
                        debugLog(`⚠️ [DiagnosticPathway] Event extraction error: ${e.message}`);
                        // Don't fail the upload if pathway extraction fails
                    }
                }
            } catch (e) {
                console.warn('Profile update after upload failed:', e);
            }

            debugLog(`✅ Upload complete status: ${aiStatus}, reportId: ${reportData.id}`);
            console.log("✅ Upload processing complete");
            return res.json({
                status: "success",
                ai_status: aiStatus,
                patient_id: patientId,
                report: aiJSON,
                reportId: reportData.id,
                report_id: reportData.id
            });
        } catch (err: any) {
            console.error("❌ UPLOAD ERROR:", err);
            debugLog(`❌ CRITICAL UPLOAD ERROR: ${err.message}`);
            return res.status(500).json({
                status: "error",
                message: err?.message || "Unknown error",
                details: String(err)
            });
        }
    }
);

// Test parsing directly
router.get("/test-parse", async (req: Request, res: Response) => {
    try {
        const testText = "PATIENT: John Doe, DATE: 2024-01-01, TEST: Glucose 120 mg/dL";
        const result = await multiLLMService.parseReport(testText);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Debug AI Provider Status
router.get("/debug-ai", async (req: Request, res: Response) => {
    try {
        const providers = (multiLLMService as any).providers || [];
        const status = {
            count: providers.length,
            providerNames: providers.map((p: any) => p.name),
            lastError: lastAIError,
            envKeysPresent: {
                MISTRAL: !!process.env.MISTRAL_API_KEY,
                OPENROUTER: !!process.env.OPENROUTER_API_KEY,
                NVIDIA: !!process.env.NVIDIA_API_KEY,
                QWEN: !!process.env.QWEN_API_KEY,
                GEMINI: !!process.env.GEMINI_API_KEY
            },
            nodeEnv: process.env.NODE_ENV
        };
        res.json(status);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
