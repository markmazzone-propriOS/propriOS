/*
  # Fix Team Invitation Email Trigger Authentication

  1. Changes
    - Update the trigger to include proper authorization headers when calling the edge function
    - Add the service role key to bypass JWT verification

  2. Security
    - Uses service role key for internal trigger-to-edge-function communication
*/

CREATE OR REPLACE FUNCTION notify_team_invitation_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inviter_name text;
  v_team_name text;
  v_team_description text;
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  -- Only send email for pending invitations
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Get inviter name
  SELECT full_name INTO v_inviter_name
  FROM profiles
  WHERE id = NEW.inviter_id;

  -- Get team details
  SELECT name, description INTO v_team_name, v_team_description
  FROM teams
  WHERE id = NEW.team_id;

  -- Get Supabase URL and service role key from environment
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://rfdaepolwygosvwunhnk.supabase.co';
  END IF;

  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- Call the edge function to send the email with authorization
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-team-invitation-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_role_key, '')
    ),
    body := jsonb_build_object(
      'inviteeEmail', NEW.invitee_email,
      'inviteeName', NEW.invitee_name,
      'inviterName', COALESCE(v_inviter_name, 'A team member'),
      'teamName', COALESCE(v_team_name, 'a team'),
      'teamDescription', v_team_description,
      'appUrl', 'https://bolt.new/~/sb1-gmtxjbe6'
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the invitation creation
    RAISE WARNING 'Failed to send team invitation email: %', SQLERRM;
    RETURN NEW;
END;
$$;
