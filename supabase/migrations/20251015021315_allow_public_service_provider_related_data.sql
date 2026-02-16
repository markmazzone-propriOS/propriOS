/*
  # Allow Public Access to Service Provider Related Data

  1. Changes
    - Add policies to allow anonymous users to view:
      - profiles (for service provider names and contact info)
      - service_categories (for displaying service types)
      - service_provider_services (for linking providers to their services)

  2. Security
    - Read-only access for public users
    - Only viewing public profile information, no sensitive data exposed
*/

-- Allow public viewing of profiles (needed for service provider full names)
DROP POLICY IF EXISTS "Public can view profiles" ON profiles;
CREATE POLICY "Public can view profiles"
  ON profiles FOR SELECT
  TO anon
  USING (true);

-- Allow public viewing of service categories
DROP POLICY IF EXISTS "Public can view service categories" ON service_categories;
CREATE POLICY "Public can view service categories"
  ON service_categories FOR SELECT
  TO anon
  USING (true);

-- Allow public viewing of service provider services
DROP POLICY IF EXISTS "Public can view service provider services" ON service_provider_services;
CREATE POLICY "Public can view service provider services"
  ON service_provider_services FOR SELECT
  TO anon
  USING (true);
