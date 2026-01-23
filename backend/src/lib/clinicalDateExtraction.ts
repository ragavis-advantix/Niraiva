/**
 * Clinical Date Extraction Utility
 * 
 * Extracts medical event dates from parsed report content.
 * Supports: visit dates, test dates, prescription dates, lab dates, discharge dates.
 * 
 * Normalized to ISO DATE format (YYYY-MM-DD)
 */

import { parse, isValid, format } from 'date-fns';

interface ExtractedClinicalDates {
    visitDate: string | null;
    testDate: string | null;
    prescriptionDate: string | null;
    labDate: string | null;
    dischargeDate: string | null;
    reportDate: string | null;
}

/**
 * Extract clinical dates from parsed report text/JSON
 */
export function extractClinicalDates(parsedText: string, parsedJson?: any): ExtractedClinicalDates {
    // 1. Try to get dates directly from structured JSON if available
    const json = parsedJson || {};
    const metadata = json.metadata || {};
    const eventInfo = json.eventInfo || {};
    const data = json.data || {};
    const profile = data.profile || {};

    const structuredDates: ExtractedClinicalDates = {
        visitDate: metadata.documentDate || metadata.visitDate || null,
        testDate: metadata.testDate || null,
        prescriptionDate: metadata.prescriptionDate || null,
        labDate: metadata.labDate || null,
        dischargeDate: metadata.dischargeDate || null,
        reportDate: metadata.documentDate || metadata.reportDate || null
    };

    // If we already have structured dates, normalize them and return
    const hasAnyStructured = Object.values(structuredDates).some(v => v !== null);
    if (hasAnyStructured) {
        return {
            visitDate: structuredDates.visitDate ? normalizeDate(structuredDates.visitDate) : null,
            testDate: structuredDates.testDate ? normalizeDate(structuredDates.testDate) : null,
            prescriptionDate: structuredDates.prescriptionDate ? normalizeDate(structuredDates.prescriptionDate) : null,
            labDate: structuredDates.labDate ? normalizeDate(structuredDates.labDate) : null,
            dischargeDate: structuredDates.dischargeDate ? normalizeDate(structuredDates.dischargeDate) : null,
            reportDate: structuredDates.reportDate ? normalizeDate(structuredDates.reportDate) : null
        };
    }

    // 2. Fallback to regex-based extraction from text
    const extractedText = parsedText || JSON.stringify(json);

    return {
        visitDate: extractDateWithPatterns(extractedText, [
            /Date of Visit[:\s\\"]+(.+?)[\\"\n,]/i,
            /Consultation Date[:\s\\"]+(.+?)[\\"\n,]/i,
            /Visit Date[:\s\\"]+(.+?)[\\"\n,]/i,
            /Date[:\s\\"]+(.*(?:visit|consultation).*?)[\\"\n,]/i,
        ]),

        testDate: extractDateWithPatterns(extractedText, [
            /Test Date[:\s\\"]+(.+?)[\\"\n,]/i,
            /Date of Test[:\s\\"]+(.+?)[\\"\n,]/i,
            /Specimen Date[:\s\\"]+(.+?)[\\"\n,]/i,
            /Collection Date[:\s\\"]+(.+?)[\\"\n,]/i,
        ]),

        prescriptionDate: extractDateWithPatterns(extractedText, [
            /Prescription Date[:\s\\"]+(.+?)[\\"\n,]/i,
            /Date Prescribed[:\s\\"]+(.+?)[\\"\n,]/i,
            /Rx Date[:\s\\"]+(.+?)[\\"\n,]/i,
        ]),

        labDate: extractDateWithPatterns(extractedText, [
            /Lab Date[:\s\\"]+(.+?)[\\"\n,]/i,
            /Laboratory Report Date[:\s\\"]+(.+?)[\\"\n,]/i,
            /Test Report Date[:\s\\"]+(.+?)[\\"\n,]/i,
            /Report Date[:\s\\"]+(.+?)[\\"\n,]/i,
        ]),

        dischargeDate: extractDateWithPatterns(extractedText, [
            /Discharge Date[:\s\\"]+(.+?)[\\"\n,]/i,
            /Date of Discharge[:\s\\"]+(.+?)[\\"\n,]/i,
            /Discharged[:\s\\"]+(.+?)[\\"\n,]/i,
        ]),

        reportDate: extractDateWithPatterns(extractedText, [
            /Report Date[:\s\\"]+(.+?)[\\"\n,]/i,
            /"Date"[:\s\\"]+(.+?)[\\"\n,]/i,
            /Date[:\s]+(.+?)[\n,]/i,
        ]),
    };
}

