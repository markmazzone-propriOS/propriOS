/*
  # Fix Agent Policies Column References

  1. Changes
    - Drop and recreate agent UPDATE policies with correct column references
    - In WITH CHECK clauses, reference columns directly without table prefix
    - Maintain support for both agents and their managed users

  2. Security
    - Maintains RLS on properties table
    - Allows agents to manage their own properties
    - Allows managed users to manage properties on behalf of their agent
*/

-- Drop existing agent-related UPDATE policies
DROP POLICY IF EXISTS "Agents can assign sellers to own listings" ON properties;
DROP POLICY IF EXISTS "Assigned agent can update property" ON properties;

-- Recreate policies with correct column references for WITH CHECK
CREATE POLICY "Agents can assign sellers to own listings"
  ON properties FOR UPDATE
  TO authenticated
  USING (
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = properties.agent_id
      AND ama.can_edit_listings = true
    )
  )
  WITH CHECK (
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = agent_id
      AND ama.can_edit_listings = true
    )
  );

CREATE POLICY "Assigned agent can update property"
  ON properties FOR UPDATE
  TO authenticated
  USING (
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = properties.agent_id
      AND ama.can_edit_listings = true
    )
  )
  WITH CHECK (
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = agent_id
      AND ama.can_edit_listings = true
    )
  );
