/*
  # Fix Team Invitations Auth Users Access
  
  1. Problem
    - Team invitations policy tries to access auth.users table
    - This requires special permissions and causes "permission denied" error
    
  2. Solution
    - Create a SECURITY DEFINER function to check if user email matches invitation
    - Update the SELECT policy to use this function instead of direct auth.users access
    
  3. Changes
    - Create helper function to check invitation email
    - Update team_invitations SELECT policy
*/

-- Create a security definer function to check if user's email matches invitation
CREATE OR REPLACE FUNCTION user_email_matches(p_email text)
RETURNS boolean AS $$
DECLARE
  v_user_email text;
BEGIN
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();
  
  RETURN v_user_email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Team members can view team invitations" ON team_invitations;

-- Recreate the policy using the security definer function
CREATE POLICY "Team members can view team invitations"
  ON team_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams
      WHERE teams.id = team_invitations.team_id
      AND (
        teams.owner_id = auth.uid()
        OR is_team_member(teams.id, auth.uid())
      )
    )
    OR user_email_matches(team_invitations.invitee_email)
  );
