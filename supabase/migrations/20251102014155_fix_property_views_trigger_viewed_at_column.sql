/*
  # Fix Property Views Trigger to Use viewed_at Column

  1. Changes
    - Update update_journey_on_first_viewing() function to use NEW.viewed_at instead of NEW.created_at
    - The property_views table has a viewed_at column, not created_at
  
  2. Security
    - Maintains SECURITY DEFINER for safe RLS bypass
    - Keeps search_path set for security
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;