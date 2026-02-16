/*
  # Fix Conversations RLS v2

  ## Changes
  This migration completely removes and recreates RLS policies
  for the conversations table to resolve the persistent RLS violation.

  ## Security
  - Authenticated users can create conversations
  - Users can view conversations they participate in
  - Users can update conversations they participate in

  ## Tables Affected
  - conversations: Complete RLS reset
*/

-- Disable RLS temporarily
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'conversations') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON conversations';
    END LOOP;
END $$;

-- Re-enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Create brand new INSERT policy - allow all authenticated users
CREATE POLICY "conversations_insert_policy"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create brand new SELECT policy
CREATE POLICY "conversations_select_policy"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (is_conversation_member(id, auth.uid()));

-- Create brand new UPDATE policy  
CREATE POLICY "conversations_update_policy"
  ON conversations
  FOR UPDATE
  TO authenticated
  USING (is_conversation_member(id, auth.uid()))
  WITH CHECK (is_conversation_member(id, auth.uid()));

-- Ensure all grants are in place
GRANT INSERT, SELECT, UPDATE, DELETE ON conversations TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
