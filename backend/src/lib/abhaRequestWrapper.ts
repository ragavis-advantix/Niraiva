import { v4 as uuidv4 } from "uuid";
import { getABHASessionToken } from "./redisCache";

/**
 * Wrapper for all ABHA API calls
 * Automatically adds required headers and handles authentication
 * IMPORTANT: Uses abhasbx.abdm.gov.in for ABHA APIs
 */
export async function abhaRequest(
    endpoint: string,
    options: RequestInit = {}
): Promise<Response> {
    const token = await getABHASessionToken();
    // CORRECT Sandbox URL for ABHA APIs (NOT hiecm gateway)
    const baseUrl = process.env.ABHA_BASE_URL || "https://abhasbx.abdm.gov.in/abha/api/v3";

    // Generate timestamp and validate drift (<5 minutes tolerance)
    const timestamp = new Date().toISOString();

    const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
            "REQUEST-ID": uuidv4(),
            TIMESTAMP: timestamp,
            "X-CM-ID": process.env.X_CM_ID || process.env.SBX || "sbx",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            ...options.headers,
        },
    });

    return response;
}

/**
 * Validate timestamp drift
 * ABHA API requires timestamps within 5 minutes of server time
 */
export function validateTimestampDrift(timestamp: string): boolean {
    const requestTime = new Date(timestamp).getTime();
    const currentTime = Date.now();
    const driftMs = Math.abs(currentTime - requestTime);
    const maxDriftMs = 5 * 60 * 1000; // 5 minutes

    return driftMs < maxDriftMs;
}
