/*
  # Add Document Sharing System

  1. New Tables
    - `document_shares`
      - `id` (uuid, primary key)
      - `document_id` (uuid, references agent_documents)
      - `shared_by` (uuid, references profiles) - who shared the document
      - `shared_with` (uuid, references profiles) - who can view the document
      - `can_download` (boolean) - download permission
      - `shared_at` (timestamptz)
      - `expires_at` (timestamptz, optional) - optional expiration

  2. Updates to agent_documents
    - Add `owner_id` column to track original owner
    - Update to support buyers/sellers owning documents too

  3. Security
    - Enable RLS on document_shares table
    - Users can share their own documents
    - Users can view documents shared with them
    - Agents can share documents with assigned clients
    - Clients can share documents with their assigned agent
    - Update agent_documents RLS to allow viewing shared documents

  4. Changes
    - Rename agent_documents to documents for broader use
    - Update policies to support all user types
*/

-- First, rename the table to be more generic
ALTER TABLE agent_documents RENAME TO documents;

-- Add owner_id to support all user types owning documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE documents ADD COLUMN owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
    UPDATE documents SET owner_id = agent_id WHERE owner_id IS NULL;
  END IF;
END $$;

-- Update agent_id to be nullable since all user types can now own documents
ALTER TABLE documents ALTER COLUMN agent_id DROP NOT NULL;

-- Update check constraint to include all document types
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_document_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_document_type_check 
  CHECK (document_type IN ('license', 'certification', 'contract', 'identification', 'insurance', 'inspection', 'appraisal', 'disclosure', 'offer', 'other'));

-- Create document_shares table
CREATE TABLE IF NOT EXISTS document_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  shared_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  shared_with uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  can_download boolean DEFAULT true,
  shared_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(document_id, shared_with)
);

-- Enable RLS on document_shares
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

-- Drop old policies
DROP POLICY IF EXISTS "Agents can upload own documents" ON documents;
DROP POLICY IF EXISTS "Agents can view own documents" ON documents;
DROP POLICY IF EXISTS "Agents can update own documents" ON documents;
DROP POLICY IF EXISTS "Agents can delete own documents" ON documents;

-- New policies for documents table

-- Policy: Users can insert their own documents
CREATE POLICY "Users can upload own documents"
  ON documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can view their own documents
CREATE POLICY "Users can view own documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Policy: Users can view documents shared with them (non-expired)
CREATE POLICY "Users can view shared documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM document_shares
      WHERE document_shares.document_id = documents.id
      AND document_shares.shared_with = auth.uid()
      AND (document_shares.expires_at IS NULL OR document_shares.expires_at > now())
    )
  );

-- Policy: Agents can view documents owned by their assigned clients
CREATE POLICY "Agents can view client documents"
  ON documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
      AND documents.owner_id IN (
        SELECT id FROM profiles WHERE assigned_agent_id = auth.uid()
      )
    )
  );

-- Policy: Users can update their own documents
CREATE POLICY "Users can update own documents"
  ON documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Users can delete their own documents
CREATE POLICY "Users can delete own documents"
  ON documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Policies for document_shares table

-- Policy: Users can create shares for their own documents
CREATE POLICY "Users can share own documents"
  ON document_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = shared_by AND
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_id
      AND documents.owner_id = auth.uid()
    )
  );

-- Policy: Agents can share documents with assigned clients
CREATE POLICY "Agents can share with assigned clients"
  ON document_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = shared_by AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
      AND shared_with IN (
        SELECT id FROM profiles WHERE assigned_agent_id = auth.uid()
      )
    ) AND
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_id
      AND documents.owner_id = auth.uid()
    )
  );

-- Policy: Clients can share documents with their assigned agent
CREATE POLICY "Clients can share with assigned agent"
  ON document_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = shared_by AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.assigned_agent_id = shared_with
    ) AND
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_id
      AND documents.owner_id = auth.uid()
    )
  );

-- Policy: Users can view shares for their own documents
CREATE POLICY "Users can view own document shares"
  ON document_shares
  FOR SELECT
  TO authenticated
  USING (
    shared_by = auth.uid() OR
    shared_with = auth.uid()
  );

-- Policy: Users can delete shares they created
CREATE POLICY "Users can revoke shares"
  ON document_shares
  FOR DELETE
  TO authenticated
  USING (shared_by = auth.uid());

-- Policy: Users can update shares they created
CREATE POLICY "Users can update own shares"
  ON document_shares
  FOR UPDATE
  TO authenticated
  USING (shared_by = auth.uid())
  WITH CHECK (shared_by = auth.uid());

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_document_id ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_document_shares_shared_with ON document_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_document_shares_shared_by ON document_shares(shared_by);
