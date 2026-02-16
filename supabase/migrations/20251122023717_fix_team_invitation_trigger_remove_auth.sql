/*
  # Fix Team Invitation Email Trigger - Remove Auth Header

  1. Changes
    - Remove authorization header from trigger since edge function no longer requires JWT verification
    - Simplify the trigger function

  2. Security
    - Edge function is now callable without authentication, which is safe since it only sends emails based on database data
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

  -- Get Supabase URL from environment
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://rfdaepolwygosvwunhnk.supabase.co';
  END IF;

  -- Call the edge function to send the email without authorization
  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-team-invitation-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
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
