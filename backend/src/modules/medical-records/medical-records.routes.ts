import { Router } from 'express';
import { medicalRecordsController } from './medical-records.controller';
import { authenticateUser } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';
import { enforceConsent } from '../../middleware/enforceConsent';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });
const router = Router();

// Upload medical record (Doctor/Clinical only)
router.post(
    '/upload',
    authenticateUser,
    requireRole(['doctor', 'clinical_staff', 'admin']),
    upload.single('file'),
    medicalRecordsController.uploadRecord
);

// Get patient medical records (with consent check)
router.get(
    '/patient/:patientId',
    authenticateUser,
    enforceConsent(['medical_records']),
    medicalRecordsController.getPatientRecords
);

// Get specific medical record
router.get(
    '/:recordId',
    authenticateUser,
    medicalRecordsController.getRecord
);

// Get records by type
router.get(
    '/patient/:patientId/type/:recordType',
    authenticateUser,
    enforceConsent(['medical_records']),
    medicalRecordsController.getRecordsByType
);

export default router;
