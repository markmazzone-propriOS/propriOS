/*
  # Allow agents to create profiles for managed users

  1. Changes
    - Drop existing restrictive INSERT policy on profiles table
    - Create new INSERT policy that allows:
      - Users to create their own profile (auth.uid() = id)
      - Agents to create profiles for managed users (user_type = 'managed_user' and managed_by_agent_id = auth.uid())
  
  2. Security
    - Maintains data integrity by ensuring only agents can create managed user profiles
    - Prevents unauthorized profile creation
*/

-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create new INSERT policy that allows agents to create managed user profiles
CREATE POLICY "Users can insert own profile or agents can create managed profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id 
    OR 
    (user_type = 'managed_user' AND managed_by_agent_id = auth.uid())
  );
