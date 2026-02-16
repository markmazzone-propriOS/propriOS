/*
  # Add Tutorial Completion Tracking

  1. Changes
    - Add `tutorial_completed` column to agent_profiles table
    - Defaults to false for new agents
    - Allows agents to track whether they've completed the onboarding tutorial

  2. Security
    - Agents can update their own tutorial_completed status
*/

-- Add tutorial_completed column to agent_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_profiles' AND column_name = 'tutorial_completed'
  ) THEN
    ALTER TABLE agent_profiles ADD COLUMN tutorial_completed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Update RLS policy to allow agents to update their tutorial_completed status
-- The existing update policy should already cover this, but let's ensure it
DROP POLICY IF EXISTS "Agents can update own profile tutorial status" ON agent_profiles;

CREATE POLICY "Agents can update own profile tutorial status"
  ON agent_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
