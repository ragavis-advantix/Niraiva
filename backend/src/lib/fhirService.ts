/**
 * FHIR Service Layer
 * Handles all communication with HAPI FHIR server
 * Designed for Patient POV only
 */

import {
    fhirGet,
    fhirPost,
    fhirPut,
    type FhirResource,
    type FhirBundle,
    type FhirResponse,
} from "./fhirClient";

export interface PatientData {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    gender: "male" | "female" | "other" | "unknown";
}

export interface VitalData {
    type: "blood-pressure" | "heart-rate" | "weight" | "temperature" | "blood-glucose";
    value: number | number[];
    unit: string;
    timestamp: string;
    patientId: string;
}

/**
 * Create a FHIR Patient resource from Niraiva user data
 */
export function mapPatientToFhir(data: PatientData): FhirResource {
    return {
        resourceType: "Patient",
        name: [
            {
                family: data.lastName,
                given: [data.firstName],
            },
        ],
        gender: data.gender,
        birthDate: data.dateOfBirth,
        telecom: [
            {
                system: "phone",
                value: data.phone,
            },
            {
                system: "email",
                value: data.email,
            },
        ],
        address: [
            {
                use: "home",
                country: "IN",
            },
        ],
    };
}

/**
 * Create FHIR Observation resource for vital signs
 */
export function mapVitalsToFhir(vital: VitalData): FhirResource {
    const patientRef = `Patient/${vital.patientId}`;
    const timestamp = new Date(vital.timestamp).toISOString();

    // Blood Pressure - Component observation
    if (vital.type === "blood-pressure") {
        const [systolic, diastolic] = vital.value as number[];
        return {
            resourceType: "Observation",
            status: "final",
            category: [
                {
                    coding: [
                        {
                            system: "http://terminology.hl7.org/CodeSystem/observation-category",
                            code: "vital-signs",
                            display: "Vital Signs",
                        },
                    ],
                },
            ],
            code: {
                coding: [
                    {
                        system: "http://loinc.org",
                        code: "85354-9",
                        display: "Blood pressure panel with all children optional",
                    },
                ],
            },
            subject: {
                reference: patientRef,
            },
            effectiveDateTime: timestamp,
            component: [
                {
                    code: {
                        coding: [
                            {
                                system: "http://loinc.org",
                                code: "8480-6",
                                display: "Systolic blood pressure",
                            },
                        ],
                    },
                    valueQuantity: {
                        value: systolic,
                        unit: "mmHg",
                        system: "http://unitsofmeasure.org",
                        code: "mm[Hg]",
                    },
                },
                {
                    code: {
                        coding: [
                            {
                                system: "http://loinc.org",
                                code: "8462-4",
                                display: "Diastolic blood pressure",
                            },
                        ],
                    },
                    valueQuantity: {
                        value: diastolic,
                        unit: "mmHg",
                        system: "http://unitsofmeasure.org",
                        code: "mm[Hg]",
                    },
                },
            ],
        };
    }

    // Heart Rate
    if (vital.type === "heart-rate") {
        return {
            resourceType: "Observation",
            status: "final",
            category: [
                {
                    coding: [
                        {
                            system: "http://terminology.hl7.org/CodeSystem/observation-category",
                            code: "vital-signs",
                        },
                    ],
                },
            ],
            code: {
                coding: [
                    {
                        system: "http://loinc.org",
                        code: "8867-4",
                        display: "Heart rate",
                    },
                ],
            },
            subject: {
                reference: patientRef,
            },
            effectiveDateTime: timestamp,
            valueQuantity: {
                value: vital.value as number,
                unit: "beats/minute",
                system: "http://unitsofmeasure.org",
                code: "/min",
            },
        };
    }

    // Weight
    if (vital.type === "weight") {
        return {
            resourceType: "Observation",
            status: "final",
            category: [
                {
                    coding: [
                        {
                            system: "http://terminology.hl7.org/CodeSystem/observation-category",
                            code: "vital-signs",
                        },
                    ],
                },
            ],
            code: {
                coding: [
                    {
                        system: "http://loinc.org",
                        code: "29463-7",
                        display: "Body weight",
                    },
                ],
            },
            subject: {
                reference: patientRef,
            },
            effectiveDateTime: timestamp,
            valueQuantity: {
                value: vital.value as number,
                unit: "kg",
                system: "http://unitsofmeasure.org",
                code: "kg",
            },
        };
    }

    // Blood Glucose
    if (vital.type === "blood-glucose") {
        return {
            resourceType: "Observation",
            status: "final",
            category: [
                {
                    coding: [
                        {
                            system: "http://terminology.hl7.org/CodeSystem/observation-category",
                            code: "laboratory",
                        },
                    ],
                },
            ],
            code: {
                coding: [
                    {
                        system: "http://loinc.org",
                        code: "2345-7",
                        display: "Glucose [Mass/volume] in Serum or Plasma",
                    },
                ],
            },
            subject: {
                reference: patientRef,
            },
            effectiveDateTime: timestamp,
            valueQuantity: {
                value: vital.value as number,
                unit: "mg/dL",
                system: "http://unitsofmeasure.org",
                code: "mg/dL",
            },
        };
    }

    // Temperature
    if (vital.type === "temperature") {
        return {
            resourceType: "Observation",
            status: "final",
            category: [
                {
                    coding: [
                        {
                            system: "http://terminology.hl7.org/CodeSystem/observation-category",
                            code: "vital-signs",
                        },
                    ],
                },
            ],
            code: {
                coding: [
                    {
                        system: "http://loinc.org",
                        code: "8310-5",
                        display: "Body temperature",
                    },
                ],
            },
            subject: {
                reference: patientRef,
            },
            effectiveDateTime: timestamp,
            valueQuantity: {
                value: vital.value as number,
                unit: "°C",
                system: "http://unitsofmeasure.org",
                code: "Cel",
            },
        };
    }

    throw new Error(`Unknown vital type: ${vital.type}`);
}

