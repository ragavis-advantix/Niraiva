// src/backend/src/lib/abhaClient.ts
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { getValidSessionToken, getCommonHeaders } from './authService';
import { fetchPublicKey, encryptOAEP_SHA1 } from './encryption';

/**
 * Helper to build the base URL for the selected environment.
 * Pass "sbx" for sandbox or "abdm" for production.
 */
function getBaseUrl(env: 'sbx' | 'abdm'): string {
    return env === 'sbx'
        ? 'https://abhasbx.abdm.gov.in/abha/api'
        : 'https://apis.abdm.gov.in/abha/api';
}

/**
 * Generic request wrapper that injects the mandatory ABHA headers.
 */
async function abhaRequest<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    payload: any,
    env: 'sbx' | 'abdm',
): Promise<T> {
    const token = await getValidSessionToken();
    const baseUrl = getBaseUrl(env);
    const headers = getCommonHeaders(token, env);
    const url = `${baseUrl}${endpoint}`;

    console.log('[ABHA Client] Request Details:');
    console.log('  URL:', url);
    console.log('  Method:', method);
    console.log('  Headers:', JSON.stringify(headers, null, 2));
    console.log('  Payload:', JSON.stringify(payload, null, 2));

    const config = { method, url, headers, data: payload };

    try {
        const response = await axios(config);
        console.log('[ABHA Client] Response Status:', response.status);
        return response.data as T;
    } catch (error: any) {
        console.error('[ABHA Client] Request Failed:');
        console.error('  Status:', error.response?.status);
        console.error('  Status Text:', error.response?.statusText);
        console.error('  Response Data:', JSON.stringify(error.response?.data, null, 2));
        throw error;
    }
}

/**
 * Request OTP for Aadhaar / Mobile / DL flows.
 */
export async function requestOtp(
    params: {
        loginHint: 'aadhaar' | 'mobile' | 'dl';
        loginId: string; // plain value, will be encrypted inside
        scope: string[];
        otpSystem?: string;
    },
    env: 'sbx' | 'abdm',
) {
    const token = await getValidSessionToken();
    const baseUrl = getBaseUrl(env);
    const publicKey = await fetchPublicKey(baseUrl, token);
    const encryptedLoginId = encryptOAEP_SHA1(publicKey, params.loginId);

    const payload = {
        txnId: '',
        scope: params.scope,
        loginHint: params.loginHint,
        loginId: encryptedLoginId,
        otpSystem: params.otpSystem ?? params.loginHint,
    };

    return abhaRequest<any>('POST', '/v3/enrollment/request/otp', payload, env);
}

/**
 * Enrol by Aadhaar after OTP verification.
 */
export async function enrolByAadhaar(
    args: {
        txnId: string;
        otp: string; // plain OTP
        mobile?: string; // optional primary mobile, plain
        consentCode: string;
        consentVersion: string;
    },
    env: 'sbx' | 'abdm',
) {
    const token = await getValidSessionToken();
    const baseUrl = getBaseUrl(env);
    const publicKey = await fetchPublicKey(baseUrl, token);

    const encryptedOtp = encryptOAEP_SHA1(publicKey, args.otp);
    const encryptedMobile = args.mobile ? encryptOAEP_SHA1(publicKey, args.mobile) : undefined;

    const payload: any = {
        authData: {
            authMethods: ['otp'],
            otp: {
                txnId: args.txnId,
                otpValue: encryptedOtp,
                ...(encryptedMobile && { mobile: encryptedMobile }),
            },
        },
        consent: {
            code: args.consentCode,
            version: args.consentVersion,
        },
    };

    return abhaRequest<any>('POST', '/v3/enrollment/enrol/byAadhaar', payload, env);
}

/**
 * Generic ABHA auth by ABDM (used for OTP verification, mobile verification, etc.).
 */
