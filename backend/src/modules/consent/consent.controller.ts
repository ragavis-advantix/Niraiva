import { Request, Response } from 'express';
import { consentService } from './consent.service';

export const consentController = {
    /**
     * Grant consent to a user
     * POST /api/consent/grant
     */
    async grantConsent(req: Request, res: Response) {
        try {
            const patientId = req.user?.linked_patient_id;
            const { granted_to, scopes, purpose, expires_in_days } = req.body;

            if (!patientId) {
                return res.status(403).json({ error: 'Not authorized as patient' });
            }

            const consent = await consentService.grantConsent({
                patient_id: patientId,
                granted_to,
                scopes,
                purpose,
                expires_in_days
            });

            res.json({ consent });
        } catch (error: any) {
            console.error('Error granting consent:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Revoke consent
     * POST /api/consent/revoke/:consentId
     */
    async revokeConsent(req: Request, res: Response) {
        try {
            const { consentId } = req.params;
            const patientId = req.user?.linked_patient_id;

            await consentService.revokeConsent(consentId, patientId);

            res.json({ message: 'Consent revoked successfully' });
        } catch (error: any) {
            console.error('Error revoking consent:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Get patient consents
     * GET /api/consent/patient/:patientId
     */
    async getPatientConsents(req: Request, res: Response) {
        try {
            const { patientId } = req.params;

            const consents = await consentService.getPatientConsents(patientId);

            res.json({ consents });
        } catch (error: any) {
            console.error('Error fetching consents:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Request access (doctor)
     * POST /api/consent/request
     */
    async requestAccess(req: Request, res: Response) {
        try {
            const requesterId = req.user?.id;
            const { patient_id, scopes, purpose } = req.body;

            const request = await consentService.createAccessRequest({
                patient_id,
                requester_id: requesterId,
                scopes,
                purpose
            });

            res.json({ request });
        } catch (error: any) {
            console.error('Error requesting access:', error);
            res.status(500).json({ error: error.message });
        }
    }
};
