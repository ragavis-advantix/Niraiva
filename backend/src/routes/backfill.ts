import express, { Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { eventExtractionService } from '../modules/diagnostic-pathway/EventExtractionService';
import { edgeConstructionService } from '../modules/diagnostic-pathway/EdgeConstructionService';

const router = express.Router();

/**
 * POST /api/backfill/extract-events-from-existing-reports
 * 
 * One-time operation to extract clinical events from all existing health reports
 * This backfills the clinical_events table for reports uploaded before event extraction was added
 */
router.post('/extract-events-from-existing-reports', async (req: Request, res: Response) => {
    try {
        console.log('🔄 [Backfill] Starting event extraction from existing reports...');

        // Fetch all existing health reports
        const { data: reports, error: reportsError } = await supabase
            .from('health_reports')
            .select('id, user_id, report_json')
            .limit(1000);

        if (reportsError) {
            console.error('❌ [Backfill] Error fetching reports:', reportsError);
            return res.status(500).json({ error: 'Failed to fetch reports' });
        }

        if (!reports || reports.length === 0) {
            console.log('ℹ️ [Backfill] No reports found to process');
            return res.json({ message: 'No reports to process', processed: 0 });
        }

        console.log(`📊 [Backfill] Found ${reports.length} reports to process`);

        let successCount = 0;
        let failureCount = 0;
        const processedPatients = new Set<string>();

        // Process each report
        for (const report of reports) {
            try {
                console.log(`\n📋 [Backfill] Processing report ${report.id} for user ${report.user_id}`);

                const reportJson = typeof report.report_json === 'string'
                    ? JSON.parse(report.report_json)
                    : report.report_json;

                // Extract events from this report
                const eventIds = await eventExtractionService.processReportEvents(
                    report.user_id,
                    report.id,
                    reportJson
                );

                if (eventIds.length > 0) {
                    console.log(`✅ [Backfill] Extracted ${eventIds.length} events from report ${report.id}`);
                    successCount++;
                    processedPatients.add(report.user_id);
                }
            } catch (error: any) {
                console.error(`❌ [Backfill] Error processing report ${report.id}:`, error.message);
                failureCount++;
            }
        }

        // After all reports processed, build edges for all affected patients
        console.log(`\n🔗 [Backfill] Building edges for ${processedPatients.size} patients...`);
        for (const patientId of processedPatients) {
            try {
                const edgeIds = await edgeConstructionService.constructEdges(patientId);
                console.log(`✅ [Backfill] Created ${edgeIds.length} edges for patient ${patientId}`);
            } catch (error: any) {
                console.error(`❌ [Backfill] Error building edges for patient ${patientId}:`, error.message);
            }
        }

        console.log(`\n✅ [Backfill] COMPLETE - Processed: ${successCount}, Failed: ${failureCount}`);

        res.json({
            message: 'Backfill complete',
            processed: successCount,
            failed: failureCount,
            patients: processedPatients.size
        });

    } catch (error: any) {
        console.error('❌ [Backfill] Critical error:', error);
        res.status(500).json({ error: error.message || 'Backfill failed' });
    }
});

/**
 * POST /api/backfill/fix-timeline-dates
 * 
 * Re-processes all timeline events to extract and set proper clinical dates
 * from their source reports. This fixes the grouping and sorting on the timeline.
 */
router.post('/fix-timeline-dates', async (req: Request, res: Response) => {
    try {
        const { extractClinicalDates, resolvePrimaryClinicialDate } = await import('../lib/clinicalDateExtraction');

        console.log('🔄 [Backfill] Starting timeline date fix...');

        // 1. Fetch all timeline events with their associated reports
        const { data: events, error: fetchErr } = await supabase
            .from('timeline_events')
            .select('id, source_report_id, metadata, clinical_event_date, report_date, event_time');

        if (fetchErr) throw fetchErr;

        console.log(`📊 [Backfill] Found ${events?.length || 0} events to check`);

        let updateCount = 0;

        for (const event of (events || [])) {
            const reportJson = event.metadata?.report_json || {};
            const parsedText = typeof reportJson.text === 'string' ? reportJson.text : JSON.stringify(reportJson);

            // Re-extract dates using improved logic
            const extracted = extractClinicalDates(parsedText, reportJson);
            const clinicalDate = resolvePrimaryClinicialDate(extracted);
            const reportDate = extracted.reportDate || extracted.labDate;

            // Only update if we found something new or different
            if (clinicalDate || reportDate) {
                const newEventTime = clinicalDate
                    ? new Date(clinicalDate).toISOString()
                    : (reportDate ? new Date(reportDate).toISOString() : event.event_time);

                const { error: updateErr } = await supabase
                    .from('timeline_events')
                    .update({
                        clinical_event_date: clinicalDate || event.clinical_event_date,
                        report_date: reportDate || event.report_date,
                        event_time: newEventTime
                    })
                    .eq('id', event.id);

                if (!updateErr) updateCount++;
            }
        }

        console.log(`✅ [Backfill] Fixed ${updateCount} timeline events`);
        res.json({ success: true, fixed: updateCount });

    } catch (err: any) {
        console.error('❌ [Backfill] Date fix failed:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