export async function authByAbdm(
    args: {
        txnId: string;
        otp: string; // plain OTP
        loginHint: 'mobile' | 'aadhaar' | 'dl';
        loginId: string; // plain identifier (mobile number, Aadhaar, DL)
    },
    env: 'sbx' | 'abdm',
) {
    const token = await getValidSessionToken();
    const baseUrl = getBaseUrl(env);
    const publicKey = await fetchPublicKey(baseUrl, token);

    const encryptedOtp = encryptOAEP_SHA1(publicKey, args.otp);
    const encryptedLoginId = encryptOAEP_SHA1(publicKey, args.loginId);

    const payload = {
        authData: {
            authMethods: ['otp'],
            otp: {
                txnId: args.txnId,
                otpValue: encryptedOtp,
            },
            loginHint: args.loginHint,
            loginId: encryptedLoginId,
        },
    };

    return abhaRequest<any>('POST', '/v3/enrollment/auth/byAbdm', payload, env);
}

/**
 * Enrol by Document (e.g., Driving Licence).
 */
export async function enrolByDocument(
    args: {
        txnId: string;
        documentType: string; // e.g., "DRIVING_LICENCE"
        documentId: string;
        firstName: string;
        lastName: string;
        dob: string; // YYYY-MM-DD
        gender: string;
        frontSidePhoto: string; // base64 image
        backSidePhoto?: string; // base64 image (optional)
        address: string;
        state: string;
        district: string;
        pinCode: string;
        consentCode: string;
        consentVersion: string;
    },
    env: 'sbx' | 'abdm',
) {
    const token = await getValidSessionToken();
    const baseUrl = getBaseUrl(env);
    const publicKey = await fetchPublicKey(baseUrl, token);

    // Encrypt only the fields that require it (documentId, address, etc.)
    const encrypt = (val: string) => encryptOAEP_SHA1(publicKey, val);

    const payload = {
        txnId: args.txnId,
        documentType: args.documentType,
        documentId: encrypt(args.documentId),
        firstName: encrypt(args.firstName),
        lastName: encrypt(args.lastName),
        dob: encrypt(args.dob),
        gender: encrypt(args.gender),
        frontSidePhoto: args.frontSidePhoto, // binary already base64, no encryption needed
        ...(args.backSidePhoto && { backSidePhoto: args.backSidePhoto }),
        address: encrypt(args.address),
        state: encrypt(args.state),
        district: encrypt(args.district),
        pinCode: encrypt(args.pinCode),
        consent: {
            code: args.consentCode,
            version: args.consentVersion,
        },
    };

    return abhaRequest<any>('POST', '/v3/enrollment/enrol/byDocument', payload, env);
}

/**
 * Generate QR code for an ABHA address.
 */
export async function generateQr(abhaAddress: string, env: 'sbx' | 'abdm') {
    const token = await getValidSessionToken();
    const baseUrl = getBaseUrl(env);
    const payload = { abhaAddress };
    return abhaRequest<any>('POST', '/v3/qr/generate', payload, env);
}

/**
 * Generate ABHA Card (PDF/PNG) for an ABHA address.
 */
export async function generateAbhaCard(abhaAddress: string, env: 'sbx' | 'abdm') {
    const token = await getValidSessionToken();
    const baseUrl = getBaseUrl(env);
    const payload = { abhaAddress };
    return abhaRequest<any>('POST', '/v3/abha/card/generate', payload, env);
}

/**
 * Example: Benefit linking – wrapper for the generic benefit endpoint.
 */
export async function linkBenefit(
    args: { abhaAddress: string; benefitId: string; payload?: any },
    env: 'sbx' | 'abdm',
) {
    const token = await getValidSessionToken();
    const baseUrl = getBaseUrl(env);
    const endpoint = `/v3/benefit/${args.benefitId}/link`;
    const payload = { abhaAddress: args.abhaAddress, ...(args.payload || {}) };
    return abhaRequest<any>('POST', endpoint, payload, env);
}

// Additional endpoint wrappers can be added following the same pattern.
