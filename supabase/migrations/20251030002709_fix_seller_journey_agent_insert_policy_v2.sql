/*
  # Fix Seller Journey Progress - Agent Insert Policy V2
  
  1. Changes
    - Drop the previous agent insert policy that had a logic error
    - Create a new policy that correctly checks agent assignment
    - The previous policy tried to reference seller_journey_progress.seller_id during INSERT
      which doesn't work because the row doesn't exist yet in the table context
    
  2. Security
    - Agents can only insert journey progress for sellers they are assigned to
    - Uses NEW record's seller_id value instead of table lookup
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Agents can insert clients journey progress" ON seller_journey_progress;

-- Create the corrected policy for agent inserts
CREATE POLICY "Agents can insert clients journey progress"
  ON seller_journey_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles seller_profile
      WHERE seller_profile.id = seller_id
      AND seller_profile.assigned_agent_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM profiles agent_profile
        WHERE agent_profile.id = auth.uid()
        AND agent_profile.user_type = 'agent'
      )
    )
  );