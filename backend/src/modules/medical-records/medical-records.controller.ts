import { Request, Response } from 'express';
import { medicalRecordsService } from './medical-records.service';

export const medicalRecordsController = {
    /**
     * Upload medical record (Doctor/Clinical only)
     * POST /api/medical-records/upload
     */
    async uploadRecord(req: Request, res: Response) {
        try {
            const { patient_id, record_type, source } = req.body;
            const file = req.file;
            const uploadedBy = req.user?.id;

            if (!patient_id || !record_type || !file) {
                return res.status(400).json({
                    error: 'patient_id, record_type, and file are required'
                });
            }

            // Validate record type
            const validTypes = ['lab', 'imaging', 'diagnosis', 'prescription', 'consultation', 'procedure', 'vitals'];
            if (!validTypes.includes(record_type)) {
                return res.status(400).json({
                    error: `Invalid record_type. Must be one of: ${validTypes.join(', ')}`
                });
            }

            const record = await medicalRecordsService.uploadRecord({
                patient_id,
                record_type,
                source: source || 'Unknown',
                file,
                uploaded_by: uploadedBy
            });

            res.status(201).json({ record });
        } catch (error: any) {
            console.error('Error uploading medical record:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Get patient medical records
     * GET /api/medical-records/patient/:patientId
     */
    async getPatientRecords(req: Request, res: Response) {
        try {
            const { patientId } = req.params;
            const { limit, offset } = req.query;

            const records = await medicalRecordsService.getPatientRecords(
                patientId,
                parseInt(limit as string) || 50,
                parseInt(offset as string) || 0
            );

            res.json({ records });
        } catch (error: any) {
            console.error('Error fetching medical records:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Get specific medical record
     * GET /api/medical-records/:recordId
     */
    async getRecord(req: Request, res: Response) {
        try {
            const { recordId } = req.params;

            const record = await medicalRecordsService.getRecordById(recordId);

            if (!record) {
                return res.status(404).json({ error: 'Record not found' });
            }

            res.json({ record });
        } catch (error: any) {
            console.error('Error fetching record:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Get records by type
     * GET /api/medical-records/patient/:patientId/type/:recordType
     */
    async getRecordsByType(req: Request, res: Response) {
        try {
            const { patientId, recordType } = req.params;

            const records = await medicalRecordsService.getRecordsByType(
                patientId,
                recordType
            );

            res.json({ records });
        } catch (error: any) {
            console.error('Error fetching records by type:', error);
            res.status(500).json({ error: error.message });
        }
    }
};
