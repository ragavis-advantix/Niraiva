import { medicalRecordsRepository } from './medical-records.repository';
import { timelineService } from '../timeline/timeline.service';
import { aiService } from '../ai/ai.service';
import path from 'path';
import fs from 'fs/promises';

export const medicalRecordsService = {
    /**
     * Upload medical record
     * - Stores file
     * - Triggers AI parsing (if applicable)
     * - Creates timeline event
     */
    async uploadRecord(data: {
        patient_id: string;
        record_type: string;
        source: string;
        file: Express.Multer.File;
        uploaded_by?: string;
    }) {
        // TODO: Upload file to storage (S3, Supabase Storage, etc.)
        // For now, we'll store the local path
        const fileUrl = `/uploads/${data.file.filename}`;

        // Trigger AI parsing for supported types
        let parsedData = {};
        if (['lab', 'imaging', 'prescription'].includes(data.record_type)) {
            try {
                parsedData = await aiService.parseDocument(data.file.path, data.record_type);
            } catch (error) {
                console.error('AI parsing failed:', error);
                // Continue without parsed data
            }
        }

        // Create medical record
        const record = await medicalRecordsRepository.create({
            patient_id: data.patient_id,
            record_type: data.record_type,
            source: data.source,
            authority: 'clinical',
            data: parsedData,
            file_url: fileUrl,
            locked: true,
            uploaded_by: data.uploaded_by
        });

        // Create timeline event
        await timelineService.createEventFromMedicalRecord(record);

        return record;
    },

    /**
     * Get patient medical records
     */
    async getPatientRecords(patientId: string, limit: number = 50, offset: number = 0) {
        return await medicalRecordsRepository.findByPatientId(patientId, limit, offset);
    },

    /**
     * Get record by ID
     */
    async getRecordById(recordId: string) {
        return await medicalRecordsRepository.findById(recordId);
    },

    /**
     * Get records by type
     */
    async getRecordsByType(patientId: string, recordType: string) {
        return await medicalRecordsRepository.findByType(patientId, recordType);
    }
};
