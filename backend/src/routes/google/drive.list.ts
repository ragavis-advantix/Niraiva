import { Router } from "express";
import axios from "axios";
import { getSupabaseAdminClient } from "../../lib/supabaseClient";

const router = Router();

router.get("/list", async (req, res) => {
    try {
        // Get userId from authenticated request
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized - Please log in" });
        }

        const supabase = getSupabaseAdminClient();

        // Get user's Drive access token
        const { data: tokenRow, error: tokenError } = await supabase
            .from("user_oauth_tokens")
            .select("google_access_token")
            .eq("user_id", userId)
            .single();

        if (tokenError || !tokenRow?.google_access_token) {
            return res.status(400).json({ error: "Drive not connected. Please link your Google Drive account first." });
        }

        const accessToken = tokenRow.google_access_token;

        // List files from Google Drive
        const listRes = await axios.get(
            "https://www.googleapis.com/drive/v3/files?" +
            "spaces=drive&" +
            "fields=files(id,name,mimeType,size,modifiedTime)&" +
            "q=mimeType='application/pdf' or mimeType='image/png' or mimeType='image/jpeg' or mimeType='application/json'",
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        return res.json({ files: listRes.data.files || [] });
    } catch (error: any) {
        console.error("❌ Drive list error:", error.response?.data || error.message);

        // Handle token expiration
        if (error.response?.status === 401) {
            return res.status(401).json({ error: "Drive access expired. Please reconnect your account." });
        }

        return res.status(500).json({ error: "Failed to list Drive files" });
    }
});

export default router;
