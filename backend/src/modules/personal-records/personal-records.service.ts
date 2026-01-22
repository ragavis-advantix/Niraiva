import { personalRecordsRepository } from './personal-records.repository';
import { timelineService } from '../timeline/timeline.service';

export const personalRecordsService = {
    /**
     * Upload personal record
     */
    async uploadRecord(data: {
        patient_id: string;
        type: string;
        data: any;
        file?: Express.Multer.File;
    }) {
        let fileUrl;
        if (data.file) {
            // TODO: Upload to storage
            fileUrl = `/uploads/${data.file.filename}`;
        }

        const record = await personalRecordsRepository.create({
            patient_id: data.patient_id,
            type: data.type,
            authority: 'personal',
            data: data.data,
            file_url: fileUrl
        });

        // Create timeline event
        await timelineService.createEventFromPersonalRecord(record);

        return record;
    },

    /**
     * Get patient personal records
     */
    async getPatientRecords(patientId: string) {
        return await personalRecordsRepository.findByPatientId(patientId);
    },

    /**
     * Delete personal record
     */
    async deleteRecord(recordId: string, patientId?: string) {
        const record = await personalRecordsRepository.findById(recordId);

        if (!record) {
            throw new Error('Record not found');
        }

        if (patientId && record.patient_id !== patientId) {
            throw new Error('Not authorized to delete this record');
        }

        await personalRecordsRepository.delete(recordId);
    }
};
