-- Multi-Tenant Schema for 10 Hospitals
-- Migration: 002_add_multi_tenancy.sql

-- Hospitals/Organizations Table
CREATE TABLE hospitals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'HOSP001', 'NYC_MAIN'
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'UTC',
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add hospital_id to existing tables
ALTER TABLE users ADD COLUMN hospital_id INTEGER REFERENCES hospitals(id);
ALTER TABLE patients ADD COLUMN hospital_id INTEGER REFERENCES hospitals(id);

-- Update task_logs to inherit hospital_id (denormalized for performance)
ALTER TABLE task_logs ADD COLUMN hospital_id INTEGER REFERENCES hospitals(id);

-- Critical: Add NOT NULL constraints after data migration
-- ALTER TABLE users ALTER COLUMN hospital_id SET NOT NULL;
-- ALTER TABLE patients ALTER COLUMN hospital_id SET NOT NULL; 
-- ALTER TABLE task_logs ALTER COLUMN hospital_id SET NOT NULL;

-- Indexes for multi-tenant performance
CREATE INDEX idx_users_hospital_id ON users(hospital_id);
CREATE INDEX idx_patients_hospital_id ON patients(hospital_id);
CREATE INDEX idx_task_logs_hospital_id ON task_logs(hospital_id);

-- Composite indexes for common queries
CREATE INDEX idx_patients_hospital_mrn ON patients(hospital_id, medical_record_number);
CREATE INDEX idx_task_logs_hospital_patient ON task_logs(hospital_id, patient_id);
CREATE INDEX idx_task_logs_hospital_completed ON task_logs(hospital_id, completed_at DESC);

-- Row Level Security (RLS) for automatic data isolation
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see data from their hospital
CREATE POLICY users_hospital_isolation ON users
    USING (hospital_id = current_setting('app.current_hospital_id')::INTEGER);

CREATE POLICY patients_hospital_isolation ON patients  
    USING (hospital_id = current_setting('app.current_hospital_id')::INTEGER);

CREATE POLICY task_logs_hospital_isolation ON task_logs
    USING (hospital_id = current_setting('app.current_hospital_id')::INTEGER);

-- Sample hospitals
INSERT INTO hospitals (name, code, address, timezone) VALUES 
('General Hospital Downtown', 'GHD', '123 Main St, City A', 'America/New_York'),
('Regional Medical Center', 'RMC', '456 Oak Ave, City B', 'America/Chicago'),
('University Hospital', 'UH', '789 College Rd, City C', 'America/Denver'),
('Mercy Hospital', 'MH', '321 Pine St, City D', 'America/Los_Angeles');

-- Sample data migration (for existing data)
-- UPDATE users SET hospital_id = 1 WHERE hospital_id IS NULL;
-- UPDATE patients SET hospital_id = 1 WHERE hospital_id IS NULL;
-- UPDATE task_logs SET hospital_id = 1 WHERE hospital_id IS NULL;

-- Triggers to automatically set hospital_id on task_logs from patient
CREATE OR REPLACE FUNCTION set_task_log_hospital_id()
RETURNS TRIGGER AS $$
BEGIN
    SELECT hospital_id INTO NEW.hospital_id 
    FROM patients WHERE id = NEW.patient_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_task_log_hospital_id
    BEFORE INSERT ON task_logs
    FOR EACH ROW
    EXECUTE FUNCTION set_task_log_hospital_id();