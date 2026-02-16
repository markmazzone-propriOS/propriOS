/*
  # Add Job Details and Work History Tracking

  1. Changes to service_provider_jobs table
    - Add `notes` field for service provider work documentation
    - Add `completion_notes` field for final work summary
    - Add `materials_used` field for tracking materials/supplies
    - Add `completed_at` timestamp for tracking when work was finished
    - Add `end_date` timestamp for scheduled end time

  2. New Tables
    - `job_status_history`
      - Tracks all status changes for audit trail
      - Records who made the change and when
      - Stores old and new status values

  3. Security
    - Enable RLS on job_status_history
    - Service providers can view history for their jobs
    - Property owners can view history for their jobs
    - Automatic tracking via trigger
*/

-- Add new fields to service_provider_jobs
ALTER TABLE service_provider_jobs 
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS completion_notes text,
ADD COLUMN IF NOT EXISTS materials_used text,
ADD COLUMN IF NOT EXISTS completed_at timestamptz,
ADD COLUMN IF NOT EXISTS end_date timestamptz;

-- Create job status history table
CREATE TABLE IF NOT EXISTS job_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES service_provider_jobs(id) ON DELETE CASCADE NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz DEFAULT now() NOT NULL,
  notes text
);

-- Enable RLS
ALTER TABLE job_status_history ENABLE ROW LEVEL SECURITY;

-- Service providers can view history for their jobs
CREATE POLICY "Service providers can view their job history"
  ON job_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_provider_jobs spj
      WHERE spj.id = job_status_history.job_id
      AND spj.service_provider_id = auth.uid()
    )
  );

-- Property owners can view history for their jobs
CREATE POLICY "Property owners can view job history"
  ON job_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_provider_jobs spj
      WHERE spj.id = job_status_history.job_id
      AND spj.property_owner_id = auth.uid()
    )
  );

-- System can insert history (via trigger)
CREATE POLICY "System can insert job history"
  ON job_status_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create trigger to automatically log status changes
CREATE OR REPLACE FUNCTION log_job_status_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO job_status_history (job_id, old_status, new_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO job_status_history (job_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS job_status_change_trigger ON service_provider_jobs;
CREATE TRIGGER job_status_change_trigger
  AFTER INSERT OR UPDATE ON service_provider_jobs
  FOR EACH ROW
  EXECUTE FUNCTION log_job_status_change();

-- Auto-set completed_at when status changes to completed
CREATE OR REPLACE FUNCTION set_job_completed_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_job_completed_at_trigger ON service_provider_jobs;
CREATE TRIGGER set_job_completed_at_trigger
  BEFORE UPDATE ON service_provider_jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_job_completed_at();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_job_status_history_job_id ON job_status_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_status_history_changed_at ON job_status_history(changed_at DESC);
