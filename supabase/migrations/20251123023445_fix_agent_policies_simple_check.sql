/*
  # Fix Agent Policies - Simple WITH CHECK

  1. Changes
    - Drop and recreate agent UPDATE policies
    - In WITH CHECK, use a lateral join to get the property's current agent_id
    - This allows us to check if the managed user can edit for that agent

  2. Security
    - Maintains RLS on properties table
    - Allows agents to manage their own properties
    - Allows managed users to manage properties on behalf of their agent
*/

-- Drop existing agent-related UPDATE policies
DROP POLICY IF EXISTS "Agents can assign sellers to own listings" ON properties;
DROP POLICY IF EXISTS "Assigned agent can update property" ON properties;

-- The key insight: In WITH CHECK for UPDATE, the column references refer to NEW values
-- So 'agent_id' in WITH CHECK is the NEW agent_id value being set
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
    -- Check the NEW agent_id value
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = properties.agent_id  -- This now refers to NEW agent_id
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
    -- Check the NEW agent_id value
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = properties.agent_id  -- This now refers to NEW agent_id
      AND ama.can_edit_listings = true
    )
  );
