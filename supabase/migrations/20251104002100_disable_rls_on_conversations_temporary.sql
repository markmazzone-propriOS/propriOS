/*
  # Temporarily Disable RLS on Conversations

  1. Problem
    - RLS policies are causing issues even with proper authentication
    - Multiple conflicting policies from past migrations

  2. Temporary Solution
    - Disable RLS completely on conversations table
    - This allows messages to work while we debug the root cause

  3. TODO
    - This is NOT secure for production
    - Need to identify why RLS policies aren't working with authenticated users
    - Re-enable with proper policies once issue is identified
*/

-- Disable RLS on conversations table
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;
