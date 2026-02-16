/*
  # Add Hidden From Public Flag to Properties
  
  1. Changes
    - Add `hidden_from_public` column to properties table
    - Defaults to false (visible to public)
    - Allows property owners, agents, and sellers to hide listings from public view
    - Hidden listings remain visible to the owner/creator
  
  2. Security
    - Update RLS policies to respect hidden_from_public flag
    - Public can only view non-hidden properties
    - Owners/agents can always view their own properties regardless of hidden status
*/

-- Add hidden_from_public column to properties table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'hidden_from_public'
  ) THEN
    ALTER TABLE properties ADD COLUMN hidden_from_public BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Update the public viewing policy to exclude hidden properties
DROP POLICY IF EXISTS "Public can view active properties" ON properties;

CREATE POLICY "Public can view active properties"
  ON properties
  FOR SELECT
  USING (
    status = 'active' 
    AND (hidden_from_public = false OR hidden_from_public IS NULL)
  );

-- Ensure agents can view all their own properties including hidden ones
DROP POLICY IF EXISTS "Agents can view own properties including hidden" ON properties;

CREATE POLICY "Agents can view own properties including hidden"
  ON properties
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
      AND properties.agent_id = auth.uid()
    )
  );

-- Ensure sellers can view all their own properties including hidden ones
DROP POLICY IF EXISTS "Sellers can view own properties including hidden" ON properties;

CREATE POLICY "Sellers can view own properties including hidden"
  ON properties
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type IN ('seller', 'managed_user')
      AND properties.seller_id = auth.uid()
    )
  );

-- Ensure property owners can view all their own rental properties including hidden ones
DROP POLICY IF EXISTS "Property owners can view own rentals including hidden" ON properties;

CREATE POLICY "Property owners can view own rentals including hidden"
  ON properties
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'property_owner'
      AND properties.listed_by = auth.uid()
    )
  );

-- Allow owners to update hidden_from_public status
DROP POLICY IF EXISTS "Agents can update own property visibility" ON properties;
DROP POLICY IF EXISTS "Sellers can update own property visibility" ON properties;
DROP POLICY IF EXISTS "Property owners can update own property visibility" ON properties;

CREATE POLICY "Agents can update own property visibility"
  ON properties
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
      AND properties.agent_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'agent'
      AND properties.agent_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update own property visibility"
  ON properties
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type IN ('seller', 'managed_user')
      AND properties.seller_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type IN ('seller', 'managed_user')
      AND properties.seller_id = auth.uid()
    )
  );

CREATE POLICY "Property owners can update own property visibility"
  ON properties
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'property_owner'
      AND properties.listed_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'property_owner'
      AND properties.listed_by = auth.uid()
    )
  );
