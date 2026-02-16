/*
  # Add Contact Type to Service Provider Leads

  1. Changes
    - Add `contact_type` column to `service_provider_leads` table
      - Type: text
      - Values: 'buyer', 'seller', 'agent'
      - Default: null (for backwards compatibility with existing leads)
    
  2. Notes
    - This field identifies whether the lead is a buyer, seller, or agent
    - Helps service providers understand the context of the inquiry
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'service_provider_leads' AND column_name = 'contact_type'
  ) THEN
    ALTER TABLE service_provider_leads ADD COLUMN contact_type text;
    ALTER TABLE service_provider_leads ADD CONSTRAINT contact_type_check 
      CHECK (contact_type IS NULL OR contact_type IN ('buyer', 'seller', 'agent'));
  END IF;
END $$;