/*
  # Add Manual Resend Function for Brokerage Invitations

  1. New Functions
    - `resend_brokerage_invitation_email(invitation_id)` - Manually trigger email send
  
  2. Details
    - Allows resending invitation emails for existing invitations
    - Useful for testing and for cases where email failed to send
    - Only works for pending invitations
*/

CREATE OR REPLACE FUNCTION resend_brokerage_invitation_email(p_invitation_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_invitation record;
  v_inviter_name text;
  v_company_name text;
  v_site_url text;
BEGIN
  -- Get the invitation
  SELECT * INTO v_invitation
  FROM brokerage_invitations
  WHERE id = p_invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF v_invitation.status != 'pending' THEN
    RAISE EXCEPTION 'Can only resend pending invitations';
  END IF;

  -- Get inviter name from profiles
  SELECT COALESCE(p.full_name, au.email)
  INTO v_inviter_name
  FROM auth.users au
  LEFT JOIN profiles p ON p.id = au.id
  WHERE au.id = v_invitation.inviter_id;

  -- Get company name from brokerages
  SELECT company_name
  INTO v_company_name
  FROM brokerages
  WHERE id = v_invitation.brokerage_id;

  -- Get site URL from app_settings
  SELECT value INTO v_site_url
  FROM app_settings
  WHERE key = 'SITE_URL';

  -- Call the edge function to send the invitation email
  PERFORM
    net.http_post(
      url := 'https://rfdaepolwygosvwunhnk.supabase.co/functions/v1/send-brokerage-invitation-email',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'invitation_id', v_invitation.id,
        'invitee_email', v_invitation.invitee_email,
        'invitee_name', v_invitation.invitee_name,
        'inviter_name', v_inviter_name,
        'company_name', v_company_name,
        'site_url', COALESCE(v_site_url, 'http://localhost:5173')
      )
    );

  RETURN true;
END;
$$;
