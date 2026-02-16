/*
  # Fix Conversation Participants RLS Recursion Issue

  ## Changes
  This migration fixes the circular dependency in the conversation_participants
  INSERT policy that was preventing users from adding themselves to new conversations.

  ## Security
  - Allow users to add themselves as participants
  - Allow users to add others only if they're already a participant
  - Remove circular dependency in policy logic
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can add participants to conversations they are in" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;

-- Create new INSERT policy without circular dependency
-- Users can add themselves OR add others if they're already a participant
CREATE POLICY "Users can insert conversation participants"
  ON conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Can always add yourself
    user_id = auth.uid()
    OR
    -- Can add others if you're already a participant (check directly, no function)
    EXISTS (
      SELECT 1
      FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

-- Create SELECT policy
CREATE POLICY "Users can view conversation participants"
  ON conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    -- Can see participants if you're in the conversation
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1
      FROM conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

-- Grant explicit permissions
GRANT INSERT ON conversation_participants TO authenticated;
GRANT SELECT ON conversation_participants TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
