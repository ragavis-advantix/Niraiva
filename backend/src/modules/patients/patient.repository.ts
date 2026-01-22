import { supabase } from '../../lib/supabase';

export const patientRepository = {
    /**
     * Create patient in patient_master table
     */
    async create(data: {
        mrn: string;
        full_name: string;
        dob: string;
        sex?: string;
        phone?: string;
        email?: string;
        address?: string;
        primary_org_id?: string;
        created_by: string;
    }) {
        const { data: patient, error } = await supabase
            .from('patient_master')
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return patient;
    },

    /**
     * Find patient by ID
     */
    async findById(id: string) {
        const { data, error } = await supabase
            .from('patient_master')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    /**
     * Search patients
     */
    async search(filters: {
        query?: string;
        mrn?: string;
        phone?: string;
    }) {
        let query = supabase.from('patient_master').select('*');

        if (filters.mrn) {
            query = query.eq('mrn', filters.mrn);
        } else if (filters.phone) {
            query = query.eq('phone', filters.phone);
        } else if (filters.query) {
            query = query.ilike('full_name', `%${filters.query}%`);
        }

        const { data, error } = await query.limit(20);

        if (error) throw error;
        return data || [];
    },

    /**
     * Create patient invite
     */
    async createInvite(data: {
        patient_id: string;
        hashed_token: string;
        expires_at: string;
        created_by?: string;
    }) {
        const { data: invite, error } = await supabase
            .from('patient_invites')
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return invite;
    },

    /**
     * Find invite by hashed token
     */
    async findInviteByToken(hashedToken: string) {
        const { data, error } = await supabase
            .from('patient_invites')
            .select('*, patient_master(*)')
            .eq('hashed_token', hashedToken)
            .eq('used', false)
            .gt('expires_at', new Date().toISOString())
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    /**
     * Mark invite as used
     */
    async markInviteUsed(inviteId: string) {
        const { error } = await supabase
            .from('patient_invites')
            .update({ used: true, used_at: new Date().toISOString() })
            .eq('id', inviteId);

        if (error) throw error;
    }
};
