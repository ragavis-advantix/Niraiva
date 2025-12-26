/**
 * Health Report Upload Routes
 * Handles file uploads, status checking, and report management
 */

import { Router, Request, Response } from 'express';
import formidable from 'formidable';
import { getSupabaseAdminClient } from '../lib/supabaseClient';
import fs from 'fs';
import path from 'path';

export const healthReportRouter = Router();

// Disable body parser for multipart/form-data
export const config = { api: { bodyParser: false } };

/**
 * POST /api/health-reports/upload
 * Upload a health report file (image, PDF, JSON)
 */
healthReportRouter.post('/upload', async (req: Request, res: Response) => {
    try {
        const form = formidable({
            maxFileSize: 20 * 1024 * 1024, // 20MB limit
            allowEmptyFiles: false,
            keepExtensions: true,
        });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                console.error('File upload error:', err);
                return res.status(400).json({
                    error: 'File upload failed',
                    details: err.message,
                });
            }

            // Extract fields
            const patientId = Array.isArray(fields.patientId) ? fields.patientId[0] : fields.patientId;
            const source = (Array.isArray(fields.source) ? fields.source[0] : fields.source) || 'upload';
            const sourceMeta = fields.source_meta
                ? JSON.parse(Array.isArray(fields.source_meta) ? fields.source_meta[0] : fields.source_meta)
                : null;

            // Extract file
            const file = Array.isArray(files.file) ? files.file[0] : files.file;

            if (!file || !patientId) {
                return res.status(400).json({
                    error: 'Missing required fields',
                    details: 'Both file and patientId are required',
                });
            }

            // Validate file type
            const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf', 'application/json'];
            if (file.mimetype && !allowedTypes.includes(file.mimetype)) {
                return res.status(400).json({
                    error: 'Invalid file type',
                    details: `Allowed types: ${allowedTypes.join(', ')}`,
                });
            }

            try {
                // Read file buffer
                const fileBuffer = fs.readFileSync(file.filepath);
                const fileExt = path.extname(file.originalFilename || file.newFilename || '').toLowerCase();
                const timestamp = Date.now();
                const storagePath = `${patientId}/${timestamp}_${file.originalFilename || file.newFilename}`;

                // Upload to Supabase Storage
                const supabase = getSupabaseAdminClient();
                const bucketName = process.env.SUPABASE_BUCKET || 'reports';

                console.log(`📤 Uploading file to Supabase: ${storagePath}`);

                const { error: uploadError } = await supabase.storage
                    .from(bucketName)
                    .upload(storagePath, fileBuffer, {
                        contentType: file.mimetype || 'application/octet-stream',
                        upsert: false,
                    });

                if (uploadError) {
                    console.error('Supabase storage error:', uploadError);
                    return res.status(500).json({
                        error: 'Storage upload failed',
                        details: uploadError.message,
                    });
                }

                // Insert metadata into reports table
                const { data: report, error: dbError } = await supabase
                    .from('reports')
                    .insert({
                        patient_id: patientId,
                        uploader_id: (req as any).user?.id || null,
                        original_filename: file.originalFilename || file.newFilename,
                        storage_path: storagePath,
                        content_type: file.mimetype,
                        size_bytes: file.size,
                        source,
                        source_meta: sourceMeta,
                        status: 'uploaded',
                    })
                    .select()
                    .single();

                if (dbError) {
                    console.error('Database insert error:', dbError);
                    // Clean up uploaded file
                    await supabase.storage.from(bucketName).remove([storagePath]);
                    return res.status(500).json({
                        error: 'Database insert failed',
                        details: dbError.message,
                    });
                }

                // Create initial processing job (OCR)
                const { error: jobError } = await supabase.from('processing_jobs').insert({
                    report_id: report.id,
                    job_type: 'ocr',
                    status: 'pending',
                });

                if (jobError) {
                    console.warn('Failed to create processing job:', jobError);
                }

                console.log(`✅ File uploaded successfully: ${report.id}`);

                res.json({
                    success: true,
                    reportId: report.id,
                    message: 'File uploaded successfully. Processing started.',
                    report: {
                        id: report.id,
                        filename: report.original_filename,
                        status: report.status,
                        created_at: report.created_at,
                    },
                });
            } catch (error: any) {
                console.error('Upload processing error:', error);
                return res.status(500).json({
                    error: 'Internal server error',
                    details: error.message,
                });
            } finally {
                // Clean up temp file
                if (file.filepath && fs.existsSync(file.filepath)) {
                    fs.unlinkSync(file.filepath);
                }
            }
        });
    } catch (error: any) {
        console.error('Upload route error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message,
        });
    }
});

