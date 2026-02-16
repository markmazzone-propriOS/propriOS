/*
  # Fix Team Invitations RLS with Security Definer Function

  1. Changes
    - Create a security definer function to get current user's email
    - Use this function in the RLS policy instead of direct auth.users access
    - This allows authenticated users to check their own email without table permissions

  2. Security
    - SECURITY DEFINER allows safe access to auth.users
    - Function only returns the current user's email
    - Maintains proper security boundaries
*/

-- Create function to get current user's email safely
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_current_user_email() TO authenticated;

-- Drop and recreate the policy with the safe function
DROP POLICY IF EXISTS "Team members and invitees can view team invitations" ON team_invitations;

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
    invitee_email = get_current_user_email()
  );
