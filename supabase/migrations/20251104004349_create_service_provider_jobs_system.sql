/*
  # Create Service Provider Jobs System
  
  1. New Tables
    - `service_provider_jobs`
      - `id` (uuid, primary key)
      - `service_provider_id` (uuid, references profiles) - The service provider
      - `property_owner_id` (uuid, references profiles) - The property owner
      - `appointment_id` (uuid, references service_provider_appointments) - Source appointment
      - `lead_id` (uuid, references service_provider_leads, nullable) - Associated lead
      - `job_number` (text, unique) - Auto-generated job number
      - `title` (text) - Job title
      - `description` (text, nullable) - Job description
      - `location` (text, nullable) - Job location/address
      - `status` (text) - Status: 'scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled'
      - `priority` (text) - Priority: 'low', 'normal', 'high', 'urgent'
      - `estimated_hours` (numeric, nullable) - Estimated hours to complete
      - `actual_hours` (numeric, nullable) - Actual hours spent
      - `estimated_cost` (numeric, nullable) - Estimated cost
      - `actual_cost` (numeric, nullable) - Actual cost
      - `start_date` (timestamptz) - Job start date
      - `end_date` (timestamptz, nullable) - Job end date
      - `completed_at` (timestamptz, nullable) - Completion timestamp
      - `notes` (text, nullable) - Internal notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `service_provider_job_updates`
      - `id` (uuid, primary key)
      - `job_id` (uuid, references service_provider_jobs)
      - `service_provider_id` (uuid, references profiles)
      - `update_type` (text) - Type: 'status_change', 'progress_update', 'note', 'cost_update', 'time_logged'
      - `title` (text) - Update title
      - `description` (text, nullable) - Update description
      - `old_value` (text, nullable) - Previous value for changes
      - `new_value` (text, nullable) - New value for changes
      - `hours_logged` (numeric, nullable) - Hours logged in this update
      - `cost_added` (numeric, nullable) - Cost added in this update
      - `created_at` (timestamptz)
    
    - `service_provider_job_attachments`
      - `id` (uuid, primary key)
      - `job_id` (uuid, references service_provider_jobs)
      - `service_provider_id` (uuid, references profiles)
      - `file_name` (text) - Original file name
      - `file_path` (text) - Storage path
      - `file_type` (text) - MIME type
      - `file_size` (bigint) - File size in bytes
      - `description` (text, nullable) - File description
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on all tables
    - Service providers can manage their own jobs
    - Property owners can view jobs assigned to them (read-only)
    - Auto-generate unique job numbers
*/

-- Create sequence for job numbers
CREATE SEQUENCE IF NOT EXISTS job_number_seq START 10000;

-- Create service_provider_jobs table
CREATE TABLE IF NOT EXISTS service_provider_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_provider_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  property_owner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES service_provider_appointments(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES service_provider_leads(id) ON DELETE SET NULL,
  job_number text UNIQUE NOT NULL DEFAULT 'JOB-' || nextval('job_number_seq')::text,
  title text NOT NULL,
  description text,
  location text,
  status text NOT NULL DEFAULT 'scheduled',
  priority text NOT NULL DEFAULT 'normal',
  estimated_hours numeric,
  actual_hours numeric DEFAULT 0,
  estimated_cost numeric,
  actual_cost numeric DEFAULT 0,
  start_date timestamptz NOT NULL,
  end_date timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_job_status CHECK (status IN ('scheduled', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  CONSTRAINT valid_job_priority CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

-- Create indexes for jobs
CREATE INDEX IF NOT EXISTS idx_jobs_service_provider_id ON service_provider_jobs(service_provider_id);
CREATE INDEX IF NOT EXISTS idx_jobs_property_owner_id ON service_provider_jobs(property_owner_id);
CREATE INDEX IF NOT EXISTS idx_jobs_appointment_id ON service_provider_jobs(appointment_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON service_provider_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_start_date ON service_provider_jobs(start_date);
CREATE INDEX IF NOT EXISTS idx_jobs_job_number ON service_provider_jobs(job_number);

-- Create service_provider_job_updates table
CREATE TABLE IF NOT EXISTS service_provider_job_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES service_provider_jobs(id) ON DELETE CASCADE NOT NULL,
  service_provider_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  update_type text NOT NULL,
  title text NOT NULL,
  description text,
  old_value text,
  new_value text,
  hours_logged numeric,
  cost_added numeric,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_update_type CHECK (update_type IN ('status_change', 'progress_update', 'note', 'cost_update', 'time_logged'))
);

-- Create indexes for job updates
CREATE INDEX IF NOT EXISTS idx_job_updates_job_id ON service_provider_job_updates(job_id);
CREATE INDEX IF NOT EXISTS idx_job_updates_created_at ON service_provider_job_updates(created_at DESC);

-- Create service_provider_job_attachments table
CREATE TABLE IF NOT EXISTS service_provider_job_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES service_provider_jobs(id) ON DELETE CASCADE NOT NULL,
  service_provider_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for job attachments
CREATE INDEX IF NOT EXISTS idx_job_attachments_job_id ON service_provider_job_attachments(job_id);

-- Enable RLS
ALTER TABLE service_provider_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_provider_job_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_provider_job_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for service_provider_jobs

-- Service providers can view their own jobs
CREATE POLICY "Service providers can view own jobs"
  ON service_provider_jobs FOR SELECT
  TO authenticated
  USING (
    service_provider_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'service_provider'
    )
  );

-- Property owners can view jobs assigned to them
CREATE POLICY "Property owners can view their jobs"
  ON service_provider_jobs FOR SELECT
  TO authenticated
  USING (
    property_owner_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'property_owner'
    )
  );

-- Service providers can create their own jobs
CREATE POLICY "Service providers can create own jobs"
  ON service_provider_jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    service_provider_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'service_provider'
    )
  );

