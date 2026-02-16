/*
  # Backfill Buyer ID for Existing Inspection Jobs

  1. Changes
    - Update existing jobs that were created from inspection requests to include the buyer_id
    - This ensures all historical inspection jobs are properly linked to buyers

  2. Behavior
    - Finds jobs linked to inspection requests via job_id
    - Updates those jobs to include the buyer_id from the inspection request
*/

-- Update existing jobs with buyer_id from inspection requests
UPDATE service_provider_jobs spj
SET buyer_id = bir.buyer_id
FROM buyer_inspection_requests bir
WHERE spj.id = bir.job_id
AND spj.buyer_id IS NULL
AND bir.buyer_id IS NOT NULL;
