/*
  # Add Seller Journey Under Contract Trigger

  1. Changes
    - Create trigger to automatically update seller_journey_progress when an offer is accepted
    - When a property_offer status changes to 'accepted', mark under_contract = true
    - Updates current_stage to 'under_contract' if not already past that stage
    - Sets under_contract_date to track when the offer was accepted

  2. Security
    - Function runs with SECURITY DEFINER to allow updating seller_journey_progress
*/

-- Create function to update seller journey when offer is accepted
CREATE OR REPLACE FUNCTION auto_update_seller_journey_on_offer_accepted()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_seller_id uuid;
BEGIN
  -- Only proceed if offer status changed to 'accepted'
  IF NEW.offer_status = 'accepted' AND (OLD.offer_status IS NULL OR OLD.offer_status != 'accepted') THEN
    -- Get the seller_id from the property
    SELECT seller_id INTO v_seller_id
    FROM properties
    WHERE id = NEW.property_id;

    -- Only proceed if the property has a seller
    IF v_seller_id IS NOT NULL THEN
      -- Update seller journey progress to under_contract
      UPDATE seller_journey_progress
      SET
        under_contract = true,
        under_contract_date = COALESCE(under_contract_date, now()),
        current_stage = CASE
          WHEN current_stage IN ('preparation', 'listed', 'showings', 'offer_received') THEN 'under_contract'
          ELSE current_stage
        END,
        updated_at = now()
      WHERE seller_id = v_seller_id
        AND property_id = NEW.property_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on property_offers table for updates
DROP TRIGGER IF EXISTS property_offer_accepted_journey_update ON property_offers;
CREATE TRIGGER property_offer_accepted_journey_update
  AFTER UPDATE ON property_offers
  FOR EACH ROW
  WHEN (NEW.offer_status = 'accepted')
  EXECUTE FUNCTION auto_update_seller_journey_on_offer_accepted();
