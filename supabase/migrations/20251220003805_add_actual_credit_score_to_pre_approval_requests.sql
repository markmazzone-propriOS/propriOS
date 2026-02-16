/*
  # Add Actual Credit Score to Pre-Approval Requests

  ## Overview
  Adds a new field for lenders to record the actual credit score they verify
  during the pre-approval review process. This allows lenders to compare the
  buyer's stated credit score with the actual verified score.

  ## Changes
  1. Adds `actual_credit_score` column to pre_approval_requests table
  2. This field is optional and set by the lender during review

  ## Notes
  - The `approved_amount` field already exists in the schema
  - Both fields are editable by the lender before approval/denial
*/

-- Add actual credit score column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pre_approval_requests' AND column_name = 'actual_credit_score'
  ) THEN
    ALTER TABLE pre_approval_requests
    ADD COLUMN actual_credit_score integer;
  END IF;
END $$;
