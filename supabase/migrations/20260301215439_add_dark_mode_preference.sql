/*
  # Add Dark Mode Preference to Profiles

  1. Changes
    - Add `dark_mode` boolean column to `profiles` table
    - Default to false (light mode)
    - Allow users to update their own dark mode preference

  2. Security
    - Users can update their own dark_mode setting
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'dark_mode'
  ) THEN
    ALTER TABLE profiles ADD COLUMN dark_mode boolean DEFAULT false;
  END IF;
END $$;