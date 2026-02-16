/*
  # Grant Conversations Permissions

  ## Changes
  This migration explicitly grants INSERT permissions on the conversations table
  to the authenticated role and ensures the policy is working correctly.

  ## Security
  - Grant explicit table permissions to authenticated role
  - Verify RLS policies are in place
*/

-- Grant explicit permissions to authenticated role
GRANT INSERT ON conversations TO authenticated;
GRANT SELECT ON conversations TO authenticated;
GRANT UPDATE ON conversations TO authenticated;

-- Grant usage on the sequence for the id column
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Verify RLS is enabled
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Drop and recreate the INSERT policy to ensure it's fresh
DROP POLICY IF EXISTS "Allow authenticated users to insert conversations" ON conversations;

CREATE POLICY "Allow authenticated users to insert conversations"
  ON conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
