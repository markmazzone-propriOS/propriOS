/*
  # Add support ticket email notification

  1. New Functions
    - `notify_admin_new_support_ticket()` - Trigger function to send email when new ticket is created
    - Uses edge function to send branded email notification to admin
    - Extracts user email from ticket or description for guest tickets

  2. Changes
    - Creates trigger on support_tickets table for INSERT operations
    - Calls edge function with ticket details
*/

-- Function to notify admin of new support ticket
CREATE OR REPLACE FUNCTION notify_admin_new_support_ticket()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email_value text;
  edge_function_url text;
BEGIN
  -- Get the edge function URL from environment
  edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-support-ticket-notification';
  
  -- If we don't have the URL from settings, try to construct it
  IF edge_function_url IS NULL OR edge_function_url = '' THEN
    edge_function_url := 'https://lqtkutqflmmhkajmjlvt.supabase.co/functions/v1/send-support-ticket-notification';
  END IF;

  -- Get user email
  IF NEW.user_id IS NOT NULL THEN
    -- Get email from auth.users for authenticated users
    SELECT email INTO user_email_value
    FROM auth.users
    WHERE id = NEW.user_id;
  ELSE
    -- Extract email from description for guest tickets
    user_email_value := (regexp_matches(NEW.description, 'Email: ([^\n]+)'))[1];
    IF user_email_value IS NULL THEN
      user_email_value := 'Guest User';
    END IF;
  END IF;

  -- Call edge function to send email
  PERFORM net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.supabase_anon_key', true)
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

  RETURN NEW;
END;
$$;

-- Create trigger for new support tickets
DROP TRIGGER IF EXISTS on_support_ticket_created ON support_tickets;
CREATE TRIGGER on_support_ticket_created
  AFTER INSERT ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION notify_admin_new_support_ticket();
