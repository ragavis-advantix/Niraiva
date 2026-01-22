import { Router } from 'express';
import { consentController } from './consent.controller';
import { authenticateUser } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';

const router = Router();

// Patient grants consent
router.post(
    '/grant',
    authenticateUser,
    requireRole(['patient']),
    consentController.grantConsent
);

// Patient revokes consent
router.post(
    '/revoke/:consentId',
    authenticateUser,
    requireRole(['patient']),
    consentController.revokeConsent
);

// Get patient's consents
router.get(
    '/patient/:patientId',
    authenticateUser,
    consentController.getPatientConsents
);

// Doctor requests access
router.post(
    '/request',
    authenticateUser,
    requireRole(['doctor', 'clinical_staff']),
    consentController.requestAccess
);

export default router;
