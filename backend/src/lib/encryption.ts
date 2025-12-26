// src/backend/src/lib/encryption.ts
import axios from 'axios';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const X_CM_ID = process.env.ABHA_X_CM_ID as string; // sbx or abdm

interface PublicKeyResponse {
    publicKey: string; // PEM or base64 string
}

// In-memory cache (replaces Redis for now)
let publicKeyCache: {
    key: string | null;
    expiryTimestamp: number | null;
} = {
    key: null,
    expiryTimestamp: null,
};

const PUBKEY_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

/**
 * Fetch the RSA public key from ABHA V3 and cache it in memory.
 * Returns the PEM formatted key ready for crypto operations.
 */
export async function fetchPublicKey(baseUrl: string, token: string): Promise<string> {
    const now = Date.now();

    // Try cache first
    if (publicKeyCache.key && publicKeyCache.expiryTimestamp && now < publicKeyCache.expiryTimestamp) {
        console.log('[ABHA Encryption] Using cached public key');
        return publicKeyCache.key;
    }

    console.log('[ABHA Encryption] Fetching new public key...');

    const requestId = uuidv4();
    const response = await axios.get(
        `${baseUrl}/v3/profile/public/certificate`,
        {
            headers: {
                'REQUEST-ID': requestId,
                TIMESTAMP: new Date().toISOString(),
                'X-CM-ID': X_CM_ID,
                Authorization: `Bearer ${token}`,
            },
        },
    );

    const data = response.data as PublicKeyResponse;

    // Ensure PEM format
    const pem = data.publicKey.includes('BEGIN')
        ? data.publicKey
        : `-----BEGIN PUBLIC KEY-----\n${data.publicKey}\n-----END PUBLIC KEY-----`;

    // Cache in memory
    publicKeyCache.key = pem;
    publicKeyCache.expiryTimestamp = now + PUBKEY_TTL_MS;

    console.log('[ABHA Encryption] Public key cached successfully');

    return pem;
}

/**
 * Encrypt a plain string using RSA OAEP with SHA‑1 (as required by ABHA V3).
 * Returns Base64‑encoded ciphertext.
 */
export function encryptOAEP_SHA1(publicKeyPem: string, plain: string): string {
    const buffer = Buffer.from(plain, 'utf8');
    const encrypted = crypto.publicEncrypt(
        {
            key: publicKeyPem,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha1',
        },
        buffer,
    );
    return encrypted.toString('base64');
}

/**
 * Simple encryption function for token storage (AES-256-GCM)
 * This is used for encrypting refresh tokens in storage
 */
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
