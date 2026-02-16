/*
  # Fix offer activity trigger to use correct address fields

  1. Changes
    - Update log_offer_to_activities function to use address_line1, city, state, zip_code
    - The properties table doesn't have a single "address" column

  2. Security
    - Function uses SECURITY DEFINER to bypass RLS when creating activities
*/

CREATE OR REPLACE FUNCTION log_offer_to_activities()
RETURNS TRIGGER AS $$
DECLARE
  v_agent_id uuid;
  v_property_address text;
  v_buyer_name text;
BEGIN
  -- Get agent and property info
  SELECT agent_id, address_line1 || ', ' || city || ', ' || state || ' ' || zip_code 
  INTO v_agent_id, v_property_address
  FROM properties
  WHERE id = NEW.property_id;

  -- Get buyer name
  SELECT full_name INTO v_buyer_name
  FROM profiles
  WHERE id = NEW.buyer_id;

  -- Create activity for agent if property has an agent
  IF v_agent_id IS NOT NULL THEN
    INSERT INTO activities (
      user_id,
      activity_type,
      description,
      property_id,
      related_user_id
    ) VALUES (
      v_agent_id,
      'offer_received',
      v_buyer_name || ' submitted an offer of $' || NEW.offer_amount || ' on ' || v_property_address,
      NEW.property_id,
      NEW.buyer_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;