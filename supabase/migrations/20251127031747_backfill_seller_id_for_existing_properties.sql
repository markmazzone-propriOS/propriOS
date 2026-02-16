/*
  # Backfill seller_id for Existing Properties

  ## Overview
  This migration updates existing properties to set seller_id where it's currently null
  but the listed_by user is a seller.

  ## Changes
  - Update properties where listed_by is a seller to set seller_id = listed_by
  - This fixes historical data where seller_id wasn't being set
*/

-- Update existing properties where listed_by is a seller
UPDATE properties
SET seller_id = listed_by
WHERE seller_id IS NULL
AND EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.id = properties.listed_by
  AND profiles.user_type = 'seller'
);