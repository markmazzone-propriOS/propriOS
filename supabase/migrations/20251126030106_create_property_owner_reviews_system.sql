/*
  # Create Property Owner Reviews System

  ## Overview
  This migration creates a review system for property owners where tenants and past renters
  can leave reviews. It also includes support for importing external reviews.

  ## Changes

  1. New Table: `property_owner_reviews`
    - `id` (uuid, primary key) - Unique review identifier
    - `owner_id` (uuid, references property_owner_profiles) - Owner being reviewed
    - `reviewer_id` (uuid, references profiles, nullable) - User leaving the review
    - `property_id` (uuid, references properties, optional) - Related property
    - `rating` (numeric, 1-5) - Star rating
    - `comment` (text, optional) - Review text
    - `created_at` (timestamptz) - When review was created
    - `updated_at` (timestamptz) - When review was last updated
    - `external_source` (text, optional) - External platform name
    - `external_url` (text, optional) - Original review URL
    - `external_reviewer_name` (text, optional) - Reviewer name from external platform
    - `is_imported` (boolean, default false) - Whether review was imported
    - `imported_at` (timestamptz, optional) - When imported
    - `imported_by` (uuid, references profiles) - Who imported the review

  2. Security
    - Enable RLS on property_owner_reviews table
    - Public can view all reviews (for transparency)
    - Only authenticated renters can insert native reviews
    - Property owners can import reviews for their own profile
    - Users can only update/delete their own reviews

  3. Indexes
    - Index on owner_id for efficient review lookups
    - Index on reviewer_id for user's review history
    - Index on imported reviews

  ## Notes
  - Reviews are publicly viewable to provide transparency
  - Each user can only review an owner once per property
  - Users must be authenticated to leave native reviews
  - Property owners can import reviews from external platforms
*/

-- Create property_owner_reviews table
CREATE TABLE IF NOT EXISTS property_owner_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES property_owner_profiles(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  property_id uuid REFERENCES properties(id) ON DELETE SET NULL,
  rating numeric NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  external_source text,
  external_url text,
  external_reviewer_name text,
  is_imported boolean DEFAULT false,
  imported_at timestamptz,
  imported_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

-- Add constraint: imported reviews must have external source
ALTER TABLE property_owner_reviews
ADD CONSTRAINT check_imported_reviews_have_source
CHECK (
  (is_imported = false AND reviewer_id IS NOT NULL) OR
  (is_imported = true AND external_source IS NOT NULL AND imported_by IS NOT NULL)
);

-- Add unique constraint: one native review per user per owner
CREATE UNIQUE INDEX IF NOT EXISTS idx_property_owner_reviews_unique_native
ON property_owner_reviews(owner_id, reviewer_id)
WHERE reviewer_id IS NOT NULL AND is_imported = false;

-- Enable RLS
ALTER TABLE property_owner_reviews ENABLE ROW LEVEL SECURITY;

-- Public can view all reviews
CREATE POLICY "Public can view all reviews"
  ON property_owner_reviews
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users can insert native reviews
CREATE POLICY "Authenticated users can insert native reviews"
  ON property_owner_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_imported = false
    AND auth.uid() = reviewer_id
    AND auth.uid() != owner_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type IN ('renter', 'buyer', 'seller')
    )
  );

-- Property owners can import external reviews
CREATE POLICY "Property owners can import external reviews"
  ON property_owner_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_imported = true
    AND auth.uid() = imported_by
    AND auth.uid() = owner_id
    AND external_source IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM property_owner_profiles
      WHERE id = auth.uid()
    )
  );

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
  ON property_owner_reviews
  FOR UPDATE
  TO authenticated
  USING (
    (is_imported = false AND auth.uid() = reviewer_id) OR
    (is_imported = true AND auth.uid() = imported_by)
  )
  WITH CHECK (
    (is_imported = false AND auth.uid() = reviewer_id) OR
    (is_imported = true AND auth.uid() = imported_by)
  );

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
  ON property_owner_reviews
  FOR DELETE
  TO authenticated
  USING (
    (is_imported = false AND auth.uid() = reviewer_id) OR
    (is_imported = true AND auth.uid() = imported_by)
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_property_owner_reviews_owner_id ON property_owner_reviews(owner_id);
CREATE INDEX IF NOT EXISTS idx_property_owner_reviews_reviewer_id ON property_owner_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_property_owner_reviews_created_at ON property_owner_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_owner_reviews_imported ON property_owner_reviews(is_imported, owner_id);

-- Add average_rating and total_reviews columns to property_owner_profiles if they don't exist
ALTER TABLE property_owner_profiles
ADD COLUMN IF NOT EXISTS average_rating numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_reviews integer DEFAULT 0;

-- Create function to update property owner rating
CREATE OR REPLACE FUNCTION update_property_owner_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE property_owner_profiles
  SET 
    average_rating = (
      SELECT COALESCE(AVG(rating), 0)
      FROM property_owner_reviews
      WHERE owner_id = COALESCE(NEW.owner_id, OLD.owner_id)
    ),
    total_reviews = (
      SELECT COUNT(*)
      FROM property_owner_reviews
      WHERE owner_id = COALESCE(NEW.owner_id, OLD.owner_id)
    )
  WHERE id = COALESCE(NEW.owner_id, OLD.owner_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update property owner rating when reviews change
DROP TRIGGER IF EXISTS trigger_update_property_owner_rating ON property_owner_reviews;

CREATE TRIGGER trigger_update_property_owner_rating
  AFTER INSERT OR UPDATE OR DELETE ON property_owner_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_property_owner_rating();