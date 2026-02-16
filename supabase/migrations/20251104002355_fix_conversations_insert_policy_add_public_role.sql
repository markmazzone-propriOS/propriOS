/*
  # Fix Conversations Insert Policy - Add Public Role

  1. Problem
    - The INSERT policy was created but not assigned to any role
    - Policy shows roles: {-} meaning no role can use it

  2. Solution
    - Drop the existing INSERT policy
    - Recreate it with TO public to apply to all users

  3. Security
    - Allows anyone to create conversations
    - All other operations remain restricted to participants
*/

-- Drop the policy that has no role assigned
DROP POLICY IF EXISTS "allow_all_insert" ON conversations;

-- Recreate with explicit public role
CREATE POLICY "allow_all_insert"
  ON conversations FOR INSERT
  TO public
  WITH CHECK (true);
