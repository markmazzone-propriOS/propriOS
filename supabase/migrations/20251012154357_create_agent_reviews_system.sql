/*
  # Create Agent Reviews System

  ## Overview
  This migration creates a review system for agents where authenticated buyers and sellers
  can leave reviews for agents they've worked with.

  ## Changes

  1. New Table: `agent_reviews`
    - `id` (uuid, primary key) - Unique review identifier
    - `agent_id` (uuid, references agent_profiles) - Agent being reviewed
    - `reviewer_id` (uuid, references profiles) - User leaving the review
    - `rating` (numeric, 1-5) - Star rating
    - `comment` (text, optional) - Review text
    - `created_at` (timestamptz) - When review was created
    - `updated_at` (timestamptz) - When review was last updated

  2. Security
    - Enable RLS on agent_reviews table
    - Public can view all reviews (for transparency)
    - Only authenticated buyers/sellers can insert reviews
    - Users can only update/delete their own reviews
    - Users can only review an agent once (unique constraint)

  3. Indexes
    - Index on agent_id for efficient review lookups
    - Index on reviewer_id for user's review history

  ## Notes
  - Reviews are publicly viewable to provide transparency
  - Each user can only review an agent once
  - Users must be authenticated to leave reviews
  - Agents cannot review themselves
*/

-- Create agent_reviews table
CREATE TABLE IF NOT EXISTS agent_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES agent_profiles(id) ON DELETE CASCADE NOT NULL,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  rating numeric NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, reviewer_id)
);

-- Enable RLS
ALTER TABLE agent_reviews ENABLE ROW LEVEL SECURITY;

-- Public can view all reviews
CREATE POLICY "Public can view all reviews"
  ON agent_reviews
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Authenticated users can insert reviews
CREATE POLICY "Authenticated users can insert reviews"
  ON agent_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reviewer_id
    AND auth.uid() != agent_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type IN ('buyer', 'seller')
    )
  );

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
  ON agent_reviews
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
  ON agent_reviews
  FOR DELETE
  TO authenticated
  USING (auth.uid() = reviewer_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_agent_reviews_agent_id ON agent_reviews(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_reviews_reviewer_id ON agent_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_agent_reviews_created_at ON agent_reviews(created_at DESC);

-- Create function to update agent star rating
CREATE OR REPLACE FUNCTION update_agent_star_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agent_profiles
  SET star_rating = (
    SELECT COALESCE(AVG(rating), 0)
    FROM agent_reviews
    WHERE agent_id = COALESCE(NEW.agent_id, OLD.agent_id)
  )
  WHERE id = COALESCE(NEW.agent_id, OLD.agent_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update agent star rating when reviews change
DROP TRIGGER IF EXISTS trigger_update_agent_star_rating ON agent_reviews;

CREATE TRIGGER trigger_update_agent_star_rating
  AFTER INSERT OR UPDATE OR DELETE ON agent_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_star_rating();