/*
  # Add loan type field to pre-approval requests

  1. Changes
    - Add `loan_type` column to distinguish between pre-approval requests and final loan approvals
    - Add `final_loan_amount` column for the final approved loan amount (different from pre-approval)
    - Add `loan_terms` column to store loan terms (interest rate, loan term, etc.)
    - Add `loan_documents_complete` boolean to track if all loan documents are ready
    - Add `loan_approval_date` for when the final loan was approved

  2. Types
    - loan_type: 'pre_approval' or 'loan_approval'
    - pre_approval: Initial mortgage pre-qualification/pre-approval
    - loan_approval: Final mortgage loan ready for closing

  3. Notes
    - Default existing records to 'pre_approval'
    - Lenders can create 'loan_approval' type records to send final loans to buyers
*/

-- Add loan_type column with default 'pre_approval'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pre_approval_requests' AND column_name = 'loan_type'
  ) THEN
    ALTER TABLE pre_approval_requests 
    ADD COLUMN loan_type text DEFAULT 'pre_approval' CHECK (loan_type IN ('pre_approval', 'loan_approval'));
  END IF;
END $$;

-- Add final_loan_amount for loan approvals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pre_approval_requests' AND column_name = 'final_loan_amount'
  ) THEN
    ALTER TABLE pre_approval_requests 
    ADD COLUMN final_loan_amount numeric;
  END IF;
END $$;

-- Add loan_terms to store interest rate, term length, monthly payment, etc.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pre_approval_requests' AND column_name = 'loan_terms'
  ) THEN
    ALTER TABLE pre_approval_requests 
    ADD COLUMN loan_terms jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Add loan_documents_complete flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pre_approval_requests' AND column_name = 'loan_documents_complete'
  ) THEN
    ALTER TABLE pre_approval_requests 
    ADD COLUMN loan_documents_complete boolean DEFAULT false;
  END IF;
END $$;

-- Add loan_approval_date for final loan approval
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pre_approval_requests' AND column_name = 'loan_approval_date'
  ) THEN
    ALTER TABLE pre_approval_requests 
    ADD COLUMN loan_approval_date timestamptz;
  END IF;
END $$;

-- Update existing records to be 'pre_approval' type
UPDATE pre_approval_requests 
SET loan_type = 'pre_approval' 
WHERE loan_type IS NULL;

-- Create index for loan_type queries
CREATE INDEX IF NOT EXISTS idx_pre_approval_requests_loan_type 
ON pre_approval_requests(loan_type);

-- Create index for buyer and loan type combined
CREATE INDEX IF NOT EXISTS idx_pre_approval_requests_buyer_loan_type 
ON pre_approval_requests(buyer_id, loan_type);
