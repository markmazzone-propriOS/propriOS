/*
  # Allow Public Property Viewing

  1. Changes
    - Update RLS policy to allow unauthenticated users to view active properties
    - Allow public access to property photos
    - Allow public access to agent profiles for properties

  2. Security
    - Only active properties visible to public
    - All other operations still require authentication
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Anyone can view active properties" ON properties;

-- Create new policy that allows public viewing of active properties
CREATE POLICY "Public can view active properties"
  ON properties
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

-- Allow public to view property photos
DROP POLICY IF EXISTS "Anyone can view property photos" ON property_photos;

CREATE POLICY "Public can view property photos"
  ON property_photos
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM properties
      WHERE properties.id = property_photos.property_id
      AND properties.status = 'active'
    )
  );

-- Allow public to view agent profiles (for listing display)
DROP POLICY IF EXISTS "Anyone can view agent profiles" ON agent_profiles;

CREATE POLICY "Public can view agent profiles"
  ON agent_profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow public to view profiles (for agent names on listings)
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

CREATE POLICY "Public can view basic profile info"
  ON profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);
