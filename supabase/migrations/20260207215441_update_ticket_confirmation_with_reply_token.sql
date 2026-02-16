/*
  # Update Ticket Confirmation Email with Reply Token

  ## Overview
  Updates the ticket confirmation email trigger to include the reply_token,
  allowing users to click directly to view and reply to their ticket.

  ## Changes
  - Updates send_ticket_confirmation_email() function to pass reply_token to edge function
*/

-- Update function to send ticket confirmation email with reply token
CREATE OR REPLACE FUNCTION send_ticket_confirmation_email()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email_value TEXT;
  site_url TEXT;
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

  -- Get site URL from app_settings
  SELECT value INTO site_url
  FROM app_settings
  WHERE key = 'site_url'
  LIMIT 1;

  -- Default to environment variable if not in settings
  IF site_url IS NULL OR site_url = '' THEN
    site_url := current_setting('app.settings.site_url', true);
  END IF;

  -- Send confirmation email via edge function if we have an email
  IF user_email_value IS NOT NULL AND user_email_value != '' THEN
    PERFORM
      net.http_post(
        url := site_url || '/functions/v1/send-ticket-confirmation',
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
