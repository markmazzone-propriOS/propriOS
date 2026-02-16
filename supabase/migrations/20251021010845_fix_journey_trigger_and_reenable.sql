/*
  # Fix Journey Trigger and Re-enable Triggers

  1. Changes
    - Re-enable the email notification trigger (it works fine)
    - Check if buyer_journey_progress row exists before updating
    - If it doesn't exist, create it first
    - This prevents the UPDATE from hitting RLS when no row exists

  2. Security
    - Functions use SECURITY DEFINER to bypass RLS safely
*/

-- Re-enable the email notification trigger
ALTER TABLE property_offers ENABLE TRIGGER trigger_notify_agent_of_new_offer;

-- Fix the journey trigger to handle missing rows
CREATE OR REPLACE FUNCTION update_journey_on_offer_submit()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert if not exists, then update
  INSERT INTO buyer_journey_progress (buyer_id, current_stage)
  VALUES (NEW.buyer_id, 'pre_approval')
  ON CONFLICT (buyer_id) DO NOTHING;
  
  -- Now update the row
  UPDATE buyer_journey_progress
  SET
    offer_submitted = true,
    offer_submitted_date = COALESCE(offer_submitted_date, NEW.created_at),
    property_id = NEW.property_id
  WHERE buyer_id = NEW.buyer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Re-enable the journey tracking trigger
ALTER TABLE property_offers ENABLE TRIGGER trigger_journey_on_offer_submit;