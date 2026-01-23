/**
 * Health Report Background Worker
 * Processes OCR, AI parsing, and FHIR mapping jobs
 * 
 * Run this as a separate process:
 * ts-node src/workers/reportProcessor.ts
 */

import 'dotenv/config';
import { getSupabaseAdminClient } from '../lib/supabaseClient';
import { OCRService } from '../services/ocrService';
import { MultiLLMService } from '../services/MultiLLMService';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { eventExtractionService } from '../modules/diagnostic-pathway/EventExtractionService';

const POLL_INTERVAL = parseInt(process.env.WORKER_POLL_INTERVAL || '5000'); // 5 seconds
const MAX_CONCURRENT_JOBS = parseInt(process.env.WORKER_MAX_CONCURRENT || '3');

let ocrService: OCRService | null = null;
let multiLLMService: MultiLLMService | null = null;

// Initialize services
try {
    ocrService = new OCRService();
    multiLLMService = new MultiLLMService();
} catch (error: any) {
    console.error('❌ Failed to initialize services:', error.message);
    console.error('Worker will continue but jobs will fail without API keys');
}

/**
 * Main job processing loop
 */
async function processJobs() {
    const supabase = getSupabaseAdminClient();

    try {
        // Fetch pending jobs (not failed more than max_attempts)
        const { data: jobs, error } = await supabase
            .from('processing_jobs')
            .select('*, reports(*)')
            .eq('status', 'pending')
            .lt('attempts', 3)
            .order('created_at', { ascending: true })
            .limit(MAX_CONCURRENT_JOBS);

        if (error) {
            console.error('Error fetching jobs:', error);
            return;
        }

        if (!jobs || jobs.length === 0) {
            return; // No jobs to process
        }

        console.log(`📋 Processing ${jobs.length} job(s)...`);

        // Process jobs concurrently
        await Promise.all(jobs.map(job => processJob(job)));

    } catch (error: any) {
        console.error('Job processing loop error:', error.message);
    }
}

/**
 * Process a single job
 */
