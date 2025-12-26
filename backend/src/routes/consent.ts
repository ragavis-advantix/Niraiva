/**
 * Consent Management Routes
 * Patient-facing endpoints for granting, revoking, and managing consents
 */

import { Router, type Request, type Response } from 'express';
import { grantConsent, revokeConsent, getPatientConsents, validateConsentRequest } from '../lib/consentService';
import { getTokenByConsentId } from '../lib/consentTokenService';
import { supabaseAdmin } from '../lib/supabaseClient';
import type { ConsentGrantRequest } from '../types/consentTypes';

const router = Router();

// ============================================================
// CONSENT GRANT
// ============================================================

/**
 * POST /api/consent/grant
 * Create a new consent grant (triggered by patient consent popup)
 * 
 * Body:
 * {
 *   organizationId: string,
 *   purposeOfUse: 'TREATMENT' | 'EMERGENCY' | 'INSURANCE' | 'RESEARCH',
 *   allowedResources: string[],
 *   validFrom: string (ISO),
 *   validUntil: string (ISO),
 *   emergencyOverride?: boolean,
 *   notes?: string
 * }
 */
router.post('/grant', async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Fetch patient ABHA number
        const { data: patientMap, error: mapError } = await supabaseAdmin
            .from('fhir_user_map')
            .select('abha_number')
            .eq('supabase_user_id', user.id)
            .single();

        if (mapError || !patientMap || !patientMap.abha_number) {
            return res.status(400).json({
                error: 'ABHA not linked',
                message: 'Please link your ABHA before granting consent',
            });
        }

        // Fetch organization name
        const { data: org, error: orgError } = await supabaseAdmin
            .from('organizations')
            .select('name')
            .eq('id', req.body.organizationId)
            .single();

        if (orgError || !org) {
            return res.status(400).json({ error: 'Organization not found' });
        }

        // Build consent grant request
        const grantRequest: ConsentGrantRequest = {
            patientId: user.id,
            patientAbha: patientMap.abha_number,
            organizationId: req.body.organizationId,
            organizationName: org.name,
            purposeOfUse: req.body.purposeOfUse,
            allowedResources: req.body.allowedResources,
            validFrom: req.body.validFrom || new Date().toISOString(),
            validUntil: req.body.validUntil,
            emergencyOverride: req.body.emergencyOverride,
            notes: req.body.notes,
        };

        // Validate request
        const validation = validateConsentRequest(grantRequest);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Validation failed',
                errors: validation.errors,
            });
        }

        // Grant consent
        const result = await grantConsent(grantRequest);

        return res.status(201).json({
            message: 'Consent granted successfully',
            consentId: result.consent.id,
            token: result.token,
            tokenId: result.tokenId,
            consent: result.consent,
        });

    } catch (error: any) {
        console.error('Consent grant error:', error);
        return res.status(500).json({
            error: 'Failed to grant consent',
            message: error.message,
        });
    }
});

// ============================================================
// CONSENT LIST
// ============================================================

/**
 * GET /api/consent/list
 * Get all consents for the authenticated patient
 */
router.get('/list', async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const consents = await getPatientConsents(user.id);

        return res.json({
            consents,
            total: consents.length,
        });

    } catch (error: any) {
        console.error('Consent list error:', error);
        return res.status(500).json({
            error: 'Failed to fetch consents',
            message: error.message,
        });
    }
});

// ============================================================
// CONSENT REVOCATION
// ============================================================

/**
 * POST /api/consent/revoke/:consentId
 * Revoke a consent
 * 
 * Body:
 * {
 *   reason?: string
 * }
 */
router.post('/revoke/:consentId', async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { consentId } = req.params;
        const { reason } = req.body;

        const result = await revokeConsent(consentId, user.id, reason);

        if (!result.success) {
            return res.status(400).json({
                error: 'Failed to revoke consent',
                message: result.error,
            });
        }

        return res.json({
            message: 'Consent revoked successfully',
            consentId,
        });

    } catch (error: any) {
        console.error('Consent revoke error:', error);
        return res.status(500).json({
            error: 'Failed to revoke consent',
            message: error.message,
        });
    }
});

// ============================================================
// CONSENT TOKEN GENERATION
// ============================================================

/**
 * POST /api/consent/token/:consentId
 * Generate a new token for an existing consent (for sharing)
 */
router.post('/token/:consentId', async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { consentId } = req.params;

        // Get existing token
        const tokenRecord = await getTokenByConsentId(consentId);

        if (!tokenRecord) {
            return res.status(404).json({ error: 'Consent token not found' });
        }

        // Verify ownership
        if (tokenRecord.patient_id !== user.id) {
            return res.status(403).json({ error: 'Unauthorized: consent belongs to different patient' });
        }

        // Check if revoked
        if (tokenRecord.revoked) {
            return res.status(400).json({
                error: 'Consent is revoked',
                message: tokenRecord.revoked_reason || 'Consent has been revoked',
            });
        }

        // Return existing token
        return res.json({
            token: tokenRecord.token_jwt,
            consentId: tokenRecord.consent_fhir_id,
            expiresAt: tokenRecord.expires_at,
        });

    } catch (error: any) {
        console.error('Token generation error:', error);
        return res.status(500).json({
            error: 'Failed to generate token',
            message: error.message,
        });
    }
});

// ============================================================
// PENDING ACCESS REQUESTS
// ============================================================

/**
 * GET /api/consent/pending
 * Get pending access requests from hospitals (placeholder - requires notification system)
 */
router.get('/pending', async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // TODO: Implement pending access requests table and logic
        // For now, return empty array
        return res.json({
            requests: [],
            total: 0,
        });

    } catch (error: any) {
        console.error('Pending requests error:', error);
        return res.status(500).json({
            error: 'Failed to fetch pending requests',
            message: error.message,
        });
    }
});

// ============================================================
// CONSENT DETAILS
// ============================================================

/**
 * GET /api/consent/:consentId
 * Get detailed information about a specific consent
 */
router.get('/:consentId', async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        if (!user || !user.id) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { consentId } = req.params;

        const tokenRecord = await getTokenByConsentId(consentId);

        if (!tokenRecord) {
            return res.status(404).json({ error: 'Consent not found' });
        }

        // Verify ownership
        if (tokenRecord.patient_id !== user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Fetch organization details
        const { data: org } = await supabaseAdmin
            .from('organizations')
            .select('*')
            .eq('id', tokenRecord.organization_id)
            .single();

        return res.json({
            consentId: tokenRecord.consent_fhir_id,
            organization: org,
            purposeOfUse: tokenRecord.purpose_of_use,
            allowedResources: tokenRecord.allowed_resources,
            issuedAt: tokenRecord.issued_at,
            expiresAt: tokenRecord.expires_at,
            revoked: tokenRecord.revoked,
            revokedAt: tokenRecord.revoked_at,
            revokedReason: tokenRecord.revoked_reason,
        });

    } catch (error: any) {
        console.error('Consent details error:', error);
        return res.status(500).json({
            error: 'Failed to fetch consent details',
            message: error.message,
        });
    }
});

export default router;
