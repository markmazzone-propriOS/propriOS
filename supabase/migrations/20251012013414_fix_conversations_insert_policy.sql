/*
  # Fix Conversations Insert Policy

  ## Changes
  This migration fixes the conversations table INSERT policy to allow authenticated users
  to create conversations without restrictions.

  ## Security
  - Authenticated users can create conversations
  - Access to view and update conversations is still restricted to participants only
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;

-- Create new insert policy that allows any authenticated user to create conversations
CREATE POLICY "Authenticated users can create conversations"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
