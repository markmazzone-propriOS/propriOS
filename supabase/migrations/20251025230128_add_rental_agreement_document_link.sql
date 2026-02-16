/*
  # Link Documents to Rental Agreements

  1. Changes
    - Add `rental_agreement_id` column to documents table
    - Allows documents to be linked to specific rental agreements
    - Property owners can see which documents are associated with which agreements

  2. Updates
    - Add optional foreign key constraint
    - Update to allow documents without rental agreements (general documents)
*/

-- Add rental_agreement_id column to documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'rental_agreement_id'
  ) THEN
    ALTER TABLE documents ADD COLUMN rental_agreement_id uuid REFERENCES rental_agreements(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_documents_rental_agreement_id ON documents(rental_agreement_id);
