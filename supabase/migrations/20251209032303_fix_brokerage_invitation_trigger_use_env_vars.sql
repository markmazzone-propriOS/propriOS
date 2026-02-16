/*
  # Fix Brokerage Invitation Email Trigger to Use Environment Variables

  1. Changes
    - Remove vault secret dependencies
    - Use current_setting() to access environment variables directly
    - This matches how other email triggers work in the system
  
  2. Details
    - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatically available as environment variables
    - No need to store them in vault
*/

-- Recreate function to use environment variables
CREATE OR REPLACE FUNCTION send_brokerage_invitation_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
DECLARE
  v_inviter_name text;
  v_company_name text;
  v_function_url text;
BEGIN
  -- Only send email for pending invitations
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Get inviter name from profiles
  SELECT COALESCE(p.full_name, au.email)
  INTO v_inviter_name
  FROM auth.users au
  LEFT JOIN profiles p ON p.id = au.id
  WHERE au.id = NEW.inviter_id;

  -- Get company name from brokerages
  SELECT company_name
  INTO v_company_name
  FROM brokerages
  WHERE id = NEW.brokerage_id;

  -- Get the function URL from environment
  BEGIN
    v_function_url := current_setting('app.settings.supabase_url', true);
  EXCEPTION
    WHEN OTHERS THEN
      v_function_url := NULL;
  END;

  -- Only proceed if we have all required data
  IF v_function_url IS NOT NULL 
    AND v_inviter_name IS NOT NULL
    AND v_company_name IS NOT NULL THEN
    -- Call the edge function to send the invitation email
    PERFORM
      net.http_post(
        url := v_function_url || '/functions/v1/send-brokerage-invitation-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object(
          'invitation_id', NEW.id,
          'invitee_email', NEW.invitee_email,
          'invitee_name', NEW.invitee_name,
          'inviter_name', v_inviter_name,
          'company_name', v_company_name
        )
      );
  END IF;

  RETURN NEW;
END;
$$;
