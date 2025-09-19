-- Users (Clinicians and Admins)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('clinician', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patients
CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    date_of_birth DATE,
    medical_record_number VARCHAR(50) UNIQUE,
    room_number VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Task Logs
CREATE TABLE task_logs (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    task_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    completed_at TIMESTAMP NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_task_logs_patient_id ON task_logs(patient_id);
CREATE INDEX idx_task_logs_user_id ON task_logs(user_id);
CREATE INDEX idx_task_logs_completed_at ON task_logs(completed_at);
CREATE INDEX idx_patients_mrn ON patients(medical_record_number);

-- Insert sample admin user (password: 'admin123')
INSERT INTO users (email, password_hash, first_name, last_name, role) 
VALUES ('admin@clinic.com', '$2b$10$qzAVAAhXXYlaXNoL4pneWOqluz0SKDl.BaXCud7vgIY0NSlyF6Wbi', 'Admin', 'User', 'admin');