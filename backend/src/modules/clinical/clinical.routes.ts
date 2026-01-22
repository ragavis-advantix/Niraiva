import { Router } from 'express';
import { clinicalController } from './clinical.controller';
import { authenticateUser } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';

const router = Router();

// Create patient (Clinical system)
router.post(
    '/patient/create',
    authenticateUser,
    requireRole(['clinical_staff', 'admin']),
    clinicalController.createPatient
);

// Bulk upload records
router.post(
    '/records/bulk-upload',
    authenticateUser,
    requireRole(['clinical_staff', 'admin']),
    clinicalController.bulkUploadRecords
);

// Create appointment
router.post(
    '/appointments',
    authenticateUser,
    requireRole(['clinical_staff', 'admin']),
    clinicalController.createAppointment
);

// Discharge patient (triggers invite)
router.post(
    '/discharge',
    authenticateUser,
    requireRole(['clinical_staff', 'admin']),
    clinicalController.dischargePatient
);

export default router;
