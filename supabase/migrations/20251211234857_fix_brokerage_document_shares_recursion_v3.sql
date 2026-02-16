/*
  # Fix Brokerage Document Shares Infinite Recursion (v3)

  1. Problem
    - When querying brokerage_documents with shares joined, the RLS policies on 
      brokerage_document_shares reference brokerage_documents, creating infinite recursion
    - This happens because the policy checks brokerage_documents.id which triggers 
      another RLS check

  2. Solution
    - Use a SECURITY DEFINER helper function to check brokerage membership
    - This breaks the recursion by not triggering RLS when checking permissions
*/

-- Drop ALL existing policies
DROP POLICY IF EXISTS "Brokerage admins can view document shares" ON brokerage_document_shares;
DROP POLICY IF EXISTS "Agents can view their document shares" ON brokerage_document_shares;
DROP POLICY IF EXISTS "Brokerage admins can share documents" ON brokerage_document_shares;
DROP POLICY IF EXISTS "Brokerage admins can unshare documents" ON brokerage_document_shares;
DROP POLICY IF EXISTS "Users can view document shares for their documents" ON brokerage_document_shares;

-- Drop the function if it exists
DROP FUNCTION IF EXISTS user_can_view_brokerage_document(uuid);

-- Create a helper function to check if a user can view a document
CREATE OR REPLACE FUNCTION user_can_view_brokerage_document(doc_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM brokerage_documents bd
    JOIN brokerages b ON b.id = bd.brokerage_id
    WHERE bd.id = doc_id
    AND (
      b.super_admin_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM brokerage_agents ba
        WHERE ba.brokerage_id = b.id
        AND ba.agent_id = auth.uid()
        AND ba.status = 'active'
      )
    )
  );
END;
$$;

-- Recreate policies using the helper function
CREATE POLICY "Users can view document shares"
  ON brokerage_document_shares
  FOR SELECT
  TO authenticated
  USING (
    agent_id = auth.uid()
    OR (agent_id IS NULL AND user_can_view_brokerage_document(document_id))
    OR user_can_view_brokerage_document(document_id)
  );

CREATE POLICY "Brokerage admins can share documents"
  ON brokerage_document_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_can_view_brokerage_document(document_id)
  );

CREATE POLICY "Brokerage admins can unshare documents"
  ON brokerage_document_shares
  FOR DELETE
  TO authenticated
  USING (
    user_can_view_brokerage_document(document_id)
  );
