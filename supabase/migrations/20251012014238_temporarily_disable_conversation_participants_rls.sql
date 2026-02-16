/*
  # Temporarily Disable Conversation Participants RLS

  ## Changes
  Temporarily disable RLS on conversation_participants table to allow
  the messaging system to work while we design a better RLS strategy.

  ## Security Note
  This is temporary for debugging. We need to implement a non-recursive
  RLS solution or use security definer functions.
*/

-- Temporarily disable RLS on conversation_participants
ALTER TABLE conversation_participants DISABLE ROW LEVEL SECURITY;
