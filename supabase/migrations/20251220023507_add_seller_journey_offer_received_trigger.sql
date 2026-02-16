/*
  # Add Seller Journey Offer Received Trigger

  1. Changes
    - Create trigger to automatically update seller_journey_progress when an offer is received
    - When a property_offer is created, mark offer_received = true and update current_stage to 'offer_received'
    - Updates the offer_received_date to track when the first offer was received

  2. Security
    - Function runs with SECURITY DEFINER to allow updating seller_journey_progress
*/

-- Create function to update seller journey when offer is received
CREATE OR REPLACE FUNCTION auto_update_seller_journey_on_offer_received()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_seller_id uuid;
BEGIN
  -- Get the seller_id from the property
  SELECT seller_id INTO v_seller_id
  FROM properties
  WHERE id = NEW.property_id;

  -- Only proceed if the property has a seller
  IF v_seller_id IS NOT NULL THEN
    -- Update or create seller journey progress
    INSERT INTO seller_journey_progress (
      seller_id,
      property_id,
      current_stage,
      offer_received,
      offer_received_date
    )
    VALUES (
      v_seller_id,
      NEW.property_id,
      'offer_received',
      true,
      now()
    )
    ON CONFLICT (seller_id, property_id)
    DO UPDATE SET
      offer_received = true,
      offer_received_date = COALESCE(seller_journey_progress.offer_received_date, now()),
      current_stage = CASE
        WHEN seller_journey_progress.current_stage IN ('preparation', 'listed', 'showings') THEN 'offer_received'
        ELSE seller_journey_progress.current_stage
      END,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on property_offers table
DROP TRIGGER IF EXISTS property_offer_received_journey_update ON property_offers;
CREATE TRIGGER property_offer_received_journey_update
  AFTER INSERT ON property_offers
  FOR EACH ROW
  EXECUTE FUNCTION auto_update_seller_journey_on_offer_received();
