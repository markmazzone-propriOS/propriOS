/*
  # Add Available Date to Properties

  1. Changes
    - Add `available_date` column to properties table to track when rental properties become available
    - This allows property owners to set availability dates for rental listings
    - Publicly visible on property listings to help renters plan accordingly
  
  2. Notes
    - Column is nullable since not all listings may have a specific available date
    - Applies to rental listings (listing_type = 'rent')
    - Default is NULL (available immediately or date not specified)
*/

-- Add available_date column to properties table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'available_date'
  ) THEN
    ALTER TABLE properties ADD COLUMN available_date date;
  END IF;
END $$;
