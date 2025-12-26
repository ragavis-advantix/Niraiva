/**
 * Safely decode JSON files
 */
export function extractJSON(buffer: Buffer): string {
    try {
        return buffer.toString("utf8");
    } catch {
        return "";
    }
}
