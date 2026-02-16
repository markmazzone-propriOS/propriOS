/*
  # Add Business Address to Service Provider Profiles

  ## Changes
  - Add `business_address` column to `service_provider_profiles` table
    - This field stores the physical business address
    - Required for validation and business identity
*/

-- Add business_address column to service_provider_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_provider_profiles' AND column_name = 'business_address'
  ) THEN
    ALTER TABLE service_provider_profiles ADD COLUMN business_address text;
  END IF;
END $$;