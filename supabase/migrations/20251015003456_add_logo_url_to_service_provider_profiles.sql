/*
  # Add Logo URL to Service Provider Profiles

  1. Changes
    - Adds `logo_url` field to `service_provider_profiles` table to store business logo images
    
  2. Notes
    - Field is optional (nullable)
    - Stores the URL path to the logo image in storage
*/

-- Add logo_url column to service_provider_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_provider_profiles' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE service_provider_profiles ADD COLUMN logo_url text;
  END IF;
END $$;
