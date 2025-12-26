import { Router } from "express";
import axios from "axios";
import { getSupabaseAdminClient } from "../../lib/supabaseClient";

const router = Router();

/**
 * POST /api/google/gmail/import
 * Import selected Gmail attachments
 */
router.post("/import", async (req, res) => {
    try {
        const { items } = req.body;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized - Please log in" });
        }

        if (!items || !Array.isArray(items)) {
            return res.status(400).json({ error: "Invalid items array" });
        }

        const supabase = getSupabaseAdminClient();

        // Get user's Gmail access token
        const { data: tokenRow, error: tokenError } = await supabase
            .from("user_oauth_tokens")
            .select("google_access_token")
            .eq("user_id", userId)
            .single();

        if (tokenError || !tokenRow?.google_access_token) {
            return res.status(400).json({ error: "Gmail not connected" });
        }

        const accessToken = tokenRow.google_access_token;
        const imported: any[] = [];

        for (const item of items) {
            try {
                const { messageId, attachmentId, filename } = item;

                // Download attachment from Gmail
                const attachmentRes = await axios.get(
                    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`,
                    {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    }
                );

                // Decode base64url data
                const data = attachmentRes.data.data;
                const buffer = Buffer.from(data, "base64url");

                // Upload to Supabase Storage
                const filePath = `${userId}/${Date.now()}-${filename}`;
                const { error: uploadError } = await supabase.storage
                    .from(process.env.SUPABASE_BUCKET || "reports")
                    .upload(filePath, buffer, {
                        contentType: item.mimeType || "application/octet-stream",
                    });

                if (uploadError) {
                    console.error("Upload error:", uploadError);
                    continue;
                }

                // Create report record
                const { data: report, error: reportError } = await supabase
                    .from("reports")
                    .insert({
                        patient_id: userId,
                        source: "gmail",
                        file_path: filePath,
                        filename: filename,
                        content_type: item.mimeType,
                        size: buffer.length,
                        status: "uploaded",
                    })
                    .select()
                    .single();

                if (reportError) {
                    console.error("Report creation error:", reportError);
                    continue;
                }

                // Create report source record
                await supabase.from("report_sources").insert({
                    report_id: report.id,
                    provider: "gmail",
                    provider_message_id: messageId,
                    provider_metadata: {
                        attachmentId,
                        filename,
                    },
                });

                // Queue OCR job
                await supabase.from("processing_jobs").insert({
                    report_id: report.id,
                    job_type: "ocr",
                    status: "pending",
                });

                imported.push(report);
            } catch (error: any) {
                console.error(`Error importing attachment:`, error.message);
            }
        }

        return res.json({
            imported,
            count: imported.length,
            message: `Successfully imported ${imported.length} file(s) from Gmail`,
        });
    } catch (error: any) {
        console.error("❌ Gmail import error:", error.message);
        return res.status(500).json({ error: "Failed to import Gmail attachments" });
    }
});

export default router;
