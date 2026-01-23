-- Migration: 005_health_snapshot
-- Goal: Fix missing dashboard data and enable editable patient name

-- 1. Ensure user_profiles has required fields for name and basic info
-- Note: Based on core_schema.sql and database.sql, we might have user_profiles.
-- We want to make sure it includes 'full_name' or similar for display.
ALTER TABLE IF EXISTS user_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 2. Create Patient Health Snapshot table
-- This stores the latest consolidated health state
CREATE TABLE IF NOT EXISTS patient_health_snapshot (
    patient_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Vitals
    systolic_bp INTEGER,
    diastolic_bp INTEGER,
    heart_rate INTEGER,
    spo2 INTEGER,
    temperature NUMERIC(4,1),
    
    -- Labs
    hba1c NUMERIC(4,2),
    ldl INTEGER,
    vitamin_b12 INTEGER,
    
    -- Conditions
    chronic_conditions TEXT[],
    
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source_report_id UUID -- Track which report last updated this
);

-- Enable Realtime for the snapshot table
ALTER PUBLICATION supabase_realtime ADD TABLE patient_health_snapshot;

-- 3. RLS Policies
ALTER TABLE patient_health_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own health snapshot"
    ON patient_health_snapshot FOR SELECT
    USING (auth.uid() = patient_id);

CREATE POLICY "System can update health snapshot"
    ON patient_health_snapshot FOR ALL
    USING (auth.uid() = patient_id)
    WITH CHECK (auth.uid() = patient_id);

-- 4. Update Trigger for last_updated
CREATE OR REPLACE FUNCTION update_health_snapshot_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patient_health_snapshot_timestamp
    BEFORE UPDATE ON patient_health_snapshot
    FOR EACH ROW
    EXECUTE FUNCTION update_health_snapshot_timestamp();
