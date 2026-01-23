/**
 * Backfill Clinical Events (CORRECTED & PATCHED for FK - V3)
 * 
 * Extracts clinical events from existing health_reports (report_json column)
 * and populates the clinical_events table.
 * Includes patching of 'reports' and 'parsed_reports' tables to satisfy Foreign Keys.
 * uses parsed_reports.id as source_report_id for events.
 * Run with: npx ts-node src/scripts/backfill_clinical_events.ts
 */

import 'dotenv/config';
import { getSupabaseAdminClient } from '../lib/supabaseClient';
import { eventExtractionService } from '../modules/diagnostic-pathway/EventExtractionService';

async function backfillEvents() {
    console.log('🔄 Starting Clinical Events Backfill (FK Patch Version - V3 ParsedID)...');

    const url = process.env.SUPABASE_URL;
    console.log(`🔌 Connecting to Supabase at: ${url ? url.substring(0, 20) + '...' : 'UNDEFINED'}`);

    const supabase = getSupabaseAdminClient();

    // Check health_reports table
    const { count: reportsCount, error: reportsError } = await supabase
        .from('health_reports')
        .select('*', { count: 'exact', head: true });

    if (reportsError) console.error('❌ Error checking health_reports table:', reportsError);
    else console.log(`📊 Total health_reports in DB: ${reportsCount}`);

    // Fetch all health reports with JSON data
    const { data: reports, error } = await supabase
        .from('health_reports')
        .select('id, user_id, patient_id, report_json, uploaded_at')
        .not('report_json', 'is', null);

    if (error) {
        console.error('❌ Failed to fetch health reports:', error);
        return;
    }

    if (!reports || reports.length === 0) {
        console.log('ℹ️ No health reports found to process.');
        return;
    }

    console.log(`📋 Found ${reports.length} health reports. Processing...`);

    let successCount = 0;
    let failCount = 0;

    for (const report of reports) {
        try {
            const patientId = report.user_id || report.patient_id;

            if (!report.report_json) {
                console.log('  ⚠️ Skipping (Empty JSON)');
                continue;
            }

            // 0. Ensure reports table entry exists (Legacy FK constraint)
            const reportEntry = {
                id: report.id,
                user_id: patientId, // REQUIRED by reports table schema
                patient_id: patientId,
                status: 'parsed',
                created_at: report.uploaded_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const { error: reportError } = await supabase
                .from('reports')
                .upsert(reportEntry, { onConflict: 'id' });

            if (reportError) {
                // console.warn(`  ⚠️ Failed to backfill reports table: ${reportError.message}`);
            }

            // 1. Ensure parsed_reports entry exists and GET ID
            const parsedEntry = {
                report_id: report.id,
                patient_id: patientId,
                report_type: 'health_report',
                parsed_json: report.report_json,
                confidence: 1.0,
                status: 'confirmed',
                created_at: report.uploaded_at || new Date().toISOString()
            };

            const { data: parsedData, error: parsedError } = await supabase
                .from('parsed_reports')
                .upsert(parsedEntry, { onConflict: 'report_id' })
                .select('id')
                .single();

            if (parsedError) {
                // console.warn(`  ⚠️ Failed to backfill parsed_report: ${parsedError.message}`);
            }

            const sourceId = parsedData?.id || report.id;
            // console.log(`  -> Using sourceId: ${sourceId} (ReportID: ${report.id})`);

            // 2. Extract Events
            await eventExtractionService.processReportEvents(
                patientId,
                sourceId,
                report.report_json
            );

            successCount++;
            process.stdout.write('.'); // Compact progress
        } catch (err: any) {
            console.error(`\n❌ Failed to process report ${report.id}:`, err.message);
            failCount++;
        }
    }

    console.log('\n🏁 Backfill Complete');
    console.log(`✅ Successfully processed: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
}

backfillEvents().catch(console.error);
