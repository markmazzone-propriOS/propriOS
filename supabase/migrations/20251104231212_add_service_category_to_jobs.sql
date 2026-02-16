/*
  # Add Service Category to Jobs

  1. Changes
    - Add `service_category_id` column to `service_provider_jobs` table
    - Add foreign key reference to `service_categories` table
    - Add index for efficient queries

  2. Notes
    - This allows jobs to be categorized by service type
    - Property owners and service providers can filter/sort jobs by category
*/

-- Add service_category_id column to jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_provider_jobs' 
    AND column_name = 'service_category_id'
  ) THEN
    ALTER TABLE service_provider_jobs 
    ADD COLUMN service_category_id uuid REFERENCES service_categories(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_jobs_service_category_id 
  ON service_provider_jobs(service_category_id);
