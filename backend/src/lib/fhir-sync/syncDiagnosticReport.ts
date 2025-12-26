import { fhirPost, type FhirResource, type FhirResponse } from '../fhirClient';
import { getFhirPatientId } from './syncPatient';

export interface DiagnosticReportData {
    userId: string;
    code?: string;
    display?: string;
    status?: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'cancelled';
    category?: string;
    effectiveDateTime?: string;
    issuedDateTime?: string;
    conclusion?: string;
    results?: Array<{
        code: string;
        display: string;
        value: string | number;
        unit?: string;
        interpretation?: 'normal' | 'high' | 'low';
    }>;
}

/**
 * Sync lab results to FHIR DiagnosticReport resource
 */
export async function syncDiagnosticReport(
    data: DiagnosticReportData
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

        const diagnosticReport: any = {
            resourceType: 'DiagnosticReport',
            status: data.status || 'final',
            subject: {
                reference: `Patient/${fhirPatientId}`,
            },
            effectiveDateTime: data.effectiveDateTime || new Date().toISOString(),
            issued: data.issuedDateTime || new Date().toISOString(),
        };

        // Add category
        if (data.category) {
            diagnosticReport.category = [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/v2-0074',
                            code: 'LAB',
                            display: 'Laboratory',
                        },
                    ],
                    text: data.category,
                },
            ];
        }

        // Add code
        if (data.code || data.display) {
            diagnosticReport.code = {
                text: data.display || data.code,
            };
            if (data.code) {
                diagnosticReport.code.coding = [
                    {
                        code: data.code,
                        display: data.display,
                    },
                ];
            }
        }

        // Add conclusion
        if (data.conclusion) {
            diagnosticReport.conclusion = data.conclusion;
        }

        // Create Observation resources for results and link them
        if (data.results && data.results.length > 0) {
            const resultReferences: any[] = [];

            for (const result of data.results) {
                const observation: any = {
                    resourceType: 'Observation',
                    status: 'final',
                    code: {
                        coding: [
                            {
                                code: result.code,
                                display: result.display,
                            },
                        ],
                        text: result.display,
                    },
                    subject: {
                        reference: `Patient/${fhirPatientId}`,
                    },
                    effectiveDateTime: data.effectiveDateTime || new Date().toISOString(),
                    valueQuantity: {
                        value: typeof result.value === 'string' ? parseFloat(result.value) : result.value,
                        unit: result.unit,
                    },
                };

                // Add interpretation
                if (result.interpretation) {
                    observation.interpretation = [
                        {
                            coding: [
                                {
                                    system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                                    code: result.interpretation === 'normal' ? 'N' : result.interpretation === 'high' ? 'H' : 'L',
                                    display: result.interpretation.charAt(0).toUpperCase() + result.interpretation.slice(1),
                                },
                            ],
                        },
                    ];
                }

                // Post observation
                const obsResponse = await fhirPost<FhirResource>('Observation', observation);
                if (obsResponse.ok && (obsResponse.data as any)?.id) {
                    resultReferences.push({
                        reference: `Observation/${(obsResponse.data as any).id}`,
                    });
                }
            }

            if (resultReferences.length > 0) {
                diagnosticReport.result = resultReferences;
            }
        }

        const response = await fhirPost<FhirResource>('DiagnosticReport', diagnosticReport);

        return response;
    } catch (error) {
        console.error('Error syncing diagnostic report to FHIR:', error);
        return {
            status: 500,
            ok: false,
            error:
                error instanceof Error ? error.message : 'Unknown error syncing diagnostic report',
        };
    }
}
