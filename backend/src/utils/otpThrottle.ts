/**
 * OTP retry throttling with lockout mechanism
 * Prevents brute force attacks on OTP verification
 */

interface OTPAttempt {
    count: number;
    resetAt: number;
    locked: boolean;
}

const otpAttempts = new Map<string, OTPAttempt>();

/**
 * Check if user is allowed to attempt OTP verification
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
export function checkOTPThrottle(
    userId: string
): { allowed: boolean; reason?: string } {
    const key = `otp-${userId}`;
    const attempt = otpAttempts.get(key);

    if (!attempt) {
        return { allowed: true };
    }

    // Check if lockout period expired
    if (Date.now() > attempt.resetAt) {
        otpAttempts.delete(key);
        return { allowed: true };
    }

    // Check if locked after 3 failed attempts
    if (attempt.locked || attempt.count >= 3) {
        const remainingTime = Math.ceil((attempt.resetAt - Date.now()) / 60000);
        return {
            allowed: false,
            reason: `Too many failed attempts. Try again in ${remainingTime} minute${remainingTime !== 1 ? "s" : ""}.`,
        };
    }

    return { allowed: true };
}

/**
 * Record OTP attempt (success or failure)
 * Locks user out after 3 failed attempts for 15 minutes
 */
export function recordOTPAttempt(
    userId: string,
    failed: boolean = false
): void {
    const key = `otp-${userId}`;
    const attempt = otpAttempts.get(key) || {
        count: 0,
        resetAt: Date.now() + 15 * 60 * 1000, // 15 minutes
        locked: false,
    };

    if (failed) {
        attempt.count++;
        if (attempt.count >= 3) {
            attempt.locked = true;
            console.warn(`User ${userId} locked out after 3 failed OTP attempts`);
        }
    } else {
        // Success - clear attempts
        otpAttempts.delete(key);
        return;
    }

    otpAttempts.set(key, attempt);
}

/**
 * Clear OTP throttle for a user (admin function)
 */
export function clearOTPThrottle(userId: string): void {
    const key = `otp-${userId}`;
    otpAttempts.delete(key);
}

/**
 * Get remaining lockout time in minutes
 */
export function getRemainingLockoutTime(userId: string): number | null {
    const key = `otp-${userId}`;
    const attempt = otpAttempts.get(key);

    if (!attempt || !attempt.locked) {
        return null;
    }

    if (Date.now() > attempt.resetAt) {
        return null;
    }

    return Math.ceil((attempt.resetAt - Date.now()) / 60000);
}
