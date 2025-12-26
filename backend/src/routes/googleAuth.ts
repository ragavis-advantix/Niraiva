/**
 * Google OAuth Routes - Gmail and Drive authentication
 */

import express, { Request, Response } from 'express';
import { google } from 'googleapis';
import { getSupabaseAdminClient } from '../lib/supabaseClient';
import { GmailService } from '../services/gmailService';
import { DriveService } from '../services/driveService';

const router = express.Router();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

/**
 * GET /api/google/gmail/start
 * Initiate Gmail OAuth flow
 */
router.get('/gmail/start', (req: Request, res: Response) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
        ],
        prompt: 'consent',
        state: 'gmail', // Track which service is being authorized
    });

    res.redirect(authUrl);
});

/**
 * GET /api/google/drive/start
 * Initiate Google Drive OAuth flow
 */
router.get('/drive/start', (req: Request, res: Response) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/userinfo.email',
        ],
        prompt: 'consent',
        state: 'drive', // Track which service is being authorized
    });

    res.redirect(authUrl);
});

/**
 * GET /api/google/callback
 * OAuth callback handler
 */
router.get('/callback', async (req: Request, res: Response) => {
    try {
        const code = req.query.code as string;
        const state = req.query.state as string; // 'gmail' or 'drive'

        if (!code) {
            return res.redirect('/upload-reports?error=no_code');
        }

        // Exchange code for tokens
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Get user info
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
        const { data: userInfo } = await oauth2.userinfo.get();

        // TODO: Get user ID from session/JWT
        // For now, using email as identifier (you should use proper auth)
        const userId = (req as any).user?.id || userInfo.email;

        if (!userId) {
            return res.redirect('/upload-reports?error=no_user');
        }

        // Store tokens in Supabase
        const supabase = getSupabaseAdminClient();
        const { error } = await supabase
            .from('user_oauth_tokens')
            .upsert({
                user_id: userId,
                google_access_token: tokens.access_token,
                google_refresh_token: tokens.refresh_token,
                google_token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
                gmail_enabled: state === 'gmail',
                drive_enabled: state === 'drive',
                updated_at: new Date(),
            });

        if (error) {
            console.error('Error storing tokens:', error);
            return res.redirect('/upload-reports?error=token_storage_failed');
        }

        // Redirect back to upload page with success
        res.redirect(`/upload-reports?google_linked=${state}`);
    } catch (error: any) {
        console.error('OAuth callback error:', error);
        res.redirect('/upload-reports?error=oauth_failed');
    }
});

/**
 * GET /api/google/status
 * Check OAuth connection status
 */
router.get('/status', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const supabase = getSupabaseAdminClient();
        const { data, error } = await supabase
            .from('user_oauth_tokens')
            .select('gmail_enabled, drive_enabled, google_token_expiry')
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            return res.json({
                gmail_connected: false,
                drive_connected: false,
            });
        }

        res.json({
            gmail_connected: data.gmail_enabled,
            drive_connected: data.drive_enabled,
            token_expired: data.google_token_expiry ? new Date(data.google_token_expiry) < new Date() : false,
        });
    } catch (error: any) {
        console.error('Status check error:', error);
        res.status(500).json({ error: 'Failed to check status' });
    }
});

/**
 * GET /api/google/gmail/messages
 * List Gmail messages with attachments
 */
router.get('/gmail/messages', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const supabase = getSupabaseAdminClient();
        const { data: tokenData, error } = await supabase
            .from('user_oauth_tokens')
            .select('google_access_token')
            .eq('user_id', userId)
            .single();

        if (error || !tokenData?.google_access_token) {
            return res.status(400).json({ error: 'Gmail not connected' });
        }

        const gmailService = new GmailService(tokenData.google_access_token);
        const messages = await gmailService.listMessagesWithAttachments(20);

        // Get details for each message
        const messagesWithDetails = await Promise.all(
            messages.map(async (msg: any) => {
                try {
                    const details = await gmailService.getMessage(msg.id);
                    return {
                        id: msg.id,
                        subject: details.payload?.headers?.find((h: any) => h.name === 'Subject')?.value,
                        from: details.payload?.headers?.find((h: any) => h.name === 'From')?.value,
                        date: details.payload?.headers?.find((h: any) => h.name === 'Date')?.value,
                        snippet: details.snippet,
                    };
                } catch (err) {
                    return null;
                }
            })
        );

        res.json({ messages: messagesWithDetails.filter(Boolean) });
    } catch (error: any) {
        console.error('Gmail messages error:', error);
        res.status(500).json({ error: 'Failed to fetch Gmail messages' });
    }
});

/**
 * POST /api/google/gmail/import
 * Import Gmail attachments
 */
router.post('/gmail/import', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { messageIds } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!messageIds || !Array.isArray(messageIds)) {
            return res.status(400).json({ error: 'Invalid message IDs' });
        }

        const supabase = getSupabaseAdminClient();
        const { data: tokenData, error } = await supabase
            .from('user_oauth_tokens')
            .select('google_access_token')
            .eq('user_id', userId)
            .single();

        if (error || !tokenData?.google_access_token) {
            return res.status(400).json({ error: 'Gmail not connected' });
        }

        const gmailService = new GmailService(tokenData.google_access_token);
        const imported = await gmailService.importAttachments(userId, messageIds);

        res.json({ imported, count: imported.length });
    } catch (error: any) {
        console.error('Gmail import error:', error);
        res.status(500).json({ error: 'Failed to import Gmail attachments' });
    }
});

/**
 * GET /api/google/drive/files
 * List Google Drive files
 */
router.get('/drive/files', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const supabase = getSupabaseAdminClient();
        const { data: tokenData, error } = await supabase
            .from('user_oauth_tokens')
            .select('google_access_token')
            .eq('user_id', userId)
            .single();

        if (error || !tokenData?.google_access_token) {
            return res.status(400).json({ error: 'Drive not connected' });
        }

        const driveService = new DriveService(tokenData.google_access_token);
        const files = await driveService.listFiles(50);

        res.json({ files });
    } catch (error: any) {
        console.error('Drive files error:', error);
        res.status(500).json({ error: 'Failed to fetch Drive files' });
    }
});

/**
 * POST /api/google/drive/import
 * Import Google Drive files
 */
router.post('/drive/import', async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const { fileIds } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!fileIds || !Array.isArray(fileIds)) {
            return res.status(400).json({ error: 'Invalid file IDs' });
        }

        const supabase = getSupabaseAdminClient();
        const { data: tokenData, error } = await supabase
            .from('user_oauth_tokens')
            .select('google_access_token')
            .eq('user_id', userId)
            .single();

        if (error || !tokenData?.google_access_token) {
            return res.status(400).json({ error: 'Drive not connected' });
        }

        const driveService = new DriveService(tokenData.google_access_token);
        const imported = await driveService.importFiles(userId, fileIds);

        res.json({ imported, count: imported.length });
    } catch (error: any) {
        console.error('Drive import error:', error);
        res.status(500).json({ error: 'Failed to import Drive files' });
    }
});

export default router;
