/*
  # Fix Brokerage Invitation Email Trigger (v2)

  1. Changes
    - Use the same pattern as team invitation trigger
    - Fallback to hardcoded Supabase URL if environment setting not available
    - Remove service role key requirement (edge function is public)
    - Add exception handling to prevent invitation creation from failing
  
  2. Details
    - Matches the working pattern used by other invitation triggers
    - More resilient with fallbacks and error handling
*/

-- Recreate function with working pattern
CREATE OR REPLACE FUNCTION send_brokerage_invitation_email()
RETURNS TRIGGER AS $$
DECLARE
  v_inviter_name text;
  v_company_name text;
  v_supabase_url text;
BEGIN
  -- Only send email for pending invitations
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Get inviter name from profiles
  SELECT full_name INTO v_inviter_name
  FROM profiles
  WHERE id = NEW.inviter_id;

  -- Get company name from brokerages
  SELECT company_name INTO v_company_name
  FROM brokerages
  WHERE id = NEW.brokerage_id;

  -- Get Supabase URL from environment
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://rfdaepolwygosvwunhnk.supabase.co';
  END IF;

  -- Call the edge function to send the email
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-brokerage-invitation-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'invitation_id', NEW.id,
      'invitee_email', NEW.invitee_email,
      'invitee_name', COALESCE(NEW.invitee_name, 'Agent'),
      'inviter_name', COALESCE(v_inviter_name, 'A brokerage admin'),
      'company_name', COALESCE(v_company_name, 'the brokerage')
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the invitation creation
    RAISE WARNING 'Failed to send brokerage invitation email: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
