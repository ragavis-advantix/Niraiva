import crypto from "crypto";
import { supabaseAdmin } from "../lib/supabaseClient";

/**
 * Log ABHA API audit trail for compliance
 * Hashes sensitive payloads before storing
 */
export async function logABHAAudit(params: {
    userId?: string;
    endpoint: string;
    requestPayload?: any;
    responseCode?: number;
    errorMessage?: string;
}): Promise<void> {
    try {
        // Hash sensitive payloads (never store raw Aadhaar/OTP)
        const payloadHash = params.requestPayload
            ? crypto
                .createHash("sha256")
                .update(JSON.stringify(sanitizePayload(params.requestPayload)))
                .digest("hex")
            : null;

        await supabaseAdmin.from("audit_logs").insert({
            user_id: params.userId || null,
            endpoint: params.endpoint,
            request_payload_hash: payloadHash,
            response_code: params.responseCode,
            error_message: params.errorMessage,
        });
    } catch (error) {
        console.error("Error logging ABHA audit:", error);
        // Don't throw - audit logging failures shouldn't break the flow
    }
}

/**
 * Sanitize payload before hashing
 * Removes sensitive fields like Aadhaar and OTP
 */
function sanitizePayload(payload: any): any {
    if (!payload || typeof payload !== "object") {
        return {};
    }

    // Remove sensitive fields
    const { aadhaar, otp, otpValue, loginId, ...safe } = payload;

    // Recursively sanitize nested objects
    const sanitized: any = {};
    for (const [key, value] of Object.entries(safe)) {
        if (value && typeof value === "object") {
            sanitized[key] = sanitizePayload(value);
        } else {
            sanitized[key] = value;
        }
    }

    return sanitized;
}
