/*
  # Create Documents Management System

  1. New Tables
    - `agent_documents`
      - `id` (uuid, primary key)
      - `agent_id` (uuid, references profiles)
      - `file_name` (text)
      - `file_type` (text)
      - `file_size` (bigint)
      - `storage_path` (text)
      - `document_type` (text) - license, certification, contract, etc.
      - `description` (text, optional)
      - `uploaded_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `agent_documents` table
    - Agents can only access their own documents
    - Policy for agents to insert their own documents
    - Policy for agents to view their own documents
    - Policy for agents to update their own documents
    - Policy for agents to delete their own documents

  3. Storage
    - Creates a storage bucket for agent documents
    - Sets up secure access policies for the bucket
*/

-- Create agent_documents table
CREATE TABLE IF NOT EXISTS agent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  storage_path text NOT NULL UNIQUE,
  document_type text NOT NULL CHECK (document_type IN ('license', 'certification', 'contract', 'identification', 'insurance', 'other')),
  description text,
  uploaded_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE agent_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Agents can insert their own documents
CREATE POLICY "Agents can upload own documents"
  ON agent_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = agent_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
    )
  );

-- Policy: Agents can view their own documents
CREATE POLICY "Agents can view own documents"
  ON agent_documents
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = agent_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
    )
  );

-- Policy: Agents can update their own documents
CREATE POLICY "Agents can update own documents"
  ON agent_documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = agent_id)
  WITH CHECK (auth.uid() = agent_id);

-- Policy: Agents can delete their own documents
CREATE POLICY "Agents can delete own documents"
  ON agent_documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = agent_id);

-- Create storage bucket for agent documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-documents', 'agent-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Agents can upload to their own folder
CREATE POLICY "Agents can upload own documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'agent-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policy: Agents can view their own documents
CREATE POLICY "Agents can view own documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'agent-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policy: Agents can update their own documents
CREATE POLICY "Agents can update own documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'agent-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policy: Agents can delete their own documents
CREATE POLICY "Agents can delete own documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'agent-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_agent_documents_agent_id ON agent_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_documents_document_type ON agent_documents(document_type);
