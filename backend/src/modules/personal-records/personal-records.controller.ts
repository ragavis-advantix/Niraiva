import { Request, Response } from 'express';
import { personalRecordsService } from './personal-records.service.js';

export const personalRecordsController = {
    /**
     * Upload personal record (Patient only)
     * POST /api/personal-records/upload
     */
    async uploadRecord(req: Request, res: Response) {
        try {
            const patientId = req.user?.linked_patient_id;
            const { type, data } = req.body;
            const file = req.file;

            if (!patientId) {
                return res.status(403).json({ error: 'Not authorized as patient' });
            }

            if (!type) {
                return res.status(400).json({ error: 'type is required' });
            }

            // Validate type
            const validTypes = ['photo', 'wearable', 'lifestyle', 'note', 'symptom'];
            if (!validTypes.includes(type)) {
                return res.status(400).json({
                    error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
                });
            }

            const record = await personalRecordsService.uploadRecord({
                patient_id: patientId,
                type,
                data: data ? JSON.parse(data) : {},
                file
            });

            res.status(201).json({ record });
        } catch (error: any) {
            console.error('Error uploading personal record:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Get patient personal records
     * GET /api/personal-records/patient/:patientId
     */
    async getPatientRecords(req: Request, res: Response) {
        try {
            const { patientId } = req.params;
            const userPatientId = req.user?.linked_patient_id;

            // Only patient can view their own personal records
            if (req.user?.role === 'patient' && userPatientId !== patientId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const records = await personalRecordsService.getPatientRecords(patientId);

            res.json({ records });
        } catch (error: any) {
            console.error('Error fetching personal records:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Delete personal record
     * DELETE /api/personal-records/:recordId
     */
    async deleteRecord(req: Request, res: Response) {
        try {
            const { recordId } = req.params;
            const patientId = req.user?.linked_patient_id;

            await personalRecordsService.deleteRecord(recordId, patientId);

            res.json({ message: 'Record deleted successfully' });
        } catch (error: any) {
            console.error('Error deleting record:', error);
            res.status(500).json({ error: error.message });
        }
    }
};
