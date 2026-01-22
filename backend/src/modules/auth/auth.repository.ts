import { supabase } from '../../lib/supabase';

export const authRepository = {
    /**
     * Find user account by patient ID
     */
    async findByPatientId(patientId: string) {
        const { data, error } = await supabase
            .from('user_accounts')
            .select('*')
            .eq('linked_patient_id', patientId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    /**
     * Find user account by auth user ID
     */
    async findByAuthUserId(authUserId: string) {
        const { data, error } = await supabase
            .from('user_accounts')
            .select('*')
            .eq('auth_user_id', authUserId)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    /**
     * Create user account
     */
    async createUserAccount(data: {
        auth_user_id: string;
        role: string;
        linked_patient_id?: string;
        linked_org_id?: string;
    }) {
        const { data: account, error } = await supabase
            .from('user_accounts')
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return account;
    }
};
