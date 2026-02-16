/*
  # Fix Seller Journey Progress - Agent Insert Policy
  
  1. Changes
    - Add policy for agents to insert journey progress for their clients
    - This allows agents to create initial journey records when viewing seller progress
    
  2. Security
    - Agents can only insert journey progress for sellers they are assigned to
    - Maintains proper RLS security by checking agent assignment
*/

-- Agents can insert journey progress for their clients
CREATE POLICY "Agents can insert clients journey progress"
  ON seller_journey_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
      AND profiles.id = (
        SELECT assigned_agent_id FROM profiles WHERE id = seller_id
      )
    )
  );