/**
 * Consent Service
 * High-level consent management - creates FHIR Consent resources with data filters
 * Generates consent tokens with purposeOfUse
 */

import { fhirPost, fhirGet, fhirPut, type FhirResponse } from './fhirClient';
import {
    createConsentToken,
    revokeConsentToken,
    getActiveTokensForPatient,
    getDefaultExpirationDate,
    type PurposeOfUse,
} from './consentTokenService';
import { supabaseAdmin } from './supabaseClient';
import type {
    FhirConsent,
    ConsentGrantRequest,
    ConsentListItem,
} from '../types/consentTypes';

// ============================================================
// CONSENT CREATION
// ============================================================

/**
 * Create a FHIR Consent resource with data filters and generate consent token
 * @param request - Consent grant request from patient
 * @returns Consent resource and signed token
 */
export async function grantConsent(request: ConsentGrantRequest): Promise<{
    consent: FhirConsent;
    token: string;
    tokenId: string;
}> {
    // 1. Fetch organization details
    const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .eq('id', request.organizationId)
        .single();

    if (orgError || !org) {
        throw new Error(`Organization not found: ${request.organizationId}`);
    }

    // 2. Fetch patient FHIR ID
    const { data: patientMap, error: mapError } = await supabaseAdmin
        .from('fhir_user_map')
        .select('fhir_patient_id, abha_number')
        .eq('supabase_user_id', request.patientId)
        .single();

    if (mapError || !patientMap) {
        throw new Error(`Patient FHIR mapping not found for user: ${request.patientId}`);
    }

    const patientFhirId = patientMap.fhir_patient_id;
    const abhaNumber = patientMap.abha_number || request.patientAbha;

    // 3. Build FHIR Consent resource with data filters
    const consentResource: FhirConsent = {
        resourceType: 'Consent',
        status: 'active',
        scope: {
            coding: [
                {
                    system: 'http://terminology.hl7.org/CodeSystem/consentscope',
                    code: 'patient-privacy',
                    display: 'Privacy Consent',
                },
            ],
        },
        category: [
            {
                coding: [
                    {
                        system: 'http://loinc.org',
                        code: '57016-8',
                        display: 'Privacy policy acknowledgement Document',
                    },
                ],
            },
        ],
        patient: {
            reference: `Patient/${patientFhirId}`,
            display: `Patient with ABHA: ${abhaNumber}`,
        },
        dateTime: new Date().toISOString(),
        performer: [
            {
                reference: org.fhir_organization_id
                    ? `Organization/${org.fhir_organization_id}`
                    : `Organization/${org.id}`,
                display: org.name,
            },
        ],
        provision: {
            type: 'permit',
            period: {
                start: request.validFrom,
                end: request.validUntil,
            },
            actor: [
                {
                    role: {
                        coding: [
                            {
                                system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                                code: 'IRCP',
                                display: 'information recipient',
                            },
                        ],
                    },
                    reference: {
                        reference: org.fhir_organization_id
                            ? `Organization/${org.fhir_organization_id}`
                            : `Organization/${org.id}`,
                        display: org.name,
                    },
                },
            ],
            action: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/consentaction',
                            code: 'access',
                            display: 'Access',
                        },
                    ],
                },
            ],
            purpose: [
                {
                    system: 'http://terminology.hl7.org/CodeSystem/v3-ActReason',
                    code: request.purposeOfUse,
                    display: getPurposeDisplay(request.purposeOfUse),
                },
            ],
            // CRITICAL: Data filters per resource type (ABDM requirement)
            data: request.allowedResources.map((resourceType) => ({
                meaning: 'instance' as const,
                reference: {
                    reference: resourceType,
                },
            })),
        },
    };

    // 4. Create Consent in HAPI FHIR
    const fhirResponse = await fhirPost<any>('Consent', consentResource as any);

    if (!fhirResponse.ok || !fhirResponse.data) {
        throw new Error(`Failed to create FHIR Consent: ${fhirResponse.error}`);
    }

    const createdConsent = fhirResponse.data;
    const consentId = createdConsent.id!;

    // 5. Generate and store consent token
    const { token, record } = await createConsentToken(
        consentId,
        request.patientId,
        abhaNumber,
        request.organizationId,
        request.purposeOfUse,
        request.allowedResources,
        request.validFrom,
        request.validUntil
    );

    return {
        consent: createdConsent,
        token,
        tokenId: record.id,
    };
}

// ============================================================
// CONSENT REVOCATION
// ============================================================

/**
 * Revoke a consent and update FHIR Consent status
 * @param consentFhirId - FHIR Consent resource ID
 * @param patientId - Patient user ID (for authorization)
 * @param reason - Reason for revocation
 */
