
import 'dotenv/config';
import { getSupabaseAdminClient } from '../lib/supabaseClient';

async function inspectEvents() {
    console.log('🔍 Inspecting Clinical Events...');
    const supabase = getSupabaseAdminClient();

    // Fetch all events
    const { data: events, error } = await supabase
        .from('clinical_events')
        .select('id, event_name, event_date, event_type, metadata, patient_id')
        .order('event_date', { ascending: false });

    if (error) {
        console.error('Error fetching events:', error);
        return;
    }

    console.log(`Found ${events?.length} events.`);

    // Check for duplicates (same name and date)
    const seen = new Set();
    const duplicates: any[] = [];

    events?.forEach(e => {
        const key = `${e.event_name}|${e.event_date}|${e.patient_id}`;
        if (seen.has(key)) {
            duplicates.push(e);
        } else {
            seen.add(key);
        }
    });

    console.log(`Found ${duplicates.length} potential duplicates (by name+date+patient).`);

    if (duplicates.length > 0) {
        console.log('Sample duplicates:', duplicates.slice(0, 5));
    }

    // Check health_reports
    const { count: reportCount, error: reportError } = await supabase
        .from('health_reports')
        .select('*', { count: 'exact', head: true });

    console.log(`Found ${reportCount} health_reports. (Error: ${reportError?.message || 'None'})`);

    // Check timeline_events
    const { count: timelineCount, error: timelineError } = await supabase
        .from('timeline_events')
        .select('*', { count: 'exact', head: true });

    console.log(`Found ${timelineCount} timeline_events. (Error: ${timelineError?.message || 'None'})`);

    // List unique Event Names to see if "previous data" is there
    const uniqueNames = [...new Set(events?.map(e => e.event_name))];
    console.log('Unique Event Names:', uniqueNames);
}

inspectEvents();
