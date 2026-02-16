/*
  # Fix Conversations INSERT Policy - Command Type Issue

  1. Problem
    - The INSERT policy is showing as command 'a' (ALL) instead of 'i' (INSERT)
    - This causes the policy to be applied incorrectly
  
  2. Solution
    - Drop the malformed policy
    - Create a proper INSERT-only policy with correct command type
    - Use explicit FOR INSERT clause
  
  3. Security
    - Only authenticated users can create conversations
    - Policy applies specifically to INSERT operations only
*/

-- Drop the malformed policy
DROP POLICY IF EXISTS "conversations_insert_policy" ON conversations;

-- Create proper INSERT policy with explicit FOR INSERT
CREATE POLICY "conversations_insert_policy"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
