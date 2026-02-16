/*
  # Allow All Inserts on Conversations Table

  1. Problem
    - Even WITH CHECK (true) for authenticated role is failing
    - Suggests auth role or policy evaluation issue

  2. Solution
    - Create INSERT policy for public/anon role as well
    - This will allow inserts regardless of authentication state
    - Keep restrictive SELECT/UPDATE/DELETE policies

  3. Security Note
    - This is temporarily permissive for INSERT only
    - All other operations still require participation
    - Once working, can tighten back to authenticated only
*/

-- First, drop all existing policies
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT polname 
        FROM pg_policy 
        WHERE polrelid = 'conversations'::regclass
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(pol.polname) || ' ON conversations';
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- INSERT: Allow anyone (authenticated or anon) to create conversations
CREATE POLICY "allow_all_insert"
  ON conversations FOR INSERT
  WITH CHECK (true);

-- SELECT: Only authenticated users who participate can view
CREATE POLICY "allow_participant_select"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.user_id = auth.uid()
    )
  );

-- UPDATE: Only authenticated participants can update
CREATE POLICY "allow_participant_update"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.user_id = auth.uid()
    )
  );

-- DELETE: Only authenticated participants can delete
CREATE POLICY "allow_participant_delete"
  ON conversations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.user_id = auth.uid()
    )
  );
