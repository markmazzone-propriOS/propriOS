/*
  # Fix Service Provider Jobs Completed Counter

  1. Changes
    - Create trigger on `service_provider_jobs` table to update `total_jobs_completed`
    - The old trigger was referencing `service_jobs` which doesn't exist
    - Backfill existing completed jobs counts for all service providers

  2. Issue Fixed
    - Service providers with completed jobs show 0 in their Total Jobs card
    - The counter wasn't being incremented when jobs were marked as completed
*/

-- Create function to update jobs completed counter
CREATE OR REPLACE FUNCTION update_service_provider_jobs_completed()
RETURNS TRIGGER AS $$
BEGIN
  -- When a job is marked as completed, increment the counter
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE service_provider_profiles
    SET 
      total_jobs_completed = total_jobs_completed + 1,
      updated_at = now()
    WHERE id = NEW.service_provider_id;
  END IF;
  
  -- When a completed job is changed to non-completed, decrement the counter
  IF OLD.status = 'completed' AND NEW.status != 'completed' THEN
    UPDATE service_provider_profiles
    SET 
      total_jobs_completed = GREATEST(0, total_jobs_completed - 1),
      updated_at = now()
    WHERE id = NEW.service_provider_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old trigger if it exists
DROP TRIGGER IF EXISTS update_jobs_completed_trigger ON service_provider_jobs;

-- Create trigger on the correct table
CREATE TRIGGER update_service_provider_jobs_completed_trigger
  AFTER INSERT OR UPDATE ON service_provider_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_service_provider_jobs_completed();

-- Backfill the total_jobs_completed for all service providers
UPDATE service_provider_profiles spp
SET total_jobs_completed = (
  SELECT COUNT(*)
  FROM service_provider_jobs spj
  WHERE spj.service_provider_id = spp.id
  AND spj.status = 'completed'
),
updated_at = now();
