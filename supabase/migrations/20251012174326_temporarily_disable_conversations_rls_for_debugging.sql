/*
  # Temporarily Disable Conversations RLS for Debugging

  ## Changes
  This migration temporarily disables RLS on conversations table
  to verify that RLS is the actual issue.

  ## Security
  WARNING: This temporarily removes all security on conversations table.
  This is ONLY for debugging purposes.

  ## Tables Affected
  - conversations: RLS disabled
*/

-- Temporarily disable RLS on conversations
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
