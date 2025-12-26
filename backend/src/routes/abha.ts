/**
 * ABHA Routes - Enhanced with OTP Login and Token Management
 * Implements ABHA V3 OTP-based authentication and enrollment flows
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../lib/supabaseClient';
import { requestOtp, enrolByAadhaar, authByAbdm } from '../lib/abhaClient';
import { getValidSessionToken } from '../lib/authService';
import {
    storeAbhaRefreshToken,
    getAbhaAccessToken,
    revokeAbhaRefreshToken,
    hasValidAbhaTokens,
} from '../lib/abhaTokenService';
import {
    enrollAndLinkAbha,
    linkAbhaToPatient,
    getPatientAbhaDetails,
    delinkAbha,
} from '../lib/abhaGatewayAdapter';
import {
    validate,
    verifyMobileSchema,
    verifyAadharSchema,
    verifyOTPSchema,
} from '../middleware/abha.validation';
import { asyncHandler } from '../middleware/errorHandler';
import type { ABHAProfile } from '../types/abha.types';

const router = Router();

// ============================================================
// ABHA LOGIN FLOWS (OTP-BASED)
// ============================================================

/**
 * POST /login/request
 * Request OTP for ABHA login (mobile or ABHA number)
 */
router.post(
    '/login/request',
    asyncHandler(async (req: Request, res: Response) => {
        const { loginHint, loginId } = req.body;

        // Validate input
        if (!loginHint || !loginId) {
            return res.status(400).json({
                success: false,
                message: 'loginHint and loginId are required',
            });
        }

        if (!['mobile', 'abha'].includes(loginHint)) {
            return res.status(400).json({
                success: false,
                message: 'loginHint must be either "mobile" or "abha"',
            });
        }

        try {
            // Request OTP from ABHA
            const result = await requestOtp(
                {
                    loginHint: loginHint === 'abha' ? 'aadhaar' : 'mobile',
                    loginId,
                    scope: ['abha-login', 'mobile-verify'],
                },
                'sbx' // Use sandbox for now
            );

            if (!result || !result.txnId) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to request OTP from ABHA',
                });
            }

            res.json({
                success: true,
                message: 'OTP sent successfully',
                txnId: result.txnId,
            });
        } catch (error: any) {
            console.error('[ABHA Login] OTP request failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to request OTP',
                error: error.message,
            });
        }
    })
);

/**
 * POST /login/verify
 * Verify OTP and complete ABHA login
 */
router.post(
    '/login/verify',
    asyncHandler(async (req: Request, res: Response) => {
        const { txnId, otp, loginHint, loginId } = req.body;
        const userId = (req as any).user?.id;

        // Validate input
        if (!txnId || !otp || !loginHint || !loginId) {
            return res.status(400).json({
                success: false,
                message: 'txnId, otp, loginHint, and loginId are required',
            });
        }

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }

        try {
            // Verify OTP with ABHA
            const result = await authByAbdm(
                {
                    txnId,
                    otp,
                    loginHint: loginHint === 'abha' ? 'aadhaar' : 'mobile',
                    loginId,
                },
                'sbx'
            );

            if (!result || !result.ABHAProfile) {
                return res.status(400).json({
                    success: false,
                    message: 'ABHA login verification failed',
                });
            }

            const abhaProfile: ABHAProfile = result.ABHAProfile;
            const abhaNumber = abhaProfile.ABHANumber;
            const abhaAddress = abhaProfile.preferredAddress;

            // Store ABHA refresh token if provided
            if (result.refreshToken && result.expiresIn) {
                await storeAbhaRefreshToken(userId, result.refreshToken, result.expiresIn);
            }

            // Link ABHA to patient
            const linkResult = await linkAbhaToPatient(userId, abhaNumber, abhaAddress, abhaProfile);

            if (!linkResult.success) {
                return res.status(500).json({
                    success: false,
                    message: linkResult.error || 'Failed to link ABHA to patient',
                });
            }

            res.json({
                success: true,
                message: 'ABHA login successful',
                abhaProfile: {
                    abhaNumber,
                    abhaAddress,
                    name: `${abhaProfile.firstName} ${abhaProfile.lastName}`,
                    photo: abhaProfile.photo,
                },
            });
        } catch (error: any) {
            console.error('[ABHA Login] Verification failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to verify ABHA login',
                error: error.message,
            });
        }
    })
);

// ============================================================
// ABHA ENROLLMENT FLOWS
// ============================================================

/**
 * POST /enroll/request
 * Request OTP for ABHA enrollment via Aadhaar
 */
router.post(
    '/enroll/request',
    validate(verifyAadharSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const { aadhar } = req.body;

        try {
            const result = await requestOtp(
                {
                    loginHint: 'aadhaar',
                    loginId: aadhar,
                    scope: ['abha-enrol'],
                },
                'sbx'
            );

            if (!result || !result.txnId) {
                return res.status(400).json({
                    success: false,
                    message: 'Failed to request enrollment OTP',
                });
            }

            res.json({
                success: true,
                message: 'Enrollment OTP sent successfully',
                txnId: result.txnId,
            });
        } catch (error: any) {
            console.error('[ABHA Enroll] OTP request failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to request enrollment OTP',
                error: error.message,
            });
        }
    })
);

/**
 * POST /enroll/verify
 * Verify OTP and complete ABHA enrollment
 */
router.post(
    '/enroll/verify',
    validate(verifyOTPSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const { txnId, otp, mobile } = req.body;
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }

        try {
            // Enroll via ABHA
            const enrollResult = await enrollAndLinkAbha(userId, '', otp, txnId, mobile);

            if (!enrollResult.success) {
                return res.status(400).json({
                    success: false,
                    message: enrollResult.error || 'ABHA enrollment failed',
                });
            }

            // Store refresh token if provided
            if (enrollResult.abhaProfile?.refreshToken && enrollResult.abhaProfile?.expiresIn) {
                await storeAbhaRefreshToken(
                    userId,
                    enrollResult.abhaProfile.refreshToken,
                    enrollResult.abhaProfile.expiresIn
                );
            }

            res.json({
                success: true,
                message: 'ABHA enrollment successful',
                abhaNumber: enrollResult.abhaNumber,
                abhaAddress: enrollResult.abhaAddress,
                abhaProfile: enrollResult.abhaProfile,
            });
        } catch (error: any) {
            console.error('[ABHA Enroll] Verification failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to complete ABHA enrollment',
                error: error.message,
            });
        }
    })
);

// ============================================================
// ABHA PROFILE MANAGEMENT
// ============================================================

/**
 * GET /profile
 * Get ABHA profile for current user
 */
router.get(
    '/profile',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }

        try {
            const abhaDetails = await getPatientAbhaDetails(userId);

            if (!abhaDetails) {
                return res.status(404).json({
                    success: false,
                    message: 'ABHA profile not found',
                });
            }

            // Check if tokens are valid
            const hasValidTokens = await hasValidAbhaTokens(userId);

            res.json({
                success: true,
                abhaProfile: abhaDetails,
                hasValidTokens,
            });
        } catch (error: any) {
            console.error('[ABHA Profile] Fetch failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch ABHA profile',
                error: error.message,
            });
        }
    })
);

/**
 * POST /link
 * Link ABHA to existing patient (manual linking)
 */
router.post(
    '/link',
    asyncHandler(async (req: Request, res: Response) => {
        const { abhaNumber, abhaAddress, abhaProfile } = req.body;
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }

        if (!abhaNumber || !abhaAddress) {
            return res.status(400).json({
                success: false,
                message: 'abhaNumber and abhaAddress are required',
            });
        }

        try {
            const linkResult = await linkAbhaToPatient(userId, abhaNumber, abhaAddress, abhaProfile || {});

            if (!linkResult.success) {
                return res.status(500).json({
                    success: false,
                    message: linkResult.error || 'Failed to link ABHA',
                });
            }

            res.json({
                success: true,
                message: 'ABHA linked successfully',
                patientFhirId: linkResult.patientFhirId,
            });
        } catch (error: any) {
            console.error('[ABHA Link] Failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to link ABHA',
                error: error.message,
            });
        }
    })
);

