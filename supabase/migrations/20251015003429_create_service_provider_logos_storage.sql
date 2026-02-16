/*
  # Create Service Provider Logos Storage Bucket

  1. New Storage Bucket
    - Creates `service-provider-logos` bucket for storing service provider business logos
    
  2. Security Policies
    - Authenticated service providers can upload their own logos
    - Everyone can view logos (public read access)
    - Service providers can only update their own logos
*/

-- Create storage bucket for service provider logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-provider-logos', 'service-provider-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service provider logos are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Service providers can upload their logos" ON storage.objects;
DROP POLICY IF EXISTS "Service providers can update their logos" ON storage.objects;
DROP POLICY IF EXISTS "Service providers can delete their logos" ON storage.objects;

-- Policy: Anyone can view service provider logos (public bucket)
CREATE POLICY "Service provider logos are publicly accessible"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'service-provider-logos');

-- Policy: Authenticated service providers can upload their logos
CREATE POLICY "Service providers can upload their logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'service-provider-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Service providers can update their own logos
CREATE POLICY "Service providers can update their logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'service-provider-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Policy: Service providers can delete their own logos
CREATE POLICY "Service providers can delete their logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'service-provider-logos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
