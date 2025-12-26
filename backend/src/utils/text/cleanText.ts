/**
 * Clean and normalize extracted text for medical documents
 */
export function cleanText(text: string): string {
    return String(text || "")
        .replace(/\s+/g, " ")
        .replace(/[^\w.,:/\-+()\s]/g, "")
        .trim();
}
