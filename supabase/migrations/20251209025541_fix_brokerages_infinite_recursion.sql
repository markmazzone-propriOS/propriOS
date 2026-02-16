/*
  # Fix Brokerages Infinite Recursion

  1. Changes
    - Simplify the brokerages INSERT policy to avoid checking profiles table
    - Use a simpler check that only validates super_admin_id matches auth.uid()
  
  2. Security
    - Still maintains security by ensuring users can only create brokerages for themselves
    - Removes the profiles.user_type check that was causing recursion
*/

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Super admins can insert own brokerage" ON brokerages;

-- Create a simpler INSERT policy without checking profiles table
CREATE POLICY "Super admins can insert own brokerage"
  ON brokerages FOR INSERT
  TO authenticated
  WITH CHECK (super_admin_id = auth.uid());
