/*
  # Add Seller ID to Properties

  ## Changes
  This migration adds a seller_id field to the properties table to explicitly track
  which seller owns each property. This allows agents to assign sellers to listings
  they create on their behalf.

  1. Schema Changes
    - Add `seller_id` column to `properties` table (nullable, foreign key to profiles)
    - The seller_id can be different from listed_by (agent creates listing for seller)

  2. Data Migration
    - For existing properties where listed_by is a seller, set seller_id = listed_by
    - For properties listed by agents, seller_id remains null (to be assigned later)

  3. Security
    - Update RLS policies to allow agents to assign sellers to their own listings
    - Sellers can view properties where they are the seller
*/

-- Add seller_id column to properties table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'seller_id'
  ) THEN
    ALTER TABLE properties ADD COLUMN seller_id uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Migrate existing data: if listed_by is a seller, set seller_id
UPDATE properties p
SET seller_id = p.listed_by
FROM profiles pr
WHERE p.listed_by = pr.id 
  AND pr.user_type = 'seller'
  AND p.seller_id IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_properties_seller_id ON properties(seller_id);

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Agents can assign sellers to own listings" ON properties;

-- Allow agents to update seller_id on their own properties
CREATE POLICY "Agents can assign sellers to own listings"
  ON properties
  FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Sellers can view own properties" ON properties;

-- Allow sellers to view properties where they are assigned as seller
CREATE POLICY "Sellers can view own properties"
  ON properties
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());