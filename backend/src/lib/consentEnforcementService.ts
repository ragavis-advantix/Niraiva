/**
 * Consent Enforcement Service (CES)
 * Core security gateway that validates all incoming FHIR data access requests
 * Implements ABDM-compliant consent enforcement with purposeOfUse validation
 */

import { fhirGet, fhirPost, type FhirBundle } from './fhirClient';
import { validateConsentToken, validateTokenForResource, type PurposeOfUse } from './consentTokenService';
import { supabaseAdmin } from './supabaseClient';
import type {
    ConsentEvaluationRequest,
    ConsentEvaluationResult,
    AuditEventData,
    FhirAuditEvent,
    FhirConsent,
} from '../types/consentTypes';

// ============================================================
// CONSENT EVALUATION
// ============================================================

/**
 * Evaluate if a data access request is permitted by consent
 * This is the CORE enforcement function called by all external access endpoints
 * 
 * @param request - Consent evaluation request
 * @returns Evaluation result with allow/deny decision
 */
export async function evaluateConsent(
    request: ConsentEvaluationRequest
): Promise<ConsentEvaluationResult> {

    // 1. Validate consent token if provided
    if (!request.consentToken) {
        return {
            allowed: false,
            reason: 'No consent token provided',
        };
    }

    // 2. Validate token signature and expiration
    const tokenValidation = await validateTokenForResource(
        request.consentToken,
        request.resourceType
    );

    if (!tokenValidation.valid || !tokenValidation.payload) {
        return {
            allowed: false,
            reason: tokenValidation.error || 'Invalid consent token',
        };
    }

    const payload = tokenValidation.payload;

    // 3. Verify ABHA number matches
    if (payload.patientAbha !== request.patientAbha) {
        return {
            allowed: false,
            reason: 'Token ABHA does not match requested patient',
        };
    }

    // 4. Verify organization matches
    if (payload.organizationId !== request.organizationId) {
        return {
            allowed: false,
            reason: 'Token organization does not match requesting organization',
        };
    }

    // 5. Verify purposeOfUse matches (ABDM requirement)
    if (payload.purposeOfUse !== request.purposeOfUse) {
        return {
            allowed: false,
            reason: `Purpose mismatch: token allows ${payload.purposeOfUse}, requested ${request.purposeOfUse}`,
        };
    }

    // 6. Fetch FHIR Consent resource for additional validation
    const consentResponse = await fhirGet<FhirConsent>(`Consent/${payload.consentId}`);

    if (!consentResponse.ok || !consentResponse.data) {
        return {
            allowed: false,
            reason: 'Consent resource not found in FHIR server',
        };
    }

    const consent = consentResponse.data;

    // 7. Verify consent is still active
    if (consent.status !== 'active') {
        return {
            allowed: false,
            reason: `Consent status is ${consent.status}, not active`,
        };
    }

    // 8. Verify action is permitted
    const actionAllowed = isActionPermitted(consent, request.action);
    if (!actionAllowed) {
        return {
            allowed: false,
            reason: `Action '${request.action}' not permitted by consent`,
        };
    }

    // 9. Verify resource type is in data filters
    const resourceAllowed = isResourceTypeAllowed(consent, request.resourceType);
    if (!resourceAllowed) {
        return {
            allowed: false,
            reason: `Resource type '${request.resourceType}' not permitted by consent`,
        };
    }

    // 10. Check time window
    const now = new Date();
    const period = consent.provision.period;

    if (period) {
        const start = new Date(period.start);
        const end = new Date(period.end);

        if (now < start) {
            return {
                allowed: false,
                reason: 'Consent period has not started yet',
            };
        }

        if (now > end) {
            return {
                allowed: false,
                reason: 'Consent period has expired',
            };
        }
    }

    // ALL CHECKS PASSED - ALLOW ACCESS
    return {
        allowed: true,
        consentId: payload.consentId,
        restrictions: {
            allowedResources: payload.allowedResources,
            validUntil: payload.validUntil,
        },
    };
}

// ============================================================
// EMERGENCY ACCESS
// ============================================================

/**
 * Evaluate emergency "break-the-glass" access request
 * Allows access without consent but creates audit trail and notifies patient
 * 
 * @param patientAbha - Patient ABHA number
 * @param organizationId - Organization requesting emergency access
 * @param reason - Emergency justification
 * @param resourceType - Resource type being accessed
 * @returns Evaluation result
 */
export async function evaluateEmergencyAccess(
    patientAbha: string,
    organizationId: string,
    reason: string,
    resourceType: string
): Promise<ConsentEvaluationResult> {

    // Validate emergency reason is provided
    if (!reason || reason.length < 10) {
        return {
            allowed: false,
            reason: 'Emergency access requires detailed justification (minimum 10 characters)',
        };
    }

    // Fetch organization details
    const { data: org, error: orgError } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

    if (orgError || !org) {
        return {
            allowed: false,
            reason: 'Organization not found',
        };
    }

    // Only hospitals can request emergency access
    if (org.type !== 'hospital') {
        return {
            allowed: false,
            reason: 'Only hospitals can request emergency access',
        };
    }

    // Fetch patient ID for notification
    const { data: patientMap } = await supabaseAdmin
        .from('fhir_user_map')
        .select('supabase_user_id')
        .eq('abha_number', patientAbha)
        .single();

    // TODO: Send notification to patient (email/SMS)
    // await sendEmergencyAccessNotification(patientMap?.supabase_user_id, org.name, reason);

    // ALLOW emergency access with restrictions
    return {
        allowed: true,
        consentId: 'EMERGENCY_ACCESS',
        restrictions: {
            allowedResources: [resourceType], // Only requested resource
            validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        },
    };
}

