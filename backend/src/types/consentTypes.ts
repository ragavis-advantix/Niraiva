/**
 * Consent Types
 * TypeScript interfaces for consent domain models
 */

import type { PurposeOfUse as PurposeOfUseType } from '../lib/consentTokenService';

// Re-export PurposeOfUse for use in other modules
export type PurposeOfUse = PurposeOfUseType;

// ============================================================
// FHIR CONSENT RESOURCE TYPES
// ============================================================

export interface FhirConsent {
    resourceType: 'Consent';
    id?: string;
    status: 'draft' | 'proposed' | 'active' | 'rejected' | 'inactive' | 'entered-in-error';
    scope: {
        coding: Array<{
            system: string;
            code: string;
            display?: string;
        }>;
    };
    category: Array<{
        coding: Array<{
            system: string;
            code: string;
            display?: string;
        }>;
    }>;
    patient: {
        reference: string;
        display?: string;
    };
    dateTime: string;
    performer?: Array<{
        reference: string;
        display?: string;
    }>;
    organization?: Array<{
        reference: string;
        display?: string;
    }>;
    provision: ConsentProvision;
}

export interface ConsentProvision {
    type: 'deny' | 'permit';
    period?: {
        start: string;
        end: string;
    };
    actor?: Array<{
        role: {
            coding: Array<{
                system: string;
                code: string;
                display?: string;
            }>;
        };
        reference: {
            reference: string;
            display?: string;
        };
    }>;
    action?: Array<{
        coding: Array<{
            system: string;
            code: string;
            display?: string;
        }>;
    }>;
    securityLabel?: Array<{
        system: string;
        code: string;
    }>;
    purpose?: Array<{
        system: string;
        code: string;
        display?: string;
    }>;
    data?: Array<{
        meaning: 'instance' | 'related' | 'dependents' | 'authoredby';
        reference: {
            reference: string;
        };
    }>;
}

// ============================================================
// CONSENT GRANT REQUEST
// ============================================================

export interface ConsentGrantRequest {
    patientId: string;
    patientAbha: string;
    organizationId: string;
    organizationName: string;
    purposeOfUse: PurposeOfUse;
    allowedResources: string[];
    validFrom: string;
    validUntil: string;
    emergencyOverride?: boolean;
    notes?: string;
}

// ============================================================
// CONSENT EVALUATION
// ============================================================

export interface ConsentEvaluationRequest {
    patientAbha: string;
    organizationId: string;
    resourceType: string;
    resourceId?: string;
    action: 'read' | 'search' | 'create' | 'update' | 'delete';
    purposeOfUse: PurposeOfUse;
    consentToken?: string;
}

export interface ConsentEvaluationResult {
    allowed: boolean;
    consentId?: string;
    reason?: string;
    restrictions?: {
        allowedResources: string[];
        validUntil: string;
    };
}

// ============================================================
// AUDIT EVENT DATA
// ============================================================

export interface AuditEventData {
    patientId?: string;
    organizationId?: string;
    action: 'read' | 'search' | 'create' | 'update' | 'delete' | 'emergency_access';
    resourceType?: string;
    resourceId?: string;
    consentId?: string;
    purposeOfUse?: PurposeOfUse;
    outcome: 'success' | 'denied' | 'error';
    outcomeReason?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
}

export interface FhirAuditEvent {
    resourceType: 'AuditEvent';
    id?: string;
    type: {
        system: string;
        code: string;
        display: string;
    };
    subtype?: Array<{
        system: string;
        code: string;
        display: string;
    }>;
    action: 'C' | 'R' | 'U' | 'D' | 'E';
    recorded: string;
    outcome: '0' | '4' | '8' | '12';
    outcomeDesc?: string;
    agent: Array<{
        type?: {
            coding: Array<{
                system: string;
                code: string;
            }>;
        };
        who: {
            reference: string;
        };
        requestor: boolean;
    }>;
    source: {
        observer: {
            reference: string;
        };
    };
    entity?: Array<{
        what: {
            reference: string;
        };
        role?: {
            system: string;
            code: string;
            display: string;
        };
    }>;
    [key: string]: any; // Index signature for FHIR compatibility
}

// ============================================================
// ORGANIZATION TYPES
// ============================================================

export interface Organization {
    id: string;
    fhir_organization_id?: string;
    name: string;
    type: 'hospital' | 'lab' | 'hiu' | 'caregiver' | 'research';
    client_id: string;
    active: boolean;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
}

// ============================================================
// CONSENT LIST ITEM (for patient UI)
// ============================================================

export interface ConsentListItem {
    id: string;
    consentFhirId: string;
    organizationName: string;
    organizationType: string;
    purposeOfUse: PurposeOfUse;
    allowedResources: string[];
    validFrom: string;
    validUntil: string;
    status: 'active' | 'expired' | 'revoked';
    revokedAt?: string;
    revokedReason?: string;
}

// ============================================================
// PENDING ACCESS REQUEST
// ============================================================

export interface PendingAccessRequest {
    id: string;
    organizationId: string;
    organizationName: string;
    requestedAt: string;
    requestedPurpose: PurposeOfUse;
    requestedResources: string[];
    message?: string;
}
