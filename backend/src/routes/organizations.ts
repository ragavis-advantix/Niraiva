/**
 * Organization Management Routes
 * Hospital/lab/HIU registration and management
 */

import { Router, type Request, type Response } from 'express';
import { fhirPost, type FhirResource } from '../lib/fhirClient';
import { supabaseAdmin } from '../lib/supabaseClient';
import crypto from 'crypto';

const router = Router();

// ============================================================
// ORGANIZATION REGISTRATION
// ============================================================

/**
 * POST /api/organizations/register
 * Register a new hospital/lab/HIU organization
 * 
 * Body:
 * {
 *   name: string,
 *   type: 'hospital' | 'lab' | 'hiu' | 'caregiver' | 'research',
 *   metadata?: {
 *     address?: string,
 *     contact?: string,
 *     ...
 *   }
 * }
 */
router.post('/register', async (req: Request, res: Response) => {
    try {
        const { name, type, metadata } = req.body;

        if (!name || !type) {
            return res.status(400).json({ error: 'Name and type are required' });
        }

        const validTypes = ['hospital', 'lab', 'hiu', 'caregiver', 'research'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
            });
        }

        // Generate client credentials
        const clientId = `${type}-${crypto.randomBytes(8).toString('hex')}`;
        const clientSecret = crypto.randomBytes(32).toString('hex');

        // TODO: Hash client secret with bcrypt
        // const bcrypt = require('bcrypt');
        // const clientSecretHash = await bcrypt.hash(clientSecret, 10);
        const clientSecretHash = clientSecret; // Temporary for development

        // Create FHIR Organization resource
        const fhirOrganization: FhirResource = {
            resourceType: 'Organization',
            active: true,
            type: [
                {
                    coding: [
                        {
                            system: 'http://terminology.hl7.org/CodeSystem/organization-type',
                            code: type === 'hospital' ? 'prov' : 'other',
                            display: type,
                        },
                    ],
                },
            ],
            name,
            telecom: metadata?.contact
                ? [
                    {
                        system: 'phone',
                        value: metadata.contact,
                    },
                ]
                : undefined,
            address: metadata?.address
                ? [
                    {
                        text: metadata.address,
                        country: 'IN',
                    },
                ]
                : undefined,
        };

        const fhirResponse = await fhirPost('Organization', fhirOrganization);

        if (!fhirResponse.ok || !fhirResponse.data) {
            return res.status(500).json({
                error: 'Failed to create FHIR Organization',
                details: fhirResponse.error,
            });
        }

        const fhirOrgId = (fhirResponse.data as any).id;

        // Store in database
        const { data: org, error } = await supabaseAdmin
            .from('organizations')
            .insert({
                fhir_organization_id: fhirOrgId,
                name,
                type,
                client_id: clientId,
                client_secret_hash: clientSecretHash,
                active: true,
                metadata: metadata || {},
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({
                error: 'Failed to store organization',
                details: error.message,
            });
        }

        return res.status(201).json({
            message: 'Organization registered successfully',
            organization: {
                id: org.id,
                name: org.name,
                type: org.type,
                fhirOrganizationId: fhirOrgId,
            },
            credentials: {
                clientId,
                clientSecret, // Return only once - should be stored securely by organization
            },
            warning: 'Store client secret securely. It will not be shown again.',
        });

    } catch (error: any) {
        console.error('Organization registration error:', error);
        return res.status(500).json({
            error: 'Failed to register organization',
            message: error.message,
        });
    }
});

// ============================================================
// ORGANIZATION DETAILS
// ============================================================

/**
 * GET /api/organizations/:id
 * Get organization details
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const { data: org, error } = await supabaseAdmin
            .from('organizations')
            .select('id, fhir_organization_id, name, type, active, metadata, created_at')
            .eq('id', id)
            .single();

        if (error || !org) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        return res.json({ organization: org });

    } catch (error: any) {
        console.error('Organization fetch error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================
// LIST ORGANIZATIONS
// ============================================================

/**
 * GET /api/organizations
 * List all active organizations (for consent popup dropdown)
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const { type } = req.query;

        let query = supabaseAdmin
            .from('organizations')
            .select('id, name, type, metadata')
            .eq('active', true)
            .order('name');

        if (type) {
            query = query.eq('type', type);
        }

        const { data: orgs, error } = await query;

        if (error) {
            return res.status(500).json({ error: 'Failed to fetch organizations' });
        }

        return res.json({
            organizations: orgs || [],
            total: orgs?.length || 0,
        });

    } catch (error: any) {
        console.error('Organizations list error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ============================================================
// REGENERATE CREDENTIALS
// ============================================================

/**
 * POST /api/organizations/:id/credentials
 * Regenerate client credentials (admin only - TODO: add auth)
 */
router.post('/:id/credentials', async (req: Request, res: Response) => {
    try {
        // TODO: Add admin authentication
        const { id } = req.params;

        const clientSecret = crypto.randomBytes(32).toString('hex');
        const clientSecretHash = clientSecret; // TODO: Hash with bcrypt

        const { data: org, error } = await supabaseAdmin
            .from('organizations')
            .update({ client_secret_hash: clientSecretHash })
            .eq('id', id)
            .select('client_id')
            .single();

        if (error || !org) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        return res.json({
            message: 'Credentials regenerated successfully',
            credentials: {
                clientId: org.client_id,
                clientSecret,
            },
            warning: 'Store client secret securely. It will not be shown again.',
        });

    } catch (error: any) {
        console.error('Credentials regeneration error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
