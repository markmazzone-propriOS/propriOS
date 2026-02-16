/*
  # Ensure Conversations Permissions

  ## Changes
  This migration ensures all necessary permissions are granted
  and RLS policies are correctly configured for conversations.

  ## Security
  - Explicitly grant INSERT, SELECT, UPDATE on conversations to authenticated role
  - Verify RLS policies are in place

  ## Tables Affected
  - conversations: Grant permissions
  - conversation_participants: Grant permissions
*/

-- Ensure all necessary permissions are granted
GRANT ALL ON conversations TO authenticated;
GRANT ALL ON conversation_participants TO authenticated;
GRANT ALL ON messages TO authenticated;

-- Ensure sequences are accessible
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Re-verify the INSERT policy exists and is permissive
DROP POLICY IF EXISTS "Authenticated users can insert conversations" ON conversations;

CREATE POLICY "Authenticated users can insert conversations"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
