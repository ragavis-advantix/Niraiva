import { Router, type Request, type Response } from "express";
import { getSupabaseAdminClient } from "../lib/supabaseClient";
import { verifyToken } from "../middleware/verifyToken";

const router = Router();

/**
 * GET /user-latest-report
 * Returns the latest processed health_report for the authenticated user
 */
router.get("/user-latest-report", verifyToken, async (req: any, res: Response) => {
    try {
        const supabase = getSupabaseAdminClient();

        const { data, error } = await supabase
            .from('health_reports')
            .select('report_json, uploaded_at')
            .eq('user_id', req.user.id)
            .order('uploaded_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Error fetching latest report:', error);
            return res.status(500).json({ error });
        }

        if (!data || data.length === 0) {
            return res.json({ found: false });
        }

        const reportJson = data[0].report_json || {};
        const profile = reportJson?.data?.profile || null;
        const parameters = reportJson?.data?.parameters || [];
        const medications = reportJson?.data?.medications || [];
        const allergies = profile?.allergies || [];

        return res.json({
            found: true,
            report: profile,
            parameters,
            medications,
            allergies,
            uploaded_at: data[0].uploaded_at
        });
    } catch (err) {
        console.error('reports route error:', err);
        return res.status(500).json({ error: String(err) });
    }
});

/**
 * GET /user-health-parameters
 * Returns the latest processed report parameters for the authenticated user
 */
router.get("/user-health-parameters", verifyToken, async (req: any, res: Response) => {
    try {
        const supabase = getSupabaseAdminClient();

        const { data, error } = await supabase
            .from('health_reports')
            .select('report_json')
            .eq('user_id', req.user.id)
            .order('uploaded_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Error fetching report parameters:', error);
            return res.status(500).json({ error });
        }

        if (!data || data.length === 0) return res.json({ found: false });

        const parameters = data[0].report_json?.data?.parameters || [];
        return res.json({ found: true, parameters });
    } catch (err) {
        console.error('user-health-parameters error:', err);
        return res.status(500).json({ error: String(err) });
    }
});

/**
 * GET /user-summary
 * Returns a consolidated summary (profile, parameters, medications, conditions)
 * from the latest processed health_report for the authenticated user
 */
const handleUserSummary = async (req: any, res: Response) => {
    try {
        const supabase = getSupabaseAdminClient();

        const { data, error } = await supabase
            .from('health_reports')
            .select('report_json, uploaded_at')
            .eq('user_id', req.user.id)
            .order('uploaded_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Error fetching latest report for summary:', error);
            return res.status(500).json({ error });
        }

        if (!data || data.length === 0) {
            return res.json({ found: false });
        }

        const reportJson = data[0].report_json || {};
        const profile = reportJson?.data?.profile || null;
        const parameters = reportJson?.data?.parameters || [];
        const medications = reportJson?.data?.medications || [];
        const conditions = reportJson?.data?.conditions || [];

        return res.json({
            found: true,
            profile,
            parameters,
            medications,
            conditions,
            uploaded_at: data[0].uploaded_at
        };
    } catch (err) {
        console.error('user-summary error:', err);
        return res.status(500).json({ error: String(err) });
    }
};

router.get("/user-summary", verifyToken, handleUserSummary);
router.get("/user_summary", verifyToken, handleUserSummary);

/**
 * GET /patient/:patientId
 * Returns all health reports for a specific patient (user_id)
 */
router.get("/patient/:patientId", verifyToken, async (req: any, res: Response) => {
    try {
        const { patientId } = req.params;
        const supabase = getSupabaseAdminClient();

        // Query health_reports table (used by upload-report)
        const { data, error } = await supabase
            .from('health_reports')
            .select('*')
            .eq('user_id', patientId)
            .order('uploaded_at', { ascending: false });

        if (error) {
            console.error('Error fetching patient reports:', error);
            return res.status(500).json({ error });
        }

        // Map database fields to what the frontend expects
        const mappedReports = (data || []).map(r => ({
            id: r.id,
            filename: r.report_json?.metadata?.provider || 'Medical Report',
            status: r.report_json?.processingStatus === 'failure' ? 'failed' : 'parsed',
            uploadedAt: r.uploaded_at,
            parsedData: r.report_json,
            source: r.file_type
        }));

        return res.json({
            success: true,
            reports: mappedReports
        });
    } catch (err) {
        console.error('patient reports route error:', err);
        return res.status(500).json({ error: String(err) });
    }
});

/**
 * GET /:id/status
 * Returns processing status for a report
 */
router.get("/:id/status", verifyToken, async (req: any, res: Response) => {
    try {
        const { id } = req.params;
        const supabase = getSupabaseAdminClient();

        const { data, error } = await supabase
            .from('health_reports')
            .select('report_json')
            .eq('id', id)
            .single();

        if (error || !data) {
            return res.status(404).json({ error: 'Report not found' });
        }

        return res.json({
            status: data.report_json?.processingStatus === 'failure' ? 'failed' : 'parsed',
            progress: 100,
            parsedReport: data.report_json
        });
    } catch (err) {
        return res.status(500).json({ error: String(err) });
    }
});

export default router;

