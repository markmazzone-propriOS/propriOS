/*
  # Fix Conversations INSERT Policy - Command Type Issue (V2)

  1. Problem
    - The INSERT policy shows command 'a' (ALL) instead of 'i' (INSERT)
    - This causes the policy to incorrectly apply to all operations
    - Property owners cannot create conversations due to this misconfiguration
  
  2. Solution
    - Drop ALL existing policies on conversations table
    - Recreate each policy explicitly with correct command types
    - Use CREATE POLICY with explicit FOR <command> syntax
  
  3. Security
    - INSERT: Any authenticated user can create conversations (permissive)
    - SELECT: Users can only view conversations they participate in
    - UPDATE: Users can only update conversations they participate in
    - DELETE: Users can only delete conversations they participate in
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "conversations_insert_policy" ON conversations;
DROP POLICY IF EXISTS "conversations_select_policy" ON conversations;
DROP POLICY IF EXISTS "conversations_update_policy" ON conversations;
DROP POLICY IF EXISTS "conversations_delete_policy" ON conversations;

-- Create INSERT policy (must be permissive for all authenticated users)
CREATE POLICY "conversations_insert_policy"
  ON conversations
  AS PERMISSIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create SELECT policy (users can view conversations they're part of)
CREATE POLICY "conversations_select_policy"
  ON conversations
  AS PERMISSIVE
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

-- Create UPDATE policy (users can update conversations they're part of)
CREATE POLICY "conversations_update_policy"
  ON conversations
  AS PERMISSIVE
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

-- Create DELETE policy (users can delete conversations they're part of)
CREATE POLICY "conversations_delete_policy"
  ON conversations
  AS PERMISSIVE
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.user_id = auth.uid()
    )
  );
