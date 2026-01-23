-- Timeline Clinical Event Dates Migration
-- Adds proper clinical event date tracking to timeline_events table
-- Ensures timeline is ordered by actual medical event dates, not upload dates

-- ============================================================
-- ALTER TIMELINE_EVENTS TABLE
-- ============================================================

-- Add clinical event date columns
ALTER TABLE timeline_events
ADD COLUMN IF NOT EXISTS clinical_event_date DATE,
ADD COLUMN IF NOT EXISTS report_date DATE,
ADD COLUMN IF NOT EXISTS upload_date TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add indexes for efficient sorting
CREATE INDEX IF NOT EXISTS idx_timeline_clinical_event_date ON timeline_events(clinical_event_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_timeline_report_date ON timeline_events(report_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_timeline_upload_date ON timeline_events(upload_date DESC);

-- Composite index for the primary query: order by clinical_event_date, then upload_date
CREATE INDEX IF NOT EXISTS idx_timeline_clinical_sort ON timeline_events(patient_id, clinical_event_date DESC NULLS LAST, upload_date DESC);

-- ============================================================
-- COMMENTS (for documentation)
-- ============================================================
COMMENT ON COLUMN timeline_events.clinical_event_date IS 'The actual clinical event date extracted from report content (visit date, test date, prescription date). Primary sort field for timeline.';
COMMENT ON COLUMN timeline_events.report_date IS 'Report/document creation date (lab report date, discharge summary date). Fallback if clinical_event_date is null.';
COMMENT ON COLUMN timeline_events.upload_date IS 'When the report was uploaded to the system. Used as final fallback and for audit trail.';

-- ============================================================
-- BACKFILL STRATEGY
-- ============================================================
-- Note: Existing records will have:
--   - clinical_event_date = NULL (until event extraction parses content)
--   - report_date = NULL (until explicitly extracted)
--   - upload_date = created_at (migrate from existing)
--
-- The application will use this fallback order:
--   1. clinical_event_date (explicit medical event date)
--   2. report_date (document date)
--   3. upload_date (system date, last resort)
--
-- After this migration, new report uploads will populate all three fields.
-- Backfill script (separate) will populate existing records.