-- Service providers can update their own jobs
CREATE POLICY "Service providers can update own jobs"
  ON service_provider_jobs FOR UPDATE
  TO authenticated
  USING (service_provider_id = auth.uid())
  WITH CHECK (service_provider_id = auth.uid());

-- Service providers can delete their own jobs
CREATE POLICY "Service providers can delete own jobs"
  ON service_provider_jobs FOR DELETE
  TO authenticated
  USING (service_provider_id = auth.uid());

-- RLS Policies for service_provider_job_updates

-- Service providers can view updates for their jobs
CREATE POLICY "Service providers can view own job updates"
  ON service_provider_job_updates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_provider_jobs
      WHERE service_provider_jobs.id = job_id
      AND service_provider_jobs.service_provider_id = auth.uid()
    )
  );

-- Property owners can view updates for their jobs
CREATE POLICY "Property owners can view job updates"
  ON service_provider_job_updates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_provider_jobs
      WHERE service_provider_jobs.id = job_id
      AND service_provider_jobs.property_owner_id = auth.uid()
    )
  );

-- Service providers can create updates for their jobs
CREATE POLICY "Service providers can create own job updates"
  ON service_provider_job_updates FOR INSERT
  TO authenticated
  WITH CHECK (
    service_provider_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM service_provider_jobs
      WHERE service_provider_jobs.id = job_id
      AND service_provider_jobs.service_provider_id = auth.uid()
    )
  );

-- Service providers can delete their own updates
CREATE POLICY "Service providers can delete own job updates"
  ON service_provider_job_updates FOR DELETE
  TO authenticated
  USING (service_provider_id = auth.uid());

-- RLS Policies for service_provider_job_attachments

-- Service providers can view attachments for their jobs
CREATE POLICY "Service providers can view own job attachments"
  ON service_provider_job_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_provider_jobs
      WHERE service_provider_jobs.id = job_id
      AND service_provider_jobs.service_provider_id = auth.uid()
    )
  );

-- Property owners can view attachments for their jobs
CREATE POLICY "Property owners can view job attachments"
  ON service_provider_job_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_provider_jobs
      WHERE service_provider_jobs.id = job_id
      AND service_provider_jobs.property_owner_id = auth.uid()
    )
  );

-- Service providers can create attachments for their jobs
CREATE POLICY "Service providers can create own job attachments"
  ON service_provider_job_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    service_provider_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM service_provider_jobs
      WHERE service_provider_jobs.id = job_id
      AND service_provider_jobs.service_provider_id = auth.uid()
    )
  );

-- Service providers can delete their own attachments
CREATE POLICY "Service providers can delete own job attachments"
  ON service_provider_job_attachments FOR DELETE
  TO authenticated
  USING (service_provider_id = auth.uid());

-- Create updated_at trigger for jobs
CREATE OR REPLACE FUNCTION update_service_provider_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_provider_jobs_updated_at
  BEFORE UPDATE ON service_provider_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_service_provider_job_updated_at();

-- Create trigger to track status changes
CREATE OR REPLACE FUNCTION track_job_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO service_provider_job_updates (
      job_id,
      service_provider_id,
      update_type,
      title,
      old_value,
      new_value
    ) VALUES (
      NEW.id,
      NEW.service_provider_id,
      'status_change',
      'Status changed from ' || OLD.status || ' to ' || NEW.status,
      OLD.status,
      NEW.status
    );
  END IF;
  
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_job_status_change_trigger
  BEFORE UPDATE ON service_provider_jobs
  FOR EACH ROW
  EXECUTE FUNCTION track_job_status_change();

-- Create storage bucket for job attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-attachments', 'job-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for job attachments
CREATE POLICY "Service providers can upload job attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'job-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Service providers can view job attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'job-attachments' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR
      EXISTS (
        SELECT 1 FROM service_provider_jobs
        WHERE service_provider_jobs.property_owner_id = auth.uid()
      )
    )
  );

CREATE POLICY "Service providers can delete job attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'job-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
