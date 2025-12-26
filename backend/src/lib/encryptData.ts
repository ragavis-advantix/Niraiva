import crypto from "crypto";
import type { PublicKeyData } from "../types/abha.types";

/**
 * Convert a base64 DER public key string to PEM format if needed.
 * If the input already looks like PEM, return it unchanged.
 */
function toPemPublicKey(keyBase64OrPem: string): string {
    if (!keyBase64OrPem) throw new Error("Missing public key");
    if (keyBase64OrPem.includes("-----BEGIN")) return keyBase64OrPem;

    // Insert line breaks every 64 chars
    const lines = keyBase64OrPem.match(/.{1,64}/g) || [keyBase64OrPem];
    return `-----BEGIN PUBLIC KEY-----\n${lines.join("\n")}\n-----END PUBLIC KEY-----`;
}

interface AlgorithmConfig {
    padding: number;
    oaepHash?: string;
}

/**
 * Determine padding and oaepHash from algorithm string returned by the API.
 * Supported algorithms observed:
 * - 'RSA/ECB/OAEPWithSHA-1AndMGF1Padding' -> OAEP + SHA-1
 * - 'RSA/ECB/PKCS1Padding' -> PKCS1 v1.5
 */
function parseAlgorithm(algStr?: string): AlgorithmConfig {
    if (!algStr)
        return {
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha1",
        };

    const upper = algStr.toUpperCase();
    if (upper.includes("OAEP")) {
        // default oaep hash SHA-1 unless SHA-256 explicitly mentioned
        const oaepHash = upper.includes("SHA-256") ? "sha256" : "sha1";
        return { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash };
    }
    // fallback to PKCS1 v1.5
    return { padding: crypto.constants.RSA_PKCS1_PADDING };
}

/**
 * Fetch public key data from the ABHA Sandbox API
 * IMPORTANT: This is a PUBLIC endpoint - no authentication required
 */
export async function fetchPublicData(): Promise<PublicKeyData> {
    try {
        // CORRECT Sandbox URL for public key (PUBLIC endpoint - no auth needed)
        const publicKeyUrl = process.env.ABHA_PUBLIC_KEY_URL ||
            "https://abhasbx.abdm.gov.in/abha/api/v3/profile/public/certificate";

        console.log("Fetching public key from:", publicKeyUrl);

        const response = await fetch(publicKeyUrl, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Public key fetch failed:", {
                status: response.status,
                statusText: response.statusText,
                body: errorText,
            });
            throw new Error(`Failed to fetch public key: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as PublicKeyData;

        if (!data.publicKey) {
            console.error("Public key missing in response:", data);
            throw new Error("Public key not found in API response");
        }

        console.log("Public key fetched successfully");
        return data;
    } catch (error) {
        console.error("fetchPublicData error:", error);
        throw error;
    }
}

/**
 * Fetch and cache ABDM public key for encryption
 * Refreshes every 6 hours per ABDM best practices
 */
let publicKeyCache: { key: string; expiresAt: number } | null = null;

export async function getPublicKey(): Promise<string> {
    if (publicKeyCache && publicKeyCache.expiresAt > Date.now()) {
        return publicKeyCache.key;
    }

    console.log("Fetching ABDM public key");
    const data = await fetchPublicData();

    publicKeyCache = {
        key: data.publicKey,
        expiresAt: Date.now() + 6 * 60 * 60 * 1000, // 6 hours (ABDM best practice)
    };

    return publicKeyCache.key;
}

/**
 * Clear public key cache (for testing or manual refresh)
 */
export function clearPublicKeyCache(): void {
    publicKeyCache = null;
}

/**
 * Encrypt plainText using the server public key fetched from ABDM API.
 * Returns a base64 encoded ciphertext string.
 */
export async function encryptForAPI(plainText: string): Promise<string> {
    if (typeof plainText !== "string" && !Buffer.isBuffer(plainText)) {
        throw new TypeError("plainText must be a string or Buffer");
    }

    const publicData = await fetchPublicData();
    const publicKeyRaw = publicData.publicKey;
    const encryptionAlgorithm = publicData.encryptionAlgorithm;

    if (!publicKeyRaw) throw new Error("Public key not found in public data");

    const pem = toPemPublicKey(publicKeyRaw);
    const alg = parseAlgorithm(encryptionAlgorithm);

    const buffer = Buffer.isBuffer(plainText)
        ? plainText
        : Buffer.from(plainText, "utf8");

    const options: crypto.RsaPublicKey | crypto.RsaPrivateKey = {
        key: pem,
        padding: alg.padding,
    };

    if (alg.padding === crypto.constants.RSA_PKCS1_OAEP_PADDING) {
        (options as any).oaepHash = alg.oaepHash || "sha1";
    }

    const encrypted = crypto.publicEncrypt(options, buffer);
    return encrypted.toString("base64");
}
