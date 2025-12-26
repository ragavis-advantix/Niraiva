/**
 * External Access Routes
 * Hospital/lab/HIU data access endpoints with consent enforcement
 * All endpoints call CES before returning data
 */

import { Router, type Request, type Response } from 'express';
import { evaluateConsent, evaluateEmergencyAccess, createAuditEvent, getPatientIdFromAbha } from '../lib/consentEnforcementService';
import { fhirGet, type FhirBundle } from '../lib/fhirClient';
import { supabaseAdmin } from '../lib/supabaseClient';
import type { ConsentEvaluationRequest, AuditEventData, PurposeOfUse } from '../types/consentTypes';

const router = Router();

// ============================================================
// MIDDLEWARE: ORGANIZATION AUTHENTICATION
// ============================================================

/**
 * Verify organization client credentials
 */
async function authenticateOrganization(req: Request, res: Response, next: Function) {
    const clientId = req.headers['x-client-id'] as string;
    const clientSecret = req.headers['x-client-secret'] as string;

    if (!clientId) {
        return res.status(401).json({ error: 'Missing X-Client-ID header' });
    }

    // Fetch organization
    const { data: org, error } = await supabaseAdmin
        .from('organizations')
        .select('*')
        .eq('client_id', clientId)
        .eq('active', true)
        .single();

    if (error || !org) {
        return res.status(401).json({ error: 'Invalid client credentials' });
    }

    // TODO: Verify client_secret_hash with bcrypt
    // For now, skip secret validation in development
    // const bcrypt = require('bcrypt');
    // const valid = await bcrypt.compare(clientSecret, org.client_secret_hash);
    // if (!valid) return res.status(401).json({ error: 'Invalid client secret' });

    // Attach organization to request
    (req as any).organization = org;
    next();
}

router.use(authenticateOrganization);

// ============================================================
// PATIENT DATA ACCESS
// ============================================================

/**
 * GET /api/external/patient/:abhaNumber
 * Get patient data by ABHA (requires consent token)
 * 
 * Headers:
 * - X-Client-ID: Organization client ID
 * - X-Client-Secret: Organization client secret
 * - Authorization: Bearer <consent-token>
 * - X-Purpose-Of-Use: TREATMENT | EMERGENCY | INSURANCE | RESEARCH
 */
