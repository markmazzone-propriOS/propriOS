/*
  # Add Buyer Access to Service Provider Jobs

  1. Schema Changes
    - Add `buyer_id` column to `service_provider_jobs` table to link jobs to buyers
    - This allows service providers to create jobs for buyers (inspections, appraisals, etc.)

  2. Security Changes
    - Add RLS policy for buyers to view their completed jobs
    - Add RLS policy for buyers to view attachments for their completed jobs
    - Add RLS policy for buyers to view updates for their completed jobs

  3. Notes
    - Buyers can only view jobs that are completed (status = 'completed')
    - Buyers have read-only access to job details, updates, and attachments
    - Service providers maintain full control over their jobs
*/

-- Add buyer_id column to service_provider_jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_provider_jobs' AND column_name = 'buyer_id'
  ) THEN
    ALTER TABLE service_provider_jobs
    ADD COLUMN buyer_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for buyer_id
CREATE INDEX IF NOT EXISTS idx_jobs_buyer_id ON service_provider_jobs(buyer_id);

-- RLS Policy: Buyers can view their completed jobs
CREATE POLICY "Buyers can view own completed jobs"
  ON service_provider_jobs FOR SELECT
  TO authenticated
  USING (
    buyer_id = auth.uid() AND
    status = 'completed' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'buyer'
    )
  );

-- RLS Policy: Buyers can view updates for their completed jobs
CREATE POLICY "Buyers can view updates for own completed jobs"
  ON service_provider_job_updates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_provider_jobs
      WHERE service_provider_jobs.id = job_id
      AND service_provider_jobs.buyer_id = auth.uid()
      AND service_provider_jobs.status = 'completed'
    )
  );

-- RLS Policy: Buyers can view attachments for their completed jobs
CREATE POLICY "Buyers can view attachments for own completed jobs"
  ON service_provider_job_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM service_provider_jobs
      WHERE service_provider_jobs.id = job_id
      AND service_provider_jobs.buyer_id = auth.uid()
      AND service_provider_jobs.status = 'completed'
    )
  );

-- Storage Policy: Buyers can view attachments for their completed jobs
CREATE POLICY "Buyers can view their job attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'job-attachments' AND
    EXISTS (
      SELECT 1 FROM service_provider_jobs spj
      JOIN service_provider_job_attachments spja ON spja.job_id = spj.id
      WHERE spj.buyer_id = auth.uid()
      AND spj.status = 'completed'
      AND spja.file_path = name
    )
  );
