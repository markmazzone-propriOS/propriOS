/*
  # Complete Reset of Conversations RLS Policies

  1. Problem
    - Multiple duplicate policies from various migrations
    - Conflicting policies causing RLS violations

  2. Solution
    - Drop ALL existing policies on conversations table
    - Create fresh, clean policies
    - Use simple, explicit authentication checks

  3. Security
    - Any authenticated user can create conversations
    - Users can view/update/delete conversations they participate in
*/

-- Drop ALL possible policies that might exist
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can delete their conversations" ON conversations;
DROP POLICY IF EXISTS "conversations_insert_policy" ON conversations;
DROP POLICY IF EXISTS "conversations_select_policy" ON conversations;
DROP POLICY IF EXISTS "conversations_update_policy" ON conversations;
DROP POLICY IF EXISTS "conversations_delete_policy" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can insert conversations" ON conversations;
DROP POLICY IF EXISTS "Users can select their conversations" ON conversations;
DROP POLICY IF EXISTS "Allow authenticated users to insert conversations" ON conversations;
DROP POLICY IF EXISTS "Allow users to view their conversations" ON conversations;
DROP POLICY IF EXISTS "Allow users to update their conversations" ON conversations;
DROP POLICY IF EXISTS "Allow users to delete their conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can update conversations they participate in" ON conversations;

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- INSERT: Any authenticated user can create conversations (no restrictions)
CREATE POLICY "allow_authenticated_insert"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- SELECT: Users can view conversations they participate in
CREATE POLICY "allow_participant_select"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.user_id = auth.uid()
    )
  );

-- UPDATE: Users can update conversations they participate in
CREATE POLICY "allow_participant_update"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.user_id = auth.uid()
    )
  );

-- DELETE: Users can delete conversations they participate in
CREATE POLICY "allow_participant_delete"
  ON conversations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.user_id = auth.uid()
    )
  );
