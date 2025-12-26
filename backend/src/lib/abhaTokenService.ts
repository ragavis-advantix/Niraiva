/**
 * ABHA Token Service
 * Server-side token management for ABHA refresh tokens and access tokens
 * Implements secure storage, rotation, and expiry handling
 */

import { createClient } from 'redis';
import { encrypt, decrypt } from './encryption';
import axios from 'axios';

// ============================================================
// TYPES
// ============================================================

export interface AbhaTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number; // seconds
    expiresAt: Date;
}

export interface StoredAbhaToken {
    refreshTokenEncrypted: string;
    expiresAt: string;
    createdAt: string;
}

// ============================================================
// IN-MEMORY FALLBACK
// ============================================================

const memoryTokenStore = new Map<string, string>();

// ============================================================
// REDIS CLIENT
// ============================================================

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient: any = null;
let useRedis = false;
let redisErrorLogged = false;

// Initialize Redis with graceful fallback
(async () => {
    try {
        redisClient = createClient({ url: redisUrl });

        redisClient.on('error', (err: any) => {
            // Only log the first error to avoid spam
            if (!redisErrorLogged) {
                console.warn('[ABHA Token Service] ⚠️  Redis unavailable - using in-memory token storage');
                redisErrorLogged = true;
            }
            useRedis = false;
        });

        redisClient.on('connect', () => {
            console.log('[ABHA Token Service] ✅ Connected to Redis');
            useRedis = true;
            redisErrorLogged = false;
        });

        await redisClient.connect();
    } catch (error) {
        if (!redisErrorLogged) {
            console.warn('[ABHA Token Service] ⚠️  Redis unavailable - using in-memory token storage');
            redisErrorLogged = true;
        }
        useRedis = false;
        redisClient = null;
    }
})();

// ============================================================
// TOKEN STORAGE
// ============================================================

/**
 * Store ABHA refresh token securely (encrypted in Redis)
 * @param patientId - Patient UUID
 * @param refreshToken - ABHA refresh token (plain)
 * @param expiresIn - Token expiry in seconds
 */
export async function storeAbhaRefreshToken(
    patientId: string,
    refreshToken: string,
    expiresIn: number
): Promise<void> {
    try {
        const key = `abha_refresh_token:${patientId}`;

        if (useRedis && redisClient) {
            // Encrypt refresh token
            const encryptedToken = encrypt(refreshToken);

            // Calculate expiry timestamp
            const expiresAt = new Date(Date.now() + expiresIn * 1000);

            const tokenData: StoredAbhaToken = {
                refreshTokenEncrypted: encryptedToken,
                expiresAt: expiresAt.toISOString(),
                createdAt: new Date().toISOString(),
            };

            // Store in Redis with TTL
            await redisClient.setEx(key, expiresIn, JSON.stringify(tokenData));
        } else {
            // Store in memory (no encryption needed for local dev)
            const expiryData = JSON.stringify({
                token: refreshToken,
                expiresAt: Date.now() + expiresIn * 1000,
            });
            memoryTokenStore.set(key, expiryData);
        }

        console.log(`[ABHA Token Service] Stored refresh token for patient ${patientId}`);
    } catch (error) {
        console.error('[ABHA Token Service] Error storing refresh token:', error);
        throw new Error('Failed to store ABHA refresh token');
    }
}

/**
 * Get ABHA refresh token for a patient
 * @param patientId - Patient UUID
 * @returns Decrypted refresh token or null if not found/expired
 */
export async function getAbhaRefreshToken(patientId: string): Promise<string | null> {
    try {
        const key = `abha_refresh_token:${patientId}`;
        let data: string | null = null;

        if (useRedis && redisClient) {
            data = await redisClient.get(key);
        } else {
            data = memoryTokenStore.get(key) || null;
        }

        if (!data) {
            console.log(`[ABHA Token Service] No refresh token found for patient ${patientId}`);
            return null;
        }

        if (useRedis && redisClient) {
            const tokenData: StoredAbhaToken = JSON.parse(data);

            // Check if expired
            if (new Date(tokenData.expiresAt) < new Date()) {
                console.log(`[ABHA Token Service] Refresh token expired for patient ${patientId}`);
                await redisClient.del(key);
                return null;
            }

            // Decrypt and return
            const decryptedToken = decrypt(tokenData.refreshTokenEncrypted);
            return decryptedToken;
        } else {
            // In-memory storage
            const memData = JSON.parse(data);
            if (memData.expiresAt < Date.now()) {
                console.log(`[ABHA Token Service] Refresh token expired for patient ${patientId}`);
                memoryTokenStore.delete(key);
                return null;
            }
            return memData.token;
        }
    } catch (error) {
        console.error('[ABHA Token Service] Error retrieving refresh token:', error);
        return null;
    }
}

/**
 * Revoke ABHA refresh token (on logout or delink)
 * @param patientId - Patient UUID
 */
