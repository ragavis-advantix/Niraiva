import { supabase } from '../../lib/supabase';

export const medicalRecordsRepository = {
    /**
     * Create medical record
     */
    async create(data: {
        patient_id: string;
        record_type: string;
        source: string;
        authority: string;
        data: any;
        file_url?: string;
        locked: boolean;
        uploaded_by?: string;
    }) {
        const { data: record, error } = await supabase
            .from('medical_records')
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
            .from('medical_records')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    /**
     * Find records by patient ID
     */
    async findByPatientId(patientId: string, limit: number = 50, offset: number = 0) {
        const { data, error } = await supabase
            .from('medical_records')
            .select('*')
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return data || [];
    },

    /**
     * Find records by type
     */
    async findByType(patientId: string, recordType: string) {
        const { data, error } = await supabase
            .from('medical_records')
            .select('*')
            .eq('patient_id', patientId)
            .eq('record_type', recordType)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }
};
