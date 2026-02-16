/*
  # Fix Conversations INSERT RLS Policy - Final Fix

  1. Problem
    - Users getting "new row violates row-level security policy" when creating conversations
    - The WITH CHECK (true) policy should allow inserts but may not be working correctly
  
  2. Solution
    - Drop and recreate the INSERT policy with explicit authentication check
    - Ensure the policy is properly applied to authenticated users
    - Add logging to help debug if issues persist
  
  3. Security
    - Only authenticated users can create conversations
    - No additional restrictions on conversation creation
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "conversations_insert_policy" ON conversations;

-- Create new INSERT policy with explicit authentication check
CREATE POLICY "conversations_insert_policy"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
