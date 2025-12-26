// src/backend/src/lib/authService.ts
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

const SESSION_URL = process.env.ABHA_SESSION_URL as string;
const CLIENT_ID = process.env.ABHA_CLIENT_ID as string;
const CLIENT_SECRET = process.env.ABHA_CLIENT_SECRET as string;
const X_CM_ID = process.env.ABHA_X_CM_ID as string; // sbx or abdm

interface SessionResponse {
    accessToken: string;
    expiresIn: number; // seconds
    refreshToken?: string;
}

// In-memory cache (replaces Redis for now)
let sessionCache: {
    accessToken: string | null;
    expiryTimestamp: number | null;
    refreshToken: string | null;
} = {
    accessToken: null,
    expiryTimestamp: null,
    refreshToken: null,
};

/**
 * Fetch a fresh session token from ABHA and cache it in memory.
 */
export async function fetchAndCacheSession(): Promise<SessionResponse> {
    const requestId = uuidv4();

    console.log('[ABHA Auth] Fetching new session token...');

    const resp = await (axios as any).post(SESSION_URL, {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        grantType: 'client_credentials',
    }, {
        headers: {
            'REQUEST-ID': requestId,
            TIMESTAMP: new Date().toISOString(),
            'X-CM-ID': X_CM_ID,
        },
    });

    const { accessToken, expiresIn, refreshToken } = (resp.data as SessionResponse);
    const expiryTimestamp = Date.now() + (expiresIn || 0) * 1000 - 60_000; // refresh 1 min before expiry

    // Cache in memory
    sessionCache.accessToken = accessToken;
    sessionCache.expiryTimestamp = expiryTimestamp;
    sessionCache.refreshToken = refreshToken || null;

    console.log('[ABHA Auth] Session token cached successfully');

    return { accessToken, expiresIn, refreshToken };
}

/**
 * Get a valid session token, refreshing if needed.
 */
export async function getValidSessionToken(): Promise<string> {
    const now = Date.now();

    // Check if cached token is still valid
    if (sessionCache.accessToken && sessionCache.expiryTimestamp && now < sessionCache.expiryTimestamp) {
        console.log('[ABHA Auth] Using cached session token');
        return sessionCache.accessToken;
    }

    // Fetch fresh token
    console.log('[ABHA Auth] Token expired or missing, fetching new one...');
    const fresh = await fetchAndCacheSession();
    return fresh.accessToken;
}

/**
 * Helper to add mandatory ABHA headers to a request config.
 */
export function getCommonHeaders(token: string, env: 'sbx' | 'abdm'): Record<string, string> {
    return {
        'REQUEST-ID': uuidv4(),
        TIMESTAMP: new Date().toISOString(),
        'X-CM-ID': env,
        Authorization: `Bearer ${token}`,
    };
}
