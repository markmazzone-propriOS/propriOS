/*
  # Fix Brokerage Agents Insert Policy
  
  1. Changes
    - Add policy to allow agents to insert themselves into brokerage_agents when accepting invitations
    - This allows agents to join a brokerage when they accept an invitation
  
  2. Security
    - Agents can only insert records for themselves (agent_id = auth.uid())
    - They can only insert for brokerages where they have a pending invitation
*/

-- Add policy for agents to insert themselves when accepting invitations
CREATE POLICY "Agents can insert themselves when accepting invitations"
  ON brokerage_agents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    agent_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM brokerage_invitations
      WHERE brokerage_invitations.brokerage_id = brokerage_agents.brokerage_id
      AND brokerage_invitations.invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND brokerage_invitations.status = 'pending'
    )
  );
