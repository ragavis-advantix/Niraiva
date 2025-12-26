import Redis from "ioredis";
import { sessionKey } from "./supabaseClient";

// In-memory fallback cache
const memoryCache = new Map<string, { value: string; expiresAt: number }>();

// Initialize Redis client with graceful fallback
let redis: Redis | null = null;
let useRedis = false;
let redisErrorLogged = false;

try {
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
        retryStrategy: (times) => {
            // Stop retrying after 3 attempts
            if (times > 3) {
                if (!redisErrorLogged) {
                    console.warn("⚠️  Redis unavailable - using in-memory cache fallback");
                    redisErrorLogged = true;
                }
                return null;
            }
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true, // Don't connect immediately
    });

    redis.on("error", (err) => {
        // Only log the first error to avoid spam
        if (!redisErrorLogged) {
            console.warn("⚠️  Redis unavailable - using in-memory cache fallback");
            redisErrorLogged = true;
        }
        useRedis = false;
    });

    redis.on("connect", () => {
        console.log("✅ Redis connected for ABHA session caching");
        useRedis = true;
        redisErrorLogged = false;
    });

    // Try to connect
    redis.connect().catch(() => {
        if (!redisErrorLogged) {
            console.warn("⚠️  Redis unavailable - using in-memory cache fallback");
            redisErrorLogged = true;
        }
        useRedis = false;
    });
} catch (error) {
    if (!redisErrorLogged) {
        console.warn("⚠️  Redis initialization failed - using in-memory cache fallback");
        redisErrorLogged = true;
    }
    useRedis = false;
}

/**
 * Get ABHA session token with auto-refresh
 * Caches token in Redis for 25 minutes (tokens expire in 30)
 * Auto-refreshes at 20 minutes to prevent expiry
 */
export async function getABHASessionToken(): Promise<string> {
    try {
        const cacheKey = "abha:session:token";

        // Check cache (Redis or in-memory)
        let cached: string | null = null;

        if (useRedis && redis) {
            cached = await redis.get(cacheKey);
        } else {
            // Use in-memory cache
            const entry = memoryCache.get(cacheKey);
            if (entry && entry.expiresAt > Date.now()) {
                cached = entry.value;
            } else if (entry) {
                memoryCache.delete(cacheKey);
            }
        }

        if (cached) {
            console.log("Using cached ABHA session token");
            return cached;
        }

        console.log("Fetching new ABHA session token");

        // Fetch new token
        const clientId = process.env.clientId || process.env.CLIENT_ID;
        const clientSecret = process.env.clientSecret || process.env.CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error("ABHA credentials not configured in environment");
        }

        const token = await sessionKey(clientId, clientSecret);

        // Cache for 25 minutes (tokens expire in 30, refresh before expiry)
        const ttl = 25 * 60;

        if (useRedis && redis) {
            await redis.setex(cacheKey, ttl, token);
        } else {
            // Use in-memory cache
            memoryCache.set(cacheKey, {
                value: token,
                expiresAt: Date.now() + ttl * 1000,
            });
        }

        // Schedule auto-refresh at 20 minutes
        setTimeout(() => refreshABHASessionToken(), 20 * 60 * 1000);

        return token;
    } catch (error) {
        console.error("Error getting ABHA session token:", error);
        throw error;
    }
}

/**
 * Auto-refresh ABHA session token before expiry
 */
async function refreshABHASessionToken() {
    try {
        console.log("Auto-refreshing ABHA session token");
        const cacheKey = "abha:session:token";

        if (useRedis && redis) {
            await redis.del(cacheKey);
        } else {
            memoryCache.delete(cacheKey);
        }

        await getABHASessionToken(); // Fetch and cache new token
    } catch (error) {
        console.error("Error refreshing ABHA session token:", error);
    }
}

/**
 * Clear ABHA session token from cache (for testing or manual refresh)
 */
export async function clearABHASessionToken(): Promise<void> {
    const cacheKey = "abha:session:token";

    if (useRedis && redis) {
        await redis.del(cacheKey);
    } else {
        memoryCache.delete(cacheKey);
    }
}

export { redis };
