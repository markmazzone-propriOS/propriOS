/*
  # Add Lot Size Field to Properties

  1. Changes
    - Add `lot_size` column to `properties` table
      - Type: integer (square feet)
      - Optional field
      - Must be positive if provided

  2. Notes
    - This field allows property listings to include lot size information
    - Lot size is commonly measured in square feet
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'lot_size'
  ) THEN
    ALTER TABLE properties ADD COLUMN lot_size integer CHECK (lot_size > 0);
  END IF;
END $$;