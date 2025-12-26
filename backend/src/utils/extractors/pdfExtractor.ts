import Tesseract from "tesseract.js";

/**
 * Simple PDF extractor using Tesseract OCR
 * This is a fallback that works without canvas rendering
 */
export async function extractPDFSimple(buffer: Buffer): Promise<string> {
    try {
        console.log("🔄 Running OCR on PDF...");
        const ocr = await Tesseract.recognize(buffer, "eng");
        const text = ocr?.data?.text || "";
        console.log(`✅ PDF OCR completed - ${text.length} characters`);
        return text;
    } catch (err) {
        console.error("❌ PDF OCR failed:", err);
        throw err;
    }
}

/**
 * Smart PDF extractor - currently uses simple OCR
 * Can be enhanced with pdfjs-dist + canvas later
 */
export async function extractPDFSmart(buffer: Buffer): Promise<string> {
    return await extractPDFSimple(buffer);
}
