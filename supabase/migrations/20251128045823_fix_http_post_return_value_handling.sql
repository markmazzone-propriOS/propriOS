/*
  # Fix HTTP POST Return Value Handling

  ## Overview
  net.http_post() returns a bigint (request ID), not a status code.
  The function was trying to SELECT status FROM http_post(), which doesn't exist.

  ## Changes
  - Change function to just call http_post() and get the request ID
  - Remove status checking since we can't get it synchronously
  - The HTTP call will be made asynchronously and logged to net._http_response
*/

CREATE OR REPLACE FUNCTION notify_agents_on_property_creation()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_agent RECORD;
  v_notification_count integer := 0;
  v_service_role_key text;
  v_request_id bigint;
  v_seller_name text;
BEGIN
  -- Only proceed if property is unassigned (no agent) and is for sale
  IF NEW.agent_id IS NOT NULL OR NEW.listing_type != 'sale' THEN
    RETURN NEW;
  END IF;

  -- Get service role key from vault for sending emails
  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_service_role_key IS NULL THEN
    RAISE WARNING 'Service role key not found - emails will not be sent';
    RETURN NEW;
  END IF;

  -- Get seller name
  SELECT p.full_name INTO v_seller_name
  FROM profiles p
  WHERE p.id = NEW.listed_by;

  -- Find agents who service this location
  FOR v_agent IN
    SELECT DISTINCT a.id, p.full_name, u.email, a.locations, a.created_at
    FROM agent_profiles a
    INNER JOIN profiles p ON p.id = a.id
    INNER JOIN auth.users u ON u.id = a.id
    WHERE p.user_type = 'agent'
    AND a.id != NEW.listed_by
    AND (
      -- Match if agent's locations include the property's city
      a.locations @> ARRAY[NEW.city]::text[]
      -- OR match if locations include the state
      OR a.locations @> ARRAY[NEW.state]::text[]
      -- OR match if locations include "City, State" format
      OR a.locations @> ARRAY[NEW.city || ', ' || NEW.state]::text[]
      -- OR include agents with no specific locations set
      OR a.locations IS NULL
      OR array_length(a.locations, 1) IS NULL
    )
    ORDER BY a.created_at DESC
    LIMIT 20
  LOOP
    -- Create notification record (with error handling for duplicates)
    BEGIN
      INSERT INTO agent_claim_notifications (
        property_id,
        agent_id,
        buyer_id,
        notification_type,
        notified_at,
        viewed
      ) VALUES (
        NEW.id,
        v_agent.id,
        NEW.listed_by,
        'new_listing',
        now(),
        false
      );
    EXCEPTION WHEN unique_violation THEN
      -- Skip if notification already exists
      CONTINUE;
    END;

    -- Send email immediately if email is available
    IF v_agent.email IS NOT NULL THEN
      BEGIN
        -- Call HTTP post and get request ID
        v_request_id := net.http_post(
          url => 'https://rfdaepolwygosvwunhnk.supabase.co/functions/v1/send-property-claim-notification',
          body => jsonb_build_object(
            'agent_email', v_agent.email,
            'agent_name', v_agent.full_name,
            'property_address', NEW.address_line1,
            'property_price', NEW.price,
            'property_city', NEW.city,
            'property_state', NEW.state,
            'buyer_name', '',
            'seller_name', COALESCE(v_seller_name, ''),
            'notification_type', 'new_listing',
            'property_id', NEW.id
          ),
          headers => jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          )
        );

        IF v_request_id IS NOT NULL THEN
          v_notification_count := v_notification_count + 1;
          RAISE NOTICE 'Email request sent to agent % (request ID: %)', v_agent.full_name, v_request_id;
        END IF;

      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error sending email to agent %: %', v_agent.email, SQLERRM;
      END;
    END IF;
  END LOOP;

  -- Log how many agents were notified
  IF v_notification_count > 0 THEN
    RAISE NOTICE 'Successfully sent % email requests for new property at %', v_notification_count, NEW.address_line1;
  ELSE
    RAISE NOTICE 'No agents were notified for property at % (no matching agents found)', NEW.address_line1;
  END IF;

  RETURN NEW;
END;
$$;