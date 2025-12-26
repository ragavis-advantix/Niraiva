// src/backend/src/lib/abhaOrchestrator.ts
import {
    requestOtp,
    enrolByAadhaar,
    authByAbdm,
    enrolByDocument,
    generateQr,
    generateAbhaCard,
} from './abhaClient';

/**
 * Orchestrator for ABHA V3 flows - implements high-level business logic
 */

interface OrchestratorResult<T = any> {
    success: boolean;
    data?: T;
    message?: string;
    txnId?: string;
}

/**
 * Flow 1: ABHA Creation via Aadhaar OTP
 * Step 1: Request OTP for Aadhaar
 */
export async function initiateAadhaarEnrollment(
    aadhaar: string,
    env: 'sbx' | 'abdm' = 'sbx',
): Promise<OrchestratorResult> {
    try {
        const result = await requestOtp(
            {
                loginHint: 'aadhaar',
                loginId: aadhaar,
                scope: ['abha-enrol'],
            },
            env,
        );

        return {
            success: true,
            txnId: result.txnId,
            message: 'OTP sent successfully to Aadhaar-linked mobile',
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Failed to send OTP',
        };
    }
}

/**
 * Flow 1: ABHA Creation via Aadhaar OTP
 * Step 2: Verify OTP and enrol ABHA
 */
export async function completeAadhaarEnrollment(
    txnId: string,
    otp: string,
    mobile?: string,
    env: 'sbx' | 'abdm' = 'sbx',
): Promise<OrchestratorResult> {
    try {
        const result = await enrolByAadhaar(
            {
                txnId,
                otp,
                mobile,
                consentCode: 'abha-enrollment',
                consentVersion: '1.4',
            },
            env,
        );

        return {
            success: true,
            data: result,
            message: 'ABHA enrolled successfully',
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Failed to enrol ABHA',
        };
    }
}

/**
 * Flow 2: Mobile Verification (when primary mobile differs from Aadhaar mobile)
 * Step 1: Request OTP for mobile
 */
export async function initiateMobileVerification(
    mobile: string,
    env: 'sbx' | 'abdm' = 'sbx',
): Promise<OrchestratorResult> {
    try {
        const result = await requestOtp(
            {
                loginHint: 'mobile',
                loginId: mobile,
                scope: ['mobile-verify'],
            },
            env,
        );

        return {
            success: true,
            txnId: result.txnId,
            message: 'OTP sent to mobile',
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Failed to send mobile OTP',
        };
    }
}

/**
 * Flow 2: Mobile Verification
 * Step 2: Verify mobile OTP
 */
export async function completeMobileVerification(
    txnId: string,
    otp: string,
    mobile: string,
    env: 'sbx' | 'abdm' = 'sbx',
): Promise<OrchestratorResult> {
    try {
        const result = await authByAbdm(
            {
                txnId,
                otp,
                loginHint: 'mobile',
                loginId: mobile,
            },
            env,
        );

        return {
            success: true,
            data: result,
            message: 'Mobile verified successfully',
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Failed to verify mobile',
        };
    }
}

/**
 * Flow 3: ABHA Creation via Driving License
 * Step 1: Request OTP for DL flow
 */
export async function initiateDLEnrollment(
    dlNumber: string,
    env: 'sbx' | 'abdm' = 'sbx',
): Promise<OrchestratorResult> {
    try {
        const result = await requestOtp(
            {
                loginHint: 'dl',
                loginId: dlNumber,
                scope: ['dl-flow'],
            },
            env,
        );

        return {
            success: true,
            txnId: result.txnId,
            message: 'OTP sent for DL verification',
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Failed to send DL OTP',
        };
    }
}

/**
 * Flow 3: ABHA Creation via Driving License
 * Step 2: Verify OTP
 */
export async function verifyDLOtp(
    txnId: string,
    otp: string,
    dlNumber: string,
    env: 'sbx' | 'abdm' = 'sbx',
): Promise<OrchestratorResult> {
    try {
        const result = await authByAbdm(
            {
                txnId,
                otp,
                loginHint: 'dl',
                loginId: dlNumber,
            },
            env,
        );

        return {
            success: true,
            data: result,
            txnId: result.txnId,
            message: 'DL OTP verified',
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Failed to verify DL OTP',
        };
    }
}

/**
 * Flow 3: ABHA Creation via Driving License
 * Step 3: Upload DL documents and enrol
 */
export async function completeDLEnrollment(
    args: {
        txnId: string;
        documentId: string;
        firstName: string;
        lastName: string;
        dob: string;
        gender: string;
        frontSidePhoto: string;
        backSidePhoto?: string;
        address: string;
        state: string;
        district: string;
        pinCode: string;
    },
    env: 'sbx' | 'abdm' = 'sbx',
): Promise<OrchestratorResult> {
    try {
        const result = await enrolByDocument(
            {
                ...args,
                documentType: 'DRIVING_LICENCE',
                consentCode: 'abha-enrollment',
                consentVersion: '1.4',
            },
            env,
        );

        return {
            success: true,
            data: result,
            message: 'ABHA enrolled via DL successfully',
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Failed to enrol via DL',
        };
    }
}

/**
 * Flow 4: Find/Recover ABHA by Mobile
 */
export async function findAbhaByMobile(
    mobile: string,
    env: 'sbx' | 'abdm' = 'sbx',
): Promise<OrchestratorResult> {
    try {
        const otpResult = await requestOtp(
            {
                loginHint: 'mobile',
                loginId: mobile,
                scope: ['abha-search'],
            },
            env,
        );

        return {
            success: true,
            txnId: otpResult.txnId,
            message: 'OTP sent to mobile for ABHA search',
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Failed to initiate ABHA search',
        };
    }
}

/**
 * Flow 5: Generate QR Code for ABHA
 */
export async function generateAbhaQr(
    abhaAddress: string,
    env: 'sbx' | 'abdm' = 'sbx',
): Promise<OrchestratorResult> {
    try {
        const result = await generateQr(abhaAddress, env);

        return {
            success: true,
            data: result,
            message: 'QR code generated successfully',
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Failed to generate QR',
        };
    }
}

/**
 * Flow 6: Generate ABHA Card
 */
export async function generateAbhaCardPdf(
    abhaAddress: string,
    env: 'sbx' | 'abdm' = 'sbx',
): Promise<OrchestratorResult> {
    try {
        const result = await generateAbhaCard(abhaAddress, env);

        return {
            success: true,
            data: result,
            message: 'ABHA card generated successfully',
        };
    } catch (error: any) {
        return {
            success: false,
            message: error.message || 'Failed to generate ABHA card',
        };
    }
}
