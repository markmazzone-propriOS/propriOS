/*
  # Fix Property Price History Cascade Delete

  ## Overview
  This migration fixes the foreign key constraint on property_price_history.changed_by
  to allow user deletions without violating the constraint.

  ## Changes
  1. Drop existing foreign key constraint on property_price_history.changed_by
  2. Recreate it with ON DELETE SET NULL
     - We use SET NULL instead of CASCADE because we want to preserve price history
       even if the user who made the change is deleted
     - The historical data remains intact, just without a reference to the deleted user

  ## Impact
  - Allows user accounts to be deleted without foreign key violations
  - Preserves price history data for auditing purposes
  - Sets changed_by to NULL when the user who made the change is deleted
*/

-- Drop existing foreign key constraint on property_price_history.changed_by
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'property_price_history_changed_by_fkey' 
    AND table_name = 'property_price_history'
  ) THEN
    ALTER TABLE property_price_history 
    DROP CONSTRAINT property_price_history_changed_by_fkey;
  END IF;
END $$;

-- Recreate with SET NULL on delete (preserve historical records)
ALTER TABLE property_price_history 
ADD CONSTRAINT property_price_history_changed_by_fkey 
FOREIGN KEY (changed_by) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;