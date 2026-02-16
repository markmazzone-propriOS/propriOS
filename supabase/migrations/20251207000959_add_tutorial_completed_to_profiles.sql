/*
  # Add Tutorial Completion Tracking to Profiles
  
  1. Changes
    - Add `tutorial_completed` column to profiles table
    - Defaults to false for new users (buyers, sellers, renters, property owners)
    - Allows all user types to track whether they've completed the onboarding tutorial
  
  2. Security
    - Users can update their own tutorial_completed status
    - Existing update policies should cover this functionality
*/

-- Add tutorial_completed column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'tutorial_completed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN tutorial_completed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Ensure users can update their own tutorial status
-- The existing profiles update policy should already cover this
DROP POLICY IF EXISTS "Users can update own tutorial status" ON profiles;

CREATE POLICY "Users can update own tutorial status"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
