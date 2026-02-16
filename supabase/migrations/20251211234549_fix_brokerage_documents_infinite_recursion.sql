/*
  # Fix Infinite Recursion in Brokerage Document Shares Policies

  1. Problem
    - The RLS policies for brokerage_document_shares were causing infinite recursion
    - This happens when policies reference tables that also have RLS enabled

  2. Solution
    - Simplify the "Agents can view their document shares" policy
    - Remove circular dependencies between brokerage_documents and brokerage_document_shares
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Agents can view their document shares" ON brokerage_document_shares;

-- Recreate with a simpler approach that doesn't cause recursion
CREATE POLICY "Agents can view their document shares"
  ON brokerage_document_shares
  FOR SELECT
  TO authenticated
  USING (
    agent_id = auth.uid()
    OR (
      agent_id IS NULL
      AND EXISTS (
        SELECT 1 FROM brokerage_agents
        JOIN brokerage_documents ON brokerage_documents.brokerage_id = brokerage_agents.brokerage_id
        WHERE brokerage_agents.agent_id = auth.uid()
        AND brokerage_agents.status = 'active'
        AND brokerage_documents.id = brokerage_document_shares.document_id
      )
    )
  );
