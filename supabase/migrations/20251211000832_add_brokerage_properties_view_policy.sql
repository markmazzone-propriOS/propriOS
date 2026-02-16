/*
  # Add brokerage properties view policy

  1. Changes
    - Add RLS policy allowing brokerages to view properties from agents in their brokerage
    - This enables brokerage dashboard to display listings from all brokerage agents

  2. Security
    - Policy checks that the user is a brokerage super admin
    - Verifies the property's agent belongs to the brokerage
*/

-- Drop existing policy if it exists
DO $$
BEGIN
  DROP POLICY IF EXISTS "Brokerages can view properties from their agents" ON properties;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Allow brokerages to view properties from agents in their brokerage
CREATE POLICY "Brokerages can view properties from their agents"
  ON properties
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM brokerages b
      JOIN brokerage_agents ba ON ba.brokerage_id = b.id
      WHERE b.super_admin_id = auth.uid()
        AND ba.agent_id = properties.agent_id
        AND ba.status = 'active'
    )
  );
