/*
  # Fix Team Invitations RLS - Simple Approach

  1. Changes
    - Create a very simple RLS policy that uses a SECURITY DEFINER function
    - The function checks all conditions and returns a boolean
    - This avoids the permission issues with direct table access

  2. Security
    - Still secure - only shows invitations to authorized users
    - Uses SECURITY DEFINER to bypass permission issues
*/

-- Create a comprehensive check function
CREATE OR REPLACE FUNCTION can_view_team_invitation(p_invitation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_team_id uuid;
  v_invitee_email text;
  v_user_email text;
BEGIN
  -- Get invitation details
  SELECT team_id, invitee_email 
  INTO v_team_id, v_invitee_email
  FROM team_invitations
  WHERE id = p_invitation_id;

  -- Get current user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Check if user can view this invitation
  RETURN (
    -- User is team owner
    EXISTS (
      SELECT 1 FROM teams 
      WHERE id = v_team_id AND owner_id = auth.uid()
    )
    OR
    -- User is team member
    EXISTS (
      SELECT 1 FROM team_members 
      WHERE team_id = v_team_id AND agent_id = auth.uid()
    )
    OR
    -- User's email matches invitee email
    v_user_email = v_invitee_email
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_view_team_invitation(uuid) TO authenticated;

-- Drop and recreate the policy
DROP POLICY IF EXISTS "Team members and invitees can view team invitations" ON team_invitations;

CREATE POLICY "Team members and invitees can view team invitations"
  ON team_invitations
  FOR SELECT
  TO authenticated
  USING (can_view_team_invitation(id));
