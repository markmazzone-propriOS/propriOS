/*
  # Fix Seller Journey Progress Duplicates

  1. Changes
    - Remove duplicate seller_journey_progress entries, keeping only the most recent one per seller
    - Drop the existing unique constraint on (seller_id, property_id)
    - Add a new unique constraint on just seller_id
*/

-- Drop the old constraint first
ALTER TABLE seller_journey_progress
DROP CONSTRAINT IF EXISTS unique_seller_property;

-- Delete duplicate entries, keeping only the most recent one per seller
DELETE FROM seller_journey_progress
WHERE id NOT IN (
  SELECT DISTINCT ON (seller_id) id
  FROM seller_journey_progress
  ORDER BY seller_id, created_at DESC
);

-- Add new constraint on just seller_id
ALTER TABLE seller_journey_progress
ADD CONSTRAINT unique_seller_journey UNIQUE (seller_id);