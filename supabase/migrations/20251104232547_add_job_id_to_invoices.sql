/*
  # Add Job Association to Invoices

  1. Changes
    - Add `job_id` column to `invoices` table
    - Add foreign key reference to `service_provider_jobs`
    - Add index for efficient queries
    - Make it nullable since invoices can exist without jobs

  2. Notes
    - Allows service providers to link invoices to specific jobs
    - Property owners can see invoices associated with jobs
    - Invoices can still be created independently without a job
*/

-- Add job_id column to invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' 
    AND column_name = 'job_id'
  ) THEN
    ALTER TABLE invoices 
    ADD COLUMN job_id uuid REFERENCES service_provider_jobs(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON invoices(job_id);
