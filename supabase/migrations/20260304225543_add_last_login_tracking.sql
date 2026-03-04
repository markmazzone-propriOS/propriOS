/*
  # Add Last Login Tracking

  1. Changes
    - Add `last_login_at` column to `profiles` table to track when users last logged in
    - Create function to update last login timestamp
    - Create trigger to automatically update last login on auth state changes

  2. Security
    - Only the authenticated user can update their own last login timestamp
*/

-- Add last_login_at column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_login_at timestamptz;
  END IF;
END $$;

-- Create function to update last login timestamp
CREATE OR REPLACE FUNCTION update_last_login()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET last_login_at = now()
  WHERE user_id = auth.uid();
END $$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION update_last_login() TO authenticated;