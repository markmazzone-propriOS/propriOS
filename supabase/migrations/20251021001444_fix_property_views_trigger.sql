/*
  # Fix Property Views Trigger

  1. Changes
    - Update the `update_journey_on_first_viewing` function to use `viewed_at` instead of `created_at`
    - The property_views table uses `viewed_at` as its timestamp field, not `created_at`

  2. Security
    - No changes to RLS policies
*/

CREATE OR REPLACE FUNCTION update_journey_on_first_viewing()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE buyer_journey_progress
  SET
    house_hunting_started = true,
    house_hunting_date = COALESCE(house_hunting_date, NEW.viewed_at)
  WHERE buyer_id = NEW.user_id
  AND house_hunting_started = false;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
