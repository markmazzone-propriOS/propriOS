/*
  # Fix Ticket Confirmation Trigger URL

  1. Changes
    - Updates the trigger to use SUPABASE_URL for calling edge functions
    - Keeps SITE_URL for the email link only
    
  2. Security
    - Function uses SECURITY DEFINER to allow HTTP calls
*/

-- Update function to use correct URL for edge function calls
CREATE OR REPLACE FUNCTION send_ticket_confirmation_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email_value TEXT;
  supabase_url TEXT;
BEGIN
  -- Get user email
  IF NEW.user_id IS NOT NULL THEN
    -- Authenticated user - get email from auth.users
    SELECT email INTO user_email_value
    FROM auth.users
    WHERE id = NEW.user_id;
  ELSE
    -- Guest user - use email from support_tickets table
    user_email_value := NEW.email;
  END IF;

  -- Use the Supabase project URL for edge function calls
  supabase_url := 'https://rfdaepolwygosvwunhnk.supabase.co';

  -- Send confirmation email via edge function if we have an email
  IF user_email_value IS NOT NULL AND user_email_value != '' THEN
    PERFORM
      net.http_post(
        url := supabase_url || '/functions/v1/send-ticket-confirmation',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'ticket_id', NEW.id,
          'subject', NEW.subject,
          'description', NEW.description,
          'priority', NEW.priority,
          'category', NEW.category,
          'user_email', user_email_value,
          'created_at', NEW.created_at,
          'reply_token', NEW.reply_token
        )
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
