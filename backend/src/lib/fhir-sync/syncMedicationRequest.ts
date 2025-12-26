import { fhirPost, type FhirResource, type FhirResponse } from '../fhirClient';
import { getFhirPatientId } from './syncPatient';

export interface MedicationData {
    userId: string;
    medicationName: string;
    dosage?: string;
    frequency?: string;
    route?: string;
    status?: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'stopped';
    intent?: 'proposal' | 'plan' | 'order' | 'original-order' | 'reflex-order';
    authoredOn?: string;
    reasonCode?: string;
    reasonDisplay?: string;
    notes?: string;
}

/**
 * Sync medication prescription to FHIR MedicationRequest resource
 */
export async function syncMedicationRequest(
    data: MedicationData
): Promise<FhirResponse<FhirResource>> {
    try {
        const fhirPatientId = await getFhirPatientId(data.userId);
        if (!fhirPatientId) {
            return {
                status: 400,
                ok: false,
                error: 'Patient not found in FHIR. Please sync patient profile first.',
            };
        }

        const medicationRequest: any = {
            resourceType: 'MedicationRequest',
            status: data.status || 'active',
            intent: data.intent || 'order',
            medicationCodeableConcept: {
                text: data.medicationName,
            },
            subject: {
                reference: `Patient/${fhirPatientId}`,
            },
            authoredOn: data.authoredOn || new Date().toISOString(),
        };

        // Add dosage instructions
        if (data.dosage || data.frequency || data.route) {
            medicationRequest.dosageInstruction = [
                {
                    text: [data.dosage, data.frequency, data.route].filter(Boolean).join(', '),
                },
            ];

            if (data.route) {
                medicationRequest.dosageInstruction[0].route = {
                    text: data.route,
                };
            }

            if (data.frequency) {
                medicationRequest.dosageInstruction[0].timing = {
                    code: {
                        text: data.frequency,
                    },
                };
            }
        }

        // Add reason
        if (data.reasonCode || data.reasonDisplay) {
            medicationRequest.reasonCode = [
                {
                    text: data.reasonDisplay || data.reasonCode,
                },
            ];
        }

        // Add notes
        if (data.notes) {
            medicationRequest.note = [
                {
                    text: data.notes,
                },
            ];
        }

        const response = await fhirPost<FhirResource>('MedicationRequest', medicationRequest);

        return response;
    } catch (error) {
        console.error('Error syncing medication request to FHIR:', error);
        return {
            status: 500,
            ok: false,
            error:
                error instanceof Error ? error.message : 'Unknown error syncing medication request',
        };
    }
}
