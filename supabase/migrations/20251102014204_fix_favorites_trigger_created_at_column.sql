/*
  # Fix Favorites Trigger to Use created_at Column

  1. Changes
    - Update update_journey_on_favorite() function to use NEW.created_at correctly
    - The favorites table has a created_at column
  
  2. Security
    - Maintains SECURITY DEFINER for safe RLS bypass
    - Keeps search_path set for security
*/

CREATE OR REPLACE FUNCTION update_journey_on_favorite()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE buyer_journey_progress
  SET
    house_hunting_started = true,
    house_hunting_date = COALESCE(house_hunting_date, NEW.created_at)
  WHERE buyer_id = NEW.user_id
  AND house_hunting_started = false;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;