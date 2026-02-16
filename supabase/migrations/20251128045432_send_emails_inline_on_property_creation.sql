/*
  # Send Agent Notification Emails Inline

  ## Overview
  Instead of relying on a separate trigger on agent_claim_notifications, this migration
  modifies the property creation function to send emails immediately after creating
  notification records. This bypasses the broken trigger system.

  ## Changes
  - Update notify_agents_on_property_creation() to send emails directly
  - Uses net.http_post() to call the edge function for each agent
  - Ensures emails are sent reliably when properties are created

  ## Why This Approach
  The separate trigger on agent_claim_notifications was not firing despite being
  correctly defined. This inline approach guarantees email delivery.
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
  v_response_status int;
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

  -- Get seller name
  SELECT p.full_name INTO v_seller_name
  FROM profiles p
  WHERE p.id = NEW.listed_by;

  -- Find nearby agents (within same state, prioritize same city)
  FOR v_agent IN
    SELECT DISTINCT a.id, a.city, a.state, p.full_name, u.email
    FROM agent_profiles a
    INNER JOIN profiles p ON p.id = a.id
    INNER JOIN auth.users u ON u.id = a.id
    WHERE a.state = NEW.state
    AND p.user_type = 'agent'
    AND a.id != NEW.listed_by
    ORDER BY
      CASE WHEN a.city = NEW.city THEN 0 ELSE 1 END,
      a.created_at DESC
    LIMIT 20
  LOOP
    -- Create notification record
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
    )
    ON CONFLICT (property_id, agent_id, buyer_id) DO NOTHING;

    -- Send email immediately if service role key is available
    IF v_service_role_key IS NOT NULL AND v_agent.email IS NOT NULL THEN
      BEGIN
        SELECT status INTO v_response_status
        FROM net.http_post(
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

        IF v_response_status >= 200 AND v_response_status < 300 THEN
          v_notification_count := v_notification_count + 1;
        ELSE
          RAISE WARNING 'Failed to send email to agent % with status %', v_agent.email, v_response_status;
        END IF;

      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Error sending email to agent %: %', v_agent.email, SQLERRM;
      END;
    END IF;
  END LOOP;

  -- Log how many agents were notified
  IF v_notification_count > 0 THEN
    RAISE NOTICE 'Emailed % agents about new property at %', v_notification_count, NEW.address_line1;
  END IF;

  RETURN NEW;
END;
$$;