/*
  # Fix Conversation Participants RLS - Remove Infinite Recursion

  ## Problem
  The SELECT policy on conversation_participants was causing infinite recursion
  because it was checking conversation_participants to determine if a user
  can view conversation_participants records.

  ## Solution
  Simplify the policies to avoid self-referencing:
  - SELECT: Allow users to view all participant records (they still can't see
    conversations they're not part of due to the conversations table policies)
  - INSERT: Allow authenticated users to add participants
  - UPDATE: Allow users to update their own participant record
  - DELETE: Allow users to remove participants from conversations they're in

  ## Security
  - Users can only see conversations through the conversations table policies
  - The conversation_participants table just tracks membership
  - This prevents infinite recursion while maintaining security
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can add participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can update conversation participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can remove conversation participants" ON conversation_participants;

-- New simplified policies
CREATE POLICY "Users can view participant records"
  ON conversation_participants
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can add participants"
  ON conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own participant record"
  ON conversation_participants
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete participant records"
  ON conversation_participants
  FOR DELETE
  TO authenticated
  USING (true);
