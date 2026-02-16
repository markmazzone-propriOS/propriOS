/*
  # Fix Brokerage Invitation Email Trigger to Not Require Vault

  1. Changes
    - Update trigger to use direct Supabase URL instead of vault secrets
    - Remove service role key requirement since edge function has verify_jwt: false
    - Use app_settings for site_url

  2. Details
    - Hardcodes Supabase URL from current project
    - Makes http call without authentication (edge function is public)
    - More reliable and doesn't require vault configuration
*/

CREATE OR REPLACE FUNCTION send_brokerage_invitation_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_inviter_name text;
  v_company_name text;
  v_site_url text;
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

  -- Get site URL from app_settings
  SELECT value INTO v_site_url
  FROM app_settings
  WHERE key = 'SITE_URL';

  -- Only proceed if we have all required data
  IF v_inviter_name IS NOT NULL AND v_company_name IS NOT NULL THEN
    -- Call the edge function to send the invitation email
    PERFORM
      net.http_post(
        url := 'https://rfdaepolwygosvwunhnk.supabase.co/functions/v1/send-brokerage-invitation-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'invitation_id', NEW.id,
          'invitee_email', NEW.invitee_email,
          'invitee_name', NEW.invitee_name,
          'inviter_name', v_inviter_name,
          'company_name', v_company_name,
          'site_url', COALESCE(v_site_url, 'http://localhost:5173')
        )
      );
  END IF;

  RETURN NEW;
END;
$$;