export async function revokeConsent(
    consentFhirId: string,
    patientId: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    // 1. Verify patient owns this consent
    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
        .from('consent_tokens')
        .select('patient_id')
        .eq('consent_fhir_id', consentFhirId)
        .single();

    if (tokenError || !tokenRecord) {
        return { success: false, error: 'Consent not found' };
    }

    if (tokenRecord.patient_id !== patientId) {
        return { success: false, error: 'Unauthorized: consent belongs to different patient' };
    }

    // 2. Revoke token in database
    const revokeResult = await revokeConsentToken(consentFhirId, reason);
    if (!revokeResult.success) {
        return revokeResult;
    }

    // 3. Update FHIR Consent status to 'inactive'
    try {
        const consentResponse = await fhirGet<FhirConsent>(`Consent/${consentFhirId}`);
        if (consentResponse.ok && consentResponse.data) {
            const updatedConsent = {
                ...consentResponse.data,
                status: 'inactive' as const,
            };
            await fhirPut<FhirConsent>(`Consent/${consentFhirId}`, updatedConsent);
        }
    } catch (error: any) {
        console.error('Failed to update FHIR Consent status:', error);
        // Continue even if FHIR update fails - token is already revoked
    }

    return { success: true };
}

// ============================================================
// CONSENT QUERIES
// ============================================================

/**
 * Get all consents for a patient (for UI display)
 * @param patientId - Patient user ID
 * @returns List of consent items with status
 */
export async function getPatientConsents(patientId: string): Promise<ConsentListItem[]> {
    const { data: tokens, error } = await supabaseAdmin
        .from('consent_tokens')
        .select(`
            id,
            consent_fhir_id,
            purpose_of_use,
            allowed_resources,
            issued_at,
            expires_at,
            revoked,
            revoked_at,
            revoked_reason,
            organizations (
                name,
                type
            )
        `)
        .eq('patient_id', patientId)
        .order('issued_at', { ascending: false });

    if (error) {
        console.error('Error fetching patient consents:', error);
        return [];
    }

    return tokens.map((token: any) => {
        const now = new Date();
        const expiresAt = new Date(token.expires_at);

        let status: 'active' | 'expired' | 'revoked' = 'active';
        if (token.revoked) {
            status = 'revoked';
        } else if (expiresAt < now) {
            status = 'expired';
        }

        return {
            id: token.id,
            consentFhirId: token.consent_fhir_id,
            organizationName: token.organizations?.name || 'Unknown',
            organizationType: token.organizations?.type || 'unknown',
            purposeOfUse: token.purpose_of_use,
            allowedResources: token.allowed_resources,
            validFrom: token.issued_at,
            validUntil: token.expires_at,
            status,
            revokedAt: token.revoked_at,
            revokedReason: token.revoked_reason,
        };
    });
}

/**
 * Get active consents for a patient-organization pair
 * @param patientId - Patient user ID
 * @param organizationId - Organization UUID
 * @returns Array of active consent tokens
 */
export async function getActiveConsentsForOrganization(
    patientId: string,
    organizationId: string
): Promise<any[]> {
    const { data, error } = await supabaseAdmin
        .from('consent_tokens')
        .select('*')
        .eq('patient_id', patientId)
        .eq('organization_id', organizationId)
        .eq('revoked', false)
        .gte('expires_at', new Date().toISOString());

    if (error) {
        console.error('Error fetching active consents:', error);
        return [];
    }

    return data || [];
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function getPurposeDisplay(purpose: PurposeOfUse): string {
    const displays: Record<PurposeOfUse, string> = {
        TREATMENT: 'Treatment and Clinical Care',
        EMERGENCY: 'Emergency Medical Situation',
        INSURANCE: 'Insurance Claim and Verification',
        RESEARCH: 'Medical Research (De-identified)',
    };
    return displays[purpose] || purpose;
}

/**
 * Validate consent grant request
 */
export function validateConsentRequest(request: ConsentGrantRequest): {
    valid: boolean;
    errors: string[];
} {
    const errors: string[] = [];

    if (!request.patientId) errors.push('Patient ID is required');
    if (!request.organizationId) errors.push('Organization ID is required');
    if (!request.purposeOfUse) errors.push('Purpose of use is required');
    if (!request.allowedResources || request.allowedResources.length === 0) {
        errors.push('At least one resource type must be allowed');
    }

    const validFrom = new Date(request.validFrom);
    const validUntil = new Date(request.validUntil);
    const now = new Date();

    if (validFrom > validUntil) {
        errors.push('Valid from date must be before valid until date');
    }
    if (validUntil <= now) {
        errors.push('Valid until date must be in the future');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
