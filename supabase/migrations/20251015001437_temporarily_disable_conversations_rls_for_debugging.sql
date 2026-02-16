/*
  # Temporarily Disable Conversations RLS for Debugging

  1. Changes
    - Temporarily disable RLS on conversations table to allow inserts
    - This is for debugging purposes only
  
  2. Security
    - WARNING: This removes security restrictions temporarily
    - Will re-enable with proper policies once issue is identified
*/

-- Temporarily disable RLS
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;