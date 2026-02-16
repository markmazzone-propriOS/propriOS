/*
  # Add Agent Profile Photo Support

  ## Changes
  1. Add profile_photo_url column to agent_profiles table
  2. Create storage bucket for agent profile photos
  3. Set up storage policies for secure access

  ## New Columns
  - `profile_photo_url` (text, nullable) - URL to agent's profile photo

  ## Storage
  - Bucket: agent-profile-photos
  - Public access for viewing
  - Authenticated agents can upload their own photos
*/

-- Add profile_photo_url column to agent_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_profiles' AND column_name = 'profile_photo_url'
  ) THEN
    ALTER TABLE agent_profiles ADD COLUMN profile_photo_url text;
  END IF;
END $$;

-- Create storage bucket for agent profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-profile-photos', 'agent-profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Agents can upload own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Agents can update own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Agents can delete own profile photo" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view agent profile photos" ON storage.objects;

-- Storage policy: Allow authenticated agents to upload their own profile photos
CREATE POLICY "Agents can upload own profile photo"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'agent-profile-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policy: Allow agents to update their own profile photos
CREATE POLICY "Agents can update own profile photo"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'agent-profile-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policy: Allow agents to delete their own profile photos
CREATE POLICY "Agents can delete own profile photo"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'agent-profile-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policy: Allow anyone to view profile photos (public bucket)
CREATE POLICY "Anyone can view agent profile photos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'agent-profile-photos');
