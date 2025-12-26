const express = require("express");
const multer = require("multer");
const Tesseract = require("tesseract.js");
const { supabase, supabaseAdmin } = require("../connect");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

/* --------------------------------------------------------------------------
   HELPERS
-------------------------------------------------------------------------- */

function cleanText(text) {
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

/* --------------------------------------------------------------------------
   ROUTE: POST /upload-report
-------------------------------------------------------------------------- */

router.post("/upload-report", upload.single("file"), async (req, res) => {
    try {
        console.log("📥 [UPLOAD-REPORT] POST request received");
        console.log("📥 [UPLOAD-REPORT] Headers:", {
            authorization: req.headers.authorization ? "Bearer ..." : "missing",
            contentType: req.headers["content-type"]
        });
        console.log("📥 [UPLOAD-REPORT] File info:", req.file ? {
            fieldname: req.file.fieldname,
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        } : "No file received");

        /* --------------------------------------------------------------
           1. AUTHENTICATION
        -------------------------------------------------------------- */

        let user = null;
        const bypass =
            process.env.NODE_ENV === "development" &&
            String(req.headers["x-bypass-auth"]) === "true";

        if (bypass) {
            console.log("⚠️ Dev bypass auth enabled");

            // IMPORTANT: Supabase table expects UUID → use a valid one
            user = { id: "00000000-0000-0000-0000-000000000000" };
        } else {
            const token = (req.headers.authorization || "")
                .replace("Bearer ", "")
                .trim();

            if (!token) return res.status(401).json({ error: "Missing token" });

            const {
                data: { user: foundUser },
                error,
            } = await supabase.auth.getUser(token);

            if (error || !foundUser) {
                console.error("Auth error:", error);
                return res.status(401).json({ error: "Invalid token" });
            }

            user = foundUser;
        }

        /* --------------------------------------------------------------
           2. FILE EXTRACTION
        -------------------------------------------------------------- */

        if (!req.file)
            return res.status(400).json({ error: "No file uploaded" });

        const file = req.file;
        const mime = file.mimetype || "text/plain";
        let extractedText = "";

        /* ---------------------- FIXED PDF-PARSE BLOCK ---------------------- */

        if (mime === "application/pdf") {
            try {
                const pdfModule = require("pdf-parse");

                // Handle all export types
                const pdfParse =
                    typeof pdfModule === "function"
                        ? pdfModule
                        : typeof pdfModule.default === "function"
                            ? pdfModule.default
                            : null;

                if (!pdfParse) {
                    throw new Error("pdf-parse did not export a usable function");
                }

                const result = await pdfParse(file.buffer);
                extractedText = result.text || "";
            } catch (err) {
                console.error("PDF PARSE ERROR:", err);
                return res.status(500).json({
                    status: "error",
                    message: "Failed to extract PDF",
                    details: String(err),
                });
            }
        }

        /* ------------------ OCR: IMAGES ------------------ */
        else if (mime.startsWith("image/")) {
            const ocr = await Tesseract.recognize(file.buffer, "eng");
            extractedText = ocr?.data?.text || "";
        }

        /* ------------------ SIMPLE TEXT ------------------ */
        else {
            extractedText = file.buffer.toString("utf8");
        }

        const cleanedText = cleanText(extractedText);

        /* --------------------------------------------------------------
           3. GEMINI ANALYSIS
        -------------------------------------------------------------- */

        const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

        const GEMINI_URL =
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

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
    "parameters": [],
    "medications": [],
    "appointments": [],
    "conditions": [],
    "clinicalInfo": {
      "allergies": [],
      "immunizations": [],
      "lifestyle": null
    }
  },
  "extractedAt": string | null,
  "processingStatus": "success"
}

TEXT:
${cleanedText}
        `;

        const aiRes = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: prompt }],
                    },
                ],
            }),
        });

        if (!aiRes.ok) {
            const errText = await aiRes.text();
            throw new Error(`Gemini API Error ${aiRes.status} → ${errText}`);
        }

        const aiData = await aiRes.json();

        const aiText =
            aiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
            JSON.stringify(aiData);

        let aiJSON;
        try {
            aiJSON = JSON.parse(aiText);
        } catch (err) {
            const match = aiText.match(/\{[\s\S]*\}/);
            aiJSON = match ? JSON.parse(match[0]) : { raw: aiText };
        }

        /* --------------------------------------------------------------
           4. SUPABASE INSERT
        -------------------------------------------------------------- */

        const patientId = generatePatientId();

        const { error: dbError } = await supabaseAdmin
            .from("health_reports")
            .insert({
                user_id: user.id,
                patient_id: patientId,
                report_json: aiJSON,
                raw_text: cleanedText,
                file_type: mime,
                uploaded_at: new Date().toISOString(),
            });

        if (dbError) {
            console.error("🔥 Supabase insert error:", dbError);
            return res.status(500).json({
                status: "supabase-error",
                message: "Supabase insert failed",
                supabase_error: dbError,
            });
        }

        /* --------------------------------------------------------------
           5. RESPONSE
        -------------------------------------------------------------- */

        return res.json({
            status: "success",
            patient_id: patientId,
            report: aiJSON,
        });
    } catch (err) {
        console.error("UPLOAD ERROR:", err);
        return res.status(500).json({
            status: "error",
            message: err?.message || "Unknown error",
            details: String(err),
        });
    }
});

module.exports = router;
