-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist
DROP TABLE IF EXISTS abha_logs;
DROP TABLE IF EXISTS user_profiles;

-- Create user_profiles table
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    abha_number VARCHAR(20) UNIQUE,
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    dob DATE,
    gender VARCHAR(10),
    mobile VARCHAR(15),
    email VARCHAR(255),
    preferred_abha_address VARCHAR(100),
    address TEXT,
    district_code VARCHAR(10),
    state_code VARCHAR(10),
    pin_code VARCHAR(10),
    state_name VARCHAR(100),
    district_name VARCHAR(100),
    abha_status VARCHAR(20),
    photo TEXT,
    height JSONB,  -- Store as {value: number, unit: string}
    weight JSONB,  -- Store as {value: number, unit: string}
    blood_type VARCHAR(5),
    emergency_contact VARCHAR(15),
    allergies TEXT[],
    medications JSONB[], -- Store array of medication objects
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create logs table for debugging
CREATE TABLE abha_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES user_profiles(id),
    txn_id VARCHAR(100),
    status VARCHAR(50),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updating timestamp
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();