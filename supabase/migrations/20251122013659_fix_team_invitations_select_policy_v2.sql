/*
  # Fix Team Invitations SELECT Policy V2

  1. Changes
    - Use the user_email_matches helper function that has SECURITY DEFINER
    - This allows the function to access auth.users safely

  2. Security
    - Maintains security by checking authenticated user's email matches invitee_email
    - Also allows team owners and members to view invitations
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Team members and invitees can view team invitations" ON team_invitations;

-- Ensure the helper function exists and is correct
CREATE OR REPLACE FUNCTION user_email_matches(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_user_email text;
BEGIN
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();
  
  RETURN v_user_email = p_email;
END;
$$;

-- Create new SELECT policy
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
    -- Invitee can see (check email matches using helper function)
    user_email_matches(team_invitations.invitee_email)
  );