/**
 * Extract single date using regex patterns
 */
function extractDateWithPatterns(text: string, patterns: RegExp[]): string | null {
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            const normalized = normalizeDate(match[1].trim());
            if (normalized) return normalized;
        }
    }
    return null;
}

/**
 * Normalize date string to ISO DATE format (YYYY-MM-DD)
 * 
 * Supports:
 * - dd/MM/yyyy, MM/dd/yyyy
 * - dd-MM-yyyy, MM-dd-yyyy
 * - ISO format (YYYY-MM-DD)
 * - Common text dates (Jan 15, 2024)
 */
function normalizeDate(dateStr: string): string | null {
    if (!dateStr || typeof dateStr !== 'string') return null;

    const cleaned = dateStr.trim();

    // Already ISO format?
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
        const parsed = parse(cleaned, 'yyyy-MM-dd', new Date());
        return isValid(parsed) ? cleaned : null;
    }

    // Try common formats
    const formats = [
        'dd/MM/yyyy',
        'MM/dd/yyyy',
        'dd-MM-yyyy',
        'MM-dd-yyyy',
        'dd.MM.yyyy',
        'MMM dd, yyyy',
        'dd MMM yyyy',
        'yyyy/MM/dd',
        'yyyy-MM-dd',
    ];

    for (const fmt of formats) {
        try {
            const parsed = parse(cleaned, fmt, new Date());
            if (isValid(parsed)) {
                return format(parsed, 'yyyy-MM-dd');
            }
        } catch {
            // Continue to next format
        }
    }

    return null;
}

/**
 * Determine primary clinical event date with fallback order:
 * 1. visitDate (most clinically relevant)
 * 2. testDate
 * 3. prescriptionDate
 * 4. labDate
 * 5. dischargeDate
 * 6. reportDate
 * 7. null (will fall back to upload_date in DB)
 */
export function resolvePrimaryClinicialDate(dates: ExtractedClinicalDates): string | null {
    return (
        dates.visitDate ||
        dates.testDate ||
        dates.prescriptionDate ||
        dates.labDate ||
        dates.dischargeDate ||
        dates.reportDate ||
        null
    );
}

/**
 * Logger for date extraction (helps debug missing dates)
 */
export function logDateExtraction(
    reportId: string,
    dates: ExtractedClinicalDates,
    primaryDate: string | null,
    fallbackToUpload: boolean
): void {
    const extracted = Object.entries(dates).filter(([, v]) => v !== null);

    if (extracted.length === 0) {
        console.warn(
            `⚠️  [Timeline Date] Report ${reportId}: No clinical dates extracted. Falling back to upload date.`
        );
    } else if (!primaryDate) {
        console.warn(
            `⚠️  [Timeline Date] Report ${reportId}: Could not resolve primary clinical date. Falling back to upload date.`
        );
    } else {
        console.log(
            `✅ [Timeline Date] Report ${reportId}: Clinical date extracted: ${primaryDate} (${extracted.find(([, v]) => v === primaryDate)?.[0] || 'unknown'
            })`
        );
    }

    if (fallbackToUpload) {
        console.log(
            `📋 [Timeline Date] Report ${reportId}: Using upload_date as fallback (report date could not be determined)`
        );
    }
}
