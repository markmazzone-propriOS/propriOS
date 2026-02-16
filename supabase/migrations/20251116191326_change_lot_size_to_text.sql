/*
  # Change Lot Size to Text Field
  
  1. Changes
    - Drop the check constraint on lot_size column
    - Change lot_size column from integer to text
    - Allows agents to enter lot size in any format (acres, sq ft, hectares, etc.)
  
  2. Migration Safety
    - Existing numeric values will be converted to text automatically
    - No data loss expected
*/

-- Drop the check constraint
ALTER TABLE properties 
DROP CONSTRAINT IF EXISTS properties_lot_size_check;

-- Change the column type from integer to text
ALTER TABLE properties 
ALTER COLUMN lot_size TYPE text USING lot_size::text;
