/*
  # Fix Activity Feed Triggers - Address Fields and Security

  1. Changes
    - Fix notify_agent_property_listed to use address_line1 instead of address
    - Make notify_offer_received SECURITY DEFINER to bypass RLS during trigger execution
    - Fix all triggers to use proper address fields from properties table

  2. Security
    - SECURITY DEFINER ensures triggers don't hit RLS recursion issues
*/

-- Fix notify_agent_property_listed function
CREATE OR REPLACE FUNCTION notify_agent_property_listed() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.agent_id IS NOT NULL THEN
    PERFORM create_activity(
      NEW.agent_id,
      NEW.seller_id,
      'property_listed',
      'New Property Listed',
      'A new property has been listed at ' || NEW.address_line1,
      NEW.id,
      'property',
      jsonb_build_object('address', NEW.address_line1, 'price', NEW.price)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix notify_offer_received function - make it SECURITY DEFINER to avoid RLS issues
CREATE OR REPLACE FUNCTION notify_offer_received() RETURNS TRIGGER AS $$
DECLARE
  v_property record;
BEGIN
  SELECT * INTO v_property FROM properties WHERE id = NEW.property_id;

  -- Notify seller
  IF v_property.seller_id IS NOT NULL THEN
    PERFORM create_activity(
      v_property.seller_id,
      NEW.buyer_id,
      'offer_received',
      'New Offer Received',
      'You received an offer of $' || NEW.offer_amount || ' on your property',
      NEW.id,
      'offer',
      jsonb_build_object('property_address', v_property.address_line1, 'offer_amount', NEW.offer_amount)
    );
  END IF;

  -- Notify agent
  IF v_property.agent_id IS NOT NULL THEN
    PERFORM create_activity(
      v_property.agent_id,
      NEW.buyer_id,
      'offer_received',
      'New Offer on Property',
      'An offer of $' || NEW.offer_amount || ' was received for ' || v_property.address_line1,
      NEW.id,
      'offer',
      jsonb_build_object('property_address', v_property.address_line1, 'offer_amount', NEW.offer_amount)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
