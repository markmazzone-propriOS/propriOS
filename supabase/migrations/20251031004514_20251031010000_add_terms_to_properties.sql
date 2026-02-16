/*
  # Add terms field to properties table

  1. Changes
    - Add `terms` column to `properties` table to store lease terms and conditions
    - The field will store information like lease duration (6 month, annual, month-to-month)
      and pet policies (no pets, pets allowed with deposit, etc.)

  2. Notes
    - Uses TEXT type to allow flexible formatting of terms
    - Nullable field so existing properties don't require immediate updates
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'terms'
  ) THEN
    ALTER TABLE properties ADD COLUMN terms TEXT;
  END IF;
END $$;
