/*
  # Fix Renter Journey Unique Constraint

  1. Changes
    - Add unique constraint on renter_id to prevent duplicate journey records
    - This ensures each renter has exactly one journey progress record

  2. Security
    - No security changes, existing RLS policies remain in place
*/

-- Add unique constraint on renter_id
ALTER TABLE renter_journey_progress
ADD CONSTRAINT renter_journey_progress_renter_id_key UNIQUE (renter_id);
