/*
  # Create Property Photos Storage Bucket

  1. New Storage Bucket
    - Creates `property-photos` bucket for storing property images
    
  2. Security Policies
    - Authenticated agents can upload photos
    - Everyone can view photos (public read access)
    - Agents can only delete their own property photos
*/

-- Create storage bucket for property photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-photos', 'property-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Property photos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Agents can upload property photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own property photos" ON storage.objects;

-- Policy: Anyone can view property photos (public bucket)
CREATE POLICY "Property photos are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'property-photos');

-- Policy: Authenticated agents can upload property photos
CREATE POLICY "Agents can upload property photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'property-photos' AND
    (SELECT user_type FROM profiles WHERE id = auth.uid()) IN ('agent', 'seller')
  );

-- Policy: Agents can delete their own property photos
CREATE POLICY "Users can delete their own property photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'property-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
