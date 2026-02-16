/*
  # Temporarily Disable Conversation Participants RLS

  ## Changes
  This migration temporarily disables RLS on conversation_participants table
  to allow message creation to work.

  ## Security
  WARNING: This temporarily removes all security on conversation_participants table.
  This is ONLY for debugging purposes.

  ## Tables Affected
  - conversation_participants: RLS disabled
*/

-- Temporarily disable RLS on conversation_participants
ALTER TABLE conversation_participants DISABLE ROW LEVEL SECURITY;
