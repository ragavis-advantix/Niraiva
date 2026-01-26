
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { eventExtractionService } from './src/modules/diagnostic-pathway/EventExtractionService';
import { edgeConstructionService } from './src/modules/diagnostic-pathway/EdgeConstructionService';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reprocess() {
    console.log("--- REPROCESSING CLINICAL EVENTS (TS) ---");

    const { data: reports, error } = await supabase.from('health_reports').select('*');
    if (error) {
        console.error("Error fetching reports:", error);
        return;
    }

    console.log(`Processing ${reports.length} reports...`);

    const processedUsers = new Set<string>();

    for (const report of reports) {
        console.log(`\n📄 Report: ${report.id} (User: ${report.user_id})`);

        try {
            const eventIds = await eventExtractionService.processReportEvents(
                report.user_id,
                report.id,
                report.report_json
            );

            console.log(`✅ Extracted ${eventIds.length} events`);
            processedUsers.add(report.user_id);
        } catch (e: any) {
            console.error(`❌ Failed for report ${report.id}:`, e.message);
        }
    }

    console.log("\n--- CONSTRUCTING EDGES ---");
    for (const userId of processedUsers) {
        try {
            const edgeIds = await edgeConstructionService.constructEdges(userId);
            console.log(`✅ Edges reconstructed for user ${userId}: ${edgeIds.length}`);
        } catch (e: any) {
            console.error(`❌ Edge construction failed for user ${userId}:`, e.message);
        }
    }

    console.log("\n--- REPROCESSING COMPLETE ---");
}

reprocess();
