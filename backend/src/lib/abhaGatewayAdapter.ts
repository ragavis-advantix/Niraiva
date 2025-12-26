/**
 * ABHA Gateway Adapter
 * Wraps existing ABHA client with additional functionality for consent architecture
 * Handles ABHA session tokens, login/enrollment, and Patient resource mapping
 */

import { requestOtp, enrolByAadhaar, authByAbdm } from './abhaClient';
import { supabaseAdmin } from './supabaseClient';
import { fhirGet, fhirPut, type FhirResource } from './fhirClient';

// ============================================================
// TYPES
// ============================================================

export interface AbhaEnrollmentResult {
    success: boolean;
    abhaNumber?: string;
    abhaAddress?: string;
    abhaProfile?: any;
    error?: string;
}

export interface AbhaLinkResult {
    success: boolean;
    patientFhirId?: string;
    error?: string;
}

// ============================================================
// ABHA ENROLLMENT & LOGIN
// ============================================================

/**
 * Enroll patient via Aadhaar and link to Patient resource
 * @param userId - Supabase user ID
 * @param aadhaar - Aadhaar number (12 digits)
 * @param otp - OTP from Aadhaar
 * @param txnId - Transaction ID from OTP request
 * @param mobile - Optional mobile number
 * @returns Enrollment result with ABHA number
 */
export async function enrollAndLinkAbha(
    userId: string,
    aadhaar: string,
    otp: string,
    txnId: string,
    mobile?: string
): Promise<AbhaEnrollmentResult> {
    try {
        // 1. Enroll via ABHA
        const enrollmentResult = await enrolByAadhaar(
            {
                txnId,
                otp,
                mobile,
                consentCode: 'abha-enrollment',
                consentVersion: '1.4',
            },
            'sbx' // Use sandbox for now
        );

        if (!enrollmentResult || !enrollmentResult.ABHAProfile) {
            return {
                success: false,
                error: 'ABHA enrollment failed: No profile returned',
            };
        }

        const abhaProfile = enrollmentResult.ABHAProfile;
        const abhaNumber = abhaProfile.ABHANumber;
        const abhaAddress = abhaProfile.preferredAbhaAddress || abhaProfile.ABHAAddress;

        // 2. Link ABHA to Patient resource
        const linkResult = await linkAbhaToPatient(userId, abhaNumber, abhaAddress, abhaProfile);

        if (!linkResult.success) {
            return {
                success: false,
                error: linkResult.error,
            };
        }

        return {
            success: true,
            abhaNumber,
            abhaAddress,
            abhaProfile,
        };

    } catch (error: any) {
        console.error('ABHA enrollment error:', error);
        return {
            success: false,
            error: error.message || 'ABHA enrollment failed',
        };
    }
}

/**
 * Link ABHA to existing Patient resource
 * @param userId - Supabase user ID
 * @param abhaNumber - ABHA number from enrollment
 * @param abhaAddress - ABHA address
 * @param abhaProfile - Full ABHA profile data
 * @returns Link result
 */
export async function linkAbhaToPatient(
    userId: string,
    abhaNumber: string,
    abhaAddress: string,
    abhaProfile: any
): Promise<AbhaLinkResult> {
    try {
        // 1. Get patient FHIR ID from mapping
        const { data: patientMap, error: mapError } = await supabaseAdmin
            .from('fhir_user_map')
            .select('fhir_patient_id')
            .eq('supabase_user_id', userId)
            .single();

        if (mapError || !patientMap) {
            return {
                success: false,
                error: 'Patient FHIR mapping not found',
            };
        }

        const patientFhirId = patientMap.fhir_patient_id;

        // 2. Fetch existing Patient resource
        const patientResponse = await fhirGet<FhirResource>(`Patient/${patientFhirId}`);

        if (!patientResponse.ok || !patientResponse.data) {
            return {
                success: false,
                error: 'Failed to fetch Patient resource from HAPI',
            };
        }

        const patient = patientResponse.data as any;

        // 3. Add ABHA identifier to Patient resource
        const abhaIdentifier = {
            system: 'urn:abdm:abha',
            value: abhaNumber,
        };

        // Check if ABHA identifier already exists
        if (!patient.identifier) {
            patient.identifier = [];
        }

        const existingAbhaIndex = patient.identifier.findIndex(
            (id: any) => id.system === 'urn:abdm:abha'
        );

        if (existingAbhaIndex >= 0) {
            // Update existing ABHA identifier
            patient.identifier[existingAbhaIndex] = abhaIdentifier;
        } else {
            // Add new ABHA identifier
            patient.identifier.push(abhaIdentifier);
        }

        // 4. Update Patient resource in HAPI
        const updateResponse = await fhirPut<FhirResource>(
            `Patient/${patientFhirId}`,
            patient
        );

        if (!updateResponse.ok) {
            return {
                success: false,
                error: 'Failed to update Patient resource with ABHA',
            };
        }

        // 5. Update fhir_user_map with ABHA details
        const { error: updateError } = await supabaseAdmin
            .from('fhir_user_map')
            .update({
                abha_number: abhaNumber,
                abha_address: abhaAddress,
                abha_linked_at: new Date().toISOString(),
                abha_status: abhaProfile.abhaStatus || 'ACTIVE',
                abha_metadata: abhaProfile,
            })
            .eq('supabase_user_id', userId);

        if (updateError) {
            console.error('Failed to update fhir_user_map:', updateError);
            // Continue - FHIR update succeeded
        }

        return {
            success: true,
            patientFhirId,
        };

    } catch (error: any) {
        console.error('ABHA link error:', error);
        return {
            success: false,
            error: error.message || 'Failed to link ABHA',
        };
    }
}

