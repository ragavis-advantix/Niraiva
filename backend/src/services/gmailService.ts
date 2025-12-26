/**
 * Gmail Service - Import health report attachments from Gmail
 */

import { google } from 'googleapis';
import { getSupabaseAdminClient } from '../lib/supabaseClient';

const gmail = google.gmail('v1');

export class GmailService {
    private oauth2Client: any;

    constructor(accessToken: string) {
        this.oauth2Client = new google.auth.OAuth2();
        this.oauth2Client.setCredentials({ access_token: accessToken });
    }

    /**
     * List messages with attachments
     */
    async listMessagesWithAttachments(maxResults: number = 20) {
        try {
            const response = await gmail.users.messages.list({
                auth: this.oauth2Client,
                userId: 'me',
                q: 'has:attachment (filename:pdf OR filename:png OR filename:jpg OR filename:jpeg OR filename:json)',
                maxResults,
            });

            return response.data.messages || [];
        } catch (error: any) {
            console.error('Error listing Gmail messages:', error);
            throw new Error(`Failed to list Gmail messages: ${error.message}`);
        }
    }

    /**
     * Get message details including attachments
     */
    async getMessage(messageId: string) {
        try {
            const response = await gmail.users.messages.get({
                auth: this.oauth2Client,
                userId: 'me',
                id: messageId,
            });

            return response.data;
        } catch (error: any) {
            console.error('Error getting Gmail message:', error);
            throw new Error(`Failed to get Gmail message: ${error.message}`);
        }
    }

    /**
     * Get attachment data
     */
    async getAttachment(messageId: string, attachmentId: string) {
        try {
            const response = await gmail.users.messages.attachments.get({
                auth: this.oauth2Client,
                userId: 'me',
                messageId,
                id: attachmentId,
            });

            return response.data;
        } catch (error: any) {
            console.error('Error getting Gmail attachment:', error);
            throw new Error(`Failed to get Gmail attachment: ${error.message}`);
        }
    }

    /**
     * Import attachments from Gmail messages
     */
    async importAttachments(userId: string, messageIds: string[]) {
        const supabase = getSupabaseAdminClient();
        const imported: any[] = [];

        for (const messageId of messageIds) {
            try {
                const message = await this.getMessage(messageId);
                const parts = this.extractParts(message.payload);

                for (const part of parts) {
                    if (part.filename && part.body?.attachmentId) {
                        // Get attachment data
                        const attachment = await this.getAttachment(messageId, part.body.attachmentId);
                        const buffer = Buffer.from(attachment.data || '', 'base64url');

                        // Upload to Supabase Storage
                        const filePath = `${userId}/${Date.now()}-${part.filename}`;
                        const { error: uploadError } = await supabase.storage
                            .from(process.env.SUPABASE_BUCKET || 'reports')
                            .upload(filePath, buffer, {
                                contentType: part.mimeType || 'application/octet-stream',
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
                                source: 'gmail',
                                file_path: filePath,
                                filename: part.filename,
                                content_type: part.mimeType,
                                size: buffer.length,
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
                            provider: 'gmail',
                            provider_message_id: messageId,
                            provider_metadata: {
                                subject: message.payload?.headers?.find((h: any) => h.name === 'Subject')?.value,
                                from: message.payload?.headers?.find((h: any) => h.name === 'From')?.value,
                                date: message.payload?.headers?.find((h: any) => h.name === 'Date')?.value,
                            },
                        });

                        // Queue OCR job
                        await supabase.from('processing_jobs').insert({
                            report_id: report.id,
                            job_type: 'ocr',
                            status: 'pending',
                        });

                        imported.push(report);
                    }
                }
            } catch (error: any) {
                console.error(`Error importing message ${messageId}:`, error);
            }
        }

        return imported;
    }

    /**
     * Extract parts from message payload recursively
     */
    private extractParts(payload: any): any[] {
        const parts: any[] = [];

        if (payload.parts) {
            for (const part of payload.parts) {
                if (part.filename && part.body?.attachmentId) {
                    parts.push(part);
                }
                if (part.parts) {
                    parts.push(...this.extractParts(part));
                }
            }
        }

        return parts;
    }
}
