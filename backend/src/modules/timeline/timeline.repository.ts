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
     * Orders by clinical_event_date (actual medical event date) first,
     * then falls back to upload_date for records without extracted dates
     */
    async findByPatientId(patientId: string, limit: number = 50, offset: number = 0) {
        const { data, error } = await supabase
            .from('timeline_events')
            .select('*')
            .eq('patient_id', patientId)
            // Primary sort: clinical event date (actual medical date) - nulls last
            .order('clinical_event_date', { ascending: false, nullsFirst: false })
            // Secondary sort: upload date (for records without clinical date)
            .order('upload_date', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) throw error;
        return data || [];
    }
};
