
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function bootstrap() {
    const userId = '1eb0f16a-226f-4d63-bf73-c75397d80d10';

    console.log("Bootstrapping patient for user:", userId);

    const { data: existing } = await supabase.from('patients').select('id').eq('user_id', userId).maybeSingle();

    if (existing) {
        console.log("Patient already exists:", existing.id);
        return;
    }

    const { data: newUser, error } = await supabase.from('patients').insert({
        user_id: userId,
        name: 'Rohit Kumar',
        dob: '1980-01-01',
        gender: 'Male',
        phone: '1234567890'
    }).select().single();

    if (error) {
        console.error("Failed to bootstrap patient:", error);
    } else {
        console.log("Successfully created patient record:", newUser.id);
    }
}

bootstrap();
