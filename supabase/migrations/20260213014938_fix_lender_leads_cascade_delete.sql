/*
  # Fix Lender Leads Cascade Delete

  ## Overview
  Updates the foreign key constraint on lender_leads to cascade on delete,
  preventing errors when deleting mortgage lender accounts.

  ## Changes
  - Drop existing foreign key constraint
  - Recreate with ON DELETE CASCADE
*/

-- Drop existing constraint
ALTER TABLE lender_leads 
DROP CONSTRAINT IF EXISTS lender_leads_lender_id_fkey;

-- Recreate with CASCADE
ALTER TABLE lender_leads
ADD CONSTRAINT lender_leads_lender_id_fkey 
FOREIGN KEY (lender_id) 
REFERENCES mortgage_lender_profiles(id) 
ON DELETE CASCADE;