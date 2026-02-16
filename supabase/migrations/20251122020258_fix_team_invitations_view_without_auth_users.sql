/*
  # Fix Team Invitations View Without Auth Users Access

  1. Changes
    - Drop the policy that tries to access auth.users table
    - Create a helper function that checks if current user's email matches invitation
    - Use this function in the teams policy

  2. Security
    - Users can only view teams they have pending invitations for
    - No direct access to auth.users table required
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view teams they are invited to" ON teams;

-- Create a helper function to check if user has invitation to team
CREATE OR REPLACE FUNCTION user_has_team_invitation(p_team_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_email text;
BEGIN
  -- Get the current user's email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = auth.uid();
  
  -- Check if there's a pending invitation for this email and team
  RETURN EXISTS (
    SELECT 1
    FROM team_invitations
    WHERE team_id = p_team_id
    AND invitee_email = v_user_email
    AND status = 'pending'
  );
END;
$$;

-- Now create the policy using this function
CREATE POLICY "Users can view teams they are invited to"
  ON teams
  FOR SELECT
  TO authenticated
  USING (user_has_team_invitation(id));
