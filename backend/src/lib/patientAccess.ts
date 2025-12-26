import type { Request, Response, NextFunction } from "express";
import type { FhirResource, FhirBundle } from "./fhirClient";

/**
 * Extract patient ID from the authenticated user
 * This assumes user.id from Supabase is stored as patientId
 */
export function getPatientIdFromRequest(req: Request): string | null {
    return (req.user as any)?.id || null;
}

/**
 * Check if a FHIR resource belongs to the authenticated patient
 */
export function isResourceOwnedByPatient(
    resource: FhirResource,
    patientId: string
): boolean {
    // If resource is a Patient, check if ID matches
    if (resource.resourceType === "Patient") {
        return resource.id === patientId;
    }

    // For clinical resources, check subject reference
    if (
        [
            "Observation",
            "Condition",
            "MedicationRequest",
            "DiagnosticReport",
            "Encounter",
            "CarePlan",
            "Procedure",
            "Immunization",
        ].includes(resource.resourceType)
    ) {
        const subject = (resource as any).subject;
        if (subject) {
            const subjectRef = typeof subject === "string" ? subject : subject.reference;
            return subjectRef === `Patient/${patientId}` || subjectRef === patientId;
        }
        return false;
    }

    // For DocumentReference, check subject
    if (resource.resourceType === "DocumentReference") {
        const subject = (resource as any).subject;
        if (subject) {
            const subjectRef = typeof subject === "string" ? subject : subject.reference;
            return subjectRef === `Patient/${patientId}` || subjectRef === patientId;
        }
        return false;
    }

    // Allow other resources that might be linked differently
    return true;
}

/**
 * Filter a FHIR Bundle to only include resources owned by the patient
 */
export function filterBundleByPatient(bundle: FhirBundle, patientId: string): FhirBundle {
    if (!bundle.entry || !Array.isArray(bundle.entry)) {
        return bundle;
    }

    const filteredEntries = bundle.entry.filter((entry) => {
        if (!entry.resource) {
            return false;
        }
        return isResourceOwnedByPatient(entry.resource, patientId);
    });

    return {
        ...bundle,
        entry: filteredEntries,
        total: filteredEntries.length,
    };
}

/**
 * Middleware to enforce patient-only access
 */
export const patientAccessControl =
    () => (_req: Request, _res: Response, next: NextFunction) => {
        const patientId = getPatientIdFromRequest(_req);

        if (!patientId) {
            return _res.status(401).json({ error: "Patient ID not found in token" });
        }

        // Store patientId in request for use in route handlers
        (_req as any).patientId = patientId;
        return next();
    };

/**
 * Validate and enforce patient ownership on response
 */
export async function validatePatientOwnership(
    patientId: string,
    resource: FhirResource
): Promise<boolean> {
    return isResourceOwnedByPatient(resource, patientId);
}
