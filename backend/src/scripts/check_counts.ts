
import 'dotenv/config';
import { getSupabaseAdminClient } from '../lib/supabaseClient';

async function checkCounts() {
    console.log('📊 Checking Table Counts...');
    const supabase = getSupabaseAdminClient();

    const { count: events, error: e1 } = await supabase.from('clinical_events').select('*', { count: 'exact', head: true });
    const { count: edges, error: e2 } = await supabase.from('clinical_event_edges').select('*', { count: 'exact', head: true });

    console.log(`Clinical Events: ${events} (Error: ${e1?.message || 'None'})`);
    console.log(`Clinical Edges:  ${edges} (Error: ${e2?.message || 'None'})`);
}

checkCounts();
