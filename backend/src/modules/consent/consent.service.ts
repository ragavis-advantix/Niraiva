import { consentRepository } from './consent.repository';

export const consentService = {
    /**
     * Grant consent
     */
    async grantConsent(data: {
        patient_id: string;
        granted_to: string;
        scopes: string[];
        purpose: string;
        expires_in_days?: number;
    }) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (data.expires_in_days || 30));

        const consent = await consentRepository.create({
            patient_id: data.patient_id,
            granted_to: data.granted_to,
            scopes: data.scopes,
            purpose: data.purpose,
            expires_at: expiresAt.toISOString(),
            status: 'active'
        });

        return consent;
    },

    /**
     * Revoke consent
     */
    async revokeConsent(consentId: string, patientId?: string) {
        const consent = await consentRepository.findById(consentId);

        if (!consent) {
            throw new Error('Consent not found');
        }

        if (patientId && consent.patient_id !== patientId) {
            throw new Error('Not authorized to revoke this consent');
        }

        await consentRepository.revoke(consentId);
    },

    /**
     * Get patient consents
     */
    async getPatientConsents(patientId: string) {
        return await consentRepository.findByPatientId(patientId);
    },

    /**
     * Check if user has consent for patient
     */
    async hasConsent(userId: string, patientId: string, requiredScopes?: string[]) {
        const consents = await consentRepository.findActiveConsents(userId, patientId);

        if (consents.length === 0) {
            return false;
        }

        // If no specific scopes required, any active consent is enough
        if (!requiredScopes || requiredScopes.length === 0) {
            return true;
        }

        // Check if any consent has all required scopes
        return consents.some(consent =>
            requiredScopes.every(scope => consent.scopes.includes(scope))
        );
    },

    /**
     * Create access request (for doctor to request consent)
     */
    async createAccessRequest(data: {
        patient_id: string;
        requester_id?: string;
        scopes: string[];
        purpose: string;
    }) {
        // TODO: Store access requests in a separate table
        // For now, just return the request data
        return {
            id: 'temp-request-id',
            ...data,
            status: 'pending',
            created_at: new Date().toISOString()
        };
    }
};
