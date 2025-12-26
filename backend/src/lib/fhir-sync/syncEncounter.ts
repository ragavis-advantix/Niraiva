import { fhirPost, type FhirResource, type FhirResponse } from '../fhirClient';
import { getFhirPatientId } from './syncPatient';

export interface EncounterData {
    userId: string;
    type?: string;
    status?: 'planned' | 'arrived' | 'in-progress' | 'finished' | 'cancelled';
    startDate?: string;
    endDate?: string;
    reasonCode?: string;
    reasonDisplay?: string;
    notes?: string;
}

/**
 * Sync consultation/encounter to FHIR Encounter resource
 */
export async function syncEncounter(data: EncounterData): Promise<FhirResponse<FhirResource>> {
    try {
        const fhirPatientId = await getFhirPatientId(data.userId);
        if (!fhirPatientId) {
            return {
                status: 400,
                ok: false,
                error: 'Patient not found in FHIR. Please sync patient profile first.',
            };
        }

        const encounter: any = {
            resourceType: 'Encounter',
            status: data.status || 'finished',
            class: {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
                code: 'AMB',
                display: 'ambulatory',
            },
            subject: {
                reference: `Patient/${fhirPatientId}`,
            },
        };

        // Add type if provided
        if (data.type) {
            encounter.type = [
                {
                    text: data.type,
                },
            ];
        }

        // Add period
        if (data.startDate || data.endDate) {
            encounter.period = {};
            if (data.startDate) encounter.period.start = data.startDate;
            if (data.endDate) encounter.period.end = data.endDate;
        }

        // Add reason for visit
        if (data.reasonCode || data.reasonDisplay) {
            encounter.reasonCode = [
                {
                    text: data.reasonDisplay || data.reasonCode,
                },
            ];
        }

        const response = await fhirPost<FhirResource>('Encounter', encounter);

        return response;
    } catch (error) {
        console.error('Error syncing encounter to FHIR:', error);
        return {
            status: 500,
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown error syncing encounter',
        };
    }
}