/**
 * POST /delink
 * Delink ABHA from patient
 */
router.post(
    '/delink',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }

        try {
            // Revoke tokens
            await revokeAbhaRefreshToken(userId);

            // Delink from patient
            const delinkResult = await delinkAbha(userId);

            if (!delinkResult.success) {
                return res.status(500).json({
                    success: false,
                    message: delinkResult.error || 'Failed to delink ABHA',
                });
            }

            res.json({
                success: true,
                message: 'ABHA delinked successfully',
            });
        } catch (error: any) {
            console.error('[ABHA Delink] Failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delink ABHA',
                error: error.message,
            });
        }
    })
);

// ============================================================
// TOKEN MANAGEMENT
// ============================================================

/**
 * GET /token/status
 * Check ABHA token status
 */
router.get(
    '/token/status',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }

        try {
            const hasValidTokens = await hasValidAbhaTokens(userId);

            res.json({
                success: true,
                hasValidTokens,
            });
        } catch (error: any) {
            console.error('[ABHA Token] Status check failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to check token status',
                error: error.message,
            });
        }
    })
);

/**
 * POST /token/refresh
 * Manually refresh ABHA access token
 */
router.post(
    '/token/refresh',
    asyncHandler(async (req: Request, res: Response) => {
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
            });
        }

        try {
            const accessToken = await getAbhaAccessToken(userId);

            if (!accessToken) {
                return res.status(404).json({
                    success: false,
                    message: 'No valid ABHA tokens found',
                });
            }

            res.json({
                success: true,
                message: 'Access token refreshed successfully',
                accessToken: accessToken.substring(0, 20) + '...', // Preview only
            });
        } catch (error: any) {
            console.error('[ABHA Token] Refresh failed:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to refresh access token',
                error: error.message,
            });
        }
    })
);

// ============================================================
// LEGACY ENDPOINTS (BACKWARD COMPATIBILITY)
// ============================================================

/**
 * POST /verify-mobile
 * Legacy endpoint - Verify and save mobile number
 */
router.post(
    '/verify-mobile',
    validate(verifyMobileSchema),
    asyncHandler(async (req: Request, res: Response) => {
        const { mobile } = req.body;
        const userId = (req as any).user.id;

        const { data: existingProfile } = await supabaseAdmin
            .from('user_profiles')
            .select('id')
            .eq('user_id', userId)
            .single();

        if (!existingProfile) {
            const { error: insertError } = await supabaseAdmin.from('user_profiles').insert([
                {
                    user_id: userId,
                    mobile: mobile,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
            ]);

            if (insertError) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to create user profile',
                    error: insertError,
                });
            }
        } else {
            const { error: updateError } = await supabaseAdmin
                .from('user_profiles')
                .update({
                    mobile: mobile,
                    updated_at: new Date().toISOString(),
                })
                .eq('user_id', userId);

            if (updateError) {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to update mobile number',
                    error: updateError,
                });
            }
        }

        res.json({
            success: true,
            message: 'Mobile number saved successfully',
        });
    })
);

/**
 * DEBUG ENDPOINT - Test ABHA session token fetch
 */
router.get(
    '/debug/session',
    asyncHandler(async (req: Request, res: Response) => {
        try {
            const token = await getValidSessionToken();
            res.json({
                success: true,
                message: 'ABHA session token fetched successfully',
                tokenPreview: token.substring(0, 20) + '...',
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: 'Failed to fetch ABHA session token',
                error: error.message,
            });
        }
    })
);

export { router as abhaRouter };
