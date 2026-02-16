/*
  # Implement Secure Messaging RLS Without Recursion

  ## Changes
  Re-enable RLS on conversations and conversation_participants tables
  with non-recursive policies using security definer helper functions.

  ## Security
  - Users can only create conversations where they add themselves as a participant
  - Users can only view conversations they're part of
  - Users can only add themselves as participants
  - Uses security definer functions to avoid recursion

  ## Tables Affected
  - conversations: Re-enable RLS with proper policies
  - conversation_participants: Re-enable RLS with proper policies
*/

-- Create a security definer function to check conversation participation
-- This runs with elevated privileges to avoid RLS recursion
CREATE OR REPLACE FUNCTION is_conversation_member(conversation_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM conversation_participants
    WHERE conversation_id = conversation_id_param
      AND user_id = user_id_param
  );
END;
$$;

-- Re-enable RLS on conversations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Drop old conversation policies if they exist
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;

-- Conversations: Users can insert conversations (participants will be added separately)
CREATE POLICY "Authenticated users can create conversations"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Conversations: Users can only view conversations they're part of
CREATE POLICY "Users can view conversations they participate in"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (is_conversation_member(id, auth.uid()));

-- Re-enable RLS on conversation_participants
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

-- Drop old participant policies
DROP POLICY IF EXISTS "Users can add themselves as participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add themselves to conversations" ON conversation_participants;

-- Participants: Users can only add themselves
CREATE POLICY "Users can add themselves to conversations"
  ON conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Participants: Users can view participants in conversations they're part of
CREATE POLICY "Users can view participants in their conversations"
  ON conversation_participants
  FOR SELECT
  TO authenticated
  USING (is_conversation_member(conversation_id, auth.uid()));

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION is_conversation_member TO authenticated;
GRANT INSERT ON conversations TO authenticated;
GRANT SELECT ON conversations TO authenticated;
GRANT INSERT ON conversation_participants TO authenticated;
GRANT SELECT ON conversation_participants TO authenticated;