/**
 * GET /api/health-reports/:id/status
 * Get processing status and parsed data for a report
 */
healthReportRouter.get('/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const supabase = getSupabaseAdminClient();

        const { data: report, error } = await supabase
            .from('reports')
            .select(`
                *,
                parsed_reports(*),
                processing_jobs(*)
            `)
            .eq('id', id)
            .single();

        if (error || !report) {
            return res.status(404).json({
                error: 'Report not found',
                details: error?.message,
            });
        }

        // Calculate overall progress
        const jobs = report.processing_jobs || [];
        const totalJobs = jobs.length;
        const completedJobs = jobs.filter((j: any) => j.status === 'success').length;
        const failedJobs = jobs.filter((j: any) => j.status === 'failed').length;
        const progress = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

        res.json({
            report: {
                id: report.id,
                filename: report.original_filename,
                status: report.status,
                source: report.source,
                created_at: report.created_at,
            },
            processing: {
                progress: Math.round(progress),
                jobs: jobs.map((j: any) => ({
                    type: j.job_type,
                    status: j.status,
                    attempts: j.attempts,
                    error: j.last_error,
                })),
            },
            parsed: report.parsed_reports?.[0] || null,
        });
    } catch (error: any) {
        console.error('Status check error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message,
        });
    }
});

/**
 * GET /api/health-reports/patient/:patientId
 * Get all reports for a patient
 */
healthReportRouter.get('/patient/:patientId', async (req: Request, res: Response) => {
    try {
        const { patientId } = req.params;
        const supabase = getSupabaseAdminClient();

        const { data: reports, error } = await supabase
            .from('reports')
            .select(`
                *,
                parsed_reports(id, report_type, confidence, status)
            `)
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });

        if (error) {
            return res.status(500).json({
                error: 'Database query failed',
                details: error.message,
            });
        }

        res.json({
            success: true,
            count: reports?.length || 0,
            reports: reports || [],
        });
    } catch (error: any) {
        console.error('Patient reports query error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message,
        });
    }
});

/**
 * POST /api/health-reports/:id/confirm
 * Confirm parsed report data (after user review)
 */
healthReportRouter.post('/:id/confirm', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { parsedData, corrections } = req.body;
        const supabase = getSupabaseAdminClient();

        // Update parsed_reports status
        const { error: updateError } = await supabase
            .from('parsed_reports')
            .update({
                status: 'confirmed',
                confirmed_by: (req as any).user?.id || null,
                confirmed_at: new Date().toISOString(),
                parsed_json: corrections || parsedData,
            })
            .eq('report_id', id);

        if (updateError) {
            return res.status(500).json({
                error: 'Update failed',
                details: updateError.message,
            });
        }

        // Create FHIR mapping job
        await supabase.from('processing_jobs').insert({
            report_id: id,
            job_type: 'fhir-map',
            status: 'pending',
        });

        res.json({
            success: true,
            message: 'Report confirmed. FHIR mapping queued.',
        });
    } catch (error: any) {
        console.error('Confirm report error:', error);
        res.status(500).json({
            error: 'Internal server error',
            details: error.message,
        });
    }
});