router.get('/patient/:abhaNumber', async (req: Request, res: Response) => {
    const { abhaNumber } = req.params;
    const organization = (req as any).organization;
    const consentToken = req.headers.authorization?.replace('Bearer ', '');
    const purposeOfUse = req.headers['x-purpose-of-use'] as PurposeOfUse;

    try {
        // Get patient ID
        const patientId = await getPatientIdFromAbha(abhaNumber);
        if (!patientId) {
            await logAuditEvent({
                organizationId: organization.id,
                action: 'read',
                resourceType: 'Patient',
                purposeOfUse,
                outcome: 'denied',
                outcomeReason: 'Patient not found',
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Evaluate consent
        const evaluation = await evaluateConsent({
            patientAbha: abhaNumber,
            organizationId: organization.id,
            resourceType: 'Patient',
            action: 'read',
            purposeOfUse,
            consentToken,
        });

        if (!evaluation.allowed) {
            await logAuditEvent({
                patientId,
                organizationId: organization.id,
                action: 'read',
                resourceType: 'Patient',
                consentId: evaluation.consentId,
                purposeOfUse,
                outcome: 'denied',
                outcomeReason: evaluation.reason,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return res.status(403).json({
                error: 'Access denied',
                reason: evaluation.reason,
            });
        }

        // Fetch patient FHIR ID
        const { data: patientMap } = await supabaseAdmin
            .from('fhir_user_map')
            .select('fhir_patient_id')
            .eq('abha_number', abhaNumber)
            .single();

        if (!patientMap) {
            return res.status(404).json({ error: 'Patient FHIR mapping not found' });
        }

        // Fetch patient from HAPI
        const patientResponse = await fhirGet(`Patient/${patientMap.fhir_patient_id}`);

        if (!patientResponse.ok) {
            return res.status(500).json({ error: 'Failed to fetch patient data' });
        }

        // Log successful access
        await logAuditEvent({
            patientId,
            organizationId: organization.id,
            action: 'read',
            resourceType: 'Patient',
            resourceId: patientMap.fhir_patient_id,
            consentId: evaluation.consentId,
            purposeOfUse,
            outcome: 'success',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });

        return res.json({
            patient: patientResponse.data,
            consent: {
                consentId: evaluation.consentId,
                restrictions: evaluation.restrictions,
            },
        });

    } catch (error: any) {
        console.error('Patient access error:', error);
        await logAuditEvent({
            organizationId: organization.id,
            action: 'read',
            resourceType: 'Patient',
            purposeOfUse,
            outcome: 'error',
            outcomeReason: error.message,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        });
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================
// OBSERVATIONS ACCESS
// ============================================================

/**
 * GET /api/external/observations/:abhaNumber
 * Get observations for patient (requires consent token)
 */
router.get('/observations/:abhaNumber', async (req: Request, res: Response) => {
    const { abhaNumber } = req.params;
    const organization = (req as any).organization;
    const consentToken = req.headers.authorization?.replace('Bearer ', '');
    const purposeOfUse = req.headers['x-purpose-of-use'] as PurposeOfUse;

    try {
        const patientId = await getPatientIdFromAbha(abhaNumber);
        if (!patientId) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Evaluate consent
        const evaluation = await evaluateConsent({
            patientAbha: abhaNumber,
            organizationId: organization.id,
            resourceType: 'Observation',
            action: 'search',
            purposeOfUse,
            consentToken,
        });

        if (!evaluation.allowed) {
            await logAuditEvent({
                patientId,
                organizationId: organization.id,
                action: 'search',
                resourceType: 'Observation',
                purposeOfUse,
                outcome: 'denied',
                outcomeReason: evaluation.reason,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return res.status(403).json({
                error: 'Access denied',
                reason: evaluation.reason,
            });
        }

        // Fetch patient FHIR ID
        const { data: patientMap } = await supabaseAdmin
            .from('fhir_user_map')
            .select('fhir_patient_id')
            .eq('abha_number', abhaNumber)
            .single();

        if (!patientMap) {
            return res.status(404).json({ error: 'Patient FHIR mapping not found' });
        }

        // Fetch observations from HAPI
        const observationsResponse = await fhirGet<FhirBundle>('Observation', {
            patient: `Patient/${patientMap.fhir_patient_id}`,
            _sort: '-date',
            _count: req.query._count as string || '50',
        });

        if (!observationsResponse.ok) {
            return res.status(500).json({ error: 'Failed to fetch observations' });
        }

        // Log successful access
        await logAuditEvent({
            patientId,
            organizationId: organization.id,
            action: 'search',
            resourceType: 'Observation',
            consentId: evaluation.consentId,
            purposeOfUse,
            outcome: 'success',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            metadata: { count: observationsResponse.data?.entry?.length || 0 },
        });

        return res.json({
            observations: observationsResponse.data,
            consent: {
                consentId: evaluation.consentId,
                restrictions: evaluation.restrictions,
            },
        });

    } catch (error: any) {
        console.error('Observations access error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================
// DOCUMENTS ACCESS
// ============================================================

/**
 * GET /api/external/documents/:abhaNumber
 * Get document references for patient (requires consent token)
 */
router.get('/documents/:abhaNumber', async (req: Request, res: Response) => {
    const { abhaNumber } = req.params;
    const organization = (req as any).organization;
    const consentToken = req.headers.authorization?.replace('Bearer ', '');
    const purposeOfUse = req.headers['x-purpose-of-use'] as PurposeOfUse;

    try {
        const patientId = await getPatientIdFromAbha(abhaNumber);
        if (!patientId) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Evaluate consent
        const evaluation = await evaluateConsent({
            patientAbha: abhaNumber,
            organizationId: organization.id,
            resourceType: 'DocumentReference',
            action: 'search',
            purposeOfUse,
            consentToken,
        });

        if (!evaluation.allowed) {
            await logAuditEvent({
                patientId,
                organizationId: organization.id,
                action: 'search',
                resourceType: 'DocumentReference',
                purposeOfUse,
                outcome: 'denied',
                outcomeReason: evaluation.reason,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
            });
            return res.status(403).json({
                error: 'Access denied',
                reason: evaluation.reason,
            });
        }

        // Fetch patient FHIR ID
        const { data: patientMap } = await supabaseAdmin
            .from('fhir_user_map')
            .select('fhir_patient_id')
            .eq('abha_number', abhaNumber)
            .single();

        if (!patientMap) {
            return res.status(404).json({ error: 'Patient FHIR mapping not found' });
        }

        // Fetch documents from HAPI
        const documentsResponse = await fhirGet<FhirBundle>('DocumentReference', {
            patient: `Patient/${patientMap.fhir_patient_id}`,
            _sort: '-date',
        });

        if (!documentsResponse.ok) {
            return res.status(500).json({ error: 'Failed to fetch documents' });
        }

        // Log successful access
        await logAuditEvent({
            patientId,
            organizationId: organization.id,
            action: 'search',
            resourceType: 'DocumentReference',
            consentId: evaluation.consentId,
            purposeOfUse,
            outcome: 'success',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            metadata: { count: documentsResponse.data?.entry?.length || 0 },
        });

        return res.json({
            documents: documentsResponse.data,
            consent: {
                consentId: evaluation.consentId,
                restrictions: evaluation.restrictions,
            },
        });

    } catch (error: any) {
        console.error('Documents access error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================
// EMERGENCY ACCESS
// ============================================================

/**
 * POST /api/external/emergency-access
 * Request emergency "break-the-glass" access
 * 
 * Body:
 * {
 *   abhaNumber: string,
 *   resourceType: string,
 *   reason: string,
 *   justification: string
 * }
 */
router.post('/emergency-access', async (req: Request, res: Response) => {
    const { abhaNumber, resourceType, reason, justification } = req.body;
    const organization = (req as any).organization;

    try {
        if (!abhaNumber || !resourceType || !reason) {
            return res.status(400).json({
                error: 'Missing required fields: abhaNumber, resourceType, reason',
            });
        }

        const patientId = await getPatientIdFromAbha(abhaNumber);
        if (!patientId) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Evaluate emergency access
        const evaluation = await evaluateEmergencyAccess(
            abhaNumber,
            organization.id,
            `${reason}: ${justification}`,
            resourceType
        );

        if (!evaluation.allowed) {
            await logAuditEvent({
                patientId,
                organizationId: organization.id,
                action: 'emergency_access',
                resourceType,
                outcome: 'denied',
                outcomeReason: evaluation.reason,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                metadata: { reason, justification },
            });
            return res.status(403).json({
                error: 'Emergency access denied',
                reason: evaluation.reason,
            });
        }

        // Log emergency access
        await logAuditEvent({
            patientId,
            organizationId: organization.id,
            action: 'emergency_access',
            resourceType,
            outcome: 'success',
            outcomeReason: `Emergency access granted: ${reason}`,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            metadata: { reason, justification },
        });

        return res.json({
            message: 'Emergency access granted',
            restrictions: evaluation.restrictions,
            warning: 'Patient has been notified of emergency access',
        });

    } catch (error: any) {
        console.error('Emergency access error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

async function logAuditEvent(data: AuditEventData) {
    try {
        await createAuditEvent(data);
    } catch (error) {
        console.error('Failed to log audit event:', error);
    }
}

export default router;
