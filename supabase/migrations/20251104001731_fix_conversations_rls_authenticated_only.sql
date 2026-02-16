/*
  # Fix Conversations RLS for All Authenticated Users

  1. Problem
    - Previous INSERT policy was set to true but still failing
    - Need to explicitly check for authenticated users
  
  2. Solution
    - Enable RLS on conversations table
    - Create explicit INSERT policy that checks auth.uid() IS NOT NULL
    - Keep existing SELECT, UPDATE, DELETE policies
  
  3. Security
    - Any authenticated user can create conversations
    - Users can only view/update/delete conversations they participate in
*/

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- INSERT: Any authenticated user can create conversations
CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT: Users can view conversations they participate in
CREATE POLICY "Users can view their conversations"
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
CREATE POLICY "Users can update their conversations"
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
CREATE POLICY "Users can delete their conversations"
  ON conversations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.user_id = auth.uid()
    )
  );
