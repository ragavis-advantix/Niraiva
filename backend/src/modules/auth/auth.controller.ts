import { Request, Response } from 'express';
import { authService } from './auth.service';

export const authController = {
    /**
     * Verify patient invite token and DOB
     * POST /api/auth/patient/verify
     */
    async verifyPatientInvite(req: Request, res: Response) {
        try {
            const { token, dob } = req.body;

            if (!token || !dob) {
                return res.status(400).json({ error: 'Token and DOB are required' });
            }

            const result = await authService.verifyInvite(token, dob);

            res.json(result);
        } catch (error: any) {
            console.error('Error verifying invite:', error);
            res.status(400).json({ error: error.message });
        }
    },

    /**
     * Verify OTP
     * POST /api/auth/patient/verify-otp
     */
    async verifyOtp(req: Request, res: Response) {
        try {
            const { token, otp } = req.body;

            if (!token || !otp) {
                return res.status(400).json({ error: 'Token and OTP are required' });
            }

            const result = await authService.verifyOtp(token, otp);

            res.json(result);
        } catch (error: any) {
            console.error('Error verifying OTP:', error);
            res.status(400).json({ error: error.message });
        }
    },

    /**
     * Activate patient account (create Supabase auth user + link to patient_master)
     * POST /api/auth/patient/activate
     */
    async activatePatient(req: Request, res: Response) {
        try {
            const { token, phone, password } = req.body;

            if (!token || !phone) {
                return res.status(400).json({ error: 'Token and phone are required' });
            }

            const result = await authService.activatePatient(token, phone, password);

            res.json(result);
        } catch (error: any) {
            console.error('Error activating patient:', error);
            res.status(400).json({ error: error.message });
        }
    },

    /**
     * Get enriched user information
     * GET /api/auth/me
     */
    async getMe(req: Request, res: Response) {
        try {
            const authUserId = req.user?.id;

            if (!authUserId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const result = await authService.getMe(authUserId);

            res.json(result);
        } catch (error: any) {
            console.error('Error getting user info:', error);
            res.status(500).json({ error: error.message });
        }
    }
};
