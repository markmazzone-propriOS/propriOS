/*
  # Fix Journey Progress Triggers - Add SECURITY DEFINER

  1. Changes
    - Add SECURITY DEFINER to all journey progress trigger functions
    - This prevents RLS recursion when triggers update buyer_journey_progress table
    - The functions are safe because they only update based on the triggering row's data

  2. Security
    - Functions run with elevated privileges but are restricted to specific updates
    - No user input is used, only data from the triggering row
*/

-- Fix update_journey_on_offer_submit to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION update_journey_on_offer_submit()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE buyer_journey_progress
  SET
    offer_submitted = true,
    offer_submitted_date = COALESCE(offer_submitted_date, NEW.created_at),
    property_id = NEW.property_id
  WHERE buyer_id = NEW.buyer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Fix update_journey_on_offer_accept to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION update_journey_on_offer_accept()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.offer_status = 'accepted' AND (OLD.offer_status IS NULL OR OLD.offer_status != 'accepted') THEN
    UPDATE buyer_journey_progress
    SET
      offer_accepted = true,
      offer_accepted_date = COALESCE(offer_accepted_date, NEW.updated_at)
    WHERE buyer_id = NEW.buyer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Fix update_journey_on_first_viewing to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION update_journey_on_first_viewing()
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

-- Fix update_journey_on_favorite to use SECURITY DEFINER
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