/**
 * Create Patient on HAPI FHIR
 */
export async function createPatientFhir(
    data: PatientData
): Promise<FhirResponse<FhirResource>> {
    const fhirPatient = mapPatientToFhir(data);
    return fhirPost("Patient", fhirPatient);
}

/**
 * Get Patient from HAPI FHIR
 */
export async function getPatientFhir(
    patientId: string
): Promise<FhirResponse<FhirResource>> {
    return fhirGet(`Patient/${patientId}`);
}

/**
 * Create Observation (vital) on HAPI FHIR
 */
export async function createVitalFhir(vital: VitalData): Promise<FhirResponse<FhirResource>> {
    const fhirObservation = mapVitalsToFhir(vital);
    return fhirPost("Observation", fhirObservation);
}

/**
 * Get all Observations for a patient
 */
export async function getPatientObservations(
    patientId: string
): Promise<FhirResponse<FhirBundle>> {
    return fhirGet<FhirBundle>("Observation", {
        patient: patientId,
        _sort: "-date",
    });
}

/**
 * Search for observations by code and patient
 */
export async function searchObservations(
    patientId: string,
    code?: string
): Promise<FhirResponse<FhirBundle>> {
    const params: Record<string, string> = {
        patient: patientId,
    };

    if (code) {
        params.code = code;
    }

    return fhirGet<FhirBundle>("Observation", params);
}

/**
 * Update Patient on HAPI FHIR
 */
export async function updatePatientFhir(
    patientId: string,
    data: Partial<PatientData>
): Promise<FhirResponse<FhirResource>> {
    const patient = await getPatientFhir(patientId);

    if (!patient.ok || !patient.data) {
        return {
            status: 404,
            ok: false,
            error: "Patient not found",
        };
    }

    const updated = {
        ...patient.data,
        ...mapPatientToFhir(data as PatientData),
        id: patientId,
    };

    return fhirPut(`Patient/${patientId}`, updated);
}
