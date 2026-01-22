-- Add OTP support to patient_invites
ALTER TABLE patient_invites ADD COLUMN IF NOT EXISTS otp TEXT;
ALTER TABLE patient_invites ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE patient_invites ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT false;
