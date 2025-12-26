/**
 * Google Drive Service - Import health report files from Google Drive
 */

import { google } from 'googleapis';
import { getSupabaseAdminClient } from '../lib/supabaseClient';

const drive = google.drive('v3');

export class DriveService {
    private oauth2Client: any;

    constructor(accessToken: string) {
        this.oauth2Client = new google.auth.OAuth2();
        this.oauth2Client.setCredentials({ access_token: accessToken });
    }

    /**
     * List files from Google Drive
     */
    async listFiles(maxResults: number = 50) {
        try {
            const response = await drive.files.list({
                auth: this.oauth2Client,
                pageSize: maxResults,
                fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink)',
                q: "mimeType='application/pdf' or mimeType='image/png' or mimeType='image/jpeg' or mimeType='application/json'",
                orderBy: 'modifiedTime desc',
            });

            return response.data.files || [];
        } catch (error: any) {
            console.error('Error listing Drive files:', error);
            throw new Error(`Failed to list Drive files: ${error.message}`);
        }
    }

    /**
     * Get file metadata
     */
    async getFile(fileId: string) {
        try {
            const response = await drive.files.get({
                auth: this.oauth2Client,
                fileId,
                fields: 'id, name, mimeType, size, createdTime, modifiedTime, webViewLink',
            });

            return response.data;
        } catch (error: any) {
            console.error('Error getting Drive file:', error);
            throw new Error(`Failed to get Drive file: ${error.message}`);
        }
    }

    /**
     * Download file content
     */
    async downloadFile(fileId: string) {
        try {
            const response = await drive.files.get(
                {
                    auth: this.oauth2Client,
                    fileId,
                    alt: 'media',
                },
                { responseType: 'arraybuffer' }
            );

            return Buffer.from(response.data as ArrayBuffer);
        } catch (error: any) {
            console.error('Error downloading Drive file:', error);
            throw new Error(`Failed to download Drive file: ${error.message}`);
        }
    }

    /**
     * Import files from Google Drive
     */
    async importFiles(userId: string, fileIds: string[]) {
        const supabase = getSupabaseAdminClient();
        const imported: any[] = [];

        for (const fileId of fileIds) {
            try {
                // Get file metadata
                const fileMetadata = await this.getFile(fileId);

                // Download file content
                const buffer = await this.downloadFile(fileId);

                // Upload to Supabase Storage
                const filePath = `${userId}/${Date.now()}-${fileMetadata.name}`;
                const { error: uploadError } = await supabase.storage
                    .from(process.env.SUPABASE_BUCKET || 'reports')
                    .upload(filePath, buffer, {
                        contentType: fileMetadata.mimeType || 'application/octet-stream',
                    });

                if (uploadError) {
                    console.error('Upload error:', uploadError);
                    continue;
                }

                // Create report record
                const { data: report, error: reportError } = await supabase
                    .from('reports')
                    .insert({
                        patient_id: userId,
                        source: 'drive',
                        file_path: filePath,
                        filename: fileMetadata.name || 'unknown',
                        content_type: fileMetadata.mimeType,
                        size: parseInt(fileMetadata.size || '0'),
                        status: 'uploaded',
                    })
                    .select()
                    .single();

                if (reportError) {
                    console.error('Report creation error:', reportError);
                    continue;
                }

                // Create report source record
                await supabase.from('report_sources').insert({
                    report_id: report.id,
                    provider: 'drive',
                    provider_file_id: fileId,
                    provider_metadata: {
                        name: fileMetadata.name,
                        webViewLink: fileMetadata.webViewLink,
                        createdTime: fileMetadata.createdTime,
                        modifiedTime: fileMetadata.modifiedTime,
                    },
                });

                // Queue OCR job
                await supabase.from('processing_jobs').insert({
                    report_id: report.id,
                    job_type: 'ocr',
                    status: 'pending',
                });

                imported.push(report);
            } catch (error: any) {
                console.error(`Error importing file ${fileId}:`, error);
            }
        }

        return imported;
    }
}
