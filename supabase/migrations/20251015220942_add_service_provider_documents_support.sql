/*
  # Add Service Provider Support to Documents System

  ## Overview
  Extends the documents table to support service providers in addition to agents.

  ## Changes
  1. Add service_provider_id column to documents table
  2. Update RLS policies to allow service providers to manage their documents
  3. Ensure document_shares work for service providers

  ## Notes
  - Documents can be owned by either agents or service providers
  - RLS policies check both agent_id and service_provider_id fields
  - Maintains backward compatibility with existing agent documents
*/

-- Add service_provider_id column to documents table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'service_provider_id'
  ) THEN
    ALTER TABLE documents ADD COLUMN service_provider_id uuid REFERENCES service_provider_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop and recreate policies to support service providers
DROP POLICY IF EXISTS "Users can view own documents" ON documents;
DROP POLICY IF EXISTS "Users can upload own documents" ON documents;
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;

-- Create new policies that support both agents and service providers
CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  TO authenticated
  USING (
    auth.uid() = agent_id OR 
    auth.uid() = service_provider_id OR
    auth.uid() = owner_id OR
    auth.uid() IN (
      SELECT shared_with FROM document_shares WHERE document_id = id
    )
  );

CREATE POLICY "Users can upload own documents"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = agent_id OR 
    auth.uid() = service_provider_id OR
    auth.uid() = owner_id
  );

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = agent_id OR 
    auth.uid() = service_provider_id OR
    auth.uid() = owner_id
  )
  WITH CHECK (
    auth.uid() = agent_id OR 
    auth.uid() = service_provider_id OR
    auth.uid() = owner_id
  );

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  TO authenticated
  USING (
    auth.uid() = agent_id OR 
    auth.uid() = service_provider_id OR
    auth.uid() = owner_id
  );