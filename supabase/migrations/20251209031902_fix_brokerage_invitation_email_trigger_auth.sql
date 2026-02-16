/*
  # Fix Brokerage Invitation Email Trigger Auth Access

  1. Changes
    - Update search_path to include auth schema
    - This allows the SECURITY DEFINER function to access auth.users table
  
  2. Details
    - The function needs auth schema access to query auth.users for inviter email
    - SECURITY DEFINER + auth in search_path grants proper permissions
*/

-- Recreate function with correct search_path
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
  v_service_role_key text;
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

  -- Get the function URL and service role key from vault
  SELECT decrypted_secret INTO v_function_url
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_URL';
  
  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  -- Only proceed if we have all required data
  IF v_function_url IS NOT NULL 
    AND v_service_role_key IS NOT NULL 
    AND v_inviter_name IS NOT NULL
    AND v_company_name IS NOT NULL THEN
    -- Call the edge function to send the invitation email
    PERFORM
      net.http_post(
        url := v_function_url || '/functions/v1/send-brokerage-invitation-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
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
