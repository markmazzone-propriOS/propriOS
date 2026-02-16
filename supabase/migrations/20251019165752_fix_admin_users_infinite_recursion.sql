/*
  # Fix Admin Users Infinite Recursion

  1. Changes
    - Drop the recursive policy that causes infinite loop
    - Keep only the simple self-check policy
    - Users can only see their own admin status (no recursion)

  2. Security
    - Users can check if they themselves are an admin
    - No recursive checks that cause infinite loops
*/

-- Drop the recursive policy
DROP POLICY IF EXISTS "Admins can view all admin users" ON admin_users;

-- The self-check policy is already in place and works correctly
-- Users can check if they themselves are an admin without recursion
