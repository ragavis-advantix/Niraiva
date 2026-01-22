import { supabase } from '../../lib/supabase';

export const personalRecordsRepository = {
    /**
     * Create personal record
     */
    async create(data: {
        patient_id: string;
        type: string;
        authority: string;
        data: any;
        file_url?: string;
    }) {
        const { data: record, error } = await supabase
            .from('personal_records')
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return record;
    },

    /**
     * Find record by ID
     */
    async findById(id: string) {
        const { data, error } = await supabase
            .from('personal_records')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    /**
     * Find records by patient ID
     */
    async findByPatientId(patientId: string) {
        const { data, error } = await supabase
            .from('personal_records')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Delete record
     */
    async delete(id: string) {
        const { error } = await supabase
            .from('personal_records')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
