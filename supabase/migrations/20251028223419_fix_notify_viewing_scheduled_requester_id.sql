/*
  # Fix notify_viewing_scheduled Function to Use requester_id

  1. Changes
    - Update notify_viewing_scheduled function to use NEW.requester_id instead of NEW.user_id
    - Handle cases where requester_id is NULL (anonymous viewing requests)
    - Only create activity notification if requester_id exists

  2. Notes
    - This fixes the error "record 'new' has no field 'user_id'"
    - Anonymous viewing requests won't create activity notifications (they don't have a user_id)
*/

CREATE OR REPLACE FUNCTION notify_viewing_scheduled() 
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_property record;
BEGIN
  SELECT * INTO v_property FROM properties WHERE id = NEW.property_id;
  
  IF v_property.agent_id IS NOT NULL AND NEW.requester_id IS NOT NULL THEN
    PERFORM create_activity(
      v_property.agent_id,
      NEW.requester_id,
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
$$;
