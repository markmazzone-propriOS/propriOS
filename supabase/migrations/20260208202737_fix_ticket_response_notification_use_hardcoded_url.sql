/*
  # Fix Ticket Response Notification - Use Hardcoded URL

  ## Issue
  The trigger was trying to use vault.decrypted_secrets which are not configured,
  causing the notification to fail silently.

  ## Solution
  - Use hardcoded Supabase URL like other working triggers
  - Remove Authorization header since the edge function has verify_jwt: false
  - Follows the same pattern as send_ticket_confirmation_email()

  ## Result
  Ticket response notifications will now be sent successfully.
*/

CREATE OR REPLACE FUNCTION notify_ticket_response()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_responder_email text;
  supabase_url TEXT;
BEGIN
  -- Skip internal notes
  IF NEW.is_internal_note = true THEN
    RETURN NEW;
  END IF;

  -- Get responder email
  SELECT email INTO v_responder_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Use the Supabase project URL for edge function calls
  supabase_url := 'https://rfdaepolwygosvwunhnk.supabase.co';

  -- Send notification via edge function
  IF v_responder_email IS NOT NULL THEN
    PERFORM
      net.http_post(
        url := supabase_url || '/functions/v1/send-ticket-response-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'response_id', NEW.id,
          'ticket_id', NEW.ticket_id,
          'message', NEW.message,
          'is_internal_note', NEW.is_internal_note,
          'responder_email', v_responder_email,
          'created_at', NEW.created_at
        )
      );
  END IF;

  RETURN NEW;
END;
$$;
