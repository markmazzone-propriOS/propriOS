/*
  # Add Ticket Submission Confirmation Email

  1. Changes
    - Creates a trigger function to send confirmation email when a support ticket is created
    - Sets up an INSERT trigger on the support_tickets table
    - Sends branded confirmation email with timestamp to the ticket submitter

  2. Security
    - Function uses SECURITY DEFINER to allow HTTP calls
    - Only triggers on INSERT operations
*/

-- Create function to send ticket confirmation email
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
          'created_at', NEW.created_at
        )
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ticket submission confirmation
DROP TRIGGER IF EXISTS ticket_confirmation_trigger ON support_tickets;
CREATE TRIGGER ticket_confirmation_trigger
  AFTER INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION send_ticket_confirmation_email();
