-- 003_timeline_enhancements.sql

-- Update timeline_events with status and source
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';
ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS source TEXT;

-- Create clinical_parameters table
CREATE TABLE IF NOT EXISTS clinical_parameters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timeline_event_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
  parameter_code TEXT, -- LOINC preferred
  parameter_name TEXT NOT NULL,
  value TEXT NOT NULL,
  unit TEXT,
  normal_range_min TEXT,
  normal_range_max TEXT,
  interpretation TEXT CHECK (interpretation IN ('normal', 'warning', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_clinical_params_event ON clinical_parameters(timeline_event_id);
CREATE INDEX idx_clinical_params_name ON clinical_parameters(parameter_name);

-- Create parameter_trends table
CREATE TABLE IF NOT EXISTS parameter_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_master(id) ON DELETE CASCADE,
  parameter_code TEXT,
  current_event_id UUID NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
  previous_event_id UUID REFERENCES timeline_events(id) ON DELETE SET NULL,
  delta_value TEXT,
  trend TEXT CHECK (trend IN ('improved', 'stable', 'worsened')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_param_trends_patient ON parameter_trends(patient_id);
CREATE INDEX idx_param_trends_event ON parameter_trends(current_event_id);

COMMENT ON TABLE clinical_parameters IS 'Normalized health parameters extracted from clinical reports.';
COMMENT ON TABLE parameter_trends IS 'Computed trends for health parameters over time.';
