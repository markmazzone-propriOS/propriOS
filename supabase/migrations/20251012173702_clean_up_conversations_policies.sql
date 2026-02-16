/*
  # Clean Up Conversations RLS Policies

  ## Changes
  This migration removes duplicate policies on the conversations table
  and ensures clear, non-conflicting RLS policies.

  ## Security
  - Authenticated users can create conversations
  - Users can only view conversations they participate in
  - Users can only update conversations they participate in

  ## Tables Affected
  - conversations: Cleaned up duplicate policies
*/

-- Drop all existing conversation policies
DROP POLICY IF EXISTS "Allow authenticated users to insert conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Allow users to view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
DROP POLICY IF EXISTS "Allow users to update their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update conversations they participate in" ON conversations;

-- Create clean, non-duplicate policies

-- INSERT: Any authenticated user can create a conversation
CREATE POLICY "Authenticated users can insert conversations"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT: Users can only view conversations they're part of
CREATE POLICY "Users can select their conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (is_conversation_member(id, auth.uid()));

-- UPDATE: Users can only update conversations they're part of
CREATE POLICY "Users can update their conversations"
  ON conversations
  FOR UPDATE
  TO authenticated
  USING (is_conversation_member(id, auth.uid()))
  WITH CHECK (is_conversation_member(id, auth.uid()));
