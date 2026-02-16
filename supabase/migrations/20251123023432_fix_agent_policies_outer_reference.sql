/*
  # Fix Agent Policies with Correct Outer Reference

  1. Changes
    - Drop and recreate agent UPDATE policies
    - Use proper outer reference to the properties table's agent_id column
    - In subquery, reference outer properties.agent_id explicitly

  2. Security
    - Maintains RLS on properties table
    - Allows agents to manage their own properties
    - Allows managed users to manage properties on behalf of their agent
*/

-- Drop existing agent-related UPDATE policies
DROP POLICY IF EXISTS "Agents can assign sellers to own listings" ON properties;
DROP POLICY IF EXISTS "Assigned agent can update property" ON properties;

-- Recreate with proper outer reference in subquery
-- We need to be explicit about which agent_id we're checking
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
    -- In WITH CHECK, we're checking the NEW row values
    -- We need to reference the NEW agent_id being set
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 
      FROM agent_managed_accounts ama
      INNER JOIN properties p ON p.agent_id = ama.agent_id
      WHERE ama.managed_user_id = auth.uid()
      AND p.id = properties.id
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
    -- In WITH CHECK, we're checking the NEW row values
    -- We need to reference the NEW agent_id being set
    agent_id = auth.uid()
    OR EXISTS (
      SELECT 1 
      FROM agent_managed_accounts ama
      INNER JOIN properties p ON p.agent_id = ama.agent_id
      WHERE ama.managed_user_id = auth.uid()
      AND p.id = properties.id
      AND ama.can_edit_listings = true
    )
  );
