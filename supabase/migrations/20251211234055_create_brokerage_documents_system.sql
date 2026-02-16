/*
  # Create Brokerage Document Management System

  1. New Tables
    - `brokerage_documents`
      - `id` (uuid, primary key)
      - `brokerage_id` (uuid, references brokerages)
      - `file_name` (text)
      - `file_type` (text)
      - `file_size` (bigint)
      - `storage_path` (text, unique)
      - `document_type` (text) - policy, form, contract, training, resource, etc.
      - `description` (text, optional)
      - `uploaded_by` (uuid, references profiles)
      - `uploaded_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `brokerage_document_shares`
      - `id` (uuid, primary key)
      - `document_id` (uuid, references brokerage_documents)
      - `agent_id` (uuid, references profiles) - null means shared with all agents
      - `shared_by` (uuid, references profiles)
      - `shared_at` (timestamptz)
      - Composite unique constraint on (document_id, agent_id)

  2. Security
    - Enable RLS on both tables
    - Brokerages can manage their own documents
    - Brokerages can share documents with their agents
    - Agents can view documents shared with them
    - Agents can view documents shared with all agents in their brokerage

  3. Storage
    - Create storage bucket for brokerage documents
    - Set up secure access policies
*/

-- Create brokerage_documents table
CREATE TABLE IF NOT EXISTS brokerage_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brokerage_id uuid REFERENCES brokerages(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  storage_path text NOT NULL UNIQUE,
  document_type text NOT NULL CHECK (document_type IN ('policy', 'form', 'contract', 'training', 'resource', 'template', 'compliance', 'other')),
  description text,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create brokerage_document_shares table
CREATE TABLE IF NOT EXISTS brokerage_document_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES brokerage_documents(id) ON DELETE CASCADE NOT NULL,
  agent_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  shared_by uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  shared_at timestamptz DEFAULT now(),
  UNIQUE(document_id, agent_id)
);

-- Enable RLS
ALTER TABLE brokerage_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE brokerage_document_shares ENABLE ROW LEVEL SECURITY;

-- Brokerage Documents Policies

-- Policy: Brokerage super admins can view their brokerage documents
CREATE POLICY "Brokerage admins can view own documents"
  ON brokerage_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_documents.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );

-- Policy: Brokerage super admins can insert documents
CREATE POLICY "Brokerage admins can upload documents"
  ON brokerage_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_documents.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );

-- Policy: Brokerage super admins can update their documents
CREATE POLICY "Brokerage admins can update own documents"
  ON brokerage_documents
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_documents.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_documents.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );

-- Policy: Brokerage super admins can delete their documents
CREATE POLICY "Brokerage admins can delete own documents"
  ON brokerage_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_documents.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );

-- Policy: Agents can view documents shared with them specifically or with all agents
CREATE POLICY "Agents can view shared documents"
  ON brokerage_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokerage_document_shares
      JOIN brokerage_agents ON brokerage_agents.agent_id = auth.uid()
      WHERE brokerage_document_shares.document_id = brokerage_documents.id
      AND brokerage_agents.brokerage_id = brokerage_documents.brokerage_id
      AND brokerage_agents.status = 'active'
      AND (
        brokerage_document_shares.agent_id = auth.uid() 
        OR brokerage_document_shares.agent_id IS NULL
      )
    )
  );

-- Brokerage Document Shares Policies

-- Policy: Brokerage super admins can view all shares for their documents
CREATE POLICY "Brokerage admins can view document shares"
  ON brokerage_document_shares
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokerage_documents
      JOIN brokerages ON brokerages.id = brokerage_documents.brokerage_id
      WHERE brokerage_documents.id = brokerage_document_shares.document_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );

-- Policy: Brokerage super admins can create shares
CREATE POLICY "Brokerage admins can share documents"
  ON brokerage_document_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM brokerage_documents
      JOIN brokerages ON brokerages.id = brokerage_documents.brokerage_id
      WHERE brokerage_documents.id = brokerage_document_shares.document_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );

-- Policy: Brokerage super admins can delete shares
CREATE POLICY "Brokerage admins can unshare documents"
  ON brokerage_document_shares
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokerage_documents
      JOIN brokerages ON brokerages.id = brokerage_documents.brokerage_id
      WHERE brokerage_documents.id = brokerage_document_shares.document_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );

-- Policy: Agents can view shares for documents shared with them
CREATE POLICY "Agents can view their document shares"
  ON brokerage_document_shares
  FOR SELECT
  TO authenticated
  USING (
    brokerage_document_shares.agent_id = auth.uid()
    OR (
      brokerage_document_shares.agent_id IS NULL
      AND EXISTS (
        SELECT 1 FROM brokerage_documents
        JOIN brokerage_agents ON brokerage_agents.brokerage_id = brokerage_documents.brokerage_id
        WHERE brokerage_documents.id = brokerage_document_shares.document_id
        AND brokerage_agents.agent_id = auth.uid()
        AND brokerage_agents.status = 'active'
      )
    )
  );

-- Create storage bucket for brokerage documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('brokerage-documents', 'brokerage-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Brokerage super admins can upload to their brokerage folder
CREATE POLICY "Brokerage admins can upload documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'brokerage-documents' AND
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id::text = (storage.foldername(name))[1]
      AND brokerages.super_admin_id = auth.uid()
    )
  );

-- Storage policy: Brokerage super admins can view their documents
CREATE POLICY "Brokerage admins can view own documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'brokerage-documents' AND
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id::text = (storage.foldername(name))[1]
      AND brokerages.super_admin_id = auth.uid()
    )
  );

-- Storage policy: Brokerage super admins can update their documents
CREATE POLICY "Brokerage admins can update own documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'brokerage-documents' AND
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id::text = (storage.foldername(name))[1]
      AND brokerages.super_admin_id = auth.uid()
    )
  );

-- Storage policy: Brokerage super admins can delete their documents
CREATE POLICY "Brokerage admins can delete own documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'brokerage-documents' AND
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id::text = (storage.foldername(name))[1]
      AND brokerages.super_admin_id = auth.uid()
    )
  );

-- Storage policy: Agents can view documents shared with them
CREATE POLICY "Agents can view shared documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'brokerage-documents' AND
    EXISTS (
      SELECT 1 FROM brokerage_documents
      JOIN brokerage_document_shares ON brokerage_document_shares.document_id = brokerage_documents.id
      JOIN brokerage_agents ON brokerage_agents.brokerage_id = brokerage_documents.brokerage_id
      WHERE brokerage_documents.storage_path = name
      AND brokerage_agents.agent_id = auth.uid()
      AND brokerage_agents.status = 'active'
      AND (
        brokerage_document_shares.agent_id = auth.uid()
        OR brokerage_document_shares.agent_id IS NULL
      )
    )
  );

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_brokerage_documents_brokerage_id ON brokerage_documents(brokerage_id);
CREATE INDEX IF NOT EXISTS idx_brokerage_documents_document_type ON brokerage_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_brokerage_document_shares_document_id ON brokerage_document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_brokerage_document_shares_agent_id ON brokerage_document_shares(agent_id);
