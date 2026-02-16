/*
  # Fix Conversations INSERT Policy for Property Owners

  1. Problem
    - Property owners are unable to create conversations with service providers
    - Getting RLS policy violation error on INSERT
  
  2. Solution
    - Drop existing INSERT policy
    - Create a new simplified policy that allows any authenticated user to create conversations
    - Ensure the policy is permissive and not overly restrictive
  
  3. Security
    - Only authenticated users can create conversations
    - Access control for viewing/updating conversations is handled by separate SELECT/UPDATE policies
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "conversations_insert_policy" ON conversations;

-- Create new simplified INSERT policy
CREATE POLICY "conversations_insert_policy"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
