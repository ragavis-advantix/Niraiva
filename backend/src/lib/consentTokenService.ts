/**
 * Consent Token Service
 * Handles JWT-based consent token generation, validation, and management
 * Implements ABDM-compliant consent tokens with purposeOfUse
 */

import jwt from 'jsonwebtoken';
import { supabaseAdmin } from './supabaseClient';

// ============================================================
// TYPES & INTERFACES
// ============================================================

export interface ConsentTokenPayload {
    consentId: string;              // FHIR Consent resource ID
    patientAbha: string;            // Patient's ABHA number
    patientId: string;              // Internal patient ID (Supabase user ID)
    organizationId: string;         // Organization UUID
    purposeOfUse: PurposeOfUse;     // ABDM-mandated purpose
    allowedResources: string[];     // FHIR resource types (Observation, DocumentReference, etc.)
    validFrom: string;              // ISO timestamp
    validUntil: string;             // ISO timestamp
    iat?: number;                   // Issued at (added by JWT)
    exp?: number;                   // Expiration (added by JWT)
}

export type PurposeOfUse = 'TREATMENT' | 'EMERGENCY' | 'INSURANCE' | 'RESEARCH';

export interface ConsentTokenRecord {
    id: string;
    consent_fhir_id: string;
    patient_id: string;
    organization_id: string;
    purpose_of_use: PurposeOfUse;
    allowed_resources: string[];
    token_jwt: string;
    issued_at: string;
    expires_at: string;
    revoked: boolean;
    revoked_at?: string;
    revoked_reason?: string;
}

export interface TokenValidationResult {
    valid: boolean;
    payload?: ConsentTokenPayload;
    error?: string;
    revoked?: boolean;
}

// ============================================================
// CONFIGURATION
// ============================================================

const JWT_PRIVATE_KEY = process.env.CONSENT_JWT_PRIVATE_KEY;
const JWT_PUBLIC_KEY = process.env.CONSENT_JWT_PUBLIC_KEY;
const JWT_ALGORITHM = 'RS256';
const DEFAULT_TOKEN_DURATION_MONTHS = 6;

if (!JWT_PRIVATE_KEY || !JWT_PUBLIC_KEY) {
    console.warn('⚠️  CONSENT_JWT_PRIVATE_KEY or CONSENT_JWT_PUBLIC_KEY not set in environment');
}

// ============================================================
// TOKEN GENERATION
// ============================================================

/**
 * Generate a signed consent token (JWT)
 * @param payload - Consent token payload with ABDM-compliant fields
 * @returns Signed JWT string
 */
export function generateConsentToken(payload: ConsentTokenPayload): string {
    if (!JWT_PRIVATE_KEY) {
        throw new Error('JWT private key not configured');
    }

    // Validate purposeOfUse
    const validPurposes: PurposeOfUse[] = ['TREATMENT', 'EMERGENCY', 'INSURANCE', 'RESEARCH'];
    if (!validPurposes.includes(payload.purposeOfUse)) {
        throw new Error(`Invalid purposeOfUse: ${payload.purposeOfUse}. Must be one of: ${validPurposes.join(', ')}`);
    }

    // Calculate expiration from validUntil
    const expiresAt = new Date(payload.validUntil);
    const expiresInSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    if (expiresInSeconds <= 0) {
        throw new Error('validUntil must be in the future');
    }

    // Sign token
    const token = jwt.sign(payload, JWT_PRIVATE_KEY, {
        algorithm: JWT_ALGORITHM,
        expiresIn: expiresInSeconds,
        issuer: 'niraiva-consent-service',
        audience: payload.organizationId,
    });

    return token;
}

/**
 * Create and store a consent token in the database
 * @param consentFhirId - FHIR Consent resource ID
 * @param patientId - Supabase user ID
 * @param patientAbha - Patient's ABHA number
 * @param organizationId - Organization UUID
 * @param purposeOfUse - Purpose of data access
 * @param allowedResources - Array of FHIR resource types
 * @param validFrom - Start date (ISO string)
 * @param validUntil - End date (ISO string)
 * @returns Token record with JWT
 */
