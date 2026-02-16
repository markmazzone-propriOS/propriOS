/*
  # Fix Brokerage Invitation Email Trigger

  1. Changes
    - Update trigger to use hardcoded Supabase URL instead of vault
    - Removes dependency on vault secrets
  
  2. Details
    - Uses direct Supabase project URL
    - More reliable email delivery on invitation creation
*/

-- Create function to send brokerage invitation email
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

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_send_brokerage_invitation_email ON brokerage_invitations;

-- Create trigger to send invitation email when an invitation is created
CREATE TRIGGER trigger_send_brokerage_invitation_email
  AFTER INSERT ON brokerage_invitations
  FOR EACH ROW
  EXECUTE FUNCTION send_brokerage_invitation_email();