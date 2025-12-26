import type {
    AadharVerificationResult,
    OTPVerificationResult,
    ABHAError,
} from "../types/abha.types";
import { encryptForAPI } from "./encryptData";
import { sessionKey } from "./supabaseClient";

/**
 * Login with Aadhaar number and request OTP
 */
export async function loginAadhaar(
    aadhaar: string
): Promise<AadharVerificationResult> {
    try {
        const clientId = process.env.clientId || process.env.CLIENT_ID;
        const clientSecret = process.env.clientSecret || process.env.CLIENT_SECRET;
        let token = process.env.PUBLIC_API_TOKEN || process.env.API_KEY || null;

        if (!token) {
            if (clientId && clientSecret) {
                token = await sessionKey(clientId, clientSecret);
            } else {
                throw new Error(
                    "No token provided and clientId/clientSecret not set in environment."
                );
            }
        }

        // Encrypt the aadhaar before sending
        const encryptedLoginId = await encryptForAPI(String(aadhaar));

        const { v4: uuidv4 } = await import("uuid");
        // CORRECT Sandbox URL for ABHA APIs
        const baseUrl = process.env.ABHA_BASE_URL || "https://abhasbx.abdm.gov.in/abha/api/v3";

        const response = await fetch(`${baseUrl}/profile/login/request/otp`, {
            method: "POST",
            headers: {
                "REQUEST-ID": uuidv4(),
                TIMESTAMP: new Date().toISOString(),
                "X-CM-ID": process.env.X_CM_ID || process.env.SBX || "sbx",
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                txnId: "",
                scope: ["abha-enrol"],
                loginHint: "aadhaar",
                loginId: encryptedLoginId,
                otpSystem: "aadhaar",
            }),
        });

        const data = (await response.json()) as any;
        console.log("Response status:", response.status);
        console.log("Response body:", data);

        if (response.status !== 200) {
            return {
                success: false,
                message: data.message || "Failed to send OTP",
            };
        }

        return {
            success: true,
            txnId: data.txnId,
            message: "OTP sent successfully",
        };
    } catch (error) {
        console.error("LoginAadhaar error:", error);
        return {
            success: false,
            message: (error as Error).message || "Failed to process Aadhaar",
        };
    }
}

/**
 * Verify OTP and enroll ABHA
 */
export async function verifyOtp(
    txnId: string,
    encryptedOtp: string,
    mobile?: string
): Promise<OTPVerificationResult> {
    if (!txnId) {
        throw new Error("Transaction ID (txnId) is required for OTP verification");
    }
    if (!encryptedOtp) {
        throw new Error("OTP is required for verification");
    }

    const clientId = process.env.clientId || process.env.CLIENT_ID;
    const clientSecret = process.env.clientSecret || process.env.CLIENT_SECRET;
    let token = process.env.PUBLIC_API_TOKEN || process.env.API_KEY || null;

    if (!token) {
        if (clientId && clientSecret) {
            token = await sessionKey(clientId, clientSecret);
        } else {
            throw new Error(
                "No token provided and clientId/clientSecret not set in environment."
            );
        }
    }

    try {
        const { v4: uuidv4 } = await import("uuid");
        const requestId = uuidv4();
        const timestamp = new Date().toISOString();
        // CORRECT Sandbox URL for ABHA APIs
        const baseUrl = process.env.ABHA_BASE_URL || "https://abhasbx.abdm.gov.in/abha/api/v3";

        const response = await fetch(
            `${baseUrl}/enrollment/enrol/byAadhaar`,
            {
                method: "POST",
                headers: {
                    "REQUEST-ID": requestId,
                    TIMESTAMP: timestamp,
                    "X-CM-ID": process.env.X_CM_ID || process.env.SBX || "sbx",
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    authData: {
                        authMethods: ["otp"],
                        otp: {
                            txnId: txnId,
                            otpValue: encryptedOtp,
                            ...(mobile ? { mobile: String(mobile) } : {}),
                        },
                    },
                    consent: {
                        code: "abha-enrollment",
                        version: "1.4",
                    },
                }),
            }
        );

        const data = (await response.json()) as any;
        console.log("Response status:", response.status);
        console.log("Response body:", data);

        // Enhanced error handling
        if (!response.ok) {
            const error: ABHAError = new Error(
                data.message || "Failed to verify OTP"
            );
            error.status = response.status;
            error.code = data.code;
            error.details = data;
            throw error;
        }

        // Process successful response
        return {
            status: response.status,
            data: data as { ABHAProfile: any; message?: string; error?: string },
        };
    } catch (err) {
        const error = err as ABHAError;
        console.error("API Error:", {
            message: error.message,
            status: error.status,
            code: error.code,
            details: error.details,
            timestamp: new Date().toISOString(),
        });
        throw error;
    }
}
