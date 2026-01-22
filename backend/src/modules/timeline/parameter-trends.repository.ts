import { supabase } from '../../lib/supabase';

export const parameterTrendsRepository = {
    /**
     * Create parameter trend
     */
    async create(data: {
        patient_id: string;
        parameter_code: string;
        current_event_id: string;
        previous_event_id?: string;
        delta_value?: string;
        trend: 'improved' | 'stable' | 'worsened';
    }) {
        const { data: trend, error } = await supabase
            .from('parameter_trends')
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return trend;
    },

    /**
     * Find trends for a patient and parameter
     */
    async findByPatientAndParameter(patientId: string, parameterCode: string) {
        const { data, error } = await supabase
            .from('parameter_trends')
            .select('*, current_event:timeline_events!current_event_id(*)')
            .eq('patient_id', patientId)
            .eq('parameter_code', parameterCode)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    /**
     * Find trend for a specific event and parameter
     */
    async findByEventAndParameter(eventId: string, parameterCode: string) {
        const { data, error } = await supabase
            .from('parameter_trends')
            .select('*')
            .eq('current_event_id', eventId)
            .eq('parameter_code', parameterCode)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
        return data || null;
    }
};
