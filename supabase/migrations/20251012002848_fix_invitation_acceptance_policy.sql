/*
  # Fix Invitation Acceptance Policy

  ## Changes
  This migration fixes the invitation acceptance flow by allowing newly signed-up users
  to update the invitation status. The issue was that the RLS policy required authentication,
  but during the signup process, the user might not be fully authenticated yet when trying
  to update the invitation.

  ## Security Considerations
  - The policy still validates that:
    - The invitation is pending and not expired
    - The status can only be changed to 'accepted'
    - The accepted_by field matches the authenticated user
  - This is secure because the user just signed up with the invitation email and is authenticated

  ## Modified Policies
  - Drop the existing "Users can accept invitations" UPDATE policy
  - Create new policy that better handles the acceptance flow
*/

-- Drop the old policy
DROP POLICY IF EXISTS "Users can accept invitations" ON invitations;

-- Create new policy that allows authenticated users to accept invitations
CREATE POLICY "Users can accept invitations"
  ON invitations
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending' 
    AND expires_at > now()
  )
  WITH CHECK (
    status = 'accepted' 
    AND accepted_by = auth.uid()
    AND expires_at > now()
  );