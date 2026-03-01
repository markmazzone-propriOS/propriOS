/*
  # Add Listing Source Logo to Properties

  1. Changes
    - Add `listing_source_logo_url` (text, nullable) - URL to the listing source logo image
    - Create storage bucket for listing source logos
    - Add storage policies for listing source logos

  2. Security
    - Public read access for listing source logos
    - Authenticated users can upload logos when creating/editing properties
*/

-- Add listing source logo URL field to properties table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'listing_source_logo_url'
  ) THEN
    ALTER TABLE properties ADD COLUMN listing_source_logo_url text;
  END IF;
END $$;

-- Create storage bucket for listing source logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('listing-source-logos', 'listing-source-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public read access for listing source logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload listing source logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own listing source logos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own listing source logos" ON storage.objects;

-- Allow public read access to listing source logos
CREATE POLICY "Public read access for listing source logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'listing-source-logos');

-- Allow authenticated users to upload listing source logos
CREATE POLICY "Authenticated users can upload listing source logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'listing-source-logos');

-- Allow users to update their own listing source logos
CREATE POLICY "Users can update own listing source logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'listing-source-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to delete their own listing source logos
CREATE POLICY "Users can delete own listing source logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'listing-source-logos' AND auth.uid()::text = (storage.foldername(name))[1]);