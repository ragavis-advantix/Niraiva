import { Router } from "express";
import axios from "axios";
import { getSupabaseAdminClient } from "../../lib/supabaseClient";

const router = Router();

router.post("/import", async (req, res) => {
    try {
        const { fileIds } = req.body;

        // Get userId from authenticated request
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: "Unauthorized - Please log in" });
        }

        if (!fileIds || !Array.isArray(fileIds)) {
            return res.status(400).json({ error: "Invalid file IDs" });
        }

        const supabase = getSupabaseAdminClient();

        // Get user's Drive access token
        const { data: tokenRow, error: tokenError } = await supabase
            .from("user_oauth_tokens")
            .select("google_access_token")
            .eq("user_id", userId)
            .single();

        if (tokenError || !tokenRow?.google_access_token) {
            return res.status(400).json({ error: "Drive not connected" });
        }

        const accessToken = tokenRow.google_access_token;
        const imported: any[] = [];

        for (const fileId of fileIds) {
            try {
                // Get file metadata
                const metadata = await axios.get(
                    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`,
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );

                // Download file content
                const fileRes = await axios.get(
                    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                    {
                        headers: { Authorization: `Bearer ${accessToken}` },
                        responseType: "arraybuffer",
                    }
                );

                const buffer = Buffer.from(fileRes.data);
                const filePath = `${userId}/${Date.now()}-${metadata.data.name}`;

                // Upload to Supabase Storage
                const { error: uploadError } = await supabase.storage
                    .from(process.env.SUPABASE_BUCKET || "reports")
                    .upload(filePath, buffer, {
                        contentType: metadata.data.mimeType,
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
                        source: "drive",
                        file_path: filePath,
                        filename: metadata.data.name,
                        content_type: metadata.data.mimeType,
                        size: buffer.length,
                        status: "uploaded",
                    })
                    .select()
                    .single();

                if (reportError) {
                    console.error("Report creation error:", reportError);
                    continue;
                }

                // Queue OCR job
                await supabase.from("processing_jobs").insert({
                    report_id: report.id,
                    job_type: "ocr",
                    status: "pending",
                });

                imported.push(report);
            } catch (error: any) {
                console.error(`Error importing file ${fileId}:`, error.message);
            }
        }

        return res.json({
            imported,
            count: imported.length,
            message: `Successfully imported ${imported.length} file(s)`
        });
    } catch (error: any) {
        console.error("❌ Drive import error:", error.message);
        return res.status(500).json({ error: "Failed to import Drive files" });
    }
});

export default router;
