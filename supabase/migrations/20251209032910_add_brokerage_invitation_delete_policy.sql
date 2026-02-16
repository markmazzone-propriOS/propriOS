/*
  # Add Delete Policy for Brokerage Invitations
  
  1. Changes
    - Add DELETE policy for brokerage_invitations table
    - Allows super admins to delete invitations from their brokerage
  
  2. Security
    - Only brokerage super admins can delete their own invitations
*/

-- Allow super admins to delete their brokerage invitations
CREATE POLICY "Super admins can delete their brokerage invitations"
  ON brokerage_invitations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM brokerages
      WHERE brokerages.id = brokerage_invitations.brokerage_id
      AND brokerages.super_admin_id = auth.uid()
    )
  );
