
import 'dotenv/config';
import { getSupabaseAdminClient } from '../lib/supabaseClient';

async function debugSchema() {
    console.log('🔍 Debugging Reports Schema...');
    const supabase = getSupabaseAdminClient();

    // Try to insert a dummy row into reports to see what fails
    // Use a random UUID to avoid conflicts
    const dummyId = '00000000-0000-0000-0000-000000000000';

    console.log('Attemping insert into reports...');
    const { error } = await supabase.from('reports').insert({
        id: dummyId,
        // minimal fields
    });

    if (error) {
        console.error('❌ Insert failed:', error);
    } else {
        console.log('✅ Insert succeeded! (Deleting now)');
        await supabase.from('reports').delete().eq('id', dummyId);
    }
}

debugSchema();
