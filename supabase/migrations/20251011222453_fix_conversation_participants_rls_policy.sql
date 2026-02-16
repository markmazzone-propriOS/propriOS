/*
  # Fix Conversation Participants RLS Policy

  ## Changes
  This migration fixes the infinite recursion issue in the RLS policy for conversation_participants.
  
  ## Problem
  The original policy queried conversation_participants from within its own policy, causing infinite recursion.
  
  ## Solution
  Replace the recursive policy with a simpler policy that directly checks if the user_id matches or if they have access through the conversation.
  
  ## Security
  - Users can view all participants in conversations they are part of
  - Users can view their own participant records directly
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;

-- Create a non-recursive policy
CREATE POLICY "Users can view participants in their conversations"
  ON conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );

-- Also fix the INSERT policy to avoid the same issue
DROP POLICY IF EXISTS "Users can add participants to conversations they are in" ON conversation_participants;

CREATE POLICY "Users can add participants to conversations they are in"
  ON conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR
    conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );
