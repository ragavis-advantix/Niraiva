import { fhirPost, type FhirResource, type FhirResponse } from '../fhirClient';
import { supabaseAdmin } from '../supabaseClient';

export interface PatientSyncData {
    userId: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    email?: string;
    mobile?: string;
    gender?: string;
    dob?: string;
    abhaNumber?: string;
}

/**
 * Sync patient profile data from Supabase to FHIR Patient resource
 * Following ABDM ABHA v3 standards
 */
export async function syncPatient(data: PatientSyncData): Promise<FhirResponse<FhirResource>> {
    try {
        // Build FHIR Patient resource
        const patientResource: any = {
            resourceType: 'Patient',
            identifier: [
                {
                    system: 'niraiva-user',
                    value: data.userId,
                },
            ],
        };

        // Add ABHA identifier if present
        if (data.abhaNumber) {
            patientResource.identifier.push({
                system: 'https://healthid.ndhm.gov.in',
                value: data.abhaNumber,
                type: {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/v2-0203',
                            code: 'MR',
                            display: 'Medical Record Number',
                        },
                    ],
                    text: 'ABHA Number',
                },
            });
        }

        // Build name
        const nameParts: string[] = [];
        if (data.firstName) nameParts.push(data.firstName);
        if (data.middleName) nameParts.push(data.middleName);
        if (data.lastName) nameParts.push(data.lastName);

        if (nameParts.length > 0) {
            patientResource.name = [
                {
                    use: 'official',
                    text: nameParts.join(' '),
                    family: data.lastName || undefined,
                    given: [data.firstName, data.middleName].filter(Boolean),
                },
            ];
        } else if (data.email) {
            patientResource.name = [{ text: data.email }];
        }

        // Add telecom
        const telecom: any[] = [];
        if (data.mobile) {
            telecom.push({
                system: 'phone',
                value: data.mobile,
                use: 'mobile',
            });
        }
        if (data.email) {
            telecom.push({
                system: 'email',
                value: data.email,
            });
        }
        if (telecom.length > 0) {
            patientResource.telecom = telecom;
        }

        // Add gender
        if (data.gender) {
            const genderMap: Record<string, string> = {
                male: 'male',
                female: 'female',
                other: 'other',
                unknown: 'unknown',
            };
            patientResource.gender = genderMap[data.gender.toLowerCase()] || 'unknown';
        }

        // Add birth date
        if (data.dob) {
            patientResource.birthDate = data.dob;
        }

        // Check if patient already exists in FHIR
        const { data: mapping } = await supabaseAdmin
            .from('fhir_user_map')
            .select('fhir_patient_id')
            .eq('supabase_user_id', data.userId)
            .maybeSingle();

        let response: FhirResponse<FhirResource>;

        if (mapping?.fhir_patient_id) {
            // Update existing patient
            const { fhirPut } = await import('../fhirClient');
            patientResource.id = mapping.fhir_patient_id;
            response = await fhirPut(`Patient/${mapping.fhir_patient_id}`, patientResource);
        } else {
            // Create new patient
            response = await fhirPost('Patient', patientResource);

            // Store mapping if successful
            if (response.ok && response.data?.id) {
                await supabaseAdmin
                    .from('fhir_user_map')
                    .upsert(
                        {
                            supabase_user_id: data.userId,
                            fhir_patient_id: response.data.id,
                        },
                        { onConflict: 'supabase_user_id' }
                    );
            }
        }

        return response;
    } catch (error) {
        console.error('Error syncing patient to FHIR:', error);
        return {
            status: 500,
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown error syncing patient',
        };
    }
}

/**
 * Get FHIR Patient ID for a Supabase user
 */
export async function getFhirPatientId(userId: string): Promise<string | null> {
    try {
        const { data } = await supabaseAdmin
            .from('fhir_user_map')
            .select('fhir_patient_id')
            .eq('supabase_user_id', userId)
            .maybeSingle();

        return data?.fhir_patient_id || null;
    } catch (error) {
        console.error('Error getting FHIR patient ID:', error);
        return null;
    }
}
