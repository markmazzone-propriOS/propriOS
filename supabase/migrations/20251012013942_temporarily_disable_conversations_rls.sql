/*
  # Temporarily Disable Conversations RLS for Testing

  ## Changes
  This migration temporarily disables RLS on the conversations table
  to test if the issue is with RLS policies or something else.

  ## Note
  This is for debugging purposes. Once we identify the issue, we'll re-enable RLS.
*/

-- Temporarily disable RLS
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
