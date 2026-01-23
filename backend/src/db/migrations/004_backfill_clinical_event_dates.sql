-- Backfill Clinical Event Dates for Existing Timeline Events
-- Populates clinical_event_date for records that don't have it yet
-- Uses fallback strategy: report_date > upload_date

-- ============================================================
-- STRATEGY
-- ============================================================
-- For all timeline_events where clinical_event_date IS NULL:
-- 1. If report_date exists, use it as clinical_event_date
-- 2. Else, use upload_date (convert TIMESTAMP to DATE)
-- 3. This ensures all records have at least an upload date
--
-- This maintains backward compatibility while enabling proper
-- chronological ordering for new records with extracted dates.

UPDATE timeline_events
SET clinical_event_date = COALESCE(
  report_date,
  upload_date::date,
  created_at::date
)
WHERE clinical_event_date IS NULL;

-- Verify backfill
-- Run this to check results:
-- SELECT 
--   COUNT(*) as total_events,
--   COUNT(CASE WHEN clinical_event_date IS NOT NULL THEN 1 END) as with_clinical_date,
--   COUNT(CASE WHEN clinical_event_date IS NULL THEN 1 END) as still_null
-- FROM timeline_events;
