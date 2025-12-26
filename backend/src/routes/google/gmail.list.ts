import { Router } from "express";
import axios from "axios";
import { getSupabaseAdminClient } from "../../lib/supabaseClient";

const router = Router();

/**
 * GET /api/google/gmail/messages
 * List Gmail messages with attachments (filtered for medical content)
 */
router.get("/messages", async (req, res) => {
    try {
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized - Please log in" });
        }

        const supabase = getSupabaseAdminClient();

        // Get user's Gmail access token
        const { data: tokenRow, error: tokenError } = await supabase
            .from("user_oauth_tokens")
            .select("google_access_token")
            .eq("user_id", userId)
            .single();

        if (tokenError || !tokenRow?.google_access_token) {
            return res.status(400).json({
                error: "Gmail not connected. Please link your Gmail account first."
            });
        }

        const accessToken = tokenRow.google_access_token;

        // Search for medical-related emails with attachments (EkaCare pattern)
        const query = encodeURIComponent(
            "has:attachment newer_than:2y (health OR report OR blood OR scan OR lab OR diagnosis OR prescription OR medical OR test OR hospital)"
        );

        // List messages
        const listRes = await axios.get(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${query}`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        const messages = listRes.data.messages || [];

        // Fetch details for each message
        const detailedMessages = await Promise.all(
            messages.map(async (msg: any) => {
                try {
                    const detailRes = await axios.get(
                        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
                        {
                            headers: { Authorization: `Bearer ${accessToken}` },
                        }
                    );

                    const payload = detailRes.data.payload;
                    const headers = payload.headers || [];

                    // Extract headers
                    const subject = headers.find((h: any) => h.name === "Subject")?.value || "No Subject";
                    const from = headers.find((h: any) => h.name === "From")?.value || "Unknown";
                    const date = headers.find((h: any) => h.name === "Date")?.value || "";

                    // Extract attachments
                    const attachments: any[] = [];

                    const extractAttachments = (part: any) => {
                        if (part.filename && part.body?.attachmentId) {
                            attachments.push({
                                id: part.body.attachmentId,
                                filename: part.filename,
                                mimeType: part.mimeType,
                                size: part.body.size,
                            });
                        }
                        if (part.parts) {
                            part.parts.forEach(extractAttachments);
                        }
                    };

                    extractAttachments(payload);

                    return {
                        id: msg.id,
                        subject,
                        from,
                        date,
                        snippet: detailRes.data.snippet,
                        attachments,
                    };
                } catch (error) {
                    console.error(`Error fetching message ${msg.id}:`, error);
                    return null;
                }
            })
        );

        // Filter out failed fetches and messages without attachments
        const validMessages = detailedMessages.filter(
            (m) => m && m.attachments.length > 0
        );

        return res.json({ messages: validMessages });
    } catch (error: any) {
        console.error("❌ Gmail messages list error:", error.response?.data || error.message);

        // Handle token expiration
        if (error.response?.status === 401) {
            return res.status(401).json({
                error: "Gmail access expired. Please reconnect your account."
            });
        }

        return res.status(500).json({ error: "Failed to list Gmail messages" });
    }
});

export default router;
