/*
  # Update Agent Documents Storage for Service Providers

  ## Overview
  Updates the agent-documents storage bucket policies to allow service providers to upload and manage their documents.

  ## Changes
  1. Update storage policies to check for both agent_id and service_provider_id
  2. Allow service providers to use the same document storage bucket

  ## Security
  - Service providers can only access their own documents
  - Maintains existing security for agents
  - Documents are organized by user ID in separate folders
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Agents can upload own documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents can view own documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents can update own documents" ON storage.objects;
DROP POLICY IF EXISTS "Agents can delete own documents" ON storage.objects;

-- Create new policies that support both agents and service providers
CREATE POLICY "Users can upload own documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'agent-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can view own documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'agent-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'agent-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'agent-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'agent-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );