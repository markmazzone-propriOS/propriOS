/*
  # Update Ticket Status Change Notification for Guest Emails

  1. Changes
    - Updates the send_ticket_status_change_notification function to use the email column for guest tickets
    - Now supports both authenticated and guest user notifications
*/

-- Update function to send ticket status change notification
CREATE OR REPLACE FUNCTION send_ticket_status_change_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email_value TEXT;
  site_url TEXT;
BEGIN
  -- Only proceed if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
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

    -- Send notification via edge function if we have an email
    IF user_email_value IS NOT NULL AND user_email_value != '' THEN
      PERFORM
        net.http_post(
          url := site_url || '/functions/v1/send-ticket-status-change-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'ticket_id', NEW.id,
            'subject', NEW.subject,
            'old_status', OLD.status,
            'new_status', NEW.status,
            'user_email', user_email_value,
            'updated_at', NEW.updated_at
          )
        );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
