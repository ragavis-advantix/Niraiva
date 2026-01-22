
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    console.log("Checking chat_sessions constraints...");

    // Attempt to use information_schema (might be readable if permissions allow)
    const { data: constraints, error } = await supabase
        .from('information_schema.referential_constraints')
        .select('*');

    if (error) {
        console.log("information_schema query failed:", error.message);
    } else {
        console.log("Constraints:", constraints);
    }

    // Try to find what chat_sessions.patient_id references by asking for all tables
    const { data: tables } = await supabase.from('information_schema.tables').select('table_name').eq('table_schema', 'public');
    console.log("Tables in public:", tables?.map(t => t.table_name));
}

checkSchema();
