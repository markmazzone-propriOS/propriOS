/*
  # Fix Ticket Response Notification URL

  ## Overview
  Updates the ticket response notification trigger to properly construct the edge function URL.

  ## Changes
  - Uses SUPABASE_URL environment variable correctly
  - Simplifies URL construction logic
*/

-- Update function to send ticket response notification with proper URL handling
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
  v_supabase_url text;
BEGIN
  -- Skip internal notes
  IF NEW.is_internal_note = true THEN
    RETURN NEW;
  END IF;

  -- Get responder email
  SELECT email INTO v_responder_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Construct edge function URL
  v_supabase_url := COALESCE(
    current_setting('app.settings.supabase_url', true),
    'https://' || split_part(current_setting('request.headers', true)::json->>'host', ':', 1)
  );
  
  v_function_url := v_supabase_url || '/functions/v1/send-ticket-response-notification';

  -- Send notification via edge function
  BEGIN
    SELECT content::jsonb INTO v_response
    FROM http((
      'POST',
      v_function_url,
      ARRAY[http_header('Content-Type', 'application/json')],
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
