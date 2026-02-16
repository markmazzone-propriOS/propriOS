/*
  # Temporarily Disable RLS on Conversations for Debugging

  1. Purpose
    - Temporarily disable RLS to confirm that's the source of the issue
    - This will help us understand if the problem is with RLS or something else
  
  2. Action
    - Disable RLS on conversations table
  
  3. Important
    - This is TEMPORARY for debugging only
    - Will re-enable with proper policies once issue is identified
*/

-- Temporarily disable RLS for debugging
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
