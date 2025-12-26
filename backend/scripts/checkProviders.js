const path = require("path");

require("dotenv").config({
    path: path.resolve(__dirname, "../.env"),
});

const fetch = global.fetch;

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env");
    process.exit(1);
}

const url = `${process.env.SUPABASE_URL}/auth/v1/admin/settings`;

fetch(url, {
    headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
})
    .then(async (res) => {
        const text = await res.text();
        if (!res.ok) {
            throw new Error(`Failed to fetch settings: ${res.status} ${res.statusText}\n${text}`);
        }
        console.log(text);
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });

