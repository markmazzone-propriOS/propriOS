/*
  # Fix Conversation Participants Infinite Recursion

  1. Problem
    - The RLS policies for conversation_participants are causing infinite recursion
    - The subquery in the policy queries the same table, creating a circular dependency
    
  2. Solution
    - Create a materialized helper function to break the recursion
    - Use a security definer function to query conversation memberships
    
  3. Security
    - Maintains the same security model: users can only see conversations they're part of
    - Uses a controlled function to avoid recursion in RLS policies
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;
DROP POLICY IF EXISTS "Users can add participants to conversations they are in" ON conversation_participants;

-- Create a security definer function to check conversation membership
-- This breaks the RLS recursion by bypassing RLS within the function
CREATE OR REPLACE FUNCTION is_conversation_participant(conversation_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM conversation_participants 
    WHERE conversation_id = conversation_uuid 
      AND user_id = user_uuid
  );
$$;

-- Create non-recursive SELECT policy using the function
CREATE POLICY "Users can view participants in their conversations"
  ON conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    is_conversation_participant(conversation_id, auth.uid())
  );

-- Create non-recursive INSERT policy using the function
CREATE POLICY "Users can add participants to conversations they are in"
  ON conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR
    is_conversation_participant(conversation_id, auth.uid())
  );