async function processJob(job: any) {
    const supabase = getSupabaseAdminClient();

    try {
        // Mark as running
        await supabase
            .from('processing_jobs')
            .update({
                status: 'running',
                updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

        console.log(`🔄 Processing job ${job.id} (${job.job_type}) for report ${job.report_id}`);

        // Route to appropriate handler
        if (job.job_type === 'ocr') {
            await processOCRJob(job);
        } else if (job.job_type === 'ai-parse') {
            await processAIParseJob(job);
        } else if (job.job_type === 'fhir-map') {
            await processFHIRMapJob(job);
        } else {
            throw new Error(`Unknown job type: ${job.job_type}`);
        }

        // Mark as success
        await supabase
            .from('processing_jobs')
            .update({
                status: 'success',
                updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

        console.log(`✅ Job ${job.id} completed successfully`);

    } catch (error: any) {
        console.error(`❌ Job ${job.id} failed:`, error.message);

        const newAttempts = job.attempts + 1;
        const newStatus = newAttempts >= 3 ? 'failed' : 'pending';

        await supabase
            .from('processing_jobs')
            .update({
                status: newStatus,
                attempts: newAttempts,
                last_error: error.message,
                updated_at: new Date().toISOString(),
            })
            .eq('id', job.id);

        // Update report status if job permanently failed
        if (newStatus === 'failed') {
            await supabase
                .from('reports')
                .update({ status: 'failed' })
                .eq('id', job.report_id);
        }
    }
}

/**
 * Process OCR job - extract text from file
 */
async function processOCRJob(job: any) {
    if (!ocrService) {
        throw new Error('OCR service not initialized - check OCRSPACE_API_KEY');
    }

    const supabase = getSupabaseAdminClient();
    const bucketName = process.env.SUPABASE_BUCKET || 'reports';

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(job.reports.storage_path);

    if (downloadError) {
        throw new Error(`File download failed: ${downloadError.message}`);
    }

    // Save to temp file
    const tempDir = process.env.TEMP || '/tmp';
    const tempPath = path.join(tempDir, `${job.report_id}_${Date.now()}`);
    const buffer = Buffer.from(await fileData.arrayBuffer());
    fs.writeFileSync(tempPath, buffer);

    try {
        // Run OCR
        const ocrResult = await ocrService.processFile(tempPath);

        // Store OCR text in job metadata
        await supabase
            .from('processing_jobs')
            .update({
                metadata: {
                    ocr_text: ocrResult.text,
                    ocr_confidence: ocrResult.confidence,
                    ocr_language: ocrResult.language,
                },
            })
            .eq('id', job.id);

        // Update report status
        await supabase
            .from('reports')
            .update({ status: 'processing' })
            .eq('id', job.report_id);

        // Create next job: AI parsing
        await supabase.from('processing_jobs').insert({
            report_id: job.report_id,
            job_type: 'ai-parse',
            status: 'pending',
        });

        console.log(`✅ OCR completed for report ${job.report_id} (${ocrResult.text.length} chars)`);
    } finally {
        // Clean up temp file
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
    }
}

/**
 * Process AI parsing job - extract structured data with Gemini
 */
async function processAIParseJob(job: any) {
    if (!multiLLMService) {
        throw new Error('MultiLLMService not initialized');
    }

    const supabase = getSupabaseAdminClient();

    // Get OCR text from previous job
    const { data: ocrJob, error: ocrError } = await supabase
        .from('processing_jobs')
        .select('metadata')
        .eq('report_id', job.report_id)
        .eq('job_type', 'ocr')
        .eq('status', 'success')
        .single();

    if (ocrError || !ocrJob?.metadata?.ocr_text) {
        throw new Error('OCR text not found - OCR job may have failed');
    }

    // Parse with MultiLLMService
    const { data: parsed, provider } = await multiLLMService.parseReport(ocrJob.metadata.ocr_text);

    // Save to parsed_reports
    const { error: insertError } = await supabase.from('parsed_reports').insert({
        report_id: job.report_id,
        patient_id: job.reports.patient_id,
        report_type: parsed.type,
        fhir_bundle: parsed.fhir_bundle,
        parsed_json: parsed,
        confidence: parsed.confidence,
        ai_meta: {
            model: provider,
            timestamp: new Date().toISOString(),
            ocr_confidence: ocrJob.metadata.ocr_confidence,
        },
    });

    if (insertError) {
        throw new Error(`Failed to save parsed report: ${insertError.message}`);
    }

    // 📊 Sync Health Snapshot
    try {
        const patientId = job.reports.patient_id;
        console.log(`🔄 Syncing health snapshot for user: ${patientId}`);
        const { data: existing } = await supabase
            .from('patient_health_snapshot')
            .select('*')
            .eq('patient_id', patientId)
            .maybeSingle();

        const data = (parsed as any).data || parsed;
        const parsedParams = data.parameters || data.tests || [];

        // Robust condition extractor (Canonical Mapping)
        const extractChronicConditions = (p: any): string[] | null => {
            const list = new Set<string>();

            // 1. Structural checks
            const checkField = (f: any) => {
                if (!f) return;
                if (Array.isArray(f)) {
                    f.forEach(c => {
                        const name = typeof c === 'string' ? c : (c.name || c.condition || c.diagnosis);
                        if (name && typeof name === 'string') list.add(name);
                    });
                } else if (typeof f === 'object') {
                    const name = f.name || f.condition || f.diagnosis;
                    if (name && typeof name === 'string') list.add(name);
                }
            };

            checkField(p.conditions);
            checkField(p.diagnosis);
            checkField(p.chronic_conditions);
            checkField(p.clinical_diagnosis);

            // 2. Keyword/Heuristic checks in blobs of text
            const textSource = [
                p.summary,
                p.assessment,
                p.conclusions,
                p.clinical_notes,
                p.interpretation
            ].filter(s => typeof s === 'string').join(' ').toLowerCase();

            if (textSource.includes("neuropathy")) list.add("Peripheral Neuropathy");
            if (textSource.includes("prediabetic") || textSource.includes("pre-diabetic")) list.add("Pre-diabetes");
            if (textSource.includes("diabetes") || textSource.includes("diabetic")) {
                if (!textSource.includes("pre")) list.add("Diabetes Mellitus");
            }
            if (textSource.includes("hypertension") || textSource.includes("high blood pressure")) list.add("Hypertension");
            if (textSource.includes("hypothyroid")) list.add("Hypothyroidism");
            if (textSource.includes("hyperlipid") || textSource.includes("cholesterol")) list.add("Dyslipidemia");

            return list.size > 0 ? Array.from(list) : null;
        };

        const parsedConditions = extractChronicConditions(data);

        const findParam = (names: string[]) => {
            const p = parsedParams.find((p: any) => {
                const pName = (p.name || p.parameter || "").toLowerCase();
                return names.some(n => pName.includes(n));
            });
            if (!p || p.value === null || p.value === undefined) return null;
            const val = typeof p.value === 'number' ? p.value : parseFloat(String(p.value));
            return isNaN(val) ? null : val;
        };

        const systolic = findParam(['systolic blood pressure', 'systolic bp']);
        const diastolic = findParam(['diastolic blood pressure', 'diastolic bp']);
        const heart_rate = findParam(['heart rate', 'pulse']);
        const spo2 = findParam(['oxygen saturation', 'spo2']);
        const temperature = findParam(['temperature', 'body temperature']);
        const hba1c = findParam(['hba1c', 'hb a1c']);
        const ldl = findParam(['ldl cholesterol', 'ldl']);
        const b12 = findParam(['vitamin b12', 'b12']);

        // Merge logic
        const existingConditions = existing?.chronic_conditions || [];
        const mergedConditions = parsedConditions !== null
            ? Array.from(new Set([...existingConditions, ...parsedConditions]))
            : existingConditions;

        const updatedSnapshot: any = {
            patient_id: patientId,
            systolic_bp: systolic ?? existing?.systolic_bp,
            diastolic_bp: diastolic ?? existing?.diastolic_bp,
            heart_rate: heart_rate ?? existing?.heart_rate,
            spo2: spo2 ?? existing?.spo2,
            temperature: temperature ?? existing?.temperature,
            hba1c: hba1c ?? existing?.hba1c,
            ldl: ldl ?? existing?.ldl,
            vitamin_b12: b12 ?? existing?.vitamin_b12,

            // UPDATE: Accumulate conditions instead of replacing
            chronic_conditions: mergedConditions,

            source_report_id: job.report_id,
            last_updated: new Date().toISOString()
        };

        const hasNewData = [systolic, diastolic, heart_rate, spo2, temperature, hba1c, ldl, b12].some(v => v !== null) || parsedConditions !== null;

        if (hasNewData) {
            await supabase.from('patient_health_snapshot').upsert(updatedSnapshot);
            console.log(`✅ Health snapshot updated for user: ${patientId}`);
        }
    } catch (snapErr: any) {
        console.warn(`⚠️ Failed to sync health snapshot: ${snapErr.message}`);
    }

    // 🏥 Extract Clinical Events for Diagnostic Pathway
    try {
        console.log(`🔍 Extracting clinical events for report ${job.report_id}...`);
        await eventExtractionService.processReportEvents(
            job.reports.patient_id,
            job.report_id,
            parsed
        );
    } catch (eventErr: any) {
        console.error(`⚠️ Failed to extract clinical events: ${eventErr.message}`);
        // Continue - don't fail the whole job for this
    }

    // Update report status
    await supabase
        .from('reports')
        .update({ status: 'parsed' })
        .eq('id', job.report_id);

    console.log(`✅ AI parsing completed for report ${job.report_id} (type: ${parsed.type}, confidence: ${parsed.confidence})`);
}

/**
 * Process FHIR mapping job - send to HAPI FHIR server
 */
async function processFHIRMapJob(job: any) {
    const supabase = getSupabaseAdminClient();

    // Get parsed report
    const { data: parsedReport, error: parseError } = await supabase
        .from('parsed_reports')
        .select('fhir_bundle')
        .eq('report_id', job.report_id)
        .eq('status', 'confirmed')
        .single();

    if (parseError || !parsedReport?.fhir_bundle) {
        throw new Error('Parsed report not found or not confirmed');
    }

    const hapiFhirUrl = process.env.HAPI_FHIR_BASE_URL || 'http://localhost:8080/fhir';

    try {
        // Send FHIR bundle to HAPI server
        const response = await axios.post(
            `${hapiFhirUrl}/`,
            parsedReport.fhir_bundle,
            {
                headers: {
                    'Content-Type': 'application/fhir+json',
                },
                timeout: 30000,
            }
        );

        if (response.status >= 200 && response.status < 300) {
            console.log(`✅ FHIR bundle sent to HAPI for report ${job.report_id}`);
        } else {
            throw new Error(`HAPI FHIR returned status ${response.status}`);
        }
    } catch (error: any) {
        throw new Error(`FHIR mapping failed: ${error.message}`);
    }
}

/**
 * Start the worker
 */
async function startWorker() {
    console.log('🔄 Health Report Processor Worker Started');
    console.log(`   Poll interval: ${POLL_INTERVAL}ms`);
    console.log(`   Max concurrent: ${MAX_CONCURRENT_JOBS}`);
    console.log(`   OCR Service: ${ocrService ? '✅' : '❌'}`);
    console.log(`   MultiLLM Service: ${multiLLMService ? '✅' : '❌'}`);
    console.log('');

    // Initial run
    await processJobs();

    // Set up interval
    setInterval(async () => {
        await processJobs();
    }, POLL_INTERVAL);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Worker shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Worker shutting down gracefully...');
    process.exit(0);
});

// Start the worker
startWorker().catch((error) => {
    console.error('❌ Worker failed to start:', error);
    process.exit(1);
});