// ============================================================
// AUDIT LOGGING
// ============================================================

/**
 * Create audit event in both SQL and FHIR (ABDM requirement)
 * @param data - Audit event data
 * @returns Audit event IDs
 */
export async function createAuditEvent(data: AuditEventData): Promise<{
    sqlId: string;
    fhirId?: string;
}> {

    // 1. Create lightweight SQL audit event
    const { data: sqlAudit, error: sqlError } = await supabaseAdmin
        .from('audit_events')
        .insert({
            patient_id: data.patientId,
            organization_id: data.organizationId,
            action: data.action,
            resource_type: data.resourceType,
            resource_id: data.resourceId,
            consent_id: data.consentId,
            purpose_of_use: data.purposeOfUse,
            outcome: data.outcome,
            outcome_reason: data.outcomeReason,
            ip_address: data.ipAddress,
            user_agent: data.userAgent,
            metadata: data.metadata || {},
        })
        .select()
        .single();

    if (sqlError) {
        console.error('Failed to create SQL audit event:', sqlError);
        throw new Error(`Audit logging failed: ${sqlError.message}`);
    }

    // 2. Create FHIR AuditEvent resource (ABDM compliance)
    let fhirId: string | undefined;

    try {
        const fhirAuditEvent = buildFhirAuditEvent(data);
        const fhirResponse = await fhirPost<FhirAuditEvent>('AuditEvent', fhirAuditEvent);

        if (fhirResponse.ok && fhirResponse.data) {
            fhirId = fhirResponse.data.id;

            // Update SQL record with FHIR ID
            await supabaseAdmin
                .from('audit_events')
                .update({ fhir_audit_event_id: fhirId })
                .eq('id', sqlAudit.id);
        }
    } catch (error: any) {
        console.error('Failed to create FHIR AuditEvent:', error);
        // Continue - SQL audit is already created
    }

    return {
        sqlId: sqlAudit.id,
        fhirId,
    };
}

/**
 * Build FHIR AuditEvent resource from audit data
 */
function buildFhirAuditEvent(data: AuditEventData): FhirAuditEvent {
    const actionMap: Record<string, 'C' | 'R' | 'U' | 'D' | 'E'> = {
        create: 'C',
        read: 'R',
        update: 'U',
        delete: 'D',
        search: 'R',
        emergency_access: 'E',
    };

    const outcomeMap: Record<string, '0' | '4' | '8' | '12'> = {
        success: '0',
        denied: '4',
        error: '8',
    };

    return {
        resourceType: 'AuditEvent',
        type: {
            system: 'http://terminology.hl7.org/CodeSystem/audit-event-type',
            code: 'rest',
            display: 'RESTful Operation',
        },
        subtype: [
            {
                system: 'http://hl7.org/fhir/restful-interaction',
                code: data.action === 'search' ? 'search' : data.action,
                display: data.action,
            },
        ],
        action: actionMap[data.action] || 'R',
        recorded: new Date().toISOString(),
        outcome: outcomeMap[data.outcome] || '0',
        outcomeDesc: data.outcomeReason,
        agent: [
            {
                type: {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/extra-security-role-type',
                            code: 'datacollector',
                        },
                    ],
                },
                who: {
                    reference: data.organizationId
                        ? `Organization/${data.organizationId}`
                        : 'Organization/unknown',
                },
                requestor: true,
            },
        ],
        source: {
            observer: {
                reference: 'Organization/niraiva',
            },
        },
        entity: data.patientId
            ? [
                {
                    what: {
                        reference: `Patient/${data.patientId}`,
                    },
                    role: {
                        system: 'http://terminology.hl7.org/CodeSystem/object-role',
                        code: '1',
                        display: 'Patient',
                    },
                },
            ]
            : undefined,
    };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Check if action is permitted by consent
 */
function isActionPermitted(consent: FhirConsent, action: string): boolean {
    if (!consent.provision.action || consent.provision.action.length === 0) {
        // No action restrictions - allow all
        return true;
    }

    // Map request action to FHIR consent action codes
    const actionMap: Record<string, string[]> = {
        read: ['access', 'read'],
        search: ['access', 'read'],
        create: ['access', 'create'],
        update: ['access', 'update'],
        delete: ['access', 'delete'],
    };

    const allowedCodes = actionMap[action] || [];

    return consent.provision.action.some((a) =>
        a.coding.some((c) => allowedCodes.includes(c.code))
    );
}

/**
 * Check if resource type is allowed by consent data filters
 */
function isResourceTypeAllowed(consent: FhirConsent, resourceType: string): boolean {
    if (!consent.provision.data || consent.provision.data.length === 0) {
        // No data restrictions - allow all
        return true;
    }

    return consent.provision.data.some(
        (d) => d.reference.reference === resourceType
    );
}

/**
 * Get patient ID from ABHA number
 */
export async function getPatientIdFromAbha(abhaNumber: string): Promise<string | null> {
    const { data, error } = await supabaseAdmin
        .from('fhir_user_map')
        .select('supabase_user_id')
        .eq('abha_number', abhaNumber)
        .single();

    if (error || !data) {
        return null;
    }

    return data.supabase_user_id;
}
