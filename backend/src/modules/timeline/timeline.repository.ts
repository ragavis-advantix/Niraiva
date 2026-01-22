import { supabase } from '../../lib/supabase';

export const timelineRepository = {
    /**
     * Create timeline event
     */
    async create(data: {
        patient_id: string;
        event_type: string;
        reference_table: string;
        reference_id: string;
        authority: string;
        display_priority: number;
        event_time: string;
        status?: string;
        source?: string;
        metadata?: any;
    }) {
        const { data: event, error } = await supabase
            .from('timeline_events')
            .insert([data])
            .select()
            .single();

        if (error) throw error;
        return event;
    },

    /**
     * Find event by ID
     */
    async findById(eventId: string) {
        const { data, error } = await supabase
            .from('timeline_events')
            .select('*')
            .eq('id', eventId)
            .single();

        if (error) throw error;
        return data;
    },

    /**
     * Find events by patient ID
     */
    async findByPatientId(patientId: string, limit: number = 50, offset: number = 0) {
        const { data, error } = await supabase
            .from('timeline_events')
            .select('*')
            .eq('patient_id', patientId)
            .order('event_time', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return data || [];
    }
};
