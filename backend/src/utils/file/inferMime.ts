/**
 * Infer correct MIME type from filename and provided mimetype
 * Fixes mis-detected uploads
 */
export function inferMime(filename: string, mimetype?: string): string {
    const ext = filename.split(".").pop()?.toLowerCase();

    if (ext === "pdf") return "application/pdf";
    if (ext === "json") return "application/json";
    if (["png", "jpg", "jpeg"].includes(ext || "")) return "image/" + ext;
    return mimetype || "text/plain";
}
