/*
  # Create Agent Profile Photos Storage Bucket

  1. New Storage Bucket
    - Creates `agent-profile-photos` bucket for storing agent profile images
    
  2. Security Policies
    - Authenticated agents can upload their own profile photos
    - Everyone can view profile photos (public read access)
    - Agents can only update their own profile photos
*/

-- Create storage bucket for agent profile photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-profile-photos', 'agent-profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Agent profile photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Agents can upload their profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Agents can update their profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Agents can delete their profile photos" ON storage.objects;

-- Policy: Anyone can view agent profile photos (public bucket)
CREATE POLICY "Agent profile photos are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'agent-profile-photos');

-- Policy: Authenticated agents can upload their profile photos
CREATE POLICY "Agents can upload their profile photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'agent-profile-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Agents can update their own profile photos
CREATE POLICY "Agents can update their profile photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'agent-profile-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Agents can delete their own profile photos
CREATE POLICY "Agents can delete their profile photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'agent-profile-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
