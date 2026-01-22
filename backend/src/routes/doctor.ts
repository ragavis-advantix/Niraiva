import { Router, type Request, type Response, type NextFunction } from "express";
import { getSupabaseAdminClient } from "../lib/supabaseClient";
import { verifyToken } from "../middleware/verifyToken";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// Async error handler helper
const asyncHandler = (fn: (req: Request, res: Response, next?: NextFunction) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };

/**
 * POST /api/doctor/create-patient
 * Creates a new patient record (NO AUTH USER) and links to the doctor.
 * Auth users are created later when patients activate their accounts.
 */
router.post(
    "/create-patient",
    verifyToken,
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
        console.log("📥 [DOCTOR] create-patient request received");

        try {
            const authUserId = req.user?.id;
            const { name, phone, gender, dob, chronic_conditions } = req.body;

            console.log('[DOCTOR] Payload:', req.body);
            console.log('[DOCTOR] Auth User ID:', authUserId);

            if (!authUserId) {
                res.status(401).json({ error: "Unauthorized - no user found" });
                return;
            }

            if (!name || !phone) {
                res.status(400).json({ error: "Missing required fields: name and phone" });
                return;
            }

            const supabaseAdmin = getSupabaseAdminClient();

            // 0. Fetch doctor domain ID from doctors table
            console.log("🔍 Fetching doctor profile...");
            const { data: doctor, error: doctorError } = await supabaseAdmin
                .from("doctors")
                .select("id")
                .eq("auth_user_id", authUserId)
                .single();

            if (doctorError || !doctor) {
                console.error("❌ Doctor profile not found:", doctorError);
                res.status(404).json({ error: "Doctor profile not found. Please complete your profile setup." });
                return;
            }

            const doctorId = doctor.id;
            console.log("✅ Doctor ID resolved:", doctorId);

            // 1. Normalize gender to lowercase (constraint requires: male, female, other, prefer_not_to_say)
            const normalizedGender = gender ? gender.toLowerCase() : null;
            console.log("📝 Gender normalized:", { original: gender, normalized: normalizedGender });

            // 2. Create patient record in patients table (source of truth)
            console.log("📝 Creating patient in patients table...");

            const { data: patient, error: patientError } = await supabaseAdmin
                .from("patients")
                .insert({
                    name: name,
                    phone: phone,
                    dob: dob,
                    gender: normalizedGender,
                    chronic_conditions: chronic_conditions || [],
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (patientError) {
                console.error("❌ Patient creation error:", patientError);
                throw patientError;
            }

            console.log("✅ Patient created in patients table:", patient.id);

            // 3. Link patient to doctor using domain doctor ID
            console.log("🔗 Linking patient to doctor...");
            const { error: linkError } = await supabaseAdmin
                .from("doctor_patient_links")
                .insert({
                    doctor_id: doctorId,
                    patient_id: patient.id
                });

            if (linkError) {
                console.error("❌ Linking error:", linkError);
                throw linkError;
            }

            console.log("✅ Patient linked to doctor");

            // 4. Return success response
            console.log("✅ Patient creation complete");

            res.status(201).json({
                success: true,
                patient: {
                    id: patient.id,
                    name: patient.name,
                    phone: patient.phone,
                    dob: patient.dob,
                    gender: patient.gender,
                    chronic_conditions: patient.chronic_conditions
                }
            });

        } catch (err: any) {
            console.error("❌ CREATE PATIENT ERROR:", err);
            res.status(500).json({ error: err.message });
        }
    })
);

/**
 * GET /api/doctor/notes/:patientUserId
 */
router.get(
    "/notes/:patientUserId",
    verifyToken,
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const { patientUserId } = req.params;
        const supabaseAdmin = getSupabaseAdminClient();
        const { data, error } = await supabaseAdmin
            .from('doctor_notes')
            .select('*')
            .eq('patient_user_id', patientUserId)
            .order('created_at', { ascending: false });

        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }
        res.json(data);
    })
);

/**
 * POST /api/doctor/notes
 */
