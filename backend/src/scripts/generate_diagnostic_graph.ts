/**
 * Generate Diagnostic Graph (Complete Pipeline)
 * 
 * This script converts parsed health reports into a diagnostic graph (nodes & edges).
 * It includes robust handling for missing dependency records (reports/parsed_reports)
 * to ensure foreign key constraints are satisfied.
 * 
 * Usage: npx ts-node src/scripts/generate_diagnostic_graph.ts
 */

import 'dotenv/config';
import { getSupabaseAdminClient } from '../lib/supabaseClient';
import { eventExtractionService } from '../modules/diagnostic-pathway/EventExtractionService';
import { edgeConstructionService } from '../modules/diagnostic-pathway/EdgeConstructionService';

async function generateGraph() {
    console.log('🚀 Starting Diagnostic Graph Generation...');

    const supabase = getSupabaseAdminClient();

    // 1. Fetch all Health Reports (The source of truth)
    const { data: reports, error } = await supabase
        .from('health_reports')
        .select('id, user_id, patient_id, report_json, uploaded_at')
        .not('report_json', 'is', null);

    if (error) {
        console.error('❌ Failed to fetch health reports:', error);
        return;
    }

    if (!reports || reports.length === 0) {
        console.log('ℹ️ No health reports found.');
        return;
    }

    console.log(`📋 Found ${reports.length} health reports. Processing...`);

    const processedPatients = new Set<string>();
    let successCount = 0;

    for (const report of reports) {
        try {
            const patientId = report.user_id || report.patient_id;
            if (!patientId) continue;

            process.stdout.write(`Processing Report ${report.id.substring(0, 8)}... `);

            // STEP 1: Satisfy "reports" table Foreign Key
            // Some schemas require a parent 'reports' entry
            const reportEntry = {
                id: report.id,
                user_id: patientId,
                patient_id: patientId,
                status: 'parsed',
                created_at: report.uploaded_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            await supabase
                .from('reports')
                .upsert(reportEntry, { onConflict: 'id' });

            // STEP 2: Satisfy "parsed_reports" table Foreign Key
            // This is often the direct parent of clinical_events
            const parsedEntry = {
                report_id: report.id,
                patient_id: patientId,
                report_type: 'health_report',
                parsed_json: report.report_json,
                confidence: 1.0,
                status: 'confirmed',
                created_at: report.uploaded_at || new Date().toISOString()
            };

            const { data: parsedData } = await supabase
                .from('parsed_reports')
                .upsert(parsedEntry, { onConflict: 'report_id' })
                .select('id')
                .single();

            // Prefer the ID from parsed_reports if it exists (some schemas use serial IDs or generated UUIDs)
            // Otherwise fall back to the health_report ID
            const sourceId = parsedData?.id || report.id;

            // STEP 3: Extract Clinical Events (NODES)
            // This populates the 'clinical_events' table
            const eventIds = await eventExtractionService.processReportEvents(
                patientId,
                sourceId,
                report.report_json
            );

            console.log(`✅ Extracted ${eventIds.length} nodes`);
            processedPatients.add(patientId);
            successCount++;

        } catch (err: any) {
            console.log(`❌ Error: ${err.message}`);
        }
    }

    // STEP 4: Construct Edges (RELATIONSHIPS)
    // Run this once per patient after all their events are extracted
    console.log(`\n🔗 Constructing Graph Edges for ${processedPatients.size} patients...`);

    for (const patientId of processedPatients) {
        try {
            const edgeIds = await edgeConstructionService.constructEdges(patientId);
            console.log(`  Patient ${patientId}: Created ${edgeIds.length} edges`);
        } catch (err: any) {
            console.error(`  ❌ Edge generation failed for ${patientId}:`, err.message);
        }
    }

    console.log('\n🏁 Graph Generation Complete');
}

generateGraph().catch(console.error);
