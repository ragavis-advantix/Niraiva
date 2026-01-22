import { Router } from 'express';
import { patientController } from './patient.controller';
import { authenticateUser } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';

const router = Router();

// Clinical/Doctor endpoints - Create patient (system-first)
router.post(
    '/create',
    authenticateUser,
    requireRole(['doctor', 'clinical_staff', 'admin']),
    patientController.createPatient
);

// Search patients (by MRN, phone, name)
router.get(
    '/search',
    authenticateUser,
    requireRole(['doctor', 'clinical_staff', 'admin']),
    patientController.searchPatients
);

// Get patient details
router.get(
    '/:patientId',
    authenticateUser,
    requireRole(['doctor', 'clinical_staff', 'admin', 'patient']),
    patientController.getPatient
);

// Send invite to patient
router.post(
    '/:patientId/invite',
    authenticateUser,
    requireRole(['doctor', 'clinical_staff', 'admin']),
    patientController.sendInvite
);

export default router;
