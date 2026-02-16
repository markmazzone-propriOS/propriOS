/*
  # Fix Journey Triggers with SECURITY DEFINER

  1. Changes
    - Add SECURITY DEFINER to all journey trigger functions
    - This allows them to bypass RLS and prevent recursion
    - Set search_path for security

  2. Security
    - Functions use SECURITY DEFINER to safely update journey progress
    - search_path set to prevent SQL injection
*/

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
