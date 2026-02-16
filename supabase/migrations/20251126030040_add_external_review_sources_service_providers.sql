/*
  # Add External Review Source Support for Service Providers

  ## Overview
  This migration adds support for service providers to manually import reviews from external sources
  like Google, Yelp, HomeAdvisor, Angie's List, etc.

  ## Changes

  1. Table Updates: `service_provider_reviews`
    - `external_source` (text, optional) - Name of external review platform
    - `external_url` (text, optional) - Original review URL for verification
    - `external_reviewer_name` (text, optional) - Name from external platform if different
    - `is_imported` (boolean, default false) - Whether review was imported vs written natively
    - `imported_at` (timestamptz, optional) - When the review was imported
    - `imported_by` (uuid, references profiles) - Service provider who imported the review

  2. Policy Updates
    - Allow service providers to import reviews for their own profile
    - External reviews don't require reviewer_id (can be null for imported reviews)
    - Update existing constraints to allow null reviewer_id for imported reviews

  ## Notes
  - External reviews are clearly marked with source information
  - Service providers can only import reviews to their own profile
  - Original review URLs are preserved for verification
  - Native reviews (reviewer_id not null) work as before
*/

-- Add new columns to service_provider_reviews
ALTER TABLE service_provider_reviews
ADD COLUMN IF NOT EXISTS external_source text,
ADD COLUMN IF NOT EXISTS external_url text,
ADD COLUMN IF NOT EXISTS external_reviewer_name text,
ADD COLUMN IF NOT EXISTS is_imported boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS imported_at timestamptz,
ADD COLUMN IF NOT EXISTS imported_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Make reviewer_id nullable for imported reviews
ALTER TABLE service_provider_reviews
ALTER COLUMN reviewer_id DROP NOT NULL;

-- Add constraint: imported reviews must have external source
ALTER TABLE service_provider_reviews
ADD CONSTRAINT check_imported_reviews_have_source
CHECK (
  (is_imported = false AND reviewer_id IS NOT NULL) OR
  (is_imported = true AND external_source IS NOT NULL AND imported_by IS NOT NULL)
);

-- Drop existing insert policy
DROP POLICY IF EXISTS "Clients can create reviews for completed jobs" ON service_provider_reviews;

-- New policy: Clients can create native reviews for completed jobs
CREATE POLICY "Clients can create native reviews for completed jobs"
  ON service_provider_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_imported = false
    AND reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM service_jobs
      WHERE service_jobs.id = job_id
      AND service_jobs.client_id = auth.uid()
      AND service_jobs.status = 'completed'
    )
  );

-- New policy: Service providers can import external reviews
CREATE POLICY "Service providers can import external reviews"
  ON service_provider_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_imported = true
    AND auth.uid() = imported_by
    AND auth.uid() = provider_id
    AND external_source IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM service_provider_profiles
      WHERE id = auth.uid()
    )
  );

-- Update policy: Reviewers can update their own reviews
DROP POLICY IF EXISTS "Reviewers can update own reviews" ON service_provider_reviews;
CREATE POLICY "Reviewers can update own reviews"
  ON service_provider_reviews
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

-- Add policy: Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
  ON service_provider_reviews
  FOR DELETE
  TO authenticated
  USING (
    (is_imported = false AND auth.uid() = reviewer_id) OR
    (is_imported = true AND auth.uid() = imported_by)
  );

-- Add index for imported reviews
CREATE INDEX IF NOT EXISTS idx_service_provider_reviews_imported ON service_provider_reviews(is_imported, provider_id);