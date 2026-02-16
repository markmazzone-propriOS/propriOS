/*
  # Add Document URL Fields to Loan Applications

  1. Changes
    - Add columns to store document URLs directly on loan_applications table
    - Includes: proof_of_income, proof_of_employment, tax_returns, bank_statements, credit_report, purchase_agreement
    
  2. Security
    - No RLS changes needed - existing policies cover these new columns
    - Documents stored in agent-documents bucket with proper access control
*/

-- Add document URL columns to loan_applications
ALTER TABLE loan_applications
ADD COLUMN IF NOT EXISTS proof_of_income text,
ADD COLUMN IF NOT EXISTS proof_of_employment text,
ADD COLUMN IF NOT EXISTS tax_returns text,
ADD COLUMN IF NOT EXISTS bank_statements text,
ADD COLUMN IF NOT EXISTS credit_report text,
ADD COLUMN IF NOT EXISTS purchase_agreement text;
