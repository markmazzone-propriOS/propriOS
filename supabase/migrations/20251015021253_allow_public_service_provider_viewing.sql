/*
  # Allow Public Viewing of Service Provider Profiles

  1. Changes
    - Add policy to allow anonymous (public) users to view service provider profiles
    - This enables the featured service providers section on the home page to be visible to all visitors

  2. Security
    - Read-only access for public users
    - No sensitive data exposed (only public profile information)
*/

-- Drop existing public viewing policy if it exists
DROP POLICY IF EXISTS "Public can view service provider profiles" ON service_provider_profiles;

-- Create policy for public viewing
CREATE POLICY "Public can view service provider profiles"
  ON service_provider_profiles FOR SELECT
  TO anon
  USING (true);
