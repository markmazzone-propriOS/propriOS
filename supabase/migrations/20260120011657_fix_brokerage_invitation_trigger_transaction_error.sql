/*
  # Fix Brokerage Invitation Email Trigger Transaction Error

  1. Changes
    - Wrap HTTP call in exception handler to prevent transaction abort
    - Log errors instead of failing the entire transaction
    - Allow invitation to be created even if email sending fails

  2. Details
    - The trigger will no longer abort if the HTTP call fails
    - The invitation will be created successfully regardless of email status
    - Errors are caught and logged but don't propagate
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
  BEGIN
    SELECT COALESCE(p.full_name, au.email)
    INTO v_inviter_name
    FROM auth.users au
    LEFT JOIN profiles p ON p.id = au.id
    WHERE au.id = NEW.inviter_id;
  EXCEPTION
    WHEN OTHERS THEN
      v_inviter_name := NULL;
  END;

  -- Get company name from brokerages
  BEGIN
    SELECT company_name
    INTO v_company_name
    FROM brokerages
    WHERE id = NEW.brokerage_id;
  EXCEPTION
    WHEN OTHERS THEN
      v_company_name := NULL;
  END;

  -- Get site URL from app_settings
  BEGIN
    SELECT value INTO v_site_url
    FROM app_settings
    WHERE key = 'SITE_URL';
  EXCEPTION
    WHEN OTHERS THEN
      v_site_url := NULL;
  END;

  -- Only attempt to send email if we have all required data
  IF v_inviter_name IS NOT NULL AND v_company_name IS NOT NULL THEN
    -- Wrap HTTP call in exception handler to prevent transaction abort
    BEGIN
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
    EXCEPTION
      WHEN OTHERS THEN
        -- Log the error but don't fail the transaction
        RAISE WARNING 'Failed to send brokerage invitation email for invitation %: %', NEW.id, SQLERRM;
    END;
  END IF;

  -- Always return NEW to allow the insert to complete
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