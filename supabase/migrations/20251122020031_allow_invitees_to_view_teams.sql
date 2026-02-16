/*
  # Allow Invitees to View Teams

  1. Changes
    - Add policy to allow users to view teams they have pending invitations for
    - This is necessary so they can see team details in the invitation

  2. Security
    - Only allows viewing teams where the user has a pending invitation
    - Does not allow any modifications
*/

-- Add policy to allow invitees to view teams
CREATE POLICY "Users can view teams they are invited to"
  ON teams
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM team_invitations ti
      JOIN auth.users u ON u.email = ti.invitee_email
      WHERE ti.team_id = teams.id
      AND u.id = auth.uid()
      AND ti.status = 'pending'
    )
  );
