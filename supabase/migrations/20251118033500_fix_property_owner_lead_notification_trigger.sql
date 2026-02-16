/*
  # Fix Property Owner Lead Notification Trigger

  1. Changes
    - Update trigger to use hardcoded Supabase URL instead of current_setting
    - Use correct edge function URL format
    - Add better error handling and logging

  2. Notes
    - This ensures the email notification is actually sent
    - Uses the same pattern as other working notification triggers
*/

CREATE OR REPLACE FUNCTION notify_property_owner_new_lead()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_owner_email text;
  v_payload jsonb;
  v_request_id bigint;
  v_edge_function_url text;
BEGIN
  -- Get property owner's email
  SELECT email INTO v_owner_email
  FROM auth.users
  WHERE id = NEW.property_owner_id;

  IF v_owner_email IS NULL THEN
    RAISE WARNING 'Property owner email not found for lead %', NEW.id;
    RETURN NEW;
  END IF;

  -- Use hardcoded Supabase URL
  v_edge_function_url := 'https://rfdaepolwygosvwunhnk.supabase.co/functions/v1/send-property-owner-lead-notification';

  -- Build payload for edge function
  v_payload := jsonb_build_object(
    'propertyOwnerId', NEW.property_owner_id,
    'propertyId', NEW.property_id,
    'leadName', NEW.lead_name,
    'leadEmail', NEW.lead_email,
    'leadPhone', NEW.lead_phone,
    'message', NEW.message
  );

  RAISE LOG 'Sending property owner lead notification to: % for lead %', v_owner_email, NEW.id;

  -- Call edge function to send email
  BEGIN
    SELECT net.http_post(
      url := v_edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := v_payload,
      timeout_milliseconds := 5000
    ) INTO v_request_id;

    RAISE LOG 'Property owner lead notification sent: request_id=%', v_request_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'HTTP request failed for property owner lead notification: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to send property owner lead notification: %', SQLERRM;
    RETURN NEW;
END;
$$;
