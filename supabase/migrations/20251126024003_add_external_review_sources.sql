/*
  # Add External Review Source Support

  ## Overview
  This migration adds support for agents to manually import reviews from external sources
  like Google, Yelp, Zillow, etc.

  ## Changes

  1. Table Updates: `agent_reviews`
    - `external_source` (text, optional) - Name of external review platform (Google, Yelp, Zillow, etc.)
    - `external_url` (text, optional) - Original review URL for verification
    - `external_reviewer_name` (text, optional) - Name from external platform if different
    - `is_imported` (boolean, default false) - Whether review was imported vs written natively
    - `imported_at` (timestamptz, optional) - When the review was imported
    - `imported_by` (uuid, references profiles) - Agent who imported the review

  2. Policy Updates
    - Allow agents to import reviews for their own profile
    - External reviews don't require reviewer_id (can be null for imported reviews)
    - Update existing constraints to allow null reviewer_id for imported reviews

  ## Notes
  - External reviews are clearly marked with source information
  - Agents can only import reviews to their own profile
  - Original review URLs are preserved for verification
  - Native reviews (reviewer_id not null) work as before
*/

-- Add new columns to agent_reviews
ALTER TABLE agent_reviews
ADD COLUMN IF NOT EXISTS external_source text,
ADD COLUMN IF NOT EXISTS external_url text,
ADD COLUMN IF NOT EXISTS external_reviewer_name text,
ADD COLUMN IF NOT EXISTS is_imported boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS imported_at timestamptz,
ADD COLUMN IF NOT EXISTS imported_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Drop the existing unique constraint since imported reviews don't have reviewer_id
ALTER TABLE agent_reviews
DROP CONSTRAINT IF EXISTS agent_reviews_agent_id_reviewer_id_key;

-- Make reviewer_id nullable for imported reviews
ALTER TABLE agent_reviews
ALTER COLUMN reviewer_id DROP NOT NULL;

-- Add new unique constraint: one native review per user per agent
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_reviews_unique_native
ON agent_reviews(agent_id, reviewer_id)
WHERE reviewer_id IS NOT NULL AND is_imported = false;

-- Add constraint: imported reviews must have external source
ALTER TABLE agent_reviews
ADD CONSTRAINT check_imported_reviews_have_source
CHECK (
  (is_imported = false AND reviewer_id IS NOT NULL) OR
  (is_imported = true AND external_source IS NOT NULL AND imported_by IS NOT NULL)
);

-- Drop existing insert policy
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON agent_reviews;

-- New policy: Authenticated users can insert native reviews
CREATE POLICY "Authenticated users can insert native reviews"
  ON agent_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_imported = false
    AND auth.uid() = reviewer_id
    AND auth.uid() != agent_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND user_type IN ('buyer', 'seller', 'renter', 'property_owner')
    )
  );

-- New policy: Agents can import reviews for their own profile
CREATE POLICY "Agents can import external reviews"
  ON agent_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_imported = true
    AND auth.uid() = imported_by
    AND auth.uid() = agent_id
    AND external_source IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM agent_profiles
      WHERE id = auth.uid()
    )
  );

-- Update policy: Users can update their own reviews (native only)
DROP POLICY IF EXISTS "Users can update own reviews" ON agent_reviews;
CREATE POLICY "Users can update own reviews"
  ON agent_reviews
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

-- Update policy: Users can delete their own reviews
DROP POLICY IF EXISTS "Users can delete own reviews" ON agent_reviews;
CREATE POLICY "Users can delete own reviews"
  ON agent_reviews
  FOR DELETE
  TO authenticated
  USING (
    (is_imported = false AND auth.uid() = reviewer_id) OR
    (is_imported = true AND auth.uid() = imported_by)
  );

-- Add index for imported reviews
CREATE INDEX IF NOT EXISTS idx_agent_reviews_imported ON agent_reviews(is_imported, agent_id);