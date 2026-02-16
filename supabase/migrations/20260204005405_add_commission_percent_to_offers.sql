/*
  # Add Commission Percentage to Property Offers

  1. Changes
    - Add `commission_percent` column to `property_offers` table
    - Defaults to 3.0% but can be customized per offer
    - Allows for different agent commission rates

  2. Notes
    - This enables accurate net proceeds calculation per offer
    - Different agents may have different commission rates
    - Sellers can see exact net amount after commission
*/

-- Add commission_percent column with default of 3.0%
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'property_offers' AND column_name = 'commission_percent'
  ) THEN
    ALTER TABLE property_offers
    ADD COLUMN commission_percent numeric DEFAULT 3.0 CHECK (commission_percent >= 0 AND commission_percent <= 100);
  END IF;
END $$;

-- Backfill existing offers with 3.0% commission
UPDATE property_offers
SET commission_percent = 3.0
WHERE commission_percent IS NULL;

-- Make commission_percent NOT NULL after backfill
ALTER TABLE property_offers
ALTER COLUMN commission_percent SET NOT NULL;
