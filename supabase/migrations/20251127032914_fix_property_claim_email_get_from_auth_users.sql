/*
  # Fix Property Claim Email to Get Email from auth.users

  ## Overview
  Fixes the email notification trigger to get the agent's email from auth.users
  instead of profiles table (which doesn't have an email column).

  ## Changes
  - Update send_property_claim_email_notification to query auth.users for email
  - Join profiles with auth.users to get both name and email
*/

CREATE OR REPLACE FUNCTION send_property_claim_email_notification()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_agent RECORD;
  v_property RECORD;
  v_buyer RECORD;
  v_service_role_key text;
  v_response_status int;
BEGIN
  -- Get service role key from vault
  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF v_service_role_key IS NULL THEN
    RAISE WARNING 'Service role key not found in vault';
    RETURN NEW;
  END IF;

  -- Get agent details (email from auth.users, name from profiles)
  SELECT p.full_name, u.email
  INTO v_agent
  FROM profiles p
  INNER JOIN auth.users u ON u.id = p.id
  WHERE p.id = NEW.agent_id;

  -- Get property details
  SELECT pr.address_line1, pr.city, pr.state, pr.price, pr.id
  INTO v_property
  FROM properties pr
  WHERE pr.id = NEW.property_id;

  -- Get buyer details
  SELECT p.full_name
  INTO v_buyer
  FROM profiles p
  WHERE p.id = NEW.buyer_id;

  -- Only send email if all data is available
  IF v_agent.email IS NOT NULL AND v_property.id IS NOT NULL THEN
    BEGIN
      -- Call edge function to send email
      SELECT status INTO v_response_status
      FROM net.http_post(
        url := 'https://rfdaepolwygosvwunhnk.supabase.co/functions/v1/send-property-claim-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'agent_email', v_agent.email,
          'agent_name', v_agent.full_name,
          'property_address', v_property.address_line1,
          'property_price', v_property.price,
          'property_city', v_property.city,
          'property_state', v_property.state,
          'buyer_name', v_buyer.full_name,
          'property_id', v_property.id
        )
      );

      IF v_response_status >= 200 AND v_response_status < 300 THEN
        RAISE NOTICE 'Property claim notification sent successfully to agent %', v_agent.email;
      ELSE
        RAISE WARNING 'Property claim notification failed with status % for agent %', v_response_status, v_agent.email;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to send property claim notification to %: %', v_agent.email, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;