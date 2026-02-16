/*
  # Fix Managed User Property Delete Policy

  1. Changes
    - Drop and recreate the managed user property delete policy
    - Fix the policy to properly reference properties.agent_id in USING clause
    - Ensure proper table qualification to avoid ambiguity

  2. Security
    - Maintains RLS on properties table
    - Only allows managed users with can_delete_listings permission to delete
    - Ensures the property's agent_id matches their managing agent
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Managed accounts can delete agent properties" ON properties;

-- Recreate with corrected logic
CREATE POLICY "Managed accounts can delete agent properties"
  ON properties FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = properties.agent_id
      AND ama.can_delete_listings = true
    )
  );
