/*
  # Reset Conversations RLS Policies

  ## Changes
  This migration completely resets the RLS policies for the conversations table
  to ensure authenticated users can create conversations.

  ## Security
  - Disable and re-enable RLS to ensure clean state
  - Drop all existing policies
  - Create new policies with explicit permissions
*/

-- Disable RLS temporarily
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
DROP POLICY IF EXISTS "Users can update conversations they participate in" ON conversations;

-- Re-enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create INSERT policy - allow any authenticated user to create conversations
CREATE POLICY "Allow authenticated users to insert conversations"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create SELECT policy - users can only view conversations they participate in
CREATE POLICY "Allow users to view their conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.user_id = auth.uid()
    )
  );

-- Create UPDATE policy - users can only update conversations they participate in
CREATE POLICY "Allow users to update their conversations"
  ON conversations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.user_id = auth.uid()
    )
  );
