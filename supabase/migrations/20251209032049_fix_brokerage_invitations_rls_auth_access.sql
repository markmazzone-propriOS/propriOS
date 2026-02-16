/*
  # Fix Brokerage Invitations RLS Policies

  1. Changes
    - Update RLS policies to use get_user_email() function instead of direct auth.users access
    - This fixes "permission denied for table users" error
  
  2. Details
    - Regular users cannot query auth.users in RLS policies
    - Use the existing get_user_email() SECURITY DEFINER function instead
*/

-- Drop and recreate the policies that access auth.users
DROP POLICY IF EXISTS "Invitees can view their invitations" ON brokerage_invitations;
DROP POLICY IF EXISTS "Invitees can update their own invitations" ON brokerage_invitations;

-- Recreate with get_user_email() function
CREATE POLICY "Invitees can view their invitations"
  ON brokerage_invitations FOR SELECT
  TO authenticated
  USING (
    invitee_email = get_user_email(auth.uid())
  );

CREATE POLICY "Invitees can update their own invitations"
  ON brokerage_invitations FOR UPDATE
  TO authenticated
  USING (
    invitee_email = get_user_email(auth.uid())
  )
  WITH CHECK (
    invitee_email = get_user_email(auth.uid())
  );
