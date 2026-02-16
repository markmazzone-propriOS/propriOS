/*
  # Add business email to service provider profiles

  1. Changes
    - Add `business_email` column to `service_provider_profiles` table
    - This allows service providers to have a separate business contact email
    - Business email can be different from their auth login email

  2. Notes
    - Business email is optional and can be updated by the service provider
    - Used for customer contact purposes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_provider_profiles' AND column_name = 'business_email'
  ) THEN
    ALTER TABLE service_provider_profiles ADD COLUMN business_email text;
  END IF;
END $$;