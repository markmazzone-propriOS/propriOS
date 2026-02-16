/*
  # Fix Team Invitations Update Policy Auth Users Access
  
  1. Problem
    - Team invitations UPDATE policy also tries to access auth.users table
    - This causes "permission denied" error
    
  2. Solution
    - Update the UPDATE policy to use the security definer function
    
  3. Changes
    - Drop and recreate team_invitations UPDATE policy
*/

-- Drop the problematic UPDATE policy
DROP POLICY IF EXISTS "Team owners and admins can update invitations" ON team_invitations;

-- Recreate the policy using the security definer function
CREATE POLICY "Team owners and admins can update invitations"
  ON team_invitations
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = inviter_id
    OR EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_invitations.team_id
      AND teams.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invitations.team_id
      AND team_members.agent_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
    OR user_email_matches(team_invitations.invitee_email)
  )
  WITH CHECK (
    auth.uid() = inviter_id
    OR EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_invitations.team_id
      AND teams.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invitations.team_id
      AND team_members.agent_id = auth.uid()
      AND team_members.role IN ('owner', 'admin')
    )
    OR user_email_matches(team_invitations.invitee_email)
  );
