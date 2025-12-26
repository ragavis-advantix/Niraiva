import Tesseract from "tesseract.js";

/**
 * Extract text from images using Tesseract OCR
 */
export async function extractImage(buffer: Buffer): Promise<string> {
    const result = await Tesseract.recognize(buffer, "eng");
    return result.data.text || "";
}
