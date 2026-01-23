import { Request, Response } from 'express';
import { patientService } from '../patients/patient.service';
import { medicalRecordsService } from '../medical-records/medical-records.service';

export const clinicalController = {
    /**
     * Create patient (Clinical system)
     * POST /api/clinical/patient/create
     */
    async createPatient(req: Request, res: Response) {
        try {
            const { full_name, dob, sex, phone, email, address, primary_org_id } = req.body;

            const patient = await patientService.createPatient({
                full_name,
                dob,
                sex,
                phone,
                email,
                address,
                primary_org_id,
                created_by: 'clinic'
            });

            res.status(201).json({ patient });
        } catch (error: any) {
            console.error('Error creating patient:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Bulk upload records
     * POST /api/clinical/records/bulk-upload
     */
    async bulkUploadRecords(req: Request, res: Response) {
        try {
            const { records } = req.body;

            if (!Array.isArray(records)) {
                return res.status(400).json({ error: 'records must be an array' });
            }

            const results: Array<{ success: boolean; record?: any; error?: string }> = [];
            for (const recordData of records) {
                try {
                    // TODO: Handle file uploads in bulk
                    const record = await medicalRecordsService.uploadRecord({
                        patient_id: recordData.patient_id,
                        record_type: recordData.record_type,
                        source: recordData.source || 'Clinical System',
                        file: recordData.file,
                        uploaded_by: req.user?.id
                    });
                    results.push({ success: true, record });
                } catch (error: any) {
                    results.push({ success: false, error: error.message });
                }
            }

            res.json({ results });
        } catch (error: any) {
            console.error('Error bulk uploading records:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Create appointment
     * POST /api/clinical/appointments
     */
    async createAppointment(req: Request, res: Response) {
        try {
            const { patient_id, doctor_id, appointment_time, type } = req.body;

            // TODO: Implement appointments table and logic
            res.json({
                message: 'Appointment created',
                appointment: {
                    patient_id,
                    doctor_id,
                    appointment_time,
                    type,
                    status: 'scheduled'
                }
            });
        } catch (error: any) {
            console.error('Error creating appointment:', error);
            res.status(500).json({ error: error.message });
        }
    },

    /**
     * Discharge patient (triggers invite)
     * POST /api/clinical/discharge
     */
    async dischargePatient(req: Request, res: Response) {
        try {
            const { patient_id } = req.body;

            // Send invite to patient
            const invite = await patientService.sendPatientInvite(patient_id, req.user?.id);

            res.json({
                message: 'Patient discharged and invite sent',
                invite_link: invite.invite_link
            });
        } catch (error: any) {
            console.error('Error discharging patient:', error);
            res.status(500).json({ error: error.message });
        }
    }
};
