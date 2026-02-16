/*
  # Add Agent Cancel Invitation Policy

  1. Changes
    - Drop the existing "Users can accept invitations" UPDATE policy
    - Create separate policies for accepting and cancelling invitations
    
  2. Security
    - Agents can only cancel their own pending invitations
    - Users can only accept pending, non-expired invitations
    - Both operations properly enforce ownership and status checks
*/

-- Drop the existing restrictive update policy
DROP POLICY IF EXISTS "Users can accept invitations" ON invitations;

-- Create policy for users to accept invitations
CREATE POLICY "Users can accept invitations"
  ON invitations
  FOR UPDATE
  TO authenticated
  USING (
    (status = 'pending') AND 
    (expires_at > now())
  )
  WITH CHECK (
    (status = 'accepted') AND 
    (accepted_by = auth.uid())
  );

-- Create policy for agents to cancel their own invitations
CREATE POLICY "Agents can cancel own invitations"
  ON invitations
  FOR UPDATE
  TO authenticated
  USING (
    (agent_id = auth.uid()) AND 
    (status = 'pending')
  )
  WITH CHECK (
    (agent_id = auth.uid()) AND 
    (status IN ('pending', 'cancelled'))
  );