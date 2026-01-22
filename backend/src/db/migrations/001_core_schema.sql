-- Niraiva Core Schema Migration
-- This migration creates the foundational tables for the new architecture
-- where patient_master is the source of truth, not auth accounts

-- ============================================================
-- PATIENT MASTER (Clinical Truth)
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mrn TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  dob DATE NOT NULL,
  sex TEXT CHECK (sex IN ('male', 'female', 'other')),
  phone TEXT,
  email TEXT,
  address TEXT,
  primary_org_id UUID,
  created_by TEXT NOT NULL CHECK (created_by IN ('system', 'clinic', 'doctor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_patient_master_mrn ON patient_master(mrn);
CREATE INDEX idx_patient_master_phone ON patient_master(phone);
CREATE INDEX idx_patient_master_org ON patient_master(primary_org_id);

-- ============================================================
-- USER ACCOUNTS (Access Layer, NOT Identity)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE NOT NULL, -- Links to Supabase Auth
  role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'caretaker', 'admin', 'clinical_staff')),
  linked_patient_id UUID REFERENCES patient_master(id) ON DELETE SET NULL,
  linked_org_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_user_accounts_auth ON user_accounts(auth_user_id);
CREATE INDEX idx_user_accounts_patient ON user_accounts(linked_patient_id);
CREATE INDEX idx_user_accounts_role ON user_accounts(role);

-- ============================================================
-- MEDICAL RECORDS (Clinical Authority)
-- ============================================================
CREATE TABLE IF NOT EXISTS medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_master(id) ON DELETE CASCADE,
  record_type TEXT NOT NULL CHECK (record_type IN ('lab', 'imaging', 'diagnosis', 'prescription', 'consultation', 'procedure', 'vitals')),
  source TEXT NOT NULL, -- e.g., 'Apollo Hospital', 'Dr. Smith', 'Lab Corp'
  authority TEXT NOT NULL DEFAULT 'clinical' CHECK (authority = 'clinical'),
  data JSONB NOT NULL,
  file_url TEXT,
  locked BOOLEAN DEFAULT true,
  uploaded_by UUID REFERENCES user_accounts(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_medical_records_patient ON medical_records(patient_id);
CREATE INDEX idx_medical_records_type ON medical_records(record_type);
CREATE INDEX idx_medical_records_created ON medical_records(created_at DESC);

-- ============================================================
-- PERSONAL RECORDS (Patient-Contributed)
-- ============================================================
CREATE TABLE IF NOT EXISTS personal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_master(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('photo', 'wearable', 'lifestyle', 'note', 'symptom')),
  authority TEXT NOT NULL DEFAULT 'personal' CHECK (authority = 'personal'),
  data JSONB NOT NULL,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_personal_records_patient ON personal_records(patient_id);
CREATE INDEX idx_personal_records_type ON personal_records(type);
CREATE INDEX idx_personal_records_created ON personal_records(created_at DESC);

-- ============================================================
-- TIMELINE EVENTS (Derived View)
-- ============================================================
CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_master(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  reference_table TEXT NOT NULL CHECK (reference_table IN ('medical_records', 'personal_records')),
  reference_id UUID NOT NULL,
  authority TEXT NOT NULL CHECK (authority IN ('clinical', 'personal')),
  display_priority INTEGER DEFAULT 0,
  event_time TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_timeline_patient ON timeline_events(patient_id);
CREATE INDEX idx_timeline_event_time ON timeline_events(event_time DESC);
CREATE INDEX idx_timeline_reference ON timeline_events(reference_table, reference_id);

-- ============================================================
-- CONSENTS (Access Control)
-- ============================================================
CREATE TABLE IF NOT EXISTS consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_master(id) ON DELETE CASCADE,
  granted_to UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  scopes TEXT[] NOT NULL, -- e.g., ['labs', 'imaging', 'notes']
  purpose TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_consents_patient ON consents(patient_id);
CREATE INDEX idx_consents_granted_to ON consents(granted_to);
CREATE INDEX idx_consents_status ON consents(status);
CREATE INDEX idx_consents_expires ON consents(expires_at);

-- ============================================================
-- PATIENT INVITES (Activation Tokens)
-- ============================================================
CREATE TABLE IF NOT EXISTS patient_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES patient_master(id) ON DELETE CASCADE,
  hashed_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES user_accounts(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_patient_invites_token ON patient_invites(hashed_token);
CREATE INDEX idx_patient_invites_patient ON patient_invites(patient_id);
CREATE INDEX idx_patient_invites_expires ON patient_invites(expires_at);

-- ============================================================
-- AUDIT LOG (Security & Compliance)
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_accounts(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  patient_id UUID REFERENCES patient_master(id),
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_patient ON audit_log(patient_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_action ON audit_log(action);

-- ============================================================
-- ORGANIZATIONS (Hospitals/Clinics)
-- ============================================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('hospital', 'clinic', 'lab', 'pharmacy')),
  address TEXT,
  phone TEXT,
  email TEXT,
  mrn_prefix TEXT UNIQUE, -- e.g., 'HOSP01'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_organizations_mrn_prefix ON organizations(mrn_prefix);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patient_master_updated_at BEFORE UPDATE ON patient_master
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_accounts_updated_at BEFORE UPDATE ON user_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE patient_master IS 'Source of truth for patient identity. Created only by clinical systems.';
COMMENT ON TABLE user_accounts IS 'Access layer linking Supabase Auth to patient records. NOT the source of patient identity.';
COMMENT ON TABLE medical_records IS 'Clinical truth. Locked by default. Only system/doctor can create.';
COMMENT ON TABLE personal_records IS 'Patient-contributed data. Clearly labeled as non-clinical.';
COMMENT ON TABLE timeline_events IS 'Derived view of patient history. Auto-generated from medical/personal records.';
COMMENT ON TABLE consents IS 'Granular access control. Enforced at API layer.';
