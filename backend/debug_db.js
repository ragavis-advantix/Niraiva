
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function debug() {
    console.log("Checking tables...");

    const { data: patients, error: pErr } = await supabase.from('patient_master').select('id').limit(5);
    console.log("patient_master sample:", patients, pErr);

    const { data: roles, error: rErr } = await supabase.from('user_roles').select('*').limit(5);
    console.log("user_roles sample:", roles, rErr);

    const { data: events, error: eErr } = await supabase.from('timeline_events').select('id, patient_id').limit(5);
    console.log("timeline_events sample:", events, eErr);
}

debug();
