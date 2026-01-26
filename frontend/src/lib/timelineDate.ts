/**
 * Timeline Date Display Utilities
 * 
 * Provides helpers for displaying timeline event dates with proper fallback logic:
 * 1. clinical_event_date (actual medical event date)
 * 2. report_date (report/document creation date)
 * 3. upload_date (when report was uploaded - last resort)
 */

import { format, parseISO } from 'date-fns';
import { TimelineEvent } from '@/utils/healthData';

/**
 * Utility to check if a string is a valid date that won't result in "Invalid Date"
 */
function isValidDateString(dateStr: any): boolean {
    if (!dateStr || typeof dateStr !== 'string') return false;
    if (dateStr.toLowerCase().includes('invalid')) return false;
    if (dateStr.toLowerCase().includes('nan')) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime());
}

/**
 * Resolve the primary display date for a timeline event
 * Uses fallback order: clinical > report > metadata nested dates > upload
 */
export function getDisplayDate(event: any): string | null {
    // 1. Check top-level clinical date fields (if database was updated)
    if (isValidDateString(event.clinical_event_date)) return event.clinical_event_date;
    if (isValidDateString(event.report_date)) return event.report_date;

    // 2. Check nested report_json metadata (where AI extracts dates)
    const reportMetadata = event.metadata?.report_json?.metadata || event.metadata?.metadata;
    if (reportMetadata) {
        const nestedDate = reportMetadata.documentDate ||
            reportMetadata.visitDate ||
            reportMetadata.date ||
            reportMetadata.testDate;
        if (isValidDateString(nestedDate)) return nestedDate;
    }

    // 3. Last resorts
    if (isValidDateString(event.date)) return event.date;
    if (isValidDateString(event.upload_date)) return event.upload_date;
    if (isValidDateString(event.event_time)) return event.event_time;

    return null;
}

/**
 * Format a timeline event date for display
 * Returns formatted date string (e.g., "Jan 15, 2024")
 */
export function formatTimelineDate(event: TimelineEvent, dateFormat: string = 'MMM dd, yyyy'): string {
    const dateString = getDisplayDate(event);
    if (!dateString) return 'Unknown Date';

    try {
        const date = parseISO(dateString);
        return format(date, dateFormat);
    } catch {
        return 'Invalid Date';
    }
}

/**
 * Determine which date source is being used for display
 * Useful for UI indicators (e.g., "Date from report", "Inferred from upload")
 */
export function getDateSource(event: TimelineEvent): 'clinical' | 'report' | 'upload' | 'unknown' {
    if (event.clinical_event_date) return 'clinical';
    if (event.report_date) return 'report';
    if (event.upload_date || event.event_time) return 'upload';
    return 'unknown';
}

/**
 * Get a human-readable label for the date source
 */
export function getDateSourceLabel(source: ReturnType<typeof getDateSource>): string {
    switch (source) {
        case 'clinical':
            return 'Medical event date';
        case 'report':
            return 'Report date';
        case 'upload':
            return 'Upload date';
        default:
            return 'Unknown date';
    }
}

/**
 * Determine if a date is inferred/fallback vs explicit
 * Returns true if we had to fall back from clinical date
 */
export function isDateInferred(event: TimelineEvent): boolean {
    return !event.clinical_event_date && (!!event.report_date || !!event.upload_date);
}

/**
 * Get a tooltip hint for the UI (optional, improves clinical trust)
 */
export function getDateTooltip(event: TimelineEvent): string {
    const source = getDateSource(event);
    const label = getDateSourceLabel(source);

    if (source === 'clinical') {
        return `Clinical event date: ${event.clinical_event_date}`;
    } else if (source === 'report') {
        return `Report date: ${event.report_date} (extracted from document)`;
    } else if (source === 'upload') {
        return `Upload date: ${event.upload_date || event.event_time} (report date not found)`;
    }

    return 'Date source unknown';
}

/**
 * Group timeline events by clinical_event_date (for proper medical history grouping)
 * Returns a Map of date -> events
 */
export function groupTimelineByDate(events: TimelineEvent[]): Map<string, TimelineEvent[]> {
    const grouped = new Map<string, TimelineEvent[]>();

    for (const event of events) {
        const dateStr = getDisplayDate(event);
        if (!dateStr) continue;

        // Normalize to date-only format (YYYY-MM-DD)
        const dateOnly = dateStr.split('T')[0];

        if (!grouped.has(dateOnly)) {
            grouped.set(dateOnly, []);
        }
        grouped.get(dateOnly)!.push(event);
    }

    // Sort dates descending (most recent first)
    const sorted = new Map(
        Array.from(grouped.entries()).sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    );

    return sorted;
}
