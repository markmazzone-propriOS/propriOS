/*
  # Add Delete Invitation Policy

  1. Changes
    - Add DELETE policy for agents to remove their cancelled or accepted invitations
    
  2. Security
    - Only agents can delete their own invitations
    - Only cancelled or accepted invitations can be deleted (not pending ones)
    - This allows agents to clean up their invitation history
*/

CREATE POLICY "Agents can delete cancelled or accepted invitations"
  ON invitations
  FOR DELETE
  TO authenticated
  USING (
    (agent_id = auth.uid()) AND 
    (status IN ('cancelled', 'accepted'))
  );