import { Request, Response } from 'express';
import { patientService } from './patient.service';

export const patientController = {
    /**
     * Create a new patient (Clinical/Doctor only)
     * POST /api/patients/create
     */
    async createPatient(req: Request, res: Response) {
        try {
            const { full_name, dob, sex, phone, email, address, primary_org_id } = req.body;
            const createdBy = req.user?.role || 'system';

            if (!full_name || !dob) {
                return res.status(400).json({ error: 'full_name and dob are required' });
            }

            const patient = await patientService.createPatient({
                full_name,
                dob,
                sex,
                phone,
                email,
                address,
                primary_org_id,
                created_by: createdBy
            });

            res.status(201).json({ patient });
        } catch (error: any) {
            console.error('Error creating patient:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Search patients
     * GET /api/patients/search?q=...&mrn=...&phone=...
     */
    async searchPatients(req: Request, res: Response) {
        try {
            const { q, mrn, phone } = req.query;

            const patients = await patientService.searchPatients({
                query: q as string,
                mrn: mrn as string,
                phone: phone as string
            });

            res.json({ patients });
        } catch (error: any) {
            console.error('Error searching patients:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Get patient by ID
     * GET /api/patients/:patientId
     */
    async getPatient(req: Request, res: Response) {
        try {
            const { patientId } = req.params;

            const patient = await patientService.getPatientById(patientId);

            if (!patient) {
                return res.status(404).json({ error: 'Patient not found' });
            }

            res.json({ patient });
        } catch (error: any) {
            console.error('Error fetching patient:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Send invite to patient
     * POST /api/patients/:patientId/invite
     */
    async sendInvite(req: Request, res: Response) {
        try {
            const { patientId } = req.params;
            const createdBy = req.user?.id;

            const invite = await patientService.sendPatientInvite(patientId, createdBy);

            res.json({
                message: 'Invite sent successfully',
                invite_link: invite.invite_link
            });
        } catch (error: any) {
            console.error('Error sending invite:', error);
            res.status(500).json({ error: error.message });
        }
    }
};
