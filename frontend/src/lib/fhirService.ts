import { useAuthContext } from "@/contexts/AuthContext";
import type {
    Patient,
    Observation,
    Condition,
    MedicationRequest,
    DiagnosticReport,
    DocumentReference,
    Encounter,
    Bundle,
} from "@/types/fhir";

import { getApiBaseUrl } from "./fhir";

const API_BASE = getApiBaseUrl() + "/fhir";

interface ApiResponse<T> {
    ok: boolean;
    status: number;
    data?: T;
    error?: string;
}

async function apiCall<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: unknown,
    token?: string
): Promise<ApiResponse<T>> {
    try {
        const options: RequestInit = {
            method,
            headers: {
                "Content-Type": "application/fhir+json",
                Accept: "application/fhir+json",
                credentials: "include",
            } as Record<string, string>,
        };

        if (token) {
            options.headers.Authorization = `Bearer ${token}`;
        }

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const data = await response.json();

        return {
            ok: response.ok,
            status: response.status,
            data: response.ok ? (data as T) : undefined,
            error: !response.ok ? data?.issue?.[0]?.diagnostics || "Unknown error" : undefined,
        };
    } catch (error) {
        return {
            ok: false,
            status: 0,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}

// ============= PATIENT SERVICE =============

export const PatientService = {
    /**
     * Get the authenticated patient's profile
     */
    async getProfile(patientId: string, token: string): Promise<ApiResponse<Patient>> {
        return apiCall<Patient>(`/Patient/${patientId}`, "GET", undefined, token);
    },

    /**
     * Update the patient's profile
     */
    async updateProfile(
        patientId: string,
        updates: Partial<Patient>,
        token: string
    ): Promise<ApiResponse<Patient>> {
        const patient: Patient = {
            resourceType: "Patient",
            id: patientId,
            ...updates,
        };
        return apiCall<Patient>(`/Patient/${patientId}`, "PUT", patient, token);
    },

    /**
     * Create a new patient (admin/testing only)
     */
    async create(patientData: Omit<Patient, "id">, token: string): Promise<ApiResponse<Patient>> {
        return apiCall<Patient>("/Patient", "POST", patientData, token);
    },
};

// ============= OBSERVATION SERVICE =============

export const ObservationService = {
    /**
     * Get all observations for the patient (vitals, lab results, etc.)
     */
    async getAll(
        patientId: string,
        token: string,
        filters?: Record<string, string>
    ): Promise<ApiResponse<Bundle>> {
        const params = new URLSearchParams({
            subject: `Patient/${patientId}`,
            ...filters,
        });
        return apiCall<Bundle>(`/Observation?${params.toString()}`, "GET", undefined, token);
    },

    /**
     * Get a specific observation
     */
    async getById(observationId: string, token: string): Promise<ApiResponse<Observation>> {
        return apiCall<Observation>(`/Observation/${observationId}`, "GET", undefined, token);
    },

    /**
     * Create an observation (vital signs, measurements, etc.)
     */
    async create(
        patientId: string,
        observationData: Omit<Observation, "id" | "resourceType">,
        token: string
    ): Promise<ApiResponse<Observation>> {
        const observation: Observation = {
            resourceType: "Observation",
            ...observationData,
            subject: {
                reference: `Patient/${patientId}`,
            },
        };
        return apiCall<Observation>("/Observation", "POST", observation, token);
    },

    /**
     * Create blood pressure observation
     */
    async recordBloodPressure(
        patientId: string,
        systolic: number,
        diastolic: number,
        token: string
    ): Promise<ApiResponse<Observation>> {
        return this.create(
            patientId,
            {
                status: "final",
                code: {
                    coding: [
                        {
                            system: "http://loinc.org",
                            code: "85354-9",
                            display: "Blood Pressure",
                        },
                    ],
                    text: "Blood Pressure",
                },
                effectiveDateTime: new Date().toISOString(),
                component: [
                    {
                        code: {
                            coding: [
                                {
                                    system: "http://loinc.org",
                                    code: "8480-6",
                                    display: "Systolic Blood Pressure",
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
                                    display: "Diastolic Blood Pressure",
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
            },
            token
        );
    },

    /**
     * Record blood glucose observation
     */
    async recordBloodGlucose(
        patientId: string,
        value: number,
        token: string,
        unit: string = "mg/dL"
    ): Promise<ApiResponse<Observation>> {
        return this.create(
            patientId,
            {
                status: "final",
                code: {
                    coding: [
                        {
                            system: "http://loinc.org",
                            code: "2345-7",
                            display: "Glucose",
                        },
                    ],
                    text: "Blood Glucose",
                },
                effectiveDateTime: new Date().toISOString(),
                valueQuantity: {
                    value,
                    unit,
                    system: "http://unitsofmeasure.org",
                    code: unit === "mg/dL" ? "mg/dL" : "mmol/L",
                },
            },
            token
        );
    },
};

// ============= CONDITION SERVICE =============

export const ConditionService = {
    /**
     * Get all conditions for the patient
     */
    async getAll(patientId: string, token: string): Promise<ApiResponse<Bundle>> {
        const params = new URLSearchParams({ subject: `Patient/${patientId}` });
        return apiCall<Bundle>(`/Condition?${params.toString()}`, "GET", undefined, token);
    },

    /**
     * Get a specific condition
     */
    async getById(conditionId: string, token: string): Promise<ApiResponse<Condition>> {
        return apiCall<Condition>(`/Condition/${conditionId}`, "GET", undefined, token);
    },

    /**
     * Create a condition (diagnosis)
     */
    async create(
        patientId: string,
        conditionData: Omit<Condition, "id" | "resourceType" | "subject">,
        token: string
    ): Promise<ApiResponse<Condition>> {
        const condition: Condition = {
            resourceType: "Condition",
            ...conditionData,
            subject: {
                reference: `Patient/${patientId}`,
            },
        };
        return apiCall<Condition>("/Condition", "POST", condition, token);
    },
};

// ============= MEDICATION REQUEST SERVICE =============

export const MedicationRequestService = {
    /**
     * Get all medication requests for the patient
     */
    async getAll(patientId: string, token: string): Promise<ApiResponse<Bundle>> {
        const params = new URLSearchParams({ subject: `Patient/${patientId}` });
        return apiCall<Bundle>(`/MedicationRequest?${params.toString()}`, "GET", undefined, token);
    },

    /**
     * Get a specific medication request
     */
    async getById(medReqId: string, token: string): Promise<ApiResponse<MedicationRequest>> {
        return apiCall<MedicationRequest>(`/MedicationRequest/${medReqId}`, "GET", undefined, token);
    },

    /**
     * Create a medication request
     */
    async create(
        patientId: string,
        medData: Omit<MedicationRequest, "id" | "resourceType" | "subject">,
        token: string
    ): Promise<ApiResponse<MedicationRequest>> {
        const medicationRequest: MedicationRequest = {
            resourceType: "MedicationRequest",
            ...medData,
            subject: {
                reference: `Patient/${patientId}`,
            },
        };
        return apiCall<MedicationRequest>("/MedicationRequest", "POST", medicationRequest, token);
    },
};

// ============= DIAGNOSTIC REPORT SERVICE =============

export const DiagnosticReportService = {
    /**
     * Get all diagnostic reports for the patient
     */
    async getAll(patientId: string, token: string): Promise<ApiResponse<Bundle>> {
        const params = new URLSearchParams({ subject: `Patient/${patientId}` });
        return apiCall<Bundle>(`/DiagnosticReport?${params.toString()}`, "GET", undefined, token);
    },

    /**
     * Get a specific diagnostic report
     */
    async getById(reportId: string, token: string): Promise<ApiResponse<DiagnosticReport>> {
        return apiCall<DiagnosticReport>(`/DiagnosticReport/${reportId}`, "GET", undefined, token);
    },

    /**
     * Create a diagnostic report
     */
    async create(
        patientId: string,
        reportData: Omit<DiagnosticReport, "id" | "resourceType" | "subject">,
        token: string
    ): Promise<ApiResponse<DiagnosticReport>> {
        const report: DiagnosticReport = {
            resourceType: "DiagnosticReport",
            ...reportData,
            subject: {
                reference: `Patient/${patientId}`,
            },
        };
        return apiCall<DiagnosticReport>("/DiagnosticReport", "POST", report, token);
    },
};

// ============= DOCUMENT REFERENCE SERVICE =============

export const DocumentReferenceService = {
    /**
     * Get all documents for the patient
     */
    async getAll(patientId: string, token: string): Promise<ApiResponse<Bundle>> {
        const params = new URLSearchParams({ subject: `Patient/${patientId}` });
        return apiCall<Bundle>(`/DocumentReference?${params.toString()}`, "GET", undefined, token);
    },

    /**
     * Get a specific document
     */
    async getById(docId: string, token: string): Promise<ApiResponse<DocumentReference>> {
        return apiCall<DocumentReference>(`/DocumentReference/${docId}`, "GET", undefined, token);
    },

    /**
     * Create a document reference (for linking uploaded files)
     */
    async create(
        patientId: string,
        docData: Omit<DocumentReference, "id" | "resourceType" | "subject">,
        token: string
    ): Promise<ApiResponse<DocumentReference>> {
        const docRef: DocumentReference = {
            resourceType: "DocumentReference",
            ...docData,
            subject: {
                reference: `Patient/${patientId}`,
            },
        };
        return apiCall<DocumentReference>("/DocumentReference", "POST", docRef, token);
    },

    /**
     * Upload a medical file (PDF, image, etc.)
     * Returns the Binary resource ID for use in DocumentReference
     */
    async uploadFile(
        patientId: string,
        file: File,
        title: string,
        token: string
    ): Promise<ApiResponse<DocumentReference>> {
        const reader = new FileReader();

        return new Promise((resolve) => {
            reader.onload = async () => {
                const base64Data = (reader.result as string).split(",")[1];

                const binaryResponse = await apiCall("/Binary", "POST", {
                    resourceType: "Binary",
                    contentType: file.type || "application/octet-stream",
                    data: base64Data,
                }, token);

                if (binaryResponse.ok) {
                    const binaryId = (binaryResponse.data as any)?.id;

                    const docRef: DocumentReference = {
                        resourceType: "DocumentReference",
                        status: "current",
                        subject: {
                            reference: `Patient/${patientId}`,
                        },
                        date: new Date().toISOString(),
                        content: [
                            {
                                attachment: {
                                    contentType: file.type || "application/octet-stream",
                                    url: `Binary/${binaryId}`,
                                    title: title || file.name,
                                    size: file.size,
                                    creation: new Date().toISOString(),
                                },
                            },
                        ],
                    };

                    const docResponse = await apiCall<DocumentReference>(
                        "/DocumentReference",
                        "POST",
                        docRef,
                        token
                    );
                    resolve(docResponse);
                } else {
                    resolve(binaryResponse as any);
                }
            };

            reader.readAsDataURL(file);
        });
    },
};

// ============= ENCOUNTER SERVICE =============

export const EncounterService = {
    /**
     * Get all encounters for the patient
     */
    async getAll(patientId: string, token: string): Promise<ApiResponse<Bundle>> {
        const params = new URLSearchParams({ subject: `Patient/${patientId}` });
        return apiCall<Bundle>(`/Encounter?${params.toString()}`, "GET", undefined, token);
    },

    /**
     * Get a specific encounter
     */
    async getById(encounterId: string, token: string): Promise<ApiResponse<Encounter>> {
        return apiCall<Encounter>(`/Encounter/${encounterId}`, "GET", undefined, token);
    },

    /**
     * Create an encounter (visit log)
     */
    async create(
        patientId: string,
        encounterData: Omit<Encounter, "id" | "resourceType" | "subject">,
        token: string
    ): Promise<ApiResponse<Encounter>> {
        const encounter: Encounter = {
            resourceType: "Encounter",
            ...encounterData,
            subject: {
                reference: `Patient/${patientId}`,
            },
        };
        return apiCall<Encounter>("/Encounter", "POST", encounter, token);
    },
};
