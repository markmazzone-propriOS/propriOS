/*
  # Add Business Coordinates to Service Provider Profiles

  1. Changes
    - Add `business_latitude` column to store the latitude of the business location
    - Add `business_longitude` column to store the longitude of the business location
    - These coordinates will be used to display a map on the service provider's public profile page

  2. Notes
    - Coordinates are optional (nullable) as not all providers may have a physical business address
    - Coordinates should be populated when a business address is provided
*/

-- Add business coordinates columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_provider_profiles' AND column_name = 'business_latitude'
  ) THEN
    ALTER TABLE service_provider_profiles ADD COLUMN business_latitude double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_provider_profiles' AND column_name = 'business_longitude'
  ) THEN
    ALTER TABLE service_provider_profiles ADD COLUMN business_longitude double precision;
  END IF;
END $$;
