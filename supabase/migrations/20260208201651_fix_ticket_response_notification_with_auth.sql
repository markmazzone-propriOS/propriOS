/*
  # Fix Ticket Response Notification with Proper Authentication

  ## Overview
  Fixes the ticket response notification trigger to properly authenticate with the edge function
  using the service role key from vault secrets.

  ## Issue
  The current trigger was calling the edge function without authentication headers,
  causing the email notifications to fail silently.

  ## Changes
  - Update `notify_ticket_response()` function to use `net.http_post`
  - Add Authorization header with service role key from vault
  - Use SUPABASE_URL from vault.decrypted_secrets
  - Follows the same pattern as other working notification triggers

  ## Result
  When support team responds to tickets, users will receive email notifications.
*/

-- Update function to send ticket response notification with proper authentication
CREATE OR REPLACE FUNCTION notify_ticket_response()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_responder_email text;
  v_response RECORD;
BEGIN
  -- Skip internal notes
  IF NEW.is_internal_note = true THEN
    RETURN NEW;
  END IF;

  -- Get responder email
  SELECT email INTO v_responder_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Send notification via edge function with proper authentication
  BEGIN
    SELECT 
      net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/send-ticket-response-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
        ),
        body := jsonb_build_object(
          'response_id', NEW.id,
          'ticket_id', NEW.ticket_id,
          'message', NEW.message,
          'is_internal_note', NEW.is_internal_note,
          'responder_email', v_responder_email,
          'created_at', NEW.created_at
        )
      ) INTO v_response;
    
    RAISE NOTICE 'Ticket response notification sent successfully';
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send ticket response notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
