import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticateUser } from '../../middleware/auth';

const router = Router();

// Patient verification & activation
router.post('/patient/verify', authController.verifyPatientInvite);
router.post('/patient/verify-otp', authController.verifyOtp);

// Patient activation (creates Supabase auth user)
router.post('/patient/activate', authController.activatePatient);

// Get current user info
router.get('/me', authenticateUser, authController.getMe);

export default router;
