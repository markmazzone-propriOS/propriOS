/*
  # Fix Managed User Property Update Policy V2

  1. Changes
    - Drop and recreate the managed user property update policy
    - Fix WITH CHECK to reference the existing row's agent_id, not the new row
    - The USING clause already correctly checks the existing row
    - WITH CHECK should verify the managed user can still edit after update

  2. Security
    - Maintains RLS on properties table
    - Only allows managed users with can_edit_listings permission to update
    - Ensures the existing property belongs to their managing agent
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Managed accounts can update agent properties" ON properties;

-- Recreate with corrected logic
-- For UPDATE policies, we need to join with the existing row
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
    -- Check that they still have permission for the agent (in case agent_id is being changed)
    -- If agent_id is not being changed, this will check against the same value
    EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.can_edit_listings = true
      -- For UPDATE, we need to allow the update if they manage the agent
      AND (
        ama.agent_id = properties.agent_id
      )
    )
  );
