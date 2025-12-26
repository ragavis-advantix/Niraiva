import { fhirPost, type FhirResource, type FhirResponse } from '../fhirClient';
import { getFhirPatientId } from './syncPatient';

export interface VitalSign {
    type: 'blood_pressure' | 'heart_rate' | 'weight' | 'height' | 'temperature' | 'spo2';
    value: string | number;
    unit?: string;
    timestamp?: string;
    systolic?: number;
    diastolic?: number;
}

/**
 * LOINC codes for vital signs
 * Following FHIR R4 Vital Signs profile
 */
const LOINC_CODES: Record<string, { code: string; display: string; unit: string }> = {
    blood_pressure: {
        code: '85354-9',
        display: 'Blood Pressure',
        unit: 'mm[Hg]',
    },
    heart_rate: {
        code: '8867-4',
        display: 'Heart Rate',
        unit: '/min',
    },
    weight: {
        code: '29463-7',
        display: 'Body Weight',
        unit: 'kg',
    },
    height: {
        code: '8302-2',
        display: 'Body Height',
        unit: 'cm',
    },
    temperature: {
        code: '8310-5',
        display: 'Body Temperature',
        unit: 'Cel',
    },
    spo2: {
        code: '2708-6',
        display: 'Oxygen Saturation',
        unit: '%',
    },
};

/**
 * Sync vital signs to FHIR Observation resource
 */
export async function syncObservation(
    userId: string,
    vital: VitalSign
): Promise<FhirResponse<FhirResource>> {
    try {
        // Get FHIR Patient ID
        const fhirPatientId = await getFhirPatientId(userId);
        if (!fhirPatientId) {
            return {
                status: 400,
                ok: false,
                error: 'Patient not found in FHIR. Please sync patient profile first.',
            };
        }

        const loincInfo = LOINC_CODES[vital.type];
        if (!loincInfo) {
            return {
                status: 400,
                ok: false,
                error: `Unknown vital sign type: ${vital.type}`,
            };
        }

        // Build FHIR Observation resource
        const observation: any = {
            resourceType: 'Observation',
            status: 'final',
            category: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                            code: 'vital-signs',
                            display: 'Vital Signs',
                        },
                    ],
                },
            ],
            code: {
                coding: [
                    {
                        system: 'http://loinc.org',
                        code: loincInfo.code,
                        display: loincInfo.display,
                    },
                ],
                text: loincInfo.display,
            },
            subject: {
                reference: `Patient/${fhirPatientId}`,
            },
            effectiveDateTime: vital.timestamp || new Date().toISOString(),
        };

        // Handle blood pressure specially (has components)
        if (vital.type === 'blood_pressure' && vital.systolic && vital.diastolic) {
            observation.component = [
                {
                    code: {
                        coding: [
                            {
                                system: 'http://loinc.org',
                                code: '8480-6',
                                display: 'Systolic Blood Pressure',
                            },
                        ],
                    },
                    valueQuantity: {
                        value: vital.systolic,
                        unit: 'mm[Hg]',
                        system: 'http://unitsofmeasure.org',
                        code: 'mm[Hg]',
                    },
                },
                {
                    code: {
                        coding: [
                            {
                                system: 'http://loinc.org',
                                code: '8462-4',
                                display: 'Diastolic Blood Pressure',
                            },
                        ],
                    },
                    valueQuantity: {
                        value: vital.diastolic,
                        unit: 'mm[Hg]',
                        system: 'http://unitsofmeasure.org',
                        code: 'mm[Hg]',
                    },
                },
            ];
        } else {
            // Single value observation
            observation.valueQuantity = {
                value: typeof vital.value === 'string' ? parseFloat(vital.value) : vital.value,
                unit: vital.unit || loincInfo.unit,
                system: 'http://unitsofmeasure.org',
                code: vital.unit || loincInfo.unit,
            };
        }

        // Post to FHIR server
        const response = await fhirPost<FhirResource>('Observation', observation);

        return response;
    } catch (error) {
        console.error('Error syncing observation to FHIR:', error);
        return {
            status: 500,
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown error syncing observation',
        };
    }
}

/**
 * Sync multiple vitals at once
 */
export async function syncMultipleObservations(
    userId: string,
    vitals: VitalSign[]
): Promise<{ success: number; failed: number; results: FhirResponse<FhirResource>[] }> {
    const results = await Promise.all(vitals.map((vital) => syncObservation(userId, vital)));

    const success = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return { success, failed, results };
}
