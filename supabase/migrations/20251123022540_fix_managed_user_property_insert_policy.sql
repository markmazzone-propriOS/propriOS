/*
  # Fix Managed User Property Insert Policy

  1. Changes
    - Drop and recreate the managed user property insert policy
    - Fix the policy to properly check if the inserting user is a managed user
    - Ensure the agent_id being inserted matches the managing agent

  2. Security
    - Maintains RLS on properties table
    - Only allows managed users with can_create_listings permission to insert
    - Ensures the agent_id in the new row matches their managing agent
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Managed accounts can create properties for agent" ON properties;

-- Recreate with corrected logic
CREATE POLICY "Managed accounts can create properties for agent"
  ON properties FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = properties.agent_id
      AND ama.can_create_listings = true
    )
  );
