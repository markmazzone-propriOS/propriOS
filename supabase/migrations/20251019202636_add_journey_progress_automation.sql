/*
  # Add Automated Journey Progress Updates

  1. Changes
    - Add trigger to update journey progress when offers are submitted
    - Add trigger to update journey progress when offers are accepted
    - Add trigger to update journey progress when viewing properties
    - These ensure the buyer journey automatically progresses as actions occur

  2. Security
    - No changes to RLS policies needed
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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_journey_on_offer_submit
  AFTER INSERT ON property_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_journey_on_offer_submit();

CREATE OR REPLACE FUNCTION update_journey_on_offer_accept()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    UPDATE buyer_journey_progress
    SET
      offer_accepted = true,
      offer_accepted_date = COALESCE(offer_accepted_date, NEW.updated_at)
    WHERE buyer_id = NEW.buyer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_journey_on_offer_accept
  AFTER UPDATE ON property_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_journey_on_offer_accept();

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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_journey_on_first_viewing
  AFTER INSERT ON property_views
  FOR EACH ROW
  EXECUTE FUNCTION update_journey_on_first_viewing();

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
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_journey_on_favorite
  AFTER INSERT ON favorites
  FOR EACH ROW
  EXECUTE FUNCTION update_journey_on_favorite();
