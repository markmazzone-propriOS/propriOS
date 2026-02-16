/*
  # Add additional fields to application_documents table

  1. Changes
    - Add file_name column for original filename
    - Add file_type column for MIME type
    - Add file_size column for file size in bytes
    - Add storage_path column for storage bucket path
    - Add description column for document description
    - Add uploaded_by column for tracking who uploaded
    - Update document_name to be nullable (can use file_name instead)
    - Rename file_url to storage_path if needed

  2. Security
    - Maintain existing RLS policies
    - Add policy for lenders to insert documents
    - Add policy for buyers to view their application documents
*/

-- Add new columns to application_documents if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'application_documents' AND column_name = 'file_name'
  ) THEN
    ALTER TABLE application_documents ADD COLUMN file_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'application_documents' AND column_name = 'file_type'
  ) THEN
    ALTER TABLE application_documents ADD COLUMN file_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'application_documents' AND column_name = 'file_size'
  ) THEN
    ALTER TABLE application_documents ADD COLUMN file_size bigint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'application_documents' AND column_name = 'storage_path'
  ) THEN
    ALTER TABLE application_documents ADD COLUMN storage_path text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'application_documents' AND column_name = 'description'
  ) THEN
    ALTER TABLE application_documents ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'application_documents' AND column_name = 'uploaded_by'
  ) THEN
    ALTER TABLE application_documents ADD COLUMN uploaded_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Make document_name nullable if not already
ALTER TABLE application_documents ALTER COLUMN document_name DROP NOT NULL;

-- Add RLS policies if they don't exist
DO $$
BEGIN
  -- Allow lenders to insert documents for their applications
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'application_documents' AND policyname = 'Lenders can upload application documents'
  ) THEN
    CREATE POLICY "Lenders can upload application documents"
      ON application_documents
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM loan_applications
          WHERE loan_applications.id = application_documents.application_id
          AND loan_applications.lender_id = auth.uid()
        )
      );
  END IF;

  -- Allow buyers to view their application documents
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'application_documents' AND policyname = 'Buyers can view their application documents'
  ) THEN
    CREATE POLICY "Buyers can view their application documents"
      ON application_documents
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM loan_applications
          WHERE loan_applications.id = application_documents.application_id
          AND loan_applications.buyer_id = auth.uid()
        )
      );
  END IF;

  -- Allow lenders to view their application documents
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'application_documents' AND policyname = 'Lenders can view their application documents'
  ) THEN
    CREATE POLICY "Lenders can view their application documents"
      ON application_documents
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM loan_applications
          WHERE loan_applications.id = application_documents.application_id
          AND loan_applications.lender_id = auth.uid()
        )
      );
  END IF;
END $$;
