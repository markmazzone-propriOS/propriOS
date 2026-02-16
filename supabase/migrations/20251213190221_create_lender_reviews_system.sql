/*
  # Create Lender Reviews System

  1. New Tables
    - `lender_reviews`
      - `id` (uuid, primary key)
      - `lender_id` (uuid, foreign key to mortgage_lender_profiles)
      - `reviewer_id` (uuid, foreign key to profiles, nullable for imported reviews)
      - `rating` (numeric, 1-5)
      - `review_text` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `external_source` (text, nullable - e.g., "Zillow", "Google")
      - `external_url` (text, nullable)
      - `external_reviewer_name` (text, nullable)
      - `is_imported` (boolean, default false)
      - `imported_at` (timestamptz, nullable)
      - `imported_by` (uuid, nullable)

  2. Security
    - Enable RLS on lender_reviews table
    - Add policies for authenticated users to read reviews
    - Add policies for reviewers to create/update their own reviews
    - Add policies for lenders to import external reviews
*/

-- Create lender_reviews table
CREATE TABLE IF NOT EXISTS lender_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lender_id uuid NOT NULL REFERENCES mortgage_lender_profiles(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rating numeric NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  external_source text,
  external_url text,
  external_reviewer_name text,
  is_imported boolean DEFAULT false,
  imported_at timestamptz,
  imported_by uuid REFERENCES profiles(id)
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_lender_reviews_lender_id ON lender_reviews(lender_id);
CREATE INDEX IF NOT EXISTS idx_lender_reviews_reviewer_id ON lender_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_lender_reviews_created_at ON lender_reviews(created_at DESC);

-- Enable RLS
ALTER TABLE lender_reviews ENABLE ROW LEVEL SECURITY;

-- Public can read all reviews
CREATE POLICY "Anyone can view lender reviews"
  ON lender_reviews
  FOR SELECT
  TO public
  USING (true);

-- Authenticated users can create reviews
CREATE POLICY "Authenticated users can create reviews"
  ON lender_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
  ON lender_reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
  ON lender_reviews
  FOR DELETE
  TO authenticated
  USING (auth.uid() = reviewer_id);

-- Lenders can import external reviews
CREATE POLICY "Lenders can import external reviews"
  ON lender_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_imported = true AND
    EXISTS (
      SELECT 1 FROM mortgage_lender_profiles
      WHERE id = lender_id AND mortgage_lender_profiles.id = auth.uid()
    )
  );

-- Create function to update lender's average rating
CREATE OR REPLACE FUNCTION update_lender_average_rating()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE mortgage_lender_profiles
  SET average_rating = (
    SELECT COALESCE(AVG(rating), 0)
    FROM lender_reviews
    WHERE lender_id = COALESCE(NEW.lender_id, OLD.lender_id)
  )
  WHERE id = COALESCE(NEW.lender_id, OLD.lender_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger to update average rating
DROP TRIGGER IF EXISTS update_lender_rating_trigger ON lender_reviews;
CREATE TRIGGER update_lender_rating_trigger
AFTER INSERT OR UPDATE OR DELETE ON lender_reviews
FOR EACH ROW
EXECUTE FUNCTION update_lender_average_rating();
