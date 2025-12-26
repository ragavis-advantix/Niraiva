import { Router, type Request, type Response } from "express";
import multer from "multer";
import Tesseract from "tesseract.js";
import { getSupabaseAdminClient, getSupabaseClient } from "../lib/supabaseClient";

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
            console.log(`📝 Extracted text length: ${cleanedText.length} characters`);

            if (cleanedText.length < 10) {
                return res.status(400).json({
                    status: "error",
                    message: "Extracted text is too short. Please ensure the file contains readable text."
                });
            }

            // GEMINI ANALYSIS
            const model = process.env.GEMINI_MODEL || "gemini-2.0-flash-exp";
            const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

            const prompt = `\nYou are a medical document analyzer. Convert this text into EXACTLY one JSON following this schema:\n\n{\n  "type": "health_report",\n  "metadata": {\n    "documentDate": string | null,\n    "patientId": string | null,\n    "documentType": string | null,\n    "provider": string | null\n  },\n  "eventInfo": {\n    "eventType": "test" | "diagnosis" | "medication" | "treatment" | "appointment" | "vitals",\n    "eventTitle": string,\n    "eventDescription": string,\n    "status": "completed"\n  },\n  "data": {\n    "profile": {\n      "id": string | null,\n      "name": string | null,\n      "age": number | null,\n      "gender": string | null,\n      "height": { "value": number | null, "unit": string | null } | null,\n      "weight": { "value": number | null, "unit": string | null } | null,\n      "bmi": number | null,\n      "bloodType": string | null,\n      "emergencyContact": string | null,\n      "allergies": string[] | null\n    },\n    "parameters": [\n      {\n        "name": string | null,\n        "value": number | string | null,\n        "unit": string | null,\n        "status": "normal" | "warning" | "critical" | "improved" | "stable" | "worsened" | null,\n        "referenceRange": string | null,\n        "lastUpdated": string | null,\n        "trend": "improved" | "stable" | "worsened" | null\n      }\n    ],\n    "medications": [],\n    "appointments": [],\n    "conditions": [\n      {\n        "id": string | null,\n        "name": string | null,\n        "diagnosedDate": string | null,\n        "severity": "mild" | "moderate" | "severe" | null,\n        "currentStatus": "controlled" | "improving" | "worsening" | null,\n        "relatedParameters": [string]\n      }\n    ],\n    "clinicalInfo": {\n      "allergies": [],\n      "immunizations": [],\n      "lifestyle": null\n    }\n  },\n  "extractedAt": string | null,\n  "processingStatus": "success"\n}\n\nRULES FOR eventInfo:\n- If the report is a blood test → eventType = "test", eventTitle = "Blood Test"\n- If the report is a prescription → eventType = "medication", eventTitle = "Medication Updated"\n- If the report is a vital stats screenshot → eventType = "vitals", eventTitle = "Vitals Recorded"\n- If the report contains diagnosis → eventType = "diagnosis", eventTitle = "Diagnosis"\n- If the report contains recommendations for follow-up or visits → eventType = "appointment", eventTitle = "Appointment"\n- eventTitle must be clear and human-readable\n- eventDescription must summarize key extracted information (e.g., "CBC, HbA1c levels", "BP 142/93, Pulse 95")\n\nTEXT:\n${cleanedText}\n        `;

            // Add an explicit short instruction to ensure medications use the desired schema
            const medsSchemaNote = `\n\nNOTE: Always return a "medications" array where each item has the fields: name (string), dosage (string), frequency (string), startDate (string).`;
            const fullPrompt = prompt + medsSchemaNote;

            console.log("🤖 Sending to Gemini for analysis...");
            let aiJSON: any = null;
            let aiStatus: 'parsed' | 'failed' = 'failed';

            try {
                const aiRes = await fetch(GEMINI_URL, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contents: [
                            {
                                parts: [{ text: fullPrompt }],
                            },
                        ],
                    }),
                });

                if (!aiRes.ok) {
                    const errText = await aiRes.text();
                    console.error("❌ Gemini API error:", aiRes.status, errText);
                    throw new Error(`Gemini API Error ${aiRes.status}`);
                }

                const aiData: any = await aiRes.json();
                const aiText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(aiData);

                try {
                    aiJSON = JSON.parse(aiText);
                } catch (err) {
                    const match = aiText.match(/\{[\s\S]*\}/);
                    aiJSON = match ? JSON.parse(match[0]) : { raw: aiText };
                }
                aiStatus = "parsed";
                console.log("✅ Gemini analysis complete");
            } catch (err: any) {
                console.warn("⚠️ Gemini AI Parsing failed (Continuing upload):", err.message);
                aiStatus = "failed";
                aiJSON = {
                    type: "health_report",
                    error: "AI Parsing failed or quota exceeded",
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

            const { data: reportData, error: dbError } = await supabaseAdmin
                .from("health_reports")
                .insert({
                    user_id: user.id,
                    patient_id: patientId,
                    report_json: aiJSON,
                    raw_text: cleanedText,
                    file_type: mime,
                    uploaded_at: new Date().toISOString(),
                } as any)
                .select('id')
                .single();

            if (dbError) {
                console.error("🔥 Supabase insert error:", dbError);
                return res.status(500).json({ status: "supabase-error", message: "Supabase insert failed", supabase_error: dbError });
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

                // Extract chronic conditions from aiJSON
                const chronicConditions = aiJSON?.data?.conditions?.map((c: any) => c.name).filter(Boolean) || [];

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

                    // Metadata
                    upsertPayload.last_updated_by = 'report_upload';

                    console.log('💾 Upserting user profile with:', {
                        name: profile.name,  // ✅ Changed full_name → name
                        age,
                        gender: profile.gender,
                        height: heightValue,
                        weight: weightValue,
                        bmi,
                        blood_group: profile.bloodType,
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
                        const eventInfo = aiJSON?.eventInfo;

                        if (eventInfo) {
                            const title = eventInfo.eventTitle || `Report uploaded: ${file.originalname}`;
                            const description = eventInfo.eventDescription || `Extracted data — Blood: ${aiJSON?.data?.profile?.bloodType || 'N/A'}, Meds: ${aiJSON?.data?.medications?.length || 0}`;
                            const eventType = eventInfo.eventType || 'report';
                            const status = eventInfo.status || 'completed';

                            console.log('📅 Creating timeline event:', {
                                title,
                                description,
                                type: eventType,
                                status
                            });

                            const { error: timelineError } = await supabaseAdmin.from('timeline_events').insert([{
                                patient_id: user.id,
                                title,
                                description,
                                type: eventType,
                                status,
                                date: new Date().toISOString()
                            }]);

                            if (timelineError) {
                                console.warn('Failed to insert timeline event:', timelineError);
                            } else {
                                console.log('✅ Timeline event created successfully');
                            }
                        } else {
                            console.warn('⚠️ No eventInfo extracted from Gemini, skipping timeline event');
                        }
                    } catch (e) {
                        console.warn('Timeline insert error:', e);
                    }
                }
            } catch (e) {
                console.warn('Profile update after upload failed:', e);
            }

            console.log("✅ Upload processing complete");
            return res.json({ status: "success", ai_status: aiStatus, patient_id: patientId, report: aiJSON, reportId: reportData.id });
        } catch (err: any) {
            console.error("❌ UPLOAD ERROR:", err);
            return res.status(500).json({ status: "error", message: err?.message || "Unknown error", details: String(err) });
        }
    }
);

export default router;
