/*
  # Add Team Invitation Email Trigger
  
  1. Purpose
    - Automatically send an email notification when a team invitation is created
    - Email includes team details and instructions for accepting the invitation
    
  2. Changes
    - Create trigger function to call the send-team-invitation-email edge function
    - Add trigger on team_invitations INSERT
    
  3. Security
    - Function runs with SECURITY DEFINER to access required data
    - Only triggers for new pending invitations
*/

-- Create function to send team invitation email
CREATE OR REPLACE FUNCTION notify_team_invitation_created()
RETURNS TRIGGER AS $$
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

  -- Call the edge function to send the email
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_notify_team_invitation_created ON team_invitations;
CREATE TRIGGER trigger_notify_team_invitation_created
  AFTER INSERT ON team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION notify_team_invitation_created();
