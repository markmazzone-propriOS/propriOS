/*
  # Fix All Activity Trigger Functions - Address Field References

  1. Changes
    - Update all trigger functions to use `address_line1` instead of `address`
    - Fixes the following functions:
      - notify_agent_property_listed()
      - notify_offer_received()
      - notify_offer_status_change()
      - notify_viewing_scheduled()

  2. Notes
    - This fixes errors like: record "new" has no field "address"
    - The properties table uses address_line1, not address
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

-- Fix notify_offer_received function
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

-- Fix notify_offer_status_change function
CREATE OR REPLACE FUNCTION notify_offer_status_change() RETURNS TRIGGER AS $$
DECLARE
  v_property record;
  v_title text;
  v_description text;
BEGIN
  IF OLD.offer_status != NEW.offer_status THEN
    SELECT * INTO v_property FROM properties WHERE id = NEW.property_id;
    
    CASE NEW.offer_status
      WHEN 'accepted' THEN
        v_title := 'Offer Accepted!';
        v_description := 'Your offer of $' || NEW.offer_amount || ' has been accepted';
      WHEN 'rejected' THEN
        v_title := 'Offer Declined';
        v_description := 'Your offer of $' || NEW.offer_amount || ' was declined';
      WHEN 'countered' THEN
        v_title := 'Counter Offer Received';
        v_description := 'The seller countered with $' || NEW.counter_amount;
      ELSE
        RETURN NEW;
    END CASE;
    
    PERFORM create_activity(
      NEW.buyer_id,
      NULL,
      'offer_' || NEW.offer_status,
      v_title,
      v_description,
      NEW.id,
      'offer',
      jsonb_build_object('property_address', v_property.address_line1, 'status', NEW.offer_status)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix notify_viewing_scheduled function
CREATE OR REPLACE FUNCTION notify_viewing_scheduled() RETURNS TRIGGER AS $$
DECLARE
  v_property record;
BEGIN
  SELECT * INTO v_property FROM properties WHERE id = NEW.property_id;
  
  IF v_property.agent_id IS NOT NULL THEN
    PERFORM create_activity(
      v_property.agent_id,
      NEW.user_id,
      'viewing_scheduled',
      'New Viewing Scheduled',
      'A viewing has been scheduled for ' || v_property.address_line1,
      NEW.id,
      'viewing',
      jsonb_build_object('property_address', v_property.address_line1, 'start_time', NEW.start_time)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
