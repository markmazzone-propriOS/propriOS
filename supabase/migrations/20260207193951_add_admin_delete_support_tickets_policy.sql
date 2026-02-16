/*
  # Add admin delete support tickets policy

  1. New Policies
    - `admins_can_delete_tickets` - Allows admin users to delete support tickets
    - Uses admin_users table to verify admin status

  2. Security
    - Only users who are in the admin_users table can delete tickets
    - Maintains data integrity by restricting deletion to authorized users
*/

-- Add policy for admins to delete support tickets
CREATE POLICY "Admins can delete support tickets"
  ON support_tickets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
    )
  );
