/*
  # Add MLS and Listing Source Fields to Properties

  1. Changes
    - Add `listed_by_name` (text, nullable) - Name of the listing agent/broker
    - Add `brokerage` (text, nullable) - Name of the brokerage
    - Add `source` (text, nullable) - Source of the listing (e.g., "MLS", "Direct", "FSBO")
    - Add `mls_number` (text, nullable) - MLS listing number
    - Add `originating_mls` (text, nullable) - Name of the originating MLS (e.g., "California Regional MLS", "NWMLS")

  2. Important Notes
    - All fields are optional to support existing listings and various listing sources
    - These fields are particularly useful for properties imported from MLS or other sources
    - Fields can be used for proper attribution and compliance with MLS rules
*/

-- Add new optional fields to properties table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'listed_by_name'
  ) THEN
    ALTER TABLE properties ADD COLUMN listed_by_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'brokerage'
  ) THEN
    ALTER TABLE properties ADD COLUMN brokerage text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'source'
  ) THEN
    ALTER TABLE properties ADD COLUMN source text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'mls_number'
  ) THEN
    ALTER TABLE properties ADD COLUMN mls_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties' AND column_name = 'originating_mls'
  ) THEN
    ALTER TABLE properties ADD COLUMN originating_mls text;
  END IF;
END $$;