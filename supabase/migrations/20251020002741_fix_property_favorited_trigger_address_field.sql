/*
  # Fix Property Favorited Trigger Address Field

  1. Changes
    - Update `notify_property_favorited()` function to use `address_line1` instead of `address`
    - The properties table has `address_line1`, `address_line2`, `city`, `state`, `zip_code`
    - Fix references to non-existent `address` field

  2. Notes
    - This fixes the error: record "v_property" has no field "address"
    - The trigger is used to notify agents when a property is favorited
*/

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
