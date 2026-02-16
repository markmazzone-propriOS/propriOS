/*
  # Fix Team Invitations RLS - Final Fix

  1. Changes
    - Grant EXECUTE permission on user_email_matches to authenticated users
    - Ensure the function is marked as STABLE for query optimization
    - Simplify RLS policy to make it more reliable

  2. Security
    - Maintains security while ensuring invitees can see their invitations
*/

-- Ensure the helper function has proper permissions
GRANT EXECUTE ON FUNCTION user_email_matches(text) TO authenticated;

-- Make sure it's marked as STABLE
ALTER FUNCTION user_email_matches(text) STABLE;

-- Verify the policy exists
DO $$
BEGIN
  -- Just ensure the policy is there
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'team_invitations' 
    AND policyname = 'Team members and invitees can view team invitations'
  ) THEN
    CREATE POLICY "Team members and invitees can view team invitations"
      ON team_invitations
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM teams
          WHERE teams.id = team_invitations.team_id
          AND teams.owner_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM team_members
          WHERE team_members.team_id = team_invitations.team_id
          AND team_members.agent_id = auth.uid()
        )
        OR
        user_email_matches(team_invitations.invitee_email)
      );
  END IF;
END $$;
