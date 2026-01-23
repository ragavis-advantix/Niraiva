-- Clinical Events Table (Patient-Specific Diagnostic Graph Nodes)
CREATE TABLE clinical_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'symptom',
      'diagnosis',
      'investigation',
      'lab_result',
      'treatment',
      'medication',
      'follow_up'
    )
  ),
  event_name TEXT NOT NULL,
  event_date DATE,
  source_report_id UUID REFERENCES parsed_reports(id) ON DELETE SET NULL,
  confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(patient_id, event_type, event_name, event_date)
);

-- Index for fast queries
CREATE INDEX idx_clinical_events_patient ON clinical_events(patient_id);
CREATE INDEX idx_clinical_events_type ON clinical_events(event_type);
CREATE INDEX idx_clinical_events_date ON clinical_events(event_date);
CREATE INDEX idx_clinical_events_source_report ON clinical_events(source_report_id);


-- Clinical Event Edges Table (Causal & Temporal Relations)
CREATE TABLE clinical_event_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_event_id UUID NOT NULL REFERENCES clinical_events(id) ON DELETE CASCADE,
  to_event_id UUID NOT NULL REFERENCES clinical_events(id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL CHECK (
    relation_type IN (
      'leads_to',      -- Symptom leads to Investigation
      'confirms',      -- Investigation confirms Diagnosis
      'rules_out',     -- Investigation rules out Diagnosis
      'followed_by',   -- Diagnosis followed by Follow-up
      'caused_by',     -- Symptom caused by Diagnosis
      'treated_by',    -- Diagnosis treated by Medication
      'monitors'       -- Follow-up monitors Medication/Diagnosis
    )
  ),
  confidence FLOAT DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(from_event_id, to_event_id, relation_type)
);

-- Index for edge lookups
CREATE INDEX idx_clinical_event_edges_patient ON clinical_event_edges(patient_id);
CREATE INDEX idx_clinical_event_edges_from ON clinical_event_edges(from_event_id);
CREATE INDEX idx_clinical_event_edges_to ON clinical_event_edges(to_event_id);
