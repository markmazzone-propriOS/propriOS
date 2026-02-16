/*
  # Simplify Team Invitations RLS Policy

  1. Changes
    - Replace the complex RLS policy with a simpler one
    - Use a subquery approach instead of function calls
    - This should be more reliable for authenticated users

  2. Security
    - Still maintains proper security
    - Invitees can only see their own invitations
    - Team owners/members can see team invitations
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Team members and invitees can view team invitations" ON team_invitations;

-- Create new simplified policy
CREATE POLICY "Team members and invitees can view team invitations"
  ON team_invitations
  FOR SELECT
  TO authenticated
  USING (
    -- Team owner can see
    team_id IN (
      SELECT id FROM teams WHERE owner_id = auth.uid()
    )
    OR
    -- Team member can see
    team_id IN (
      SELECT team_id FROM team_members WHERE agent_id = auth.uid()
    )
    OR
    -- Invitee can see - check if their email matches
    invitee_email IN (
      SELECT email FROM auth.users WHERE id = auth.uid()
    )
  );
