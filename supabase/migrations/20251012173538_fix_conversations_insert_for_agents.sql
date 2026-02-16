/*
  # Fix Conversation Creation for Agents

  ## Changes
  This migration fixes the RLS policies to allow agents to:
  1. Create conversations
  2. Add their clients (buyers/renters) as participants
  
  ## Security
  - Agents can add participants who have them as assigned_agent_id
  - Users can still only add themselves as participants
  - Users can only view conversations they participate in

  ## Tables Affected
  - conversation_participants: Updated INSERT policy to allow agents to add their clients
*/

-- Drop the restrictive participant policy
DROP POLICY IF EXISTS "Users can add themselves to conversations" ON conversation_participants;

-- Create a more flexible policy that allows:
-- 1. Users to add themselves
-- 2. Agents to add their assigned clients
CREATE POLICY "Users can add participants to conversations"
  ON conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can always add themselves
    user_id = auth.uid()
    OR
    -- Agents can add their assigned clients
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = conversation_participants.user_id
      AND profiles.assigned_agent_id = auth.uid()
    )
  );
