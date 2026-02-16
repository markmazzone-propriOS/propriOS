/*
  # Fix Managed User Property Update Policy

  1. Changes
    - Drop and recreate the managed user property update policy
    - Fix the policy to properly reference properties.agent_id in both USING and WITH CHECK
    - Ensure proper table qualification to avoid ambiguity

  2. Security
    - Maintains RLS on properties table
    - Only allows managed users with can_edit_listings permission to update
    - Ensures both the existing and new agent_id match their managing agent
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Managed accounts can update agent properties" ON properties;

-- Recreate with corrected logic
CREATE POLICY "Managed accounts can update agent properties"
  ON properties FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = properties.agent_id
      AND ama.can_edit_listings = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = properties.agent_id
      AND ama.can_edit_listings = true
    )
  );
