/*
  # Fix Offer Triggers - Remove Duplicate and Fix Recursion

  1. Changes
    - Drop the on_offer_received trigger (duplicate of notify_agent_of_new_offer)
    - Keep only trigger_notify_agent_of_new_offer which sends email
    - Update create_activity function to bypass RLS completely
    - Fix all remaining address field references

  2. Security
    - create_activity uses SECURITY DEFINER and bypasses RLS to prevent recursion
*/

-- Drop the duplicate offer notification trigger
DROP TRIGGER IF EXISTS on_offer_received ON property_offers;

-- Update create_activity to be even more explicit about bypassing RLS
CREATE OR REPLACE FUNCTION create_activity(
  p_user_id uuid,
  p_actor_id uuid,
  p_activity_type text,
  p_title text,
  p_description text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_reference_type text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  v_activity_id uuid;
BEGIN
  -- Direct insert without any queries that might trigger RLS
  INSERT INTO activity_feed (
    user_id,
    actor_id,
    activity_type,
    title,
    description,
    reference_id,
    reference_type,
    metadata
  ) VALUES (
    p_user_id,
    p_actor_id,
    p_activity_type,
    p_title,
    p_description,
    p_reference_id,
    p_reference_type,
    p_metadata
  ) RETURNING id INTO v_activity_id;
  
  RETURN v_activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Fix notify_offer_status_change to use address_line1
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

-- Fix notify_viewing_scheduled to use address_line1
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

-- Fix notify_property_favorited to use address_line1
CREATE OR REPLACE FUNCTION notify_property_favorited() RETURNS TRIGGER AS $$
DECLARE
  v_property record;
  v_buyer_name text;
BEGIN
  SELECT * INTO v_property FROM properties WHERE id = NEW.property_id;
  SELECT full_name INTO v_buyer_name FROM profiles WHERE id = NEW.user_id;
  
  -- Notify agent if property has one
  IF v_property.agent_id IS NOT NULL THEN
    PERFORM create_activity(
      v_property.agent_id,
      NEW.user_id,
      'property_favorited',
      'Property Favorited',
      v_buyer_name || ' favorited ' || v_property.address_line1,
      v_property.id,
      'property',
      jsonb_build_object('property_address', v_property.address_line1)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;