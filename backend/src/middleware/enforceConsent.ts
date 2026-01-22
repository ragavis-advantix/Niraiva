import { Request, Response, NextFunction } from 'express';
import { consentService } from '../modules/consent/consent.service';

/**
 * Middleware to enforce consent-based access to patient data
 * Usage: enforceConsent(['labs', 'imaging'])
 */
export const enforceConsent = (requiredScopes?: string[]) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;
            const userRole = req.user?.role;
            const patientId = req.params.patientId || req.body.patient_id;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Admin bypass
            if (userRole === 'admin') {
                return next();
            }

            // Patient accessing own data
            if (userRole === 'patient' && req.user?.linked_patient_id === patientId) {
                return next();
            }

            // Check consent for doctors/clinical staff
            if (!patientId) {
                return res.status(400).json({ error: 'Patient ID required' });
            }

            const hasConsent = await consentService.hasConsent(userId, patientId, requiredScopes);

            if (!hasConsent) {
                return res.status(403).json({
                    error: 'Access denied. Consent required.',
                    required_scopes: requiredScopes
                });
            }

            next();
        } catch (error: any) {
            console.error('Consent enforcement error:', error);
            res.status(500).json({ error: 'Failed to verify consent' });
        }
    };
};
