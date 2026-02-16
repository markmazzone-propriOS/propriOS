/*
  # Add Agent Email Notification for Scheduled Viewings

  1. Changes
    - Create function to send email notification to agent when viewing is scheduled
    - Add trigger to call this function when a new viewing event is created

  2. Purpose
    - Notify agents immediately when a prospective buyer schedules a viewing
    - Provides agent with viewing details, time, and buyer information

  3. Security
    - Function uses SECURITY DEFINER to access user data
    - Only triggers for viewing event types with associated properties
*/

-- Create function to notify agent via email when viewing is scheduled
CREATE OR REPLACE FUNCTION notify_agent_of_viewing_via_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_property record;
  v_agent_email text;
  v_agent_name text;
  v_requester_name text;
  v_requester_email text;
  v_viewing_date text;
  v_viewing_time text;
  v_function_url text;
BEGIN
  -- Only process viewing events with a property
  IF NEW.event_type = 'viewing' AND NEW.property_id IS NOT NULL THEN

    -- Get property details
    SELECT * INTO v_property FROM properties WHERE id = NEW.property_id;

    -- Only proceed if property has an assigned agent
    IF v_property.agent_id IS NOT NULL THEN

      -- Get agent details
      SELECT
        p.full_name,
        au.email
      INTO v_agent_name, v_agent_email
      FROM profiles p
      JOIN auth.users au ON au.id = p.id
      WHERE p.id = v_property.agent_id;

      -- Get requester details
      IF NEW.requester_id IS NOT NULL THEN
        SELECT
          p.full_name,
          au.email
        INTO v_requester_name, v_requester_email
        FROM profiles p
        JOIN auth.users au ON au.id = p.id
        WHERE p.id = NEW.requester_id;
      ELSE
        v_requester_name := 'A prospective buyer';
        v_requester_email := 'Not provided';
      END IF;

      -- Format date and time
      v_viewing_date := to_char(NEW.start_time, 'YYYY-MM-DD');
      v_viewing_time := to_char(NEW.start_time, 'HH12:MI AM');

      -- Get edge function URL
      v_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-agent-viewing-notification';

      -- Send notification via edge function
      IF v_agent_email IS NOT NULL THEN
        PERFORM
          net.http_post(
            url := v_function_url,
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
            ),
            body := jsonb_build_object(
              'agentEmail', v_agent_email,
              'agentName', v_agent_name,
              'buyerName', v_requester_name,
              'buyerEmail', v_requester_email,
              'propertyAddress', v_property.address_line1,
              'viewingDate', v_viewing_date,
              'viewingTime', v_viewing_time,
              'eventId', NEW.id
            )
          );
      END IF;

    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to send email when viewing is scheduled
DROP TRIGGER IF EXISTS send_agent_viewing_notification_trigger ON calendar_events;

CREATE TRIGGER send_agent_viewing_notification_trigger
  AFTER INSERT ON calendar_events
  FOR EACH ROW
  WHEN (NEW.event_type = 'viewing' AND NEW.property_id IS NOT NULL)
  EXECUTE FUNCTION notify_agent_of_viewing_via_email();