export async function createConsentToken(
    consentFhirId: string,
    patientId: string,
    patientAbha: string,
    organizationId: string,
    purposeOfUse: PurposeOfUse,
    allowedResources: string[],
    validFrom: string,
    validUntil: string
): Promise<{ token: string; record: ConsentTokenRecord }> {

    // Generate JWT payload
    const payload: ConsentTokenPayload = {
        consentId: consentFhirId,
        patientAbha,
        patientId,
        organizationId,
        purposeOfUse,
        allowedResources,
        validFrom,
        validUntil,
    };

    // Sign token
    const token = generateConsentToken(payload);

    // Store in database
    const { data, error } = await supabaseAdmin
        .from('consent_tokens')
        .insert({
            consent_fhir_id: consentFhirId,
            patient_id: patientId,
            organization_id: organizationId,
            purpose_of_use: purposeOfUse,
            allowed_resources: allowedResources,
            token_jwt: token,
            issued_at: new Date().toISOString(),
            expires_at: validUntil,
            revoked: false,
        })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to store consent token: ${error.message}`);
    }

    return { token, record: data as ConsentTokenRecord };
}

// ============================================================
// TOKEN VALIDATION
// ============================================================

/**
 * Verify and decode a consent token
 * @param token - JWT string
 * @returns Validation result with payload or error
 */
export async function validateConsentToken(token: string): Promise<TokenValidationResult> {
    if (!JWT_PUBLIC_KEY) {
        return { valid: false, error: 'JWT public key not configured' };
    }

    try {
        // Verify signature and decode
        const decoded = jwt.verify(token, JWT_PUBLIC_KEY, {
            algorithms: [JWT_ALGORITHM],
            issuer: 'niraiva-consent-service',
        }) as ConsentTokenPayload;

        // Check if token is revoked in database
        const { data: tokenRecord, error } = await supabaseAdmin
            .from('consent_tokens')
            .select('revoked, revoked_reason')
            .eq('consent_fhir_id', decoded.consentId)
            .eq('token_jwt', token)
            .maybeSingle();

        if (error) {
            console.error('Error checking token revocation:', error);
            return { valid: false, error: 'Database error checking revocation status' };
        }

        if (tokenRecord?.revoked) {
            return {
                valid: false,
                error: `Token revoked: ${tokenRecord.revoked_reason || 'No reason provided'}`,
                revoked: true,
            };
        }

        // Check if validUntil has passed (additional check beyond JWT exp)
        const validUntil = new Date(decoded.validUntil);
        if (validUntil < new Date()) {
            return { valid: false, error: 'Consent period has expired' };
        }

        return { valid: true, payload: decoded };

    } catch (err: any) {
        if (err.name === 'TokenExpiredError') {
            return { valid: false, error: 'Token has expired' };
        }
        if (err.name === 'JsonWebTokenError') {
            return { valid: false, error: `Invalid token: ${err.message}` };
        }
        return { valid: false, error: `Token validation failed: ${err.message}` };
    }
}

/**
 * Validate token and check if it allows access to a specific resource type
 * @param token - JWT string
 * @param resourceType - FHIR resource type (e.g., 'Observation')
 * @returns Validation result
 */
export async function validateTokenForResource(
    token: string,
    resourceType: string
): Promise<TokenValidationResult> {
    const result = await validateConsentToken(token);

    if (!result.valid || !result.payload) {
        return result;
    }

    // Check if resource type is allowed
    if (!result.payload.allowedResources.includes(resourceType)) {
        return {
            valid: false,
            error: `Resource type '${resourceType}' not permitted by consent. Allowed: ${result.payload.allowedResources.join(', ')}`,
        };
    }

    return result;
}

// ============================================================
// TOKEN REVOCATION
// ============================================================

/**
 * Revoke a consent token
 * @param consentFhirId - FHIR Consent resource ID
 * @param reason - Reason for revocation
 * @returns Success status
 */
export async function revokeConsentToken(
    consentFhirId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabaseAdmin
        .from('consent_tokens')
        .update({
            revoked: true,
            revoked_at: new Date().toISOString(),
            revoked_reason: reason || 'Revoked by patient',
        })
        .eq('consent_fhir_id', consentFhirId);

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}

/**
 * Revoke all tokens for a patient-organization pair
 * @param patientId - Supabase user ID
 * @param organizationId - Organization UUID
 * @param reason - Reason for revocation
 */
export async function revokeAllTokensForOrganization(
    patientId: string,
    organizationId: string,
    reason?: string
): Promise<{ success: boolean; count: number; error?: string }> {
    const { data, error } = await supabaseAdmin
        .from('consent_tokens')
        .update({
            revoked: true,
            revoked_at: new Date().toISOString(),
            revoked_reason: reason || 'All consents revoked by patient',
        })
        .eq('patient_id', patientId)
        .eq('organization_id', organizationId)
        .eq('revoked', false)
        .select();

    if (error) {
        return { success: false, count: 0, error: error.message };
    }

    return { success: true, count: data?.length || 0 };
}

// ============================================================
// TOKEN QUERIES
// ============================================================

/**
 * Get all active consent tokens for a patient
 * @param patientId - Supabase user ID
 * @returns Array of active token records
 */
export async function getActiveTokensForPatient(
    patientId: string
): Promise<ConsentTokenRecord[]> {
    const { data, error } = await supabaseAdmin
        .from('consent_tokens')
        .select('*')
        .eq('patient_id', patientId)
        .eq('revoked', false)
        .gte('expires_at', new Date().toISOString())
        .order('issued_at', { ascending: false });

    if (error) {
        console.error('Error fetching active tokens:', error);
        return [];
    }

    return (data as ConsentTokenRecord[]) || [];
}

/**
 * Get consent token by FHIR Consent ID
 * @param consentFhirId - FHIR Consent resource ID
 * @returns Token record or null
 */
export async function getTokenByConsentId(
    consentFhirId: string
): Promise<ConsentTokenRecord | null> {
    const { data, error } = await supabaseAdmin
        .from('consent_tokens')
        .select('*')
        .eq('consent_fhir_id', consentFhirId)
        .maybeSingle();

    if (error) {
        console.error('Error fetching token by consent ID:', error);
        return null;
    }

    return data as ConsentTokenRecord | null;
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Calculate default expiration date (6 months from now)
 */
export function getDefaultExpirationDate(): string {
    const date = new Date();
    date.setMonth(date.getMonth() + DEFAULT_TOKEN_DURATION_MONTHS);
    return date.toISOString();
}

/**
 * Validate purposeOfUse value
 */
export function isValidPurposeOfUse(purpose: string): purpose is PurposeOfUse {
    return ['TREATMENT', 'EMERGENCY', 'INSURANCE', 'RESEARCH'].includes(purpose);
}