// ============================================================
// ABHA VERIFICATION
// ============================================================

/**
 * Verify ABHA number is linked to a patient
 * @param abhaNumber - ABHA number to verify
 * @returns Patient user ID if found
 */
export async function verifyAbhaLinked(abhaNumber: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from('fhir_user_map')
        .select('supabase_user_id')
        .eq('abha_number', abhaNumber)
        .single();

    if (error || !data) {
        return null;
    }

    return data.supabase_user_id;
}

/**
 * Get ABHA details for a patient
 * @param userId - Supabase user ID
 * @returns ABHA details or null
 */
export async function getPatientAbhaDetails(userId: string): Promise<{
    abhaNumber: string;
    abhaAddress: string;
    abhaStatus: string;
    linkedAt: string;
} | null> {
    const { data, error } = await supabaseAdmin
        .from('fhir_user_map')
        .select('abha_number, abha_address, abha_status, abha_linked_at')
        .eq('supabase_user_id', userId)
        .single();

    if (error || !data || !data.abha_number) {
        return null;
    }

    return {
        abhaNumber: data.abha_number,
        abhaAddress: data.abha_address,
        abhaStatus: data.abha_status || 'UNKNOWN',
        linkedAt: data.abha_linked_at,
    };
}

// ============================================================
// ABHA DELINK
// ============================================================

/**
 * Delink ABHA from patient (remove from Patient resource and mapping)
 * @param userId - Supabase user ID
 * @returns Success status
 */
export async function delinkAbha(userId: string): Promise<{
    success: boolean;
    error?: string;
}> {
    try {
        // 1. Get patient FHIR ID
        const { data: patientMap, error: mapError } = await supabaseAdmin
            .from('fhir_user_map')
            .select('fhir_patient_id, abha_number')
            .eq('supabase_user_id', userId)
            .single();

        if (mapError || !patientMap) {
            return { success: false, error: 'Patient mapping not found' };
        }

        const patientFhirId = patientMap.fhir_patient_id;

        // 2. Fetch Patient resource
        const patientResponse = await fhirGet<FhirResource>(`Patient/${patientFhirId}`);

        if (patientResponse.ok && patientResponse.data) {
            const patient = patientResponse.data as any;

            // Remove ABHA identifier
            if (patient.identifier) {
                patient.identifier = patient.identifier.filter(
                    (id: any) => id.system !== 'urn:abdm:abha'
                );
            }

            // Update Patient resource
            await fhirPut<FhirResource>(`Patient/${patientFhirId}`, patient);
        }

        // 3. Clear ABHA fields in mapping
        const { error: updateError } = await supabaseAdmin
            .from('fhir_user_map')
            .update({
                abha_number: null,
                abha_address: null,
                abha_linked_at: null,
                abha_status: null,
                abha_metadata: null,
            })
            .eq('supabase_user_id', userId);

        if (updateError) {
            return { success: false, error: updateError.message };
        }

        return { success: true };

    } catch (error: any) {
        console.error('ABHA delink error:', error);
        return { success: false, error: error.message };
    }
}
