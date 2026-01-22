import { Router } from 'express';
import { timelineController } from './timeline.controller';
import { verifyToken } from '../../middleware/verifyToken';
import { enforceConsent } from '../../middleware/enforceConsent';

const router = Router();

// Get patient timeline
router.get(
    '/patient/:patientId',
    verifyToken,
    enforceConsent(),
    timelineController.getPatientTimeline
);

// Get event details with clinical parameters and trends
router.get(
    '/event/:eventId/details',
    verifyToken,
    timelineController.getEventDetails
);

export default router;
