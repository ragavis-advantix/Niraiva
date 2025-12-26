/**
 * Google API Client Helpers
 * Handles OAuth flow and file import from Gmail and Google Drive
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

/**
 * Redirect to OAuth start endpoint (browser will open Google)
 */
export function startGmailOAuth() {
    window.location.href = `${API_BASE}/api/google/gmail/start`;
}

export function startDriveOAuth() {
    window.location.href = `${API_BASE}/api/google/drive/start`;
}

/**
 * Get connection status
 */
export async function getGoogleStatus(accessToken: string): Promise<{ gmail: boolean; drive: boolean }> {
    try {
        const res = await fetch(`${API_BASE}/api/google/status`, {
            credentials: 'include',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        if (!res.ok) return { gmail: false, drive: false };
        return res.json();
    } catch {
        return { gmail: false, drive: false };
    }
}

/**
 * List Gmail messages with attachments
 */
export async function listGmailMessages(accessToken: string) {
    const res = await fetch(`${API_BASE}/api/google/gmail/messages`, {
        credentials: 'include',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });
    if (!res.ok) throw new Error('Failed to list Gmail messages');
    return res.json();
}

/**
 * Import selected Gmail attachments
 */
export async function importGmailAttachments(accessToken: string, items: any[]) {
    const res = await fetch(`${API_BASE}/api/google/gmail/import`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error('Gmail import failed');
    return res.json();
}

/**
 * List Drive files
 */
export async function listDriveFiles(accessToken: string) {
    const res = await fetch(`${API_BASE}/api/google/drive/list`, {
        credentials: 'include',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
    });
    if (!res.ok) throw new Error('Failed to list Drive files');
    return res.json();
}

/**
 * Import selected Drive files
 */
export async function importDriveFiles(accessToken: string, fileIds: string[]) {
    const res = await fetch(`${API_BASE}/api/google/drive/import`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ fileIds }),
    });
    if (!res.ok) throw new Error('Drive import failed');
    return res.json();
}
