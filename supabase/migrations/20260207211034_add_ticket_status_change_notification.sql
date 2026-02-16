/*
  # Add Ticket Status Change Email Notification

  1. Changes
    - Creates a trigger function to send email notifications when a support ticket's status changes
    - Sets up an UPDATE trigger on the support_tickets table
    - Sends branded email with timestamp to the ticket submitter when status changes

  2. Security
    - Function uses SECURITY DEFINER to allow HTTP calls
    - Only triggers on actual status changes (old status ≠ new status)
*/

-- Create function to send ticket status change notification
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
      SELECT email INTO user_email_value
      FROM auth.users
      WHERE id = NEW.user_id;
    ELSE
      -- For guest tickets, we'll need to add an email field
      -- For now, skip notification for tickets without user_id
      RETURN NEW;
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

    -- Send notification via edge function
    IF user_email_value IS NOT NULL THEN
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

-- Create trigger for ticket status changes
DROP TRIGGER IF EXISTS ticket_status_change_notification_trigger ON support_tickets;
CREATE TRIGGER ticket_status_change_notification_trigger
  AFTER UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION send_ticket_status_change_notification();
