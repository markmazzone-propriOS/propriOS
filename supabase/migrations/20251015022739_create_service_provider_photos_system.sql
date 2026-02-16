/*
  # Create Service Provider Photos System

  1. New Tables
    - `service_provider_photos`
      - `id` (uuid, primary key)
      - `provider_id` (uuid, foreign key to service_provider_profiles)
      - `photo_url` (text, URL to the photo in storage)
      - `caption` (text, optional description)
      - `display_order` (integer, for ordering photos)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `service_provider_photos` table
    - Service providers can manage their own photos
    - Public users can view all photos

  3. Storage
    - Create `service-provider-photos` storage bucket
    - Public read access
    - Service providers can upload to their own folder
*/

-- Create service provider photos table
CREATE TABLE IF NOT EXISTS service_provider_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES service_provider_profiles(id) ON DELETE CASCADE NOT NULL,
  photo_url text NOT NULL,
  caption text,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE service_provider_photos ENABLE ROW LEVEL SECURITY;

-- Service providers can view their own photos
CREATE POLICY "Service providers can view own photos"
  ON service_provider_photos FOR SELECT
  TO authenticated
  USING (auth.uid() = provider_id);

-- Public can view all service provider photos
CREATE POLICY "Public can view service provider photos"
  ON service_provider_photos FOR SELECT
  TO anon
  USING (true);

-- Service providers can insert their own photos
CREATE POLICY "Service providers can insert own photos"
  ON service_provider_photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = provider_id);

-- Service providers can update their own photos
CREATE POLICY "Service providers can update own photos"
  ON service_provider_photos FOR UPDATE
  TO authenticated
  USING (auth.uid() = provider_id)
  WITH CHECK (auth.uid() = provider_id);

-- Service providers can delete their own photos
CREATE POLICY "Service providers can delete own photos"
  ON service_provider_photos FOR DELETE
  TO authenticated
  USING (auth.uid() = provider_id);

-- Create storage bucket for service provider photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'service-provider-photos',
  'service-provider-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for service provider photos
CREATE POLICY "Service providers can upload own photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'service-provider-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Service providers can update own photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'service-provider-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Service providers can delete own photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'service-provider-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public can view service provider photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'service-provider-photos');
