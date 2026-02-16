/*
  # Create Comprehensive Pre-Approval Request System

  ## Overview
  Enhances the pre-approval request system to include detailed document tracking
  and requirements for mortgage pre-approval applications.

  ## Changes
  1. New Table: `pre_approval_documents` - Tracks uploaded documents by section
  2. Storage: Creates bucket for pre-approval documents
  3. Updates: Adds shareable link field to pre_approval_requests

  ## New Tables
  - `pre_approval_documents`
    - `id` (uuid, primary key)
    - `pre_approval_request_id` (uuid, references pre_approval_requests)
    - `section` (text: 'personal_identification', 'income_employment', 'assets_savings', 'debts_liabilities')
    - `document_name` (text)
    - `file_url` (text)
    - `uploaded_at` (timestamptz)
    - `uploaded_by` (uuid, references auth.users)

  ## Security
  - Enable RLS on pre_approval_documents
  - Buyers can manage their own documents
  - Lenders can view documents for their assigned requests
  - Storage policies for secure document access
*/

-- Add shareable link field to pre_approval_requests
ALTER TABLE pre_approval_requests
ADD COLUMN IF NOT EXISTS shareable_token uuid DEFAULT gen_random_uuid() UNIQUE,
ADD COLUMN IF NOT EXISTS shared_by_lender_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS additional_notes text;

-- Create pre_approval_documents table
CREATE TABLE IF NOT EXISTS pre_approval_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_approval_request_id uuid REFERENCES pre_approval_requests(id) ON DELETE CASCADE NOT NULL,
  section text NOT NULL CHECK (section IN (
    'personal_identification',
    'income_employment', 
    'assets_savings',
    'debts_liabilities'
  )),
  document_name text NOT NULL,
  file_url text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL
);

ALTER TABLE pre_approval_documents ENABLE ROW LEVEL SECURITY;

-- Buyers can manage their pre-approval documents
CREATE POLICY "Buyers can view their pre-approval documents"
  ON pre_approval_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pre_approval_requests
      WHERE pre_approval_requests.id = pre_approval_documents.pre_approval_request_id
      AND pre_approval_requests.buyer_id = auth.uid()
    )
  );

CREATE POLICY "Buyers can insert their pre-approval documents"
  ON pre_approval_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pre_approval_requests
      WHERE pre_approval_requests.id = pre_approval_documents.pre_approval_request_id
      AND pre_approval_requests.buyer_id = auth.uid()
    )
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Buyers can delete their pre-approval documents"
  ON pre_approval_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pre_approval_requests
      WHERE pre_approval_requests.id = pre_approval_documents.pre_approval_request_id
      AND pre_approval_requests.buyer_id = auth.uid()
    )
  );

-- Lenders can view documents for their assigned requests
CREATE POLICY "Lenders can view pre-approval documents for their requests"
  ON pre_approval_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pre_approval_requests
      WHERE pre_approval_requests.id = pre_approval_documents.pre_approval_request_id
      AND pre_approval_requests.lender_id = auth.uid()
    )
  );

-- Create storage bucket for pre-approval documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('pre-approval-documents', 'pre-approval-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pre-approval documents
CREATE POLICY "Users can upload pre-approval documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pre-approval-documents'
  );

CREATE POLICY "Users can view their pre-approval documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pre-approval-documents'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT par.id::text
        FROM pre_approval_requests par
        WHERE par.buyer_id = auth.uid()
      )
      OR
      (storage.foldername(name))[1] IN (
        SELECT par.id::text
        FROM pre_approval_requests par
        WHERE par.lender_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their pre-approval documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'pre-approval-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT par.id::text
      FROM pre_approval_requests par
      WHERE par.buyer_id = auth.uid()
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pre_approval_documents_request_id 
  ON pre_approval_documents(pre_approval_request_id);

CREATE INDEX IF NOT EXISTS idx_pre_approval_requests_shareable_token 
  ON pre_approval_requests(shareable_token);
