import { patientRepository } from './patient.repository';
import crypto from 'crypto';

export const patientService = {
    /**
     * Create a new patient in patient_master
     */
    async createPatient(data: {
        full_name: string;
        dob: string;
        sex?: string;
        phone?: string;
        email?: string;
        address?: string;
        primary_org_id?: string;
        created_by: string;
    }) {
        // Generate MRN
        const mrn = await this.generateMRN(data.primary_org_id);

        const patient = await patientRepository.create({
            ...data,
            mrn
        });

        return patient;
    },

    /**
     * Generate unique MRN
     */
    async generateMRN(orgId?: string): Promise<string> {
        const prefix = orgId ? await this.getOrgPrefix(orgId) : 'DEMO';
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

        return `${prefix}-${year}-${random}`;
    },

    /**
     * Get organization prefix for MRN
     */
    async getOrgPrefix(orgId: string): Promise<string> {
        // TODO: Fetch from organizations table
        return 'HOSP01';
    },

    /**
     * Search patients by query, MRN, or phone
     */
    async searchPatients(filters: {
        query?: string;
        mrn?: string;
        phone?: string;
    }) {
        return await patientRepository.search(filters);
    },

    /**
     * Get patient by ID
     */
    async getPatientById(patientId: string) {
        return await patientRepository.findById(patientId);
    },

    /**
     * Send patient invite
     */
    async sendPatientInvite(patientId: string, createdBy?: string) {
        const patient = await patientRepository.findById(patientId);

        if (!patient) {
            throw new Error('Patient not found');
        }

        // Generate secure token
        const token = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Store invite
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 72); // 72 hour expiry

        await patientRepository.createInvite({
            patient_id: patientId,
            hashed_token: hashedToken,
            expires_at: expiresAt.toISOString(),
            created_by: createdBy
        });

        // Generate invite link
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const invite_link = `${baseUrl}/patient/activate?token=${token}`;

        // TODO: Send SMS/WhatsApp/Email with invite link
        console.log(`Invite link for ${patient.full_name}: ${invite_link}`);

        return { invite_link, expires_at: expiresAt };
    }
};
