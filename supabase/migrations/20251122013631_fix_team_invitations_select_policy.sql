/*
  # Fix Team Invitations SELECT Policy

  1. Changes
    - Simplify the SELECT policy for team_invitations to properly allow invitees to see their invitations
    - The existing policy uses helper functions but may have issues with the email matching
    - Add a clearer policy that directly checks auth.users email

  2. Security
    - Maintains security by checking authenticated user's email matches invitee_email
    - Also allows team owners and members to view invitations
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Team members can view team invitations" ON team_invitations;

-- Create new simplified SELECT policy
CREATE POLICY "Team members and invitees can view team invitations"
  ON team_invitations
  FOR SELECT
  TO authenticated
  USING (
    -- Team owner can see
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_invitations.team_id
      AND teams.owner_id = auth.uid()
    )
    OR
    -- Team member can see
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = team_invitations.team_id
      AND team_members.agent_id = auth.uid()
    )
    OR
    -- Invitee can see (check email matches)
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email = team_invitations.invitee_email
    )
  );
