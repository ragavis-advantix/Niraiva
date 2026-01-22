import { supabase } from '../../lib/supabase';

export const consentRepository = {
    /**
     * Create consent
     */
    async create(data: {
        patient_id: string;
        granted_to: string;
        scopes: string[];
        purpose: string;
        expires_at: string;
        status: string;
    }) {
        const { data: consent, error } = await supabase
            .from('consents')
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return consent;
    },

    /**
     * Find consent by ID
     */
    async findById(id: string) {
        const { data, error } = await supabase
            .from('consents')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    /**
     * Find consents by patient ID
     */
    async findByPatientId(patientId: string) {
        const { data, error } = await supabase
            .from('consents')
            .select('*, user_accounts!consents_granted_to_fkey(id, role)')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Find active consents for user and patient
     */
    async findActiveConsents(userId: string, patientId: string) {
        const { data, error } = await supabase
            .from('consents')
            .select('*')
            .eq('granted_to', userId)
            .eq('patient_id', patientId)
            .eq('status', 'active')
            .gt('expires_at', new Date().toISOString());

        if (error) throw error;
        return data || [];
    },

    /**
     * Revoke consent
     */
    async revoke(consentId: string) {
        const { error } = await supabase
            .from('consents')
            .update({
                status: 'revoked',
                revoked_at: new Date().toISOString()
            })
            .eq('id', consentId);

        if (error) throw error;
    }
};
