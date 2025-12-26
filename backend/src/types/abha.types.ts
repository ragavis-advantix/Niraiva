/**
 * TypeScript type definitions for ABHA (Ayushman Bharat Health Account) API
 */

// ============= Request Types =============

export interface VerifyMobileRequest {
    mobile: string;
}

export interface VerifyAadharRequest {
    aadhar: string;
}

export interface VerifyOTPRequest {
    txnId: string;
    otp: string;
    mobile?: string;
}

// ============= Response Types =============

export interface ABHAProfile {
    ABHANumber: string;
    firstName: string;
    middleName?: string;
    lastName: string;
    dob: string;
    gender: string;
    mobile: string;
    preferredAddress: string;
    address: string;
    districtCode: string;
    stateCode: string;
    pinCode: string;
    stateName: string;
    districtName: string;
    abhaStatus: string;
    photo?: string;
}

export interface AadharVerificationResult {
    success: boolean;
    txnId?: string;
    message: string;
}

export interface OTPVerificationResult {
    status: number;
    data?: {
        ABHAProfile: ABHAProfile;
        message?: string;
        error?: string;
    };
}

export interface PublicKeyData {
    publicKey: string;
    encryptionAlgorithm?: string;
}

export interface SessionKeyResponse {
    accessToken: string;
}

// ============= Error Types =============

export interface ABHAError extends Error {
    status?: number;
    code?: string;
    details?: any;
}

export interface ErrorResponse {
    success: false;
    error: {
        message: string;
        code: string;
        status: number;
        timestamp: string;
    };
}

// ============= Supabase Types =============

export interface UserProfile {
    id?: string;
    user_id: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    email?: string;
    mobile?: string;
    gender?: string;
    dob?: string;
    blood_type?: string;
    height?: number;
    weight?: number;
    bmi?: number;
    allergies?: string;
    abha_number?: string;
    abha_profile?: any;
    preferred_abha_address?: string;
    address?: string;
    district_code?: string;
    state_code?: string;
    pin_code?: string;
    state_name?: string;
    district_name?: string;
    abha_status?: string;
    photo?: string;
    created_at?: string;
    updated_at?: string;
}

// ============= Helper Function Types =============

export type EncryptFunction = (plainText: string) => Promise<string>;

export type SessionKeyFunction = (
    clientId: string,
    clientSecret: string
) => Promise<string>;

export type LoginAadhaarFunction = (
    aadhaar: string
) => Promise<AadharVerificationResult>;

export type VerifyOTPFunction = (
    txnId: string,
    encryptedOtp: string,
    mobile?: string
) => Promise<OTPVerificationResult>;