router.post(
    "/notes",
    verifyToken,
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const doctorId = req.user?.id;
        const { patientUserId, note } = req.body;

        const supabaseAdmin = getSupabaseAdminClient();
        const { data, error } = await supabaseAdmin
            .from('doctor_notes')
            .insert({
                doctor_id: doctorId,
                patient_user_id: patientUserId,
                note
            })
            .select()
            .single();

        if (error) {
            res.status(500).json({ error: error.message });
            return;
        }

        // Also insert into timeline_events for the patient's view
        await supabaseAdmin.from('timeline_events').insert({
            patient_id: patientUserId,
            doctor_id: doctorId,
            event_type: 'doctor_note',
            title: 'Doctor Observation',
            description: note,
            status: 'completed',
            category: 'note',
            event_time: new Date().toISOString()
        });

        res.status(201).json(data);
    })
);

/**
 * POST /api/doctor/process-report
 */
router.post(
    "/process-report",
    verifyToken,
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
        const doctorId = req.user?.id;
        const { patientUserId, filePath, documentType } = req.body;

        if (!doctorId || !patientUserId || !filePath || !documentType) {
            res.status(400).json({ error: "Missing required fields" });
            return;
        }

        try {
            const supabaseAdmin = getSupabaseAdminClient();

            // 1. Download file
            const { data: fileData, error: downloadError } = await supabaseAdmin
                .storage
                .from('medical-documents')
                .download(filePath);

            if (downloadError) throw new Error(downloadError.message);

            // 2. Extract Text
            const buffer = Buffer.from(await fileData.arrayBuffer());
            const extractedText = buffer.toString('utf-8').slice(0, 5000);

            // 3. AI Extraction (Gemini)
            const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
            const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

            const prompt = `
Extract clinical JSON from ${documentType}:
{
  "vitals": { "temp": number, "hr": number, "bp": string },
  "lab_results": [ { "name": string, "value": any, "unit": string, "status": "normal" | "warning" | "critical" } ],
  "medications": [ { "name": string, "dosage": string, "frequency": string } ],
  "diagnosis": [string],
  "abnormal_flags": [string]
}
TEXT: ${extractedText}`;

            const aiRes = await fetch(GEMINI_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });

            const aiData = await aiRes.json() as any;
            const aiText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

            interface ExtractedData {
                diagnosis?: string[];
                abnormal_flags?: string[];
                vitals?: any;
                lab_results?: any[];
                medications?: any[];
            }

            let aiJSON: ExtractedData = {};
            try {
                aiJSON = JSON.parse(aiText.replace(/```json|```/g, "").trim());
            } catch (e) { }

            // 4. Save to DB
            const { data: docData, error: insertError } = await supabaseAdmin
                .from('medical_documents')
                .insert({
                    patient_user_id: patientUserId,
                    uploaded_by: doctorId,
                    document_type: documentType,
                    file_path: filePath,
                    extracted_data: aiJSON
                })
                .select('id')
                .single();

            if (insertError) throw insertError;
            const docId = docData.id;

            // 5. Insert into timeline_events (Dual entry: Report + Summary)

            // Entry 1: The Diagnostic Report/Test itself
            await supabaseAdmin.from('timeline_events').insert({
                patient_id: patientUserId,
                doctor_id: doctorId,
                event_type: 'diagnostic_report',
                title: 'Lab Test Uploaded',
                description: `A new ${documentType.replace('_', ' ')} has been uploaded.`,
                status: 'completed',
                category: 'test',
                event_time: new Date().toISOString(),
                source_file_id: docId
            });

            // Entry 2: The AI Generated Summary (Separate card as requested)
            // Generate a readable summary string from the AI JSON for the timeline view
            const aiSummaryText = `Findings: ${aiJSON.diagnosis?.join(', ') || 'See details'}. Abnormal: ${(aiJSON.abnormal_flags?.length ?? 0) > 0 ? aiJSON.abnormal_flags?.join(', ') : 'None'}.`;

            await supabaseAdmin.from('timeline_events').insert({
                patient_id: patientUserId,
                doctor_id: doctorId,
                event_type: 'ai_summary',
                title: 'AI Diagnostic Summary',
                description: aiSummaryText,
                status: 'completed',
                category: 'report',
                event_time: new Date().toISOString(),
                source_file_id: docId
            });

            res.json({ success: true, extracted_data: aiJSON, docId });

        } catch (err: any) {
            console.error("❌ PROCESS ERROR:", err);
            res.status(500).json({ error: err.message });
        }
    })
);

export default router;
