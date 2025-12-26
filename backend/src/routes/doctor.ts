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
 * Creates a new patient auth user, role, profile, and links to the doctor.
 */
router.post(
    "/create-patient",
    verifyToken,
    asyncHandler(async (req: Request, res: Response): Promise<void> => {
        console.log("📥 [DOCTOR] create-patient request received");

        try {
            const doctorId = req.user?.id;
            const { fullName, phone, gender, dob, chronicConditions } = req.body;

            if (!doctorId) {
                res.status(401).json({ error: "Unauthorized - no doctor found" });
                return;
            }

            if (!fullName || !phone) {
                res.status(400).json({ error: "Missing required fields: fullName and phone" });
                return;
            }

            const supabaseAdmin = getSupabaseAdminClient();

            // 1. Create patient auth user
            const email = `${phone}@patient.niraiva.local`;
            const password = uuidv4();

            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: fullName }
            });

            if (authError) {
                console.error("❌ Auth creation error:", authError);
                res.status(500).json({ error: "Failed to create patient account", details: authError.message });
                return;
            }

            const patientId = authData.user.id;

            // 2. Assign role
            await supabaseAdmin.from('user_roles').insert({ user_id: patientId, role: 'patient' });

            // 3. Create profile
            const { error: profileError } = await supabaseAdmin.from('user_profiles').insert({
                user_id: patientId,
                full_name: fullName,
                phone: phone,
                gender: gender,
                dob: dob,
                chronic_conditions: chronicConditions || [],
                role: 'patient'
            });

            if (profileError) throw profileError;

            // 4. Link doctor
            await supabaseAdmin.from('doctor_patients').insert({
                doctor_id: doctorId,
                patient_user_id: patientId
            });

            res.status(201).json({ success: true, patientId });

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
