/*
  # Add Ticket Response Notification Trigger

  ## Overview
  Automatically sends email notifications when responses are added to support tickets.
  Both users and admins are notified when the other party responds.

  ## Changes
  1. New Function
    - `notify_ticket_response()` - Sends HTTP request to edge function when new response is added
    - Only sends notifications for non-internal notes
    - Determines recipient based on whether responder is admin or user

  2. New Trigger
    - `send_ticket_response_notification` - Fires after response insertion
    - Calls the edge function to send email notification

  ## Behavior
  - When admin responds to user ticket: User receives email notification
  - When user responds to their ticket: Admin receives email notification
  - Internal notes (admin-only) do not trigger notifications
  - Email includes ticket ID, subject, responder info, and message content
*/

-- Create function to send ticket response notification
CREATE OR REPLACE FUNCTION notify_ticket_response()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_responder_email text;
  v_function_url text;
  v_response jsonb;
BEGIN
  -- Skip internal notes
  IF NEW.is_internal_note = true THEN
    RETURN NEW;
  END IF;

  -- Get responder email
  SELECT email INTO v_responder_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Get the edge function URL
  v_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-ticket-response-notification';
  
  -- If setting doesn't exist, construct from SUPABASE_URL env var
  IF v_function_url IS NULL OR v_function_url = '' THEN
    v_function_url := 'https://' || current_setting('request.headers', true)::json->>'host' || '/functions/v1/send-ticket-response-notification';
  END IF;

  -- Send notification via edge function
  BEGIN
    SELECT content::jsonb INTO v_response
    FROM http((
      'POST',
      v_function_url,
      ARRAY[
        http_header('Content-Type', 'application/json'),
        http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))
      ],
      'application/json',
      json_build_object(
        'response_id', NEW.id,
        'ticket_id', NEW.ticket_id,
        'message', NEW.message,
        'is_internal_note', NEW.is_internal_note,
        'responder_email', v_responder_email,
        'created_at', NEW.created_at
      )::text
    )::http_request);
    
    RAISE NOTICE 'Ticket response notification sent: %', v_response;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to send ticket response notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Create trigger for ticket response notifications
DROP TRIGGER IF EXISTS send_ticket_response_notification ON support_ticket_responses;

CREATE TRIGGER send_ticket_response_notification
  AFTER INSERT ON support_ticket_responses
  FOR EACH ROW
  EXECUTE FUNCTION notify_ticket_response();
