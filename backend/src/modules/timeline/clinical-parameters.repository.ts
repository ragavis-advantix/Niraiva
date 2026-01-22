import { supabase } from '../../lib/supabase';

export const clinicalParametersRepository = {
    /**
     * Create multiple clinical parameters
     */
    async createMany(parameters: any[]) {
        const { data, error } = await supabase
            .from('health_parameters')
            .insert(parameters)
            .select();

        if (error) throw error;
        return data;
    },

    /**
     * Find parameters by timeline event ID
     */
    async findByEventId(eventId: string) {
        const { data, error } = await supabase
            .from('health_parameters')
            .select('*')
            .eq('timeline_event_id', eventId);

        if (error) throw error;
        return data || [];
    },

    /**
     * Find latest parameters for a patient and parameter code
     */
    async findLatestForPatient(patientId: string, parameterCode: string, excludeEventId?: string) {
        let query = supabase
            .from('health_parameters')
            .select('*, timeline_events!inner(patient_id)')
            .eq('timeline_events.patient_id', patientId)
            .eq('parameter_code', parameterCode)
            .order('created_at', { ascending: false })
            .limit(1);

        if (excludeEventId) {
            query = query.neq('timeline_event_id', excludeEventId);
        }

        const { data, error } = await query.single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
        return data;
    }
};
