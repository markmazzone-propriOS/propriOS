/*
  # Add Managed User Support to Seller Journey

  1. Changes
    - Add policy for managed users to insert/update seller journey records
    - Ensures managed users can work with seller journeys on behalf of their agent

  2. Security
    - Maintains RLS on seller_journey_progress table
    - Only allows managed users with proper permissions
*/

-- Add policy for managed users to insert seller journey progress
CREATE POLICY "Managed users can insert journey progress"
  ON seller_journey_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      JOIN profiles p ON p.id = seller_id
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = p.assigned_agent_id
    )
  );

-- Add policy for managed users to update seller journey progress
CREATE POLICY "Managed users can update journey progress"
  ON seller_journey_progress
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      JOIN profiles p ON p.id = seller_id
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = p.assigned_agent_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      JOIN profiles p ON p.id = seller_id
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = p.assigned_agent_id
    )
  );

-- Add policy for managed users to view seller journey progress
CREATE POLICY "Managed users can view journey progress"
  ON seller_journey_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agent_managed_accounts ama
      JOIN profiles p ON p.id = seller_id
      WHERE ama.managed_user_id = auth.uid()
      AND ama.agent_id = p.assigned_agent_id
    )
  );
