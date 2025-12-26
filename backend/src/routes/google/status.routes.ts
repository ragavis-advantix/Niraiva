import { Router } from "express";
import { getSupabaseAdminClient } from "../../lib/supabaseClient";

const router = Router();

/**
 * GET /api/google/status
 * Check if user has connected Gmail and/or Google Drive
 */
router.get("/", async (req, res) => {
    try {
        // Get userId from authenticated request
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const supabase = getSupabaseAdminClient();

        // Check if user has OAuth tokens
        const { data, error } = await supabase
            .from("user_oauth_tokens")
            .select("google_access_token, google_token_expiry, gmail_enabled, drive_enabled")
            .eq("user_id", userId)
            .single();

        if (error || !data) {
            return res.json({
                gmail: false,
                drive: false,
            });
        }

        // Check if token is expired
        const isExpired = data.google_token_expiry
            ? new Date(data.google_token_expiry) < new Date()
            : false;

        res.json({
            gmail: data.gmail_enabled && !isExpired,
            drive: data.drive_enabled && !isExpired,
            tokenExpired: isExpired,
        });
    } catch (error: any) {
        console.error("Status check error:", error);
        res.status(500).json({ error: "Failed to check status" });
    }
});

export default router;
