
import 'dotenv/config';
import { getSupabaseAdminClient } from '../lib/supabaseClient';

async function inspectSchema() {
    console.log('🔍 Inspecting Schemas...');
    const supabase = getSupabaseAdminClient();

    // Check health_reports structure
    const { data: reports } = await supabase
        .from('health_reports')
        .select('*')
        .limit(1);

    if (reports && reports.length > 0) {
        console.log('Health Report Keys:', Object.keys(reports[0]));
        // console.log('Sample Report Data:', JSON.stringify(reports[0], null, 2)); 
        const pids = [...new Set(reports.map(r => r.patient_id))];
        const uids = [...new Set(reports.map(r => r.user_id))];
        const ppids = [...new Set(reports.map(r => r.patient_profile_id))];
        console.log('Found Patient IDs:', pids);
        console.log('Found User IDs:', uids);
        console.log('Found Patient Profile IDs:', ppids);
    } else {
        console.log('No health reports found to inspect.');
    }

    // Check timeline_events structure
    const { data: timeEvents } = await supabase
        .from('timeline_events')
        .select('*')
        .limit(1);

    if (timeEvents && timeEvents.length > 0) {
        console.log('Timeline Event Keys:', Object.keys(timeEvents[0]));
        console.log('Sample Timeline Event:', JSON.stringify(timeEvents[0], null, 2));
    }
}

inspectSchema();