export async function revokeAbhaRefreshToken(patientId: string): Promise<void> {
    try {
        const key = `abha_refresh_token:${patientId}`;

        if (useRedis && redisClient) {
            await redisClient.del(key);
        } else {
            memoryTokenStore.delete(key);
        }

        console.log(`[ABHA Token Service] Revoked refresh token for patient ${patientId}`);
    } catch (error) {
        console.error('[ABHA Token Service] Error revoking refresh token:', error);
    }
}

// ============================================================
// ACCESS TOKEN MANAGEMENT
// ============================================================

/**
 * Get ABHA access token (from cache or by refreshing)
 * @param patientId - Patient UUID
 * @returns Access token or null if refresh token not available
 */
export async function getAbhaAccessToken(patientId: string): Promise<string | null> {
    try {
        // Check cache first
        const cacheKey = `abha_access_token:${patientId}`;
        let cachedToken: string | null = null;

        if (useRedis && redisClient) {
            cachedToken = await redisClient.get(cacheKey);
        } else {
            cachedToken = memoryTokenStore.get(cacheKey) || null;
        }

        if (cachedToken) {
            console.log(`[ABHA Token Service] Using cached access token for patient ${patientId}`);
            return cachedToken;
        }

        // Get refresh token
        const refreshToken = await getAbhaRefreshToken(patientId);
        if (!refreshToken) {
            console.log(`[ABHA Token Service] No refresh token available for patient ${patientId}`);
            return null;
        }

        // Request new access token from ABHA
        const newTokens = await refreshAbhaAccessToken(refreshToken);

        if (!newTokens) {
            console.error(`[ABHA Token Service] Failed to refresh access token for patient ${patientId}`);
            return null;
        }

        // Cache access token (TTL = expiresIn - 60 seconds for safety margin)
        const cacheTtl = Math.max(newTokens.expiresIn - 60, 60);

        if (useRedis && redisClient) {
            await redisClient.setEx(cacheKey, cacheTtl, newTokens.accessToken);
        } else {
            memoryTokenStore.set(cacheKey, newTokens.accessToken);
        }

        // Update refresh token if rotated
        if (newTokens.refreshToken !== refreshToken) {
            await storeAbhaRefreshToken(patientId, newTokens.refreshToken, newTokens.expiresIn);
        }

        console.log(`[ABHA Token Service] Refreshed access token for patient ${patientId}`);
        return newTokens.accessToken;
    } catch (error) {
        console.error('[ABHA Token Service] Error getting access token:', error);
        return null;
    }
}

/**
 * Refresh ABHA access token using refresh token
 * @param refreshToken - ABHA refresh token
 * @returns New tokens or null if refresh failed
 */
async function refreshAbhaAccessToken(refreshToken: string): Promise<AbhaTokens | null> {
    try {
        const abhaBaseUrl = process.env.ABHA_BASE_URL || 'https://abhasbx.abdm.gov.in/abha/api';
        const endpoint = `${abhaBaseUrl}/v3/profile/token/refresh`;

        const response = await axios.post(
            endpoint,
            { refreshToken },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'REQUEST-ID': `req-${Date.now()}`,
                    'TIMESTAMP': new Date().toISOString(),
                },
            }
        );

        if (response.status === 200 && response.data) {
            const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;

            return {
                accessToken,
                refreshToken: newRefreshToken || refreshToken, // Use new if provided, else keep old
                expiresIn,
                expiresAt: new Date(Date.now() + expiresIn * 1000),
            };
        }

        return null;
    } catch (error: any) {
        console.error('[ABHA Token Service] Token refresh failed:', error.response?.data || error.message);
        return null;
    }
}

// ============================================================
// TOKEN VALIDATION
// ============================================================

/**
 * Validate if patient has valid ABHA tokens
 * @param patientId - Patient UUID
 * @returns True if valid tokens exist
 */
export async function hasValidAbhaTokens(patientId: string): Promise<boolean> {
    const refreshToken = await getAbhaRefreshToken(patientId);
    return refreshToken !== null;
}

/**
 * Get token expiry information
 * @param patientId - Patient UUID
 * @returns Expiry date or null
 */
export async function getAbhaTokenExpiry(patientId: string): Promise<Date | null> {
    try {
        const key = `abha_refresh_token:${patientId}`;
        let data: string | null = null;

        if (useRedis && redisClient) {
            data = await redisClient.get(key);
        } else {
            data = memoryTokenStore.get(key) || null;
        }

        if (!data) return null;

        if (useRedis) {
            const tokenData: StoredAbhaToken = JSON.parse(data);
            return new Date(tokenData.expiresAt);
        } else {
            const memData = JSON.parse(data);
            return new Date(memData.expiresAt);
        }
    } catch (error) {
        console.error('[ABHA Token Service] Error getting token expiry:', error);
        return null;
    }
}

// ============================================================
// CLEANUP
// ============================================================

/**
 * Graceful shutdown - close Redis connection
 */
export async function closeAbhaTokenService(): Promise<void> {
    if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
        console.log('[ABHA Token Service] Redis connection closed');
    }
}

// Handle process termination
process.on('SIGINT', async () => {
    await closeAbhaTokenService();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closeAbhaTokenService();
    process.exit(0);
});
