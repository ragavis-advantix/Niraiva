import { fhirPost, type FhirResource, type FhirResponse } from '../fhirClient';
import { getFhirPatientId } from './syncPatient';

export interface ConditionData {
    userId: string;
    code?: string;
    display?: string;
    clinicalStatus?: 'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved';
    verificationStatus?: 'unconfirmed' | 'provisional' | 'differential' | 'confirmed' | 'refuted';
    severity?: 'mild' | 'moderate' | 'severe';
    onsetDateTime?: string;
    abatementDateTime?: string;
    notes?: string;
}

/**
 * Sync diagnosis/condition to FHIR Condition resource
 */
export async function syncCondition(data: ConditionData): Promise<FhirResponse<FhirResource>> {
    try {
        const fhirPatientId = await getFhirPatientId(data.userId);
        if (!fhirPatientId) {
            return {
                status: 400,
                ok: false,
                error: 'Patient not found in FHIR. Please sync patient profile first.',
            };
        }

        const condition: any = {
            resourceType: 'Condition',
            clinicalStatus: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                        code: data.clinicalStatus || 'active',
                    },
                ],
            },
            verificationStatus: {
                coding: [
                    {
                        system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
                        code: data.verificationStatus || 'confirmed',
                    },
                ],
            },
            subject: {
                reference: `Patient/${fhirPatientId}`,
            },
        };

        // Add condition code
        if (data.code || data.display) {
            condition.code = {
                text: data.display || data.code,
            };
            if (data.code) {
                condition.code.coding = [
                    {
                        code: data.code,
                        display: data.display,
                    },
                ];
            }
        }

        // Add severity
        if (data.severity) {
            condition.severity = {
                coding: [
                    {
                        system: 'http://snomed.info/sct',
                        code:
                            data.severity === 'mild'
                                ? '255604002'
                                : data.severity === 'moderate'
                                    ? '6736007'
                                    : '24484000',
                        display: data.severity.charAt(0).toUpperCase() + data.severity.slice(1),
                    },
                ],
            };
        }

        // Add onset
        if (data.onsetDateTime) {
            condition.onsetDateTime = data.onsetDateTime;
        }

        // Add abatement
        if (data.abatementDateTime) {
            condition.abatementDateTime = data.abatementDateTime;
        }

        // Add notes
        if (data.notes) {
            condition.note = [
                {
                    text: data.notes,
                },
            ];
        }

        const response = await fhirPost<FhirResource>('Condition', condition);

        return response;
    } catch (error) {
        console.error('Error syncing condition to FHIR:', error);
        return {
            status: 500,
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown error syncing condition',
        };
    }
}
