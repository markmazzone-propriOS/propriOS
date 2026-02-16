/*
  # Fix Admin Users Self-Check Policy

  1. Changes
    - Drop the existing restrictive policy on admin_users
    - Add a new policy that allows users to check if THEY are an admin
    - Keep other admin-only policies intact

  2. Security
    - Users can only see their own admin status
    - Full admin_users list is still restricted to actual admins
*/

-- Drop the existing overly restrictive policy
DROP POLICY IF EXISTS "Only admins can view admin users" ON admin_users;

-- Allow users to check if they themselves are an admin
CREATE POLICY "Users can check their own admin status"
  ON admin_users FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Allow admins to view all admin users
CREATE POLICY "Admins can view all admin users"
  ON admin_users FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au
      WHERE au.id = auth.uid()
    )
  );
