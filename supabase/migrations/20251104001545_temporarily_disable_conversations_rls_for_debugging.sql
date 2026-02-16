/*
  # Temporarily Disable RLS on Conversations - Final Debug Attempt

  1. Purpose
    - Completely disable RLS to confirm the issue
    - This is temporary for debugging only
  
  2. Action
    - Drop all policies
    - Disable RLS
  
  3. Next Steps
    - Test if messages work without RLS
    - If they do, we know it's an RLS/authentication issue
    - If they don't, it's something else entirely
*/

-- Drop all policies first
DROP POLICY IF EXISTS "conversations_insert_policy" ON conversations;
DROP POLICY IF EXISTS "conversations_select_policy" ON conversations;
DROP POLICY IF EXISTS "conversations_update_policy" ON conversations;
DROP POLICY IF EXISTS "conversations_delete_policy" ON conversations;

-- Disable RLS
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
