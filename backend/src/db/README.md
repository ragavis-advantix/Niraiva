# Database Schema Documentation

## Overview
This directory contains the database schema definitions for the Niraiva redesign.

## Critical Principles

### 🔴 RULE #1: Patient Master is Source of Truth
- `patient_master` table contains the canonical patient identity
- Created ONLY by clinical systems (hospital, clinic, doctor)
- **NEVER** created by patient signup

### 🔴 RULE #2: Auth ≠ Identity
- Supabase Auth provides **access**, not identity
- `user_accounts` table links auth to patient records
- A patient can exist without an auth account
- An auth account without `linked_patient_id` has no medical access

### 🔴 RULE #3: Authority is First-Class
- `medical_records`: authority = 'clinical' (locked, immutable)
- `personal_records`: authority = 'personal' (patient-contributed)
- Timeline clearly distinguishes both

## Migration Instructions

### Step 1: Run the Migration
```bash
# Connect to your Supabase database
psql <your-connection-string>

# Run the migration
\i backend/src/db/migrations/001_core_schema.sql
```

### Step 2: Verify Tables
```sql
-- Check all tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'patient_master', 
  'user_accounts', 
  'medical_records', 
  'personal_records', 
  'timeline_events', 
  'consents', 
  'patient_invites',
  'audit_log',
  'organizations'
);
```

### Step 3: Create First Organization
```sql
INSERT INTO organizations (name, type, mrn_prefix)
VALUES ('Demo Hospital', 'hospital', 'DEMO');
```

## Table Relationships

```
organizations
    ↓
patient_master (source of truth)
    ↓
    ├── user_accounts (access layer)
    ├── medical_records (clinical authority)
    ├── personal_records (patient authority)
    ├── timeline_events (derived)
    ├── consents (access control)
    └── patient_invites (activation)
```

## Key Indexes
- All foreign keys are indexed
- Timeline queries optimized with composite indexes
- MRN lookups are fast (unique index)

## Security Notes
- All tables have `created_at` timestamps
- Audit log captures all sensitive operations
- Consent enforcement happens at API layer (not DB)
- RLS policies should be added if using Supabase client-side queries

## Next Steps
1. Run migration SQL
2. Update backend code to use new tables
3. Implement consent middleware
4. Migrate existing data (if any)
