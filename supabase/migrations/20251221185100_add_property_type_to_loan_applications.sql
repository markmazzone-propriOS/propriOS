/*
  # Add property type field to loan applications

  1. Changes
    - Add `property_type` column to loan_applications table
    - Store the type of property the loan is for (single_family, condo, townhouse, multi_family, etc.)

  2. Notes
    - This is a separate field from property_id for cases where the property hasn't been selected yet
    - Allows lenders to specify property type when creating loan applications
*/

-- Add property_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'loan_applications' AND column_name = 'property_type'
  ) THEN
    ALTER TABLE loan_applications 
    ADD COLUMN property_type text;
  END IF;
END $$;

-- Create index for property_type queries
CREATE INDEX IF NOT EXISTS idx_loan_applications_property_type 
ON loan_applications(property_type);
