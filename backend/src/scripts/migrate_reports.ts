
import 'dotenv/config';
import { getSupabaseAdminClient } from '../lib/supabaseClient';

// Helper to parse dates
function parseDate(dateStr: string | null | undefined): string | null {
    if (!dateStr) return null;

    // Check for DD/MM/YYYY
    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateStr.match(ddmmyyyy);
    if (match) {
        return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`; // YYYY-MM-DD
    }

    // Attempt standard parsing
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
        return d.toISOString();
    }

    return null; // Fallback or keep as is? Postgres is picky.
}

async function migrateReports() {
    console.log('🚀 Starting Migration: Health Reports -> Clinical Events');
    const supabase = getSupabaseAdminClient();

    // 1. Fetch all health reports with their JSON data
    const { data: reports, error } = await supabase
        .from('health_reports')
        .select('*');

    if (error || !reports) {
        console.error('Error fetching reports:', error);
        return;
    }

    console.log(`Found ${reports.length} reports to process.`);

    const newEvents: any[] = [];

    for (const report of reports) {
        const jsonData = report.report_json;
        if (!jsonData || !jsonData.data) {
            console.log(`Skipping report ${report.id} - No JSON data`);
            continue;
        }

        const data = jsonData.data;
        const patientId = report.user_id; // Check schema inspection to verify column!

        // Use parsing helper
        const rawDocDate = jsonData.metadata?.documentDate || report.uploaded_at;
        const docDate = parseDate(rawDocDate) || new Date().toISOString();

        // A. Extract Conditions (Diagnoses)
        if (Array.isArray(data.conditions)) {
            data.conditions.forEach((cond: any) => {
                const updatedDate = parseDate(cond.date) || docDate;
                newEvents.push({
                    patient_id: patientId,
                    event_type: 'diagnosis',
                    event_name: cond.name || cond.condition || 'Unknown Condition',
                    event_date: updatedDate,
                    metadata: { ...cond, source_report_id: report.id } // Store full source info
                });
            });
        }

        // B. Extract Parameters (Lab Results / Vitals)
        if (Array.isArray(data.parameters)) {
            data.parameters.forEach((param: any) => {
                const updatedDate = parseDate(param.date) || docDate;
                newEvents.push({
                    patient_id: patientId,
                    event_type: 'lab_result',
                    event_name: param.name || param.testName || 'Unknown Test',
                    event_date: updatedDate,
                    metadata: {
                        value: param.value,
                        unit: param.unit,
                        test: param.name,
                        source_report_id: report.id
                    }
                });
            });
        }

        // C. Extract Medications
        if (Array.isArray(data.medications)) {
            data.medications.forEach((med: any) => {
                const updatedDate = parseDate(med.startDate) || docDate;
                newEvents.push({
                    patient_id: patientId,
                    event_type: 'medication',
                    event_name: med.name || med.medicationName || 'Unknown Medication',
                    event_date: updatedDate,
                    metadata: { ...med, source_report_id: report.id }
                });
            });
        }
    }

    console.log(`Extracted ${newEvents.length} distinct clinical events.`);

    if (newEvents.length === 0) {
        console.log('No events extracted. Check JSON structure.');
        return;
    }

    // 2. Insert into clinical_events
    // We'll insert in batches to be safe
    const BATCH_SIZE = 50;
    for (let i = 0; i < newEvents.length; i += BATCH_SIZE) {
        const batch = newEvents.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
            .from('clinical_events')
            .upsert(batch, { ignoreDuplicates: true });

        if (insertError) {
            console.error(`Error inserting batch ${i}:`, insertError);
        } else {
            console.log(`Inserted batch ${i} - ${i + batch.length}`);
        }
    }

    console.log('✅ Migration Complete.');
}

migrateReports();
