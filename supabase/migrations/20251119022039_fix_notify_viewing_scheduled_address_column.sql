/*
  # Fix notify_viewing_scheduled Function Address Column

  1. Changes
    - Update notify_viewing_scheduled function to use address_line1 instead of street_address
    - Ensures function works correctly with the properties table schema
    
  2. Security
    - Function maintains SECURITY DEFINER for proper RLS handling
*/

CREATE OR REPLACE FUNCTION notify_viewing_scheduled() 
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_property record;
  v_agent_id uuid;
  v_requester_name text;
BEGIN
  IF NEW.event_type = 'viewing' AND NEW.property_id IS NOT NULL THEN
    SELECT * INTO v_property FROM properties WHERE id = NEW.property_id;
    
    IF v_property.agent_id IS NOT NULL THEN
      v_agent_id := v_property.agent_id;
      
      IF NEW.requester_id IS NOT NULL THEN
        SELECT full_name INTO v_requester_name FROM profiles WHERE id = NEW.requester_id;
      ELSE
        v_requester_name := 'A visitor';
      END IF;
      
      PERFORM create_activity(
        v_agent_id,
        NEW.requester_id,
        'viewing_scheduled',
        'Property Viewing Scheduled',
        v_requester_name || ' scheduled a viewing for ' || v_property.address_line1 || ' on ' || to_char(NEW.start_time, 'Mon DD at HH:MI AM'),
        NEW.property_id,
        'property',
        jsonb_build_object(
          'property_address', v_property.address_line1,
          'viewing_time', NEW.start_time,
          'requester_name', v_requester_name
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
