/*
  # Re-enable Conversations RLS with Working Policies

  1. Purpose
    - Re-enable RLS on conversations table after debugging
    - Apply properly working policies
  
  2. Changes
    - Enable RLS on conversations table
    - Policies are already in place from previous migration
  
  3. Security
    - INSERT: Any authenticated user can create conversations
    - SELECT: Users can only view conversations they participate in
    - UPDATE: Users can only update conversations they participate in
    - DELETE: Users can only delete conversations they participate in
*/

-- Re-enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
