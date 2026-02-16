/*
  # Create Welcome Email Trigger for New Agents

  1. New Function
    - `send_agent_welcome_email()` - Postgres function that calls edge function

  2. Trigger
    - Fires after insert on agent_profiles table
    - Calls edge function to send welcome email
    - Runs asynchronously to not block agent creation

  3. Notes
    - Uses pg_net extension for HTTP requests
    - Sends agent details to edge function
    - Non-blocking operation
*/

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to send welcome email via edge function
CREATE OR REPLACE FUNCTION send_agent_welcome_email()
RETURNS TRIGGER AS $$
DECLARE
  agent_email text;
  agent_name text;
  request_id bigint;
  edge_function_url text;
BEGIN
  -- Get agent email and name from profiles table
  SELECT p.email, p.full_name
  INTO agent_email, agent_name
  FROM auth.users u
  JOIN profiles p ON p.id = u.id
  WHERE p.id = NEW.id;

  -- Get the edge function URL from environment
  edge_function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-welcome-email';

  -- If we can't get the URL from settings, construct it
  IF edge_function_url IS NULL OR edge_function_url = '/functions/v1/send-welcome-email' THEN
    edge_function_url := 'https://' || current_setting('app.settings.project_ref', true) || '.supabase.co/functions/v1/send-welcome-email';
  END IF;

  -- Make async HTTP request to edge function
  SELECT net.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'email', agent_email,
      'full_name', agent_name,
      'license_number', NEW.license_number
    ),
    timeout_milliseconds := 5000
  ) INTO request_id;

  -- Log the request (optional, for debugging)
  RAISE LOG 'Welcome email triggered for agent: % (request_id: %)', agent_name, request_id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Failed to send welcome email for agent %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on agent_profiles
DROP TRIGGER IF EXISTS trigger_send_agent_welcome_email ON agent_profiles;

CREATE TRIGGER trigger_send_agent_welcome_email
  AFTER INSERT ON agent_profiles
  FOR EACH ROW
  EXECUTE FUNCTION send_agent_welcome_email();
