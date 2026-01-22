import { Router } from 'express';
import { personalRecordsController } from './personal-records.controller';
import { authenticateUser } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';
import multer from 'multer';

const upload = multer({ dest: 'uploads/' });
const router = Router();

// Upload personal record (Patient only)
router.post(
    '/upload',
    authenticateUser,
    requireRole(['patient']),
    upload.single('file'),
    personalRecordsController.uploadRecord
);

// Get patient personal records
router.get(
    '/patient/:patientId',
    authenticateUser,
    personalRecordsController.getPatientRecords
);

// Delete personal record (Patient only)
router.delete(
    '/:recordId',
    authenticateUser,
    requireRole(['patient']),
    personalRecordsController.deleteRecord
);

export default router;
