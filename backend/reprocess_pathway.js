
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const { eventExtractionService } = require('./src/modules/diagnostic-pathway/EventExtractionService');
const { edgeConstructionService } = require('./src/modules/diagnostic-pathway/EdgeConstructionService');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function reprocess() {
    console.log("--- REPROCESSING CLINICAL EVENTS ---");

    const { data: reports, error } = await supabase.from('health_reports').select('*');
    if (error) {
        console.error("Error fetching reports:", error);
        return;
    }

    console.log(`Processing ${reports.length} reports...`);

    for (const report of reports) {
        console.log(`\n📄 Report: ${report.id} (User: ${report.user_id})`);

        try {
            const eventIds = await eventExtractionService.processReportEvents(
                report.user_id,
                report.id,
                report.report_json
            );

            console.log(`✅ Extracted ${eventIds.length} events`);

            await edgeConstructionService.constructEdges(report.user_id);
            console.log(`✅ Edges reconstructed for user`);
        } catch (e) {
            console.error(`❌ Failed for report ${report.id}:`, e.message);
        }
    }

    console.log("\n--- REPROCESSING COMPLETE ---");
}

reprocess